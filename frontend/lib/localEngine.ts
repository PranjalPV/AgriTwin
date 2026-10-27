/**
 * In-browser engine for the hosted demo. Runs the same exported Random Forest and
 * Decision Tree (ml/export_web.py) and a TypeScript port of backend/app/engine.py
 * and the rule-based advisor. The full app uses the FastAPI backend instead.
 */
import type { Advice, Inputs, Meta, Result } from "./api";

type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; v: unknown[] };

const CROPS: Record<string, { key: string; temp: [number, number]; rain: [number, number]; npk: [number, number, number]; hindi: string }> = {
  "Wheat": { key: "wheat", temp: [15, 24], rain: [450, 900], npk: [120, 60, 40], hindi: "गेहूँ" },
  "Rice, paddy": { key: "rice", temp: [22, 32], rain: [1100, 2500], npk: [120, 60, 40], hindi: "धान" },
  "Maize": { key: "maize", temp: [21, 30], rain: [600, 1200], npk: [150, 75, 40], hindi: "मक्का" },
  "Potatoes": { key: "potato", temp: [15, 22], rain: [500, 900], npk: [180, 80, 100], hindi: "आलू" },
  "Soybeans": { key: "soybean", temp: [20, 30], rain: [600, 1100], npk: [30, 60, 40], hindi: "सोयाबीन" },
  "Sorghum": { key: "sorghum", temp: [25, 32], rain: [450, 900], npk: [80, 40, 40], hindi: "ज्वार" },
  "Sweet potatoes": { key: "sweetpotato", temp: [21, 29], rain: [750, 1250], npk: [60, 60, 120], hindi: "शकरकंद" },
  "Cassava": { key: "cassava", temp: [25, 32], rain: [1000, 1800], npk: [100, 50, 100], hindi: "कसावा" },
  "Yams": { key: "yam", temp: [25, 30], rain: [1000, 1600], npk: [80, 60, 80], hindi: "रतालू" },
  "Plantains and others": { key: "plantain", temp: [25, 30], rain: [1500, 2500], npk: [200, 60, 300], hindi: "केला" },
};

const DISEASES: Record<string, [string, number, number, number, boolean, string][]> = {
  wheat: [["Yellow (stripe) rust", 10, 20, 85, false, "cool, humid nights favour rust spores"],
    ["Powdery mildew", 15, 22, 70, false, "moderate temperature with high humidity"],
    ["Karnal bunt", 18, 24, 70, true, "rain and humidity during heading"]],
  rice: [["Rice blast", 24, 28, 90, false, "leaf wetness and warm nights"],
    ["Bacterial leaf blight", 25, 34, 70, true, "storms and heavy rain spread bacteria"],
    ["Sheath blight", 28, 32, 85, false, "hot, humid dense canopy"]],
  maize: [["Turcicum leaf blight", 18, 27, 75, true, "moderate temperature with dew"],
    ["Maydis leaf blight", 26, 32, 80, true, "hot and humid weather"]],
  potato: [["Late blight", 10, 25, 90, true, "cool, wet weather — spreads in days"],
    ["Early blight", 24, 30, 70, false, "warm with alternating wet/dry periods"]],
  soybean: [["Soybean rust", 18, 28, 75, true, "prolonged leaf wetness"], ["Anthracnose", 25, 32, 80, true, "warm rainy periods"]],
  sorghum: [["Anthracnose", 25, 30, 80, true, "warm, humid, rainy weather"], ["Grain mold", 25, 35, 85, true, "rain during grain filling"]],
  sweetpotato: [["Black rot", 23, 30, 80, false, "warm humid storage and soil"]],
  cassava: [["Cassava bacterial blight", 22, 30, 80, true, "rain splash spreads bacteria"]],
  yam: [["Anthracnose", 25, 30, 80, true, "warm and wet weather"]],
  plantain: [["Sigatoka leaf spot", 25, 29, 85, true, "humid tropical conditions"]],
};

