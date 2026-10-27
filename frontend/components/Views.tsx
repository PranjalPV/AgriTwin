"use client";
import type { Inputs, Result } from "@/lib/api";
import { pct } from "@/lib/api";
import TwinView, { Timeline, useStage } from "./TwinView";
import { Card, Pill } from "./ui/primitives";

export type Scenario = { inputs: Inputs; result: Result };
const short = (c: string) => c.replace(", paddy", "").replace(" and others", "");

/* ---------------------------------------------------------- compare */
export function CompareView({ a, b, onGo }: { a: Scenario | null; b: Scenario | null; onGo: () => void }) {
  const stageCtl = useStage(0.6);
  if (!a || !b) {
    return (
      <div className="h-full grid place-items-center">
        <div className="panel max-w-md p-8 text-center">
          <div className="font-display text-2xl mb-2">Compare two scenarios</div>
          <p className="text-[13px] text-bone/60 mb-5">Run a simulation, pin it as <b>A</b>, change rainfall, crop or soil, run again and pin as <b>B</b>. Both twins then grow side by side.</p>
          <div className="flex justify-center gap-2 mb-5">
            <Pill tone={a ? "good" : "neutral"}>A {a ? "pinned" : "empty"}</Pill>
            <Pill tone={b ? "good" : "neutral"}>B {b ? "pinned" : "empty"}</Pill>
          </div>
          <button onClick={onGo} className="rounded-xl bg-wheat-400 px-5 py-2.5 text-soil-950 font-semibold text-sm">Go to simulator</button>
        </div>
      </div>
    );
  }
  type Row = [string, (s: Scenario) => number | string, ((x: number) => string)?, boolean?];
  const rows: Row[] = [
    ["Crop", (s) => short(s.inputs.crop)],
    ["Yield (t/ha)", (s) => s.result.yield.t_per_ha, (x) => x.toFixed(2), true],
    ["Twin health", (s) => s.result.twin.health, pct, true],
    ["Climate fit", (s) => s.result.twin.climate_fit, pct, true],
    ["Disease risk", (s) => s.result.disease.score, pct, false],
    ["Water status", (s) => s.result.twin.water],
    ["Best crop (RF)", (s) => s.result.recommendation.crop],
    ["Temperature", (s) => s.inputs.temperature, (x) => `${x}°C`],
    ["Annual rain", (s) => s.inputs.annual_rainfall, (x) => `${x} mm`],
    ["Season rain", (s) => s.inputs.season_rainfall, (x) => `${x} mm`],
    ["N · P · K", (s) => `${s.inputs.N} · ${s.inputs.P} · ${s.inputs.K}`],
  ];
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="grid md:grid-cols-2 gap-3 flex-1 min-h-[420px]">
        {[a, b].map((s, i) => (
          <TwinView key={i} twin={s.result.twin} cropName={short(s.inputs.crop)} cropHindi={s.result.crop_hi}
            quality="low" compact stageCtl={stageCtl} title={`Scenario ${i ? "B" : "A"}`} />
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_420px] gap-3">
        <Timeline {...stageCtl} cropKey={a.result.twin.crop_key} />
        <div className="panel px-4 py-3 text-[12px] text-bone/60 flex items-center">Shared timeline — both twins grow through the season together.</div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-left label"><th className="p-3">Metric</th><th className="p-3">A</th><th className="p-3">B</th><th className="p-3">Δ (B − A)</th></tr></thead>
          <tbody>
            {rows.map(([k, f, fmt, higherBetter]) => {
              const va = f(a), vb = f(b);
              const num = typeof va === "number" && typeof vb === "number";
              const d = num ? (vb as number) - (va as number) : null;
              const good = d === null || higherBetter === undefined || Math.abs(d) < 1e-9 ? null : higherBetter ? d > 0 : d < 0;
              return (
                <tr key={k} className="border-t border-soil-700/60">
                  <td className="p-3 text-bone/60">{k}</td>
                  <td className="p-3 num">{fmt && num ? fmt(va as number) : String(va)}</td>
                  <td className="p-3 num">{fmt && num ? fmt(vb as number) : String(vb)}</td>
                  <td className={`p-3 num ${good === null ? "text-bone/40" : good ? "text-leaf-300" : "text-rust-400"}`}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${fmt ? fmt(d) : d.toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- history */
export function HistoryView({ items, onLoad, error }: { items: { id: string; created_at: string; inputs: Inputs; outputs: Result }[]; onLoad: (s: Scenario) => void; error?: string }) {
  return (
    <div className="panel overflow-x-auto">
      <div className="p-4 flex justify-between items-center border-b border-soil-700/60">
        <div className="font-display text-xl">Simulation history</div>
        <span className="text-[11px] text-bone/40">Last 20 runs · {process.env.NEXT_PUBLIC_DEMO === "1" ? "stored in this browser" : "stored in database"}</span>
      </div>
      {error && <div className="p-4 text-rust-400 text-sm">{error}</div>}
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-left label"><th className="p-3">When</th><th className="p-3">Crop</th><th className="p-3">Temp / RH</th><th className="p-3">Rain (yr)</th><th className="p-3">Yield</th><th className="p-3">Health</th><th className="p-3">Disease</th><th className="p-3">Best crop</th><th /></tr></thead>
        <tbody>
          {items.map((h) => (
            <tr key={h.id} className="border-t border-soil-700/60 hover:bg-soil-850">
              <td className="p-3 text-bone/50 num">{new Date(h.created_at).toLocaleString()}</td>
              <td className="p-3">{short(h.inputs.crop)}</td>
              <td className="p-3 num">{h.inputs.temperature}° / {h.inputs.humidity}%</td>
              <td className="p-3 num">{h.inputs.annual_rainfall}</td>
              <td className="p-3 num">{h.outputs.yield.t_per_ha} t/ha</td>
              <td className="p-3 num">{pct(h.outputs.twin.health)}</td>
              <td className="p-3"><Pill tone={h.outputs.disease.level === "High" ? "bad" : h.outputs.disease.level === "Moderate" ? "warn" : "good"}>{h.outputs.disease.level}</Pill></td>
              <td className="p-3 capitalize">{h.outputs.recommendation.crop}</td>
              <td className="p-3"><button onClick={() => onLoad({ inputs: h.inputs, result: { ...h.outputs, id: h.id } })} className="text-wheat-400 hover:underline">Load</button></td>
            </tr>
          ))}
          {!items.length && !error && <tr><td colSpan={9} className="p-6 text-center text-bone/40">No simulations yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
