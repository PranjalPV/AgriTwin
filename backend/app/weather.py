"""Live weather from Open-Meteo (free, no API key), with caching and rate-limit fallback."""
from __future__ import annotations

import time
from datetime import date, timedelta

import httpx

FORECAST = "https://api.open-meteo.com/v1/forecast"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"

# In-memory cache to prevent hitting Open-Meteo repeatedly: (lat, lon) -> (timestamp, data)
_CACHE: dict[tuple[float, float], tuple[float, dict]] = {}
_CACHE_TTL = 3600  # 1 hour

# Historical climate normals fallback for key regions in case of Open-Meteo 429 rate-limiting
CITY_NORMALS = {
    (26.85, 80.95): {"name": "Lucknow", "temperature": 25.5, "humidity": 66, "season_rainfall": 180.0, "annual_rainfall": 1000.0},
    (26.76, 83.37): {"name": "Gorakhpur", "temperature": 25.8, "humidity": 72, "season_rainfall": 240.0, "annual_rainfall": 1250.0},
    (25.44, 81.85): {"name": "Prayagraj", "temperature": 26.4, "humidity": 64, "season_rainfall": 170.0, "annual_rainfall": 1020.0},
    (25.32, 82.97): {"name": "Varanasi", "temperature": 26.2, "humidity": 66, "season_rainfall": 185.0, "annual_rainfall": 1080.0},
    (26.45, 80.33): {"name": "Kanpur", "temperature": 26.0, "humidity": 62, "season_rainfall": 150.0, "annual_rainfall": 850.0},
}


def _fallback_weather(lat: float, lon: float) -> dict:
    for (clat, clon), val in CITY_NORMALS.items():
        if abs(lat - clat) < 0.15 and abs(lon - clon) < 0.15:
            return {
                "current": {"temperature": val["temperature"], "humidity": val["humidity"],
                            "precipitation": 0.0, "wind": 8.0, "cloud": 20},
                "suggested": {
                    "temperature": val["temperature"],
                    "humidity": val["humidity"],
                    "season_rainfall": val["season_rainfall"],
                    "annual_rainfall": val["annual_rainfall"],
                },
                "source": "Climate normals (Open-Meteo rate-limited)",
            }
    return {
        "current": {"temperature": 26.0, "humidity": 65, "precipitation": 0.0, "wind": 10.0, "cloud": 25},
        "suggested": {
            "temperature": 25.5,
            "humidity": 65.0,
            "season_rainfall": 180.0,
            "annual_rainfall": 1000.0,
        },
        "source": "Estimated average (Open-Meteo rate-limited)",
    }


async def geocode(q: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(GEOCODE, params={"name": q, "count": 5, "language": "en"})
            r.raise_for_status()
            return [{"name": x["name"], "admin": x.get("admin1"), "country": x.get("country"),
                     "lat": x["latitude"], "lon": x["longitude"]} for x in r.json().get("results", [])]
    except Exception:
        q_lower = q.lower().strip()
        for (clat, clon), val in CITY_NORMALS.items():
            if q_lower in val["name"].lower():
                return [{"name": val["name"], "admin": "Uttar Pradesh", "country": "India", "lat": clat, "lon": clon}]
        return []


async def live(lat: float, lon: float) -> dict:
    key = (round(lat, 2), round(lon, 2))
    now = time.time()
    if key in _CACHE:
        cached_time, cached_data = _CACHE[key]
        if now - cached_time < _CACHE_TTL:
            return cached_data

    today = date.today()
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            f = await c.get(FORECAST, params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover",
                "daily": "precipitation_sum,temperature_2m_mean,relative_humidity_2m_mean",
                "past_days": 90, "forecast_days": 1, "timezone": "auto",
            })
            f.raise_for_status()
            fj = f.json()
            a = await c.get(ARCHIVE, params={
                "latitude": lat, "longitude": lon,
                "start_date": (today - timedelta(days=370)).isoformat(),
                "end_date": (today - timedelta(days=6)).isoformat(),
                "daily": "precipitation_sum", "timezone": "auto",
            })
            a.raise_for_status()
            aj = a.json()

        daily = fj["daily"]
        season_rain = sum(x or 0 for x in daily["precipitation_sum"])
        temps = [x for x in daily["temperature_2m_mean"] if x is not None]
        hums = [x for x in daily["relative_humidity_2m_mean"] if x is not None]
        annual = sum(x or 0 for x in aj["daily"]["precipitation_sum"])
        cur = fj["current"]
        result = {
            "current": {"temperature": cur["temperature_2m"], "humidity": cur["relative_humidity_2m"],
                        "precipitation": cur["precipitation"], "wind": cur["wind_speed_10m"],
                        "cloud": cur["cloud_cover"]},
            "suggested": {
                "temperature": round(sum(temps) / len(temps), 1) if temps else cur["temperature_2m"],
                "humidity": round(sum(hums) / len(hums), 1) if hums else cur["relative_humidity_2m"],
                "season_rainfall": round(season_rain, 1),
                "annual_rainfall": round(annual, 1),
            },
            "source": "Open-Meteo",
        }
        _CACHE[key] = (now, result)
        return result
    except Exception:
        fallback = _fallback_weather(lat, lon)
        _CACHE[key] = (now, fallback)
        return fallback
