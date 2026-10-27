import { readFileSync } from "fs";
const ref = JSON.parse(readFileSync("parity.json", "utf8"));
(globalThis as any).fetch = async (p: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/" + p, "utf8")) });
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };
import { local } from "../lib/localEngine";
(async () => {
  const base = { country: "India", year: 2013, pesticides: 42000, crop: "Maize" } as any;
  for (let k = 0; k < 2; k++) {
    const s = ref.rec_in[k];
    const r = await local.simulate({ ...base, ...s, season_rainfall: s.rainfall, annual_rainfall: 800 });
    const py = ref.rec[k]; const top = py.indexOf(Math.max(...py));
    console.log("rec", r.recommendation.crop, r.recommendation.confidence, "py top idx", top, py[top]);
  }
  for (let k = 0; k < 2; k++) {
    const s = ref.yield_in[k];
    const r = await local.simulate({ ...base, N: 90, P: 42, K: 43, ph: 6.5, humidity: 60, season_rainfall: 100, crop: s.Item, annual_rainfall: s.average_rain_fall_mm_per_year, temperature: s.avg_temp });
    console.log("yield js", r.yield.hg_per_ha, "py", ref.yield[k]);
  }
})();
