"""Live weather from Open-Meteo (free, no API key)."""
from __future__ import annotations

from datetime import date, timedelta

import httpx

FORECAST = "https://api.open-meteo.com/v1/forecast"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"


async def geocode(q: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(GEOCODE, params={"name": q, "count": 5, "language": "en"})
        r.raise_for_status()
        return [{"name": x["name"], "admin": x.get("admin1"), "country": x.get("country"),
                 "lat": x["latitude"], "lon": x["longitude"]} for x in r.json().get("results", [])]


async def live(lat: float, lon: float) -> dict:
    today = date.today()
    async with httpx.AsyncClient(timeout=15) as c:
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
    return {
        "current": {"temperature": cur["temperature_2m"], "humidity": cur["relative_humidity_2m"],
                    "precipitation": cur["precipitation"], "wind": cur["wind_speed_10m"],
                    "cloud": cur["cloud_cover"]},
        # inputs for the models: 90-day averages are more representative than one reading
        "suggested": {
            "temperature": round(sum(temps) / len(temps), 1) if temps else cur["temperature_2m"],
            "humidity": round(sum(hums) / len(hums), 1) if hums else cur["relative_humidity_2m"],
            "season_rainfall": round(season_rain, 1),
            "annual_rainfall": round(annual, 1),
        },
        "source": "Open-Meteo",
    }
