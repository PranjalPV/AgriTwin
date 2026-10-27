from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .agronomy import CROPS


class SimulationInput(BaseModel):
    # soil (recommendation dataset scale)
    N: float = Field(90, ge=0, le=200, description="Nitrogen ratio in soil")
    P: float = Field(42, ge=0, le=200, description="Phosphorus ratio in soil")
    K: float = Field(43, ge=0, le=250, description="Potassium ratio in soil")
    ph: float = Field(6.5, ge=3, le=10)
    # weather
    temperature: float = Field(24, ge=-5, le=50, description="°C")
    humidity: float = Field(70, ge=0, le=100, description="% RH")
    season_rainfall: float = Field(150, ge=0, le=500, description="mm in the growing season (last ~90 days)")
    annual_rainfall: float = Field(1083, ge=0, le=4000, description="mm per year")
    # yield model context
    crop: str = "Wheat"
    country: str = "India"
    year: int = Field(2013, ge=1990, le=2035)
    pesticides: float = Field(42000, ge=0, description="national pesticide use, tonnes")
    label: str | None = Field(None, max_length=60)

    @field_validator("crop")
    @classmethod
    def known_crop(cls, v: str) -> str:
        if v not in CROPS:
            raise ValueError(f"crop must be one of {list(CROPS)}")
        return v


class AdviceRequest(BaseModel):
    inputs: SimulationInput
    result: dict
    lang: Literal["en", "hi"] = "en"
