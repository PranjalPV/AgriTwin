import { DEMO_NORMALS, local } from "./localEngine";

const rawApi = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim().replace(/\/+$/, "");
export const API = rawApi.startsWith("http://") || rawApi.startsWith("https://")
  ? rawApi
  : `https://${rawApi}`;
/** Hosted demo build: models run in the browser, no backend needed. */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export type Inputs = {
  N: number; P: number; K: number; ph: number;
  temperature: number; humidity: number; season_rainfall: number; annual_rainfall: number;
  crop: string; country: string; year: number; pesticides: number; label?: string | null;
};

export type Twin = {
  crop_key: string; health: number; vigor: number; climate_fit: number; temp_fit: number; rain_fit: number;
  moisture: number; water: "dry" | "optimal" | "waterlogged"; disease: number; paddy: boolean;
  temperature: number; humidity: number; rain_intensity: number;
  optimal: { temp: [number, number]; rain: [number, number] };
};

export type Result = {
  id: string;
  crop_hi: string;
  recommendation: {
    crop: string; crop_hi: string; confidence: number;
    top: { crop: string; crop_hi: string; p: number }[];
    importance: Record<string, number>;
    ideal: Record<string, number> | null;
    selected_crop_suitability: number | null;
  };
  yield: { hg_per_ha: number; t_per_ha: number; benchmark_t_per_ha: number; ratio: number };
  disease: { score: number; level: "Low" | "Moderate" | "High"; threats: { name: string; score: number; why: string; window: string }[] };
  twin: Twin;
};

export type Advice = {
  source: "gemini" | "rules"; error?: string;
  summary: string; irrigation: string[]; fertilizer: string[]; disease: string[]; practices: string[];
};

export type Meta = {
  crops: { name: string; key: string; hindi: string; temp: [number, number]; rain: [number, number] }[];
  countries: string[];
  defaults: { pesticides: number; annual_rainfall: number; year: number };
  metrics: {
    recommendation: { chosen: string; test_size: number; results: { model: string; accuracy: number; precision: number; recall: number; f1: number }[] };
    yield: { chosen: string; test_size: number; results: { model: string; r2: number; mae: number; rmse: number }[] };
  };
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
    throw new Error(msg);
  }
  return r.json();
}

const server = {
  health: () => req<{ status: string; gemini: boolean; storage: string }>("/api/health"),
  meta: () => req<Meta>("/api/meta"),
  geocode: (q: string) => req<{ name: string; admin?: string; country?: string; lat: number; lon: number }[]>(`/api/geocode?q=${encodeURIComponent(q)}`),
  weather: (lat: number, lon: number) =>
    req<{ current: Record<string, number>; suggested: Pick<Inputs, "temperature" | "humidity" | "season_rainfall" | "annual_rainfall"> }>(
      `/api/weather?lat=${lat}&lon=${lon}`),
  simulate: (i: Inputs, save = true) => req<Result>(`/api/simulate?save=${save}`, { method: "POST", body: JSON.stringify(i) }),
  advice: (inputs: Inputs, result: Result, lang: "en" | "hi") =>
    req<Advice>("/api/advice", { method: "POST", body: JSON.stringify({ inputs, result, lang }) }),
  history: () => req<{ id: string; created_at: string; inputs: Inputs; outputs: Result }[]>("/api/history"),
};

const demo: typeof server = {
  health: async () => ({ status: "ok", gemini: false, storage: "browser" }),
  meta: () => local.meta(),
  geocode: async () => { throw new Error("Place search needs the full app (live Open-Meteo). Use a city button."); },
  weather: async (lat: number, lon: number) => {
    const p = PRESETS.find((x) => x.lat === lat && x.lon === lon);
    if (!p) throw new Error("Live weather needs the full app.");
    const n = DEMO_NORMALS[p.name];
    return { current: { temperature: n.temperature, humidity: n.humidity }, suggested: n };
  },
  simulate: (i: Inputs, save = true) => local.simulate(i, save),
  advice: (i: Inputs, r: Result, l: "en" | "hi") => local.advice(i, r, l),
  history: () => local.history(),
};

export const api = DEMO ? demo : server;

export const DEFAULT_INPUTS: Inputs = {
  N: 80, P: 45, K: 40, ph: 7.2, temperature: 21, humidity: 62, season_rainfall: 110, annual_rainfall: 780,
  crop: "Wheat", country: "India", year: 2013, pesticides: 42000,
};

export const PRESETS = [
  { name: "Lucknow", lat: 26.85, lon: 80.95 },
  { name: "Gorakhpur", lat: 26.76, lon: 83.37 },
  { name: "Prayagraj", lat: 25.44, lon: 81.85 },
  { name: "Varanasi", lat: 25.32, lon: 82.97 },
  { name: "Kanpur", lat: 26.45, lon: 80.33 },
];

export const pct = (x: number) => `${Math.round(x * 100)}%`;
