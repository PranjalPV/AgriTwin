# AgriTwin — Planner

## Build phases

| # | Phase | Output |
|---|---|---|
| 1 | Data | Both Kaggle datasets verified and bundled in `data/` |
| 2 | ML | `ml/train.py` → models + `metrics.json` (all compared models, for the report's results table) |
| 3 | Backend | FastAPI: simulate, weather, disease risk, Gemini advice, history |
| 4 | Frontend | Dashboard, inputs, result cards, scenario A/B compare, history |
| 5 | 3D Twin | Procedural farm scene driven by twin state + growth timeline |
| 6 | QA | End-to-end run, screenshots for the report |

## Your part (2 days)

| Who | Task |
|---|---|
| Both | Get a Gemini API key (aistudio.google.com) → `backend/.env`. Run the project locally (README). |
| Prasoon | Own the backend + ML for the viva: read `ml/train.py`, `backend/app/*`. Be able to explain RF vs DT choice using `metrics.json`. |
| Pranjal | Own frontend + 3D for the viva: read `frontend/components/twin/*`. Be able to explain instancing, the wind shader, and how health maps to colour. |
| Both | Update the report: slide 9 features (see ARCHITECTURE §1), slide 12 numbers from `metrics.json`, add screenshots, add the four new features below. |
| Optional | Create a Supabase project, run `backend/supabase_schema.sql`, add keys to `.env` (otherwise SQLite is used). |

## Added beyond the report

1. Live weather autofill (Open-Meteo) — removes the "manual input only" limitation.
2. Disease-risk engine per crop (rice blast, wheat rust, potato late blight, etc.).
3. Growth-stage timeline in the 3D twin (sowing → harvest).
4. Scenario A/B comparison with side-by-side twins.
5. Hindi / English AI advice.
6. Feature-importance "why this crop" chart.

## Status (26 Oct 2026)
All six build phases are done. Production build passes; end-to-end flow (simulate → pin A/B → compare → history → models) tested.

## Report changes needed
- **Slide 9 (yield inputs):** Crop type, Country, Year, Annual rainfall, Avg temperature, Pesticide use.
- **Slide 12 (results):** Random Forest 99.55% accuracy; Decision Tree **R² 97.9%** (not 96%). Full comparison tables are in backend/models/metrics.json.
- **Slide 7:** add Open-Meteo (live weather) and the disease-risk engine as components.
- **Slide 13 (limitations):** "No live weather feed" is now solved; keep IoT sensors as future scope.
- Add screenshots: wheat twin, dry maize, rice paddy, compare view.
