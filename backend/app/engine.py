"""Core simulation: ML predictions + disease risk + digital-twin state."""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from .agronomy import CROPS, DISEASES, REC_HINDI, YIELD_TO_REC
from .schemas import SimulationInput

MODELS = Path(__file__).resolve().parents[1] / "models"
REC_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]


@lru_cache
def _load():
    return {
        "rec": joblib.load(MODELS / "crop_recommender.joblib"),
        "yield": joblib.load(MODELS / "yield_predictor.joblib"),
        "metrics": json.loads((MODELS / "metrics.json").read_text()),
        "profiles": json.loads((MODELS / "profiles.json").read_text()),
    }


def metrics() -> dict:
    return _load()["metrics"]


def clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


# ---------------------------------------------------------------- ML
def recommend(inp: SimulationInput) -> dict:
    m = _load()
    model = m["rec"]
    row = pd.DataFrame([[inp.N, inp.P, inp.K, inp.temperature, inp.humidity, inp.ph, inp.season_rainfall]],
                       columns=REC_FEATURES)
    proba = model.predict_proba(row)[0]
    classes = model.classes_
    ranked = sorted(zip(classes, proba), key=lambda t: -t[1])[:5]
    chosen_label = YIELD_TO_REC.get(inp.crop)
    chosen_prob = float(proba[list(classes).index(chosen_label)]) if chosen_label else None
    return {
        "crop": ranked[0][0],
        "crop_hi": REC_HINDI.get(ranked[0][0], ranked[0][0]),
        "confidence": round(float(ranked[0][1]), 4),
        "top": [{"crop": c, "crop_hi": REC_HINDI.get(c, c), "p": round(float(p), 4)} for c, p in ranked],
        "importance": m["metrics"]["recommendation"]["importance"],
        "ideal": m["metrics"]["recommendation"]["ideals"].get(ranked[0][0]),
        "selected_crop_suitability": None if chosen_prob is None else round(chosen_prob, 4),
    }


def predict_yield(inp: SimulationInput) -> dict:
    m = _load()
    row = pd.DataFrame([{
        "Item": inp.crop, "Area": inp.country, "Year": inp.year,
        "average_rain_fall_mm_per_year": inp.annual_rainfall,
        "pesticides_tonnes": inp.pesticides, "avg_temp": inp.temperature,
    }])
    hg = float(m["yield"].predict(row)[0])
    bench = m["profiles"][inp.crop]["india_median_hg"]
    return {
        "hg_per_ha": round(hg, 1),
        "t_per_ha": round(hg / 10000, 2),
        "benchmark_t_per_ha": round(bench / 10000, 2),
        "ratio": round(hg / bench, 3) if bench else None,
    }


# ---------------------------------------------------------------- rules
def _band(x: float, lo: float, hi: float, soft: float) -> float:
    """1 inside [lo, hi], linear fall-off to 0 over `soft` units outside."""
    if lo <= x <= hi:
        return 1.0
    d = lo - x if x < lo else x - hi
    return clip(1 - d / soft)


def disease_risk(inp: SimulationInput) -> dict:
    key = CROPS[inp.crop]["key"]
    threats = []
    for name, tlo, thi, hmin, needs_rain, note in DISEASES.get(key, []):
        t = _band(inp.temperature, tlo, thi, 4)
        h = clip((inp.humidity - (hmin - 15)) / 30)
        r = clip(inp.season_rainfall / 150, 0.35, 1.0) if needs_rain else 1.0
        n = 1.12 if inp.N > 110 else 1.0  # lush, N-heavy canopy is more susceptible
        s = clip(0.9 * t * h * r * n)  # rules never claim certainty
        threats.append({"name": name, "score": round(s, 3), "why": note,
                        "window": f"{tlo}-{thi}°C, RH ≥ {hmin}%" + (", rain" if needs_rain else "")})
    threats.sort(key=lambda d: -d["score"])
    score = threats[0]["score"] if threats else 0.0
    level = "Low" if score < 0.3 else "Moderate" if score < 0.6 else "High"
    return {"score": score, "level": level, "threats": threats}


def twin_state(inp: SimulationInput, yld: dict, dis: dict) -> dict:
    c = CROPS[inp.crop]
    tlo, thi = c["temp"]
    rlo, rhi = c["rain"]

    # climate fit
    dt = max(tlo - inp.temperature, 0, inp.temperature - thi)
    fit_t = math.exp(-((dt / 4.5) ** 2))
    r = inp.annual_rainfall
    dr = (rlo - r) / rlo if r < rlo else (r - rhi) / rhi if r > rhi else 0
    fit_r = math.exp(-((dr / 0.4) ** 2))
    fit = 0.55 * fit_t + 0.45 * fit_r

    # water
    is_rice = c["key"] == "rice"
    moisture = clip(0.65 * (r / (rhi * 1.05)) + 0.35 * (inp.season_rainfall / 260), 0.05, 1.0)
    if r < rlo * 0.8:
        water = "dry"
    elif r > rhi * (1.6 if is_rice else 1.25):
        water = "waterlogged"
    else:
        water = "optimal"

    y_score = clip((yld["ratio"] or 1) / 1.25)
    health = clip(0.45 * y_score + 0.30 * fit + 0.25 * (1 - dis["score"]))
    if water != "optimal":
        health *= 0.85

    return {
        "crop_key": c["key"],
        "health": round(health, 3),
        "vigor": round(y_score, 3),
        "climate_fit": round(fit, 3),
        "temp_fit": round(fit_t, 3),
        "rain_fit": round(fit_r, 3),
        "moisture": round(moisture, 3),
        "water": water,
        "disease": dis["score"],
        "paddy": is_rice,
        "temperature": inp.temperature,
        "humidity": inp.humidity,
        "rain_intensity": round(clip((inp.season_rainfall - 140) / 180), 3),
        "optimal": {"temp": [tlo, thi], "rain": [rlo, rhi]},
    }


def simulate(inp: SimulationInput) -> dict:
    rec = recommend(inp)
    yld = predict_yield(inp)
    dis = disease_risk(inp)
    tw = twin_state(inp, yld, dis)
    return {"recommendation": rec, "yield": yld, "disease": dis, "twin": tw,
            "crop_hi": CROPS[inp.crop]["hindi"]}