const YIELD_TO_REC: Record<string, string> = { "Rice, paddy": "rice", "Maize": "maize" };
const REC_HINDI: Record<string, string> = {
  rice: "धान", maize: "मक्का", chickpea: "चना", kidneybeans: "राजमा", pigeonpeas: "अरहर", mothbeans: "मोठ", mungbean: "मूंग",
  blackgram: "उड़द", lentil: "मसूर", pomegranate: "अनार", banana: "केला", mango: "आम", grapes: "अंगूर", watermelon: "तरबूज",
  muskmelon: "खरबूजा", apple: "सेब", orange: "संतरा", papaya: "पपीता", coconut: "नारियल", cotton: "कपास", jute: "जूट", coffee: "कॉफ़ी",
};

/* --------------------------------------------------------------- model loading */
type Models = {
  rec: { classes: string[]; trees: Tree[] };
  yld: { cats: string[][]; mean: number[]; scale: number[]; tree: Tree };
  metrics: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  profiles: Record<string, { india_median_hg: number }>;
};
let loading: Promise<Models> | null = null;
function models(): Promise<Models> {
  if (!loading) {
    const get = (p: string) => fetch(`models/${p}`).then((r) => { if (!r.ok) throw new Error(`Could not load ${p}`); return r.json(); });
    loading = Promise.all([get("recommender.json"), get("yield.json"), get("metrics.json"), get("profiles.json")])
      .then(([rec, yld, metrics, profiles]) => ({ rec, yld, metrics, profiles }));
    loading.catch(() => { loading = null; });
  }
  return loading;
}

function leafOf(t: Tree, x: number[]) {
  let n = 0;
  while (t.l[n] !== -1) n = Math.fround(x[t.f[n]]) <= t.t[n] ? t.l[n] : t.r[n];
  return t.v[n];
}

