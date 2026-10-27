from __future__ import annotations

import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from . import advisor, engine, store, weather  # noqa: E402
from .agronomy import CROPS  # noqa: E402
from .schemas import AdviceRequest, SimulationInput  # noqa: E402

app = FastAPI(title="AgriTwin API", version="1.0.0",
              description="Precision Agriculture Digital Twin — crop simulation & decision support")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "gemini": bool(os.getenv("GEMINI_API_KEY")), "storage": store.backend_name()}


@app.get("/api/meta")
def meta():
    m = engine.metrics()
    return {
        "crops": [{"name": k, "key": v["key"], "hindi": v["hindi"], "temp": v["temp"], "rain": v["rain"]}
                  for k, v in CROPS.items()],
        "countries": m["yield"]["countries"],
        "defaults": m["yield"]["india_defaults"],
        "metrics": {
            "recommendation": {"chosen": m["recommendation"]["chosen"], "results": m["recommendation"]["results"],
                               "test_size": m["recommendation"]["test_size"]},
            "yield": {"chosen": m["yield"]["chosen"], "results": m["yield"]["results"],
                      "test_size": m["yield"]["test_size"]},
        },
    }


@app.get("/api/geocode")
async def geocode(q: str = Query(..., min_length=2)):
    try:
        return await weather.geocode(q)
    except Exception as e:
        raise HTTPException(502, f"Geocoding unavailable: {e}")


@app.get("/api/weather")
async def live_weather(lat: float, lon: float):
    try:
        return await weather.live(lat, lon)
    except Exception as e:
        raise HTTPException(502, f"Weather service unavailable: {e}")


@app.post("/api/simulate")
def simulate(inp: SimulationInput, save: bool = True):
    """save=false is used for live previews while the user drags sliders."""
    result = engine.simulate(inp)
    result["id"] = store.save(inp.model_dump(), result) if save else uuid.uuid4().hex
    return result


@app.post("/api/advice")
def advice(req: AdviceRequest):
    return advisor.advise(req.inputs, req.result, req.lang)


@app.get("/api/history")
def history(limit: int = 20):
    return store.history(limit)
