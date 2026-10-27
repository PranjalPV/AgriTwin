"use client";
import { useState } from "react";
import { api, DEMO, PRESETS, type Inputs, type Meta } from "@/lib/api";
import { Icon, Slider } from "./ui/primitives";

/** Typical soil profiles (crop-recommendation dataset scale) so users don't need lab numbers. */
const SOILS = [
  { name: "Alluvial loam", note: "Most of UP · Gangetic plains", N: 80, P: 45, K: 40, ph: 7.2 },
  { name: "Sandy / light", note: "Drains fast, low nutrients", N: 35, P: 25, K: 25, ph: 6.8 },
  { name: "Black / clay", note: "Holds water, rich in potash", N: 60, P: 50, K: 60, ph: 7.8 },
  { name: "Red / acidic", note: "Low pH, needs lime", N: 50, P: 30, K: 30, ph: 5.6 },
];

function Step({ n, title, hint, children, right }: { n: number; title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="py-4 border-b border-soil-700/60 last:border-0">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="grid place-items-center w-5 h-5 shrink-0 rounded-full bg-wheat-400 text-soil-950 text-[11px] font-semibold num">{n}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-medium text-bone">{title}</h3>
            {right}
          </div>
          {hint && <p className="text-[11px] text-bone/45 mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export default function Controls({
  inputs, setInputs, meta, updating,
}: {
  inputs: Inputs; setInputs: (f: (i: Inputs) => Inputs) => void; meta: Meta | null; updating: boolean;
}) {
  const [place, setPlace] = useState<string>("");
  const [wx, setWx] = useState<{ state: "idle" | "loading" | "ok" | "err"; msg?: string }>({ state: "idle" });
  const [query, setQuery] = useState("");
  const [soilCard, setSoilCard] = useState(false);
  const set = <K extends keyof Inputs>(k: K) => (v: Inputs[K]) => setInputs((i) => ({ ...i, [k]: v }));
  const crop = meta?.crops.find((c) => c.name === inputs.crop);
  const soil = SOILS.find((s) => s.N === inputs.N && s.P === inputs.P && s.K === inputs.K && s.ph === inputs.ph);

  async function live(name: string, lat: number, lon: number) {
    setPlace(name);
    setWx({ state: "loading" });
    try {
      const w = await api.weather(lat, lon);
      setInputs((i) => ({ ...i, ...w.suggested }));
      setWx({ state: "ok", msg: DEMO ? "Typical weather for this place loaded." : `Live weather loaded — now ${w.current.temperature}°C.` });
    } catch (e) {
      setWx({ state: "err", msg: (e as Error).message });
    }
  }

  async function search() {
    if (query.trim().length < 2) return;
    try {
      const r = await api.geocode(query.trim());
      if (r[0]) live(`${r[0].name}${r[0].admin ? ", " + r[0].admin : ""}`, r[0].lat, r[0].lon);
      else setWx({ state: "err", msg: "Place not found. Try the nearest town." });
    } catch (e) { setWx({ state: "err", msg: (e as Error).message }); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="label">Set up your farm</div>
        <span className={`text-[10.5px] flex items-center gap-1.5 ${updating ? "text-wheat-400" : "text-leaf-300/80"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${updating ? "bg-wheat-400 animate-pulse" : "bg-leaf-400"}`} />
          {updating ? "Updating…" : "Live updates"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <Step n={1} title="Which crop?" hint="The 3D farm will grow this crop.">
          <div className="grid grid-cols-2 gap-1.5">
            {meta?.crops.map((c) => (
              <button
                key={c.name}
                onClick={() => set("crop")(c.name)}
                aria-pressed={inputs.crop === c.name}
                className={`text-left rounded-lg border px-2.5 py-1.5 transition ${inputs.crop === c.name
                  ? "border-wheat-400/70 bg-wheat-400/10 text-bone" : "border-soil-700 hover:border-soil-600 text-bone/60 hover:text-bone/85"}`}
              >
                <div className="text-[12px] leading-tight">{c.name.replace(", paddy", "").replace(" and others", "")}</div>
                <div className="text-[10.5px] text-bone/40">{c.hindi}</div>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Where is the farm?" hint="Pick a city to fill in its weather, or set it yourself below."
          right={wx.state === "loading" ? <span className="text-[10.5px] text-wheat-400 animate-pulse">loading…</span> : null}>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => live(p.name, p.lat, p.lon)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${place === p.name ? "border-sky-400/60 text-sky-400 bg-sky-400/10" : "border-soil-700 text-bone/65 hover:text-bone"}`}>
                {p.name}
              </button>
            ))}
          </div>
          {!DEMO && (
            <div className="flex gap-1.5">
              <input
                id="place-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Or type your village / town…"
                className="flex-1 min-w-0 rounded-lg bg-soil-850 border border-soil-700 px-3 py-1.5 text-[12.5px] outline-none focus:border-wheat-400/60 placeholder:text-bone/30"
              />
              <button onClick={search} aria-label="Search place" className="rounded-lg border border-soil-700 px-2.5 text-bone/70 hover:text-bone"><Icon.loc /></button>
            </div>
          )}
          {wx.msg && (
            <div className={`text-[11px] ${wx.state === "err" ? "text-rust-400" : "text-sky-400"}`}>
              {wx.state === "ok" && <b className="font-medium">{place}: </b>}{wx.msg}
            </div>
          )}
          <div className="rounded-xl border border-soil-700/70 bg-soil-850/60 p-3 space-y-3.5">
            <Slider label="Average temperature" unit="°C" value={inputs.temperature} min={0} max={45} step={0.5} onChange={set("temperature")} ideal={crop?.temp}
              hint={crop ? `Green band = best range for ${crop.name.replace(", paddy", "")}` : undefined} />
            <Slider label="Humidity (moisture in air)" unit="%" value={inputs.humidity} min={10} max={100} onChange={set("humidity")} hint="High humidity raises disease risk" />
            <Slider label="Rain in the last 3 months" unit="mm" value={inputs.season_rainfall} min={0} max={320} step={5} onChange={set("season_rainfall")} />
            <Slider label="Rain in a whole year" unit="mm" value={inputs.annual_rainfall} min={100} max={3200} step={10} onChange={set("annual_rainfall")} ideal={crop?.rain}
              hint="Lucknow gets about 1000 mm a year" />
          </div>
        </Step>

        <Step n={3} title="What kind of soil?" hint="Choose the closest type. Have a Soil Health Card? Enter its values.">
          <div className="grid grid-cols-2 gap-1.5">
            {SOILS.map((s) => (
              <button key={s.name} onClick={() => setInputs((i) => ({ ...i, N: s.N, P: s.P, K: s.K, ph: s.ph }))}
                aria-pressed={soil?.name === s.name}
                className={`text-left rounded-lg border px-2.5 py-1.5 transition ${soil?.name === s.name ? "border-wheat-400/70 bg-wheat-400/10" : "border-soil-700 hover:border-soil-600"}`}>
                <div className="text-[12px] text-bone/85 leading-tight">{s.name}</div>
                <div className="text-[10px] text-bone/40 leading-tight mt-0.5">{s.note}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setSoilCard(!soilCard)} className="text-[11.5px] text-wheat-400 hover:underline">
            {soilCard ? "Hide soil test values" : soil ? "Enter my Soil Health Card values" : "Custom soil values (edited)"} {soilCard ? "▴" : "▾"}
          </button>
          {soilCard && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                {(["N", "P", "K"] as const).map((k) => (
                  <label key={k} className="block" htmlFor={`soil-${k}`}>
                    <div className="text-[11px] text-bone/50 mb-1">{k === "N" ? "Nitrogen (N)" : k === "P" ? "Phosphorus (P)" : "Potassium (K)"}</div>
                    <input id={`soil-${k}`} type="number" value={inputs[k]} min={0} max={k === "K" ? 250 : 200} onChange={(e) => set(k)(Number(e.target.value))}
                      className="num w-full rounded-lg bg-soil-850 border border-soil-700 px-2 py-1.5 text-[13px] outline-none focus:border-wheat-400/60" />
                  </label>
                ))}
              </div>
              <Slider label="Soil pH" value={inputs.ph} min={3.5} max={9.5} step={0.1} onChange={set("ph")} ideal={[6, 7.5]} hint="6 – 7.5 suits most crops" />
            </div>
          )}
        </Step>

        <details className="py-4 group">
          <summary className="text-[12px] text-bone/50 cursor-pointer list-none flex justify-between hover:text-bone/80">
            Advanced settings (for the yield model)
            <span className="group-open:rotate-45 transition">+</span>
          </summary>
          <div className="space-y-3.5 mt-3">
            <label className="block" htmlFor="country">
              <div className="text-[12.5px] text-bone/75 mb-1">Country</div>
              <select id="country" value={inputs.country} onChange={(e) => set("country")(e.target.value)}
                className="w-full rounded-lg bg-soil-850 border border-soil-700 px-2 py-1.5 text-[12.5px]">
                {meta?.countries.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <Slider label="Reference year" value={inputs.year} min={1990} max={2013} onChange={set("year")} hint="Dataset covers 1990–2013" />
            <Slider label="National pesticide use" unit="t" value={inputs.pesticides} min={0} max={120000} step={500} onChange={set("pesticides")} />
          </div>
        </details>
      </div>
    </div>
  );
}