const clip = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/* --------------------------------------------------------------- engine port */
function recommend(m: Models, i: Inputs) {
  const x = [i.N, i.P, i.K, i.temperature, i.humidity, i.ph, i.season_rainfall];
  const proba = new Array(m.rec.classes.length).fill(0);
  for (const t of m.rec.trees) for (const [k, p] of leafOf(t, x) as [number, number][]) proba[k] += p;
  proba.forEach((_, k) => (proba[k] /= m.rec.trees.length));
  const ranked = m.rec.classes.map((c, k) => [c, proba[k]] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const chosen = YIELD_TO_REC[i.crop];
  const recm = m.metrics.recommendation;
  return {
    crop: ranked[0][0], crop_hi: REC_HINDI[ranked[0][0]] ?? ranked[0][0], confidence: r3(ranked[0][1]),
    top: ranked.map(([c, p]) => ({ crop: c, crop_hi: REC_HINDI[c] ?? c, p: Math.round(p * 1e4) / 1e4 })),
    importance: recm.importance, ideal: recm.ideals[ranked[0][0]] ?? null,
    selected_crop_suitability: chosen ? Math.round(proba[m.rec.classes.indexOf(chosen)] * 1e4) / 1e4 : null,
  };
}

function predictYield(m: Models, i: Inputs) {
  const { cats, mean, scale, tree } = m.yld;
  const x: number[] = [];
  cats[0].forEach((c) => x.push(c === i.crop ? 1 : 0));
  cats[1].forEach((c) => x.push(c === i.country ? 1 : 0));
  [i.year, i.annual_rainfall, i.pesticides, i.temperature].forEach((v, k) => x.push((v - mean[k]) / scale[k]));
  const hg = leafOf(tree, x) as number;
  const bench = m.profiles[i.crop].india_median_hg;
  return { hg_per_ha: Math.round(hg * 10) / 10, t_per_ha: Math.round(hg / 100) / 100, benchmark_t_per_ha: Math.round(bench / 100) / 100, ratio: r3(hg / bench) };
}

const band = (x: number, lo: number, hi: number, soft: number) => (x >= lo && x <= hi ? 1 : clip(1 - (x < lo ? lo - x : x - hi) / soft));

function disease(i: Inputs): Result["disease"] {
  const threats = (DISEASES[CROPS[i.crop].key] || []).map(([name, tlo, thi, hmin, needsRain, why]) => {
    const t = band(i.temperature, tlo, thi, 4);
    const h = clip((i.humidity - (hmin - 15)) / 30);
    const r = needsRain ? clip(i.season_rainfall / 150, 0.35, 1) : 1;
    const n = i.N > 110 ? 1.12 : 1;
    return { name, score: r3(clip(0.9 * t * h * r * n)), why, window: `${tlo}-${thi}°C, RH ≥ ${hmin}%${needsRain ? ", rain" : ""}` };
  }).sort((a, b) => b.score - a.score);
  const score = threats[0]?.score ?? 0;
  return { score, level: score < 0.3 ? "Low" : score < 0.6 ? "Moderate" : "High", threats };
}

function twin(i: Inputs, y: Result["yield"], d: Result["disease"]): Result["twin"] {
  const c = CROPS[i.crop];
  const [tlo, thi] = c.temp, [rlo, rhi] = c.rain;
  const dt = Math.max(tlo - i.temperature, 0, i.temperature - thi);
  const fitT = Math.exp(-((dt / 4.5) ** 2));
  const r = i.annual_rainfall;
  const dr = r < rlo ? (rlo - r) / rlo : r > rhi ? (r - rhi) / rhi : 0;
  const fitR = Math.exp(-((dr / 0.4) ** 2));
  const fit = 0.55 * fitT + 0.45 * fitR;
  const isRice = c.key === "rice";
  const moisture = clip(0.65 * (r / (rhi * 1.05)) + 0.35 * (i.season_rainfall / 260), 0.05, 1);
  const water = r < rlo * 0.8 ? "dry" : r > rhi * (isRice ? 1.6 : 1.25) ? "waterlogged" : "optimal";
  const yScore = clip((y.ratio || 1) / 1.25);
  let health = clip(0.45 * yScore + 0.3 * fit + 0.25 * (1 - d.score));
  if (water !== "optimal") health *= 0.85;
  return {
    crop_key: c.key, health: r3(health), vigor: r3(yScore), climate_fit: r3(fit), temp_fit: r3(fitT), rain_fit: r3(fitR),
    moisture: r3(moisture), water, disease: d.score, paddy: isRice, temperature: i.temperature, humidity: i.humidity,
    rain_intensity: r3(clip((i.season_rainfall - 140) / 180)), optimal: { temp: [tlo, thi], rain: [rlo, rhi] },
  };
}

/* --------------------------------------------------------------- history */
const KEY = "agritwin-history";
function readHistory(): { id: string; created_at: string; inputs: Inputs; outputs: Result }[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

/* --------------------------------------------------------------- public api */
export const local = {
  async meta(): Promise<Meta> {
    const m = await models();
    return {
      crops: Object.entries(CROPS).map(([name, v]) => ({ name, key: v.key, hindi: v.hindi, temp: v.temp, rain: v.rain })),
      countries: m.metrics.yield.countries, defaults: m.metrics.yield.india_defaults,
      metrics: {
        recommendation: { chosen: m.metrics.recommendation.chosen, results: m.metrics.recommendation.results, test_size: m.metrics.recommendation.test_size },
        yield: { chosen: m.metrics.yield.chosen, results: m.metrics.yield.results, test_size: m.metrics.yield.test_size },
      },
    };
  },
  async simulate(i: Inputs, save = true): Promise<Result> {
    const m = await models();
    const recommendation = recommend(m, i);
    const y = predictYield(m, i);
    const d = disease(i);
    const res: Result = { id: Math.random().toString(36).slice(2), crop_hi: CROPS[i.crop].hindi, recommendation, yield: y, disease: d, twin: twin(i, y, d) };
    if (save) try {
      const h = [{ id: res.id, created_at: new Date().toISOString(), inputs: i, outputs: res }, ...readHistory()].slice(0, 20);
      localStorage.setItem(KEY, JSON.stringify(h));
    } catch { /* storage unavailable: history just won't persist */ }
    return res;
  },
  async history() { return readHistory(); },
  async advice(i: Inputs, res: Result, lang: "en" | "hi"): Promise<Advice> {
    const c = CROPS[i.crop], tw = res.twin, dis = res.disease, y = res.yield;
    const [rlo, rhi] = c.rain, [n, p, k] = c.npk;
    const irr = {
      dry: `Rainfall ${i.annual_rainfall.toFixed(0)} mm is below the ${rlo}-${rhi} mm the crop needs — plan supplemental irrigation at critical stages.`,
      waterlogged: `Rainfall ${i.annual_rainfall.toFixed(0)} mm exceeds the crop's ${rhi} mm upper limit — open drainage channels and avoid irrigation.`,
      optimal: `Rainfall is within the ${rlo}-${rhi} mm range — irrigate only during dry spells longer than 10 days.`,
    }[tw.water];
    const ph = i.ph < 5.8 ? `${i.ph} is acidic — apply agricultural lime.` : i.ph > 7.8 ? `${i.ph} is alkaline — add gypsum and organic matter.` : `${i.ph} is in a good range.`;
    const out: Advice = {
      source: "rules",
      summary: `${i.crop} is predicted to yield ${y.t_per_ha} t/ha versus an India median of ${y.benchmark_t_per_ha} t/ha. Climate fit is ${Math.round(tw.climate_fit * 100)}% and disease risk is ${dis.level.toLowerCase()}. For this soil and weather the model's best crop is ${res.recommendation.crop}.`,
      irrigation: [irr, "Use drip or furrow irrigation in the early morning to cut evaporation losses.", "Check soil moisture at 10 cm depth before each irrigation."],
      fertilizer: [`Recommended dose for ${i.crop}: about ${n}:${p}:${k} kg/ha N:P:K, split N in 2-3 doses.`, `Soil pH ${ph}`, "Get a Soil Health Card test before the next season to fine-tune doses."],
      disease: [...(dis.threats.length ? dis.threats.slice(0, 2).map((t) => `${t.name}: risk ${Math.round(t.score * 100)}% — ${t.why}.`) : ["No major disease window active."]), "Scout the field twice a week; act at first symptoms."],
      practices: ["Use certified seed of a regional variety.", "Keep the field weed-free in the first 30-40 days.", "Record inputs and yield to compare with this simulation next season."],
    };
    if (lang === "hi") out.summary = "(डेमो में Gemini उपलब्ध नहीं है — हिंदी सलाह पूरे ऐप में Gemini API key के साथ मिलेगी।) " + out.summary;
    return out;
  },
};

/** Approximate long-term normals used by the city buttons in the demo (live Open-Meteo data needs the full app). */
export const DEMO_NORMALS: Record<string, Pick<Inputs, "temperature" | "humidity" | "season_rainfall" | "annual_rainfall">> = {
  Lucknow: { temperature: 25.5, humidity: 66, season_rainfall: 180, annual_rainfall: 1000 },
  Gorakhpur: { temperature: 25.8, humidity: 72, season_rainfall: 240, annual_rainfall: 1250 },
  Prayagraj: { temperature: 26.4, humidity: 64, season_rainfall: 170, annual_rainfall: 1020 },
  Varanasi: { temperature: 26.2, humidity: 66, season_rainfall: 185, annual_rainfall: 1080 },
  Kanpur: { temperature: 26.0, humidity: 62, season_rainfall: 150, annual_rainfall: 850 },
};
