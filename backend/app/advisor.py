"""Generative-AI advice via Google Gemini, with a rule-based fallback."""
from __future__ import annotations

import json
import os

from .agronomy import CROPS
from .schemas import SimulationInput

SECTIONS = ["summary", "irrigation", "fertilizer", "disease", "practices"]


def _prompt(inp: SimulationInput, res: dict, lang: str) -> str:
    language = "Hindi (Devanagari script, simple words a farmer understands)" if lang == "hi" else "English"
    return f"""You are an agronomist advising an Indian farmer using a crop digital-twin simulator.
Write in {language}. Be specific and practical, use numbers (mm, kg/ha, days) where useful.

SCENARIO
Crop being simulated: {inp.crop}; Country: {inp.country}
Soil: N={inp.N}, P={inp.P}, K={inp.K}, pH={inp.ph}
Weather: avg temperature {inp.temperature}°C, humidity {inp.humidity}%, season rainfall {inp.season_rainfall} mm, annual rainfall {inp.annual_rainfall} mm

MODEL OUTPUTS
Best crop for this soil/weather (Random Forest): {res['recommendation']['crop']} ({res['recommendation']['confidence']*100:.0f}% confidence)
Predicted yield for {inp.crop}: {res['yield']['t_per_ha']} t/ha (India median {res['yield']['benchmark_t_per_ha']} t/ha)
Disease risk: {res['disease']['level']} — top threats: {', '.join(t['name'] + f" ({t['score']:.2f})" for t in res['disease']['threats'][:3])}
Twin health: {res['twin']['health']*100:.0f}%, water status: {res['twin']['water']}, climate fit {res['twin']['climate_fit']*100:.0f}%

Return ONLY JSON with keys:
"summary": 2-3 sentence plain explanation of the prediction,
"irrigation": list of 3 short bullet strings,
"fertilizer": list of 3 short bullet strings,
"disease": list of 3 short bullet strings,
"practices": list of 3 short bullet strings."""


def _gemini(inp: SimulationInput, res: dict, lang: str) -> dict | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    resp = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=_prompt(inp, res, lang),
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.4),
    )
    data = json.loads(resp.text)
    return {k: data.get(k, [] if k != "summary" else "") for k in SECTIONS}


def _fallback(inp: SimulationInput, res: dict, lang: str) -> dict:
    c = CROPS[inp.crop]
    tw, dis, y = res["twin"], res["disease"], res["yield"]
    rlo, rhi = c["rain"]
    n, p, k = c["npk"]
    irr = {
        "dry": f"Rainfall {inp.annual_rainfall:.0f} mm is below the {rlo}-{rhi} mm the crop needs — plan supplemental irrigation at critical stages.",
        "waterlogged": f"Rainfall {inp.annual_rainfall:.0f} mm exceeds the crop's {rhi} mm upper limit — open drainage channels and avoid irrigation.",
        "optimal": f"Rainfall is within the {rlo}-{rhi} mm range — irrigate only during dry spells longer than 10 days.",
    }[tw["water"]]
    out = {
        "summary": (f"{inp.crop} is predicted to yield {y['t_per_ha']} t/ha versus an India median of "
                    f"{y['benchmark_t_per_ha']} t/ha. Climate fit is {tw['climate_fit']*100:.0f}% and disease risk is "
                    f"{dis['level'].lower()}. For this soil and weather the model's best crop is "
                    f"{res['recommendation']['crop']}."),
        "irrigation": [irr, "Use drip or furrow irrigation in the early morning to cut evaporation losses.",
                       "Check soil moisture at 10 cm depth before each irrigation."],
        "fertilizer": [f"Recommended dose for {inp.crop}: about {n}:{p}:{k} kg/ha N:P:K, split N in 2-3 doses.",
                       "Soil pH " + (f"{inp.ph} is acidic — apply agricultural lime." if inp.ph < 5.8 else
                                     f"{inp.ph} is alkaline — add gypsum and organic matter." if inp.ph > 7.8 else
                                     f"{inp.ph} is in a good range."),
                       "Get a Soil Health Card test before the next season to fine-tune doses."],
        "disease": ([f"{t['name']}: risk {t['score']*100:.0f}% — {t['why']}." for t in dis["threats"][:2]] or
                    ["No major disease window active."]) + ["Scout the field twice a week; act at first symptoms."],
        "practices": ["Use certified seed of a regional variety.",
                      "Keep the field weed-free in the first 30-40 days.",
                      "Record inputs and yield to compare with this simulation next season."],
    }
    if lang == "hi":
        out["summary"] = "(Gemini API key सेट नहीं है — हिंदी सलाह के लिए backend/.env में GEMINI_API_KEY जोड़ें।) " + out["summary"]
    return out


def advise(inp: SimulationInput, res: dict, lang: str = "en") -> dict:
    try:
        g = _gemini(inp, res, lang)
        if g:
            return {"source": "gemini", **g}
    except Exception as e:  # network / quota / parse errors -> fall back
        fb = _fallback(inp, res, lang)
        return {"source": "rules", "error": str(e)[:200], **fb}
    return {"source": "rules", **_fallback(inp, res, lang)}
