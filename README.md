# AgriTwin — Precision Agriculture Digital Twin

AI-driven crop simulation and decision support. Two ML models, a disease-risk engine, Gemini advice, live weather and a full 3D digital twin of an Uttar Pradesh farm.

```
agritwin/
├─ data/                 Kaggle datasets (bundled)
├─ ml/train.py           trains + compares models → backend/models/
├─ backend/              FastAPI API
│  ├─ app/               main, engine (ML + twin), agronomy rules, weather, advisor (Gemini), store
│  ├─ models/            trained .joblib + metrics.json (ready to use)
│  └─ supabase_schema.sql
├─ frontend/             Next.js 14 + Tailwind + React Three Fiber
│  └─ components/twin/   the 3D digital twin
└─ docs/                 ARCHITECTURE.md, PLAN.md
```

## Run it (Windows / macOS / Linux)

Requirements: **Python 3.10+** and **Node.js 18+**.

### 1. Backend (terminal 1)
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env      # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

> The trained models are already in `backend/models/`. Only retrain if you change something: `python ml/train.py` (run from the project root, ~1 min).
> Keep `scikit-learn==1.9.1` (pinned) — the .joblib files are tied to that version. If pip can't install it, just run `python ml/train.py` with whatever version you have.

### 2. Frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

### 3. Gemini (recommended)
Get a free key at https://aistudio.google.com/apikey and put it in `backend/.env`:
```
GEMINI_API_KEY=your_key_here
```
Restart the backend. The header shows **Gemini on**. Without a key the app uses the built-in rule engine for advice (everything else works).

### 4. Supabase (optional)
Create a project → SQL editor → run `backend/supabase_schema.sql` → put `SUPABASE_URL` and `SUPABASE_KEY` (anon key) in `.env`. Without it, history is stored in local SQLite (`backend/agritwin.db`).

## What to demo
1. **My farm** — pick a crop, click a city (Lucknow, Gorakhpur…) to pull live weather. The farm updates instantly; no Run button.
2. Press **Play** on the timeline — the crop grows from sowing to harvest (wheat turns golden).
3. Drag **Rain in a whole year** to 200 mm → cracked dry soil, wilting plants. Push humidity to 95% → disease patches appear.
4. Pick **Rice** → flooded paddy plots with bunds.
5. **Pin as A**, change something, **Pin as B** → **Compare** shows two twins side by side + delta table.
6. Click **Ask AI Farm Advisor** → advice panel; switch to **हिं** for Hindi (needs Gemini key).
7. Model scores for the report are in `backend/models/metrics.json`.

## Model results (from `backend/models/metrics.json`)
| Task | Chosen model | Score |
|---|---|---|
| Crop recommendation (22 crops) | Random Forest | 99.55% accuracy, F1 0.9955 |
| Yield prediction (10 crops, 101 countries) | Decision Tree | R² 0.9788, MAE 3,769 hg/ha |

## Troubleshooting
- **"Backend not reachable"** → backend not running, or not on port 8000. Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if you use another port.
- **Weather buttons fail** → needs internet (Open-Meteo). Sliders still work manually.
- **3D is slow** → integrated GPU on battery. Plug in, or use Chrome with hardware acceleration on.
