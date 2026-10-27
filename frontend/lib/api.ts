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

/** Directly fetch Open-Meteo from the browser to avoid Render datacenter IP 429 rate limits */
async function clientLiveWeather(lat: number, lon: number) {
  const today = new Date();
  const d370 = new Date(today.getTime() - 370 * 86400000);
  const d6 = new Date(today.getTime() - 6 * 86400000);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover&daily=precipitation_sum,temperature_2m_mean,relative_humidity_2m_mean&past_days=90&forecast_days=1&timezone=auto`;
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(d370)}&end_date=${fmt(d6)}&daily=precipitation_sum&timezone=auto`;

  const [fRes, aRes] = await Promise.all([
    fetch(forecastUrl),
    fetch(archiveUrl),
  ]);

  if (!fRes.ok || !aRes.ok) {
    throw new Error(`Open-Meteo direct status: ${!fRes.ok ? fRes.status : aRes.status}`);
  }

  const [fj, aj] = await Promise.all([fRes.json(), aRes.json()]);

  const daily = fj.daily || {};
  const seasonRain = (daily.precipitation_sum || []).reduce((acc: number, x: number | null) => acc + (x || 0), 0);
  const temps = (daily.temperature_2m_mean || []).filter((x: number | null) => x !== null && x !== undefined);
  const hums = (daily.relative_humidity_2m_mean || []).filter((x: number | null) => x !== null && x !== undefined);
  const annual = (aj.daily?.precipitation_sum || []).reduce((acc: number, x: number | null) => acc + (x || 0), 0);
  const cur = fj.current || {};

  return {
    current: {
      temperature: cur.temperature_2m ?? 25.0,
      humidity: cur.relative_humidity_2m ?? 65,
      precipitation: cur.precipitation ?? 0,
      wind: cur.wind_speed_10m ?? 8,
      cloud: cur.cloud_cover ?? 20,
    },
    suggested: {
      temperature: temps.length ? Math.round((temps.reduce((a: number, b: number) => a + b, 0) / temps.length) * 10) / 10 : (cur.temperature_2m ?? 25.0),
      humidity: hums.length ? Math.round((hums.reduce((a: number, b: number) => a + b, 0) / hums.length) * 10) / 10 : (cur.relative_humidity_2m ?? 65),
      season_rainfall: Math.round(seasonRain * 10) / 10,
      annual_rainfall: Math.round(annual * 10) / 10,
    },
    source: "Open-Meteo (Direct)",
  };
}

async function clientGeocode(q: string) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding status: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((x: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
    name: x.name,
    admin: x.admin1,
    country: x.country,
    lat: x.latitude,
    lon: x.longitude,
  }));
}

const server = {
  health: () => req<{ status: string; gemini: boolean; storage: string }>("/api/health"),
  meta: () => req<Meta>("/api/meta"),
  geocode: async (q: string) => {
    try {
      return await clientGeocode(q);
    } catch {
      return req<{ name: string; admin?: string; country?: string; lat: number; lon: number }[]>(`/api/geocode?q=${encodeURIComponent(q)}`);
    }
  },
  weather: async (lat: number, lon: number) => {
    try {
      return await clientLiveWeather(lat, lon);
    } catch {
      return req<{ current: Record<string, number>; suggested: Pick<Inputs, "temperature" | "humidity" | "season_rainfall" | "annual_rainfall"> }>(
        `/api/weather?lat=${lat}&lon=${lon}`);
    }
  },
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
