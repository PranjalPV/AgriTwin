"use client";
import type { Advice, Inputs, Result } from "@/lib/api";
import { pct } from "@/lib/api";
import { Bar, Card, healthColor, Icon, Pill } from "./ui/primitives";

const FEATURE_LABEL: Record<string, string> = {
  N: "Nitrogen", P: "Phosphorus", K: "Potassium", temperature: "Temperature", humidity: "Humidity", ph: "pH", rainfall: "Rainfall",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Recommendation({ r, lang }: { r: Result; lang: "en" | "hi" }) {
  const rec = r.recommendation;
  const imp = Object.entries(rec.importance).sort((a, b) => b[1] - a[1]);
  const maxImp = imp[0][1];
  return (
    <Card title="Best crop for this soil & weather" right={<Pill tone="info">Random Forest</Pill>}>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-[34px] leading-none text-bone">{lang === "hi" ? rec.crop_hi : cap(rec.crop)}</div>
          <div className="text-[12px] text-bone/45 mt-1">{lang === "hi" ? cap(rec.crop) : rec.crop_hi}</div>
        </div>
        <div className="text-right">
          <div className="num text-[22px] text-leaf-300">{pct(rec.confidence)}</div>
          <div className="text-[10.5px] text-bone/40">confidence</div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {rec.top.slice(1, 4).map((t) => (
          <div key={t.crop} className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-[11.5px]">
            <span className="text-bone/60 truncate">{lang === "hi" ? t.crop_hi : cap(t.crop)}</span>
            <Bar value={t.p} color="#7cc6e8" h={4} />
            <span className="num text-bone/45 text-right">{pct(t.p)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-soil-700/60">
        <div className="label mb-2">Why — feature importance</div>
        <div className="space-y-1">
          {imp.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-[11px]">
              <span className="text-bone/55">{FEATURE_LABEL[k]}</span>
              <Bar value={v / maxImp} color="#e8c66a" h={3} />
              <span className="num text-bone/40 text-right">{(v * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function YieldCard({ r, inputs }: { r: Result; inputs: Inputs }) {
  const y = r.yield;
  const better = y.ratio >= 1;
  const max = Math.max(y.t_per_ha, y.benchmark_t_per_ha) * 1.15;
  return (
    <Card title={`Predicted yield · ${inputs.crop.replace(", paddy", "")}`} right={<Pill tone="info">Decision Tree</Pill>} delay={60}>
      <div className="flex items-baseline gap-2">
        <span className="num text-[38px] leading-none text-bone">{y.t_per_ha.toFixed(2)}</span>
        <span className="text-bone/50 text-[13px]">t / ha</span>
        <span className={`ml-auto num text-[13px] ${better ? "text-leaf-300" : "text-rust-400"}`}>
          {better ? "▲" : "▼"} {Math.abs((y.ratio - 1) * 100).toFixed(0)}% vs India median
        </span>
      </div>
      <div className="mt-4 space-y-2 text-[11.5px]">
        <div className="grid grid-cols-[80px_1fr_44px] items-center gap-2">
          <span className="text-bone/60">Simulated</span><Bar value={y.t_per_ha / max} color={better ? "#7cc443" : "#e0784a"} /><span className="num text-right">{y.t_per_ha}</span>
        </div>
        <div className="grid grid-cols-[80px_1fr_44px] items-center gap-2">
          <span className="text-bone/60">India median</span><Bar value={y.benchmark_t_per_ha / max} color="#6b5d47" /><span className="num text-right text-bone/50">{y.benchmark_t_per_ha}</span>
        </div>
      </div>
      <div className="mt-3 text-[10.5px] text-bone/35">≈ {(y.t_per_ha * 4).toFixed(1)} quintal per bigha (UP, 1 bigha ≈ 0.25 ha)</div>
    </Card>
  );
}

export function DiseaseCard({ r }: { r: Result }) {
  const d = r.disease;
  const tone = d.level === "High" ? "bad" : d.level === "Moderate" ? "warn" : "good";
  const color = d.level === "High" ? "#e0784a" : d.level === "Moderate" ? "#e8c66a" : "#7cc443";
  return (
    <Card title="Disease risk" right={<Pill tone={tone}>{d.level}</Pill>} delay={120}>
      <div className="space-y-2.5">
        {d.threats.slice(0, 3).map((t) => (
          <div key={t.name}>
            <div className="flex justify-between text-[12px]">
              <span className="text-bone/85">{t.name}</span>
              <span className="num" style={{ color: t.score > 0.6 ? "#e0784a" : t.score > 0.3 ? "#e8c66a" : "#a8e07a" }}>{pct(t.score)}</span>
            </div>
            <Bar value={t.score} color={t.score > 0.6 ? "#e0784a" : t.score > 0.3 ? "#e8c66a" : "#7cc443"} h={3} />
            <div className="text-[10.5px] text-bone/40 mt-0.5">{t.window} — {t.why}</div>
          </div>
        ))}
        {!d.threats.length && <div className="text-[12px] text-bone/50" style={{ color }}>No disease window active.</div>}
      </div>
    </Card>
  );
}

export function TwinStats({ r }: { r: Result }) {
  const t = r.twin;
  const rows: [string, number, string][] = [
    ["Twin health", t.health, healthColor(t.health)],
    ["Climate fit", t.climate_fit, "#7cc6e8"],
    ["Yield vigour", t.vigor, "#e8c66a"],
    ["Soil moisture", t.moisture, "#5aa9d6"],
  ];
  return (
    <Card title="Digital-twin state" delay={180}>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([k, v, c]) => (
          <div key={k}>
            <div className="flex justify-between text-[11px] text-bone/55 mb-1"><span>{k}</span><span className="num text-bone/85">{pct(v)}</span></div>
            <Bar value={v} color={c} h={4} />
          </div>
        ))}
      </div>
      {r.recommendation.selected_crop_suitability !== null && (
        <div className="mt-3 text-[11px] text-bone/50">Model suitability for your crop: <span className="num text-bone/80">{pct(r.recommendation.selected_crop_suitability)}</span></div>
      )}
    </Card>
  );
}

export function AdviceCard({
  advice, loading, lang, setLang, error,
}: { advice: Advice | null; loading: boolean; lang: "en" | "hi"; setLang: (l: "en" | "hi") => void; error?: string }) {
  const sections: [keyof Advice, string, JSX.Element][] = [
    ["irrigation", lang === "hi" ? "सिंचाई" : "Irrigation", Icon.drop("#7cc6e8")],
    ["fertilizer", lang === "hi" ? "उर्वरक" : "Fertilizer", Icon.leaf("#a8e07a")],
    ["disease", lang === "hi" ? "रोग रोकथाम" : "Disease prevention", Icon.bug("#e0784a")],
    ["practices", lang === "hi" ? "अच्छी खेती" : "Best practices", Icon.sun("#e8c66a")],
  ];
  return (
    <Card
      title="AI farm advisor"
      delay={240}
      right={
        <div className="flex items-center gap-2">
          {advice && <Pill tone={advice.source === "gemini" ? "good" : "neutral"}>{advice.source === "gemini" ? <>{Icon.spark()} Gemini</> : "Rule engine"}</Pill>}
          <div className="flex rounded-full border border-soil-600 p-0.5 text-[11px]">
            {(["en", "hi"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`rounded-full px-2 py-0.5 ${lang === l ? "bg-bone text-soil-950" : "text-bone/60"}`}>
                {l === "en" ? "EN" : "हिं"}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {loading && (
        <div className="space-y-2 animate-pulse">
          {[90, 75, 82, 60].map((w, i) => <div key={i} className="h-3 rounded bg-soil-700" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {error && !loading && <div className="text-[12px] text-rust-400">{error}</div>}
      {advice && !loading && (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-bone/85">{advice.summary}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {sections.map(([k, label, icon]) => (
              <div key={k}>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-bone mb-1.5">{icon}{label}</div>
                <ul className="space-y-1">
                  {(advice[k] as string[]).map((s, i) => (
                    <li key={i} className="text-[11.5px] leading-snug text-bone/65 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-bone/30">{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {advice.error && <div className="text-[10.5px] text-bone/35">Gemini unavailable ({advice.error.slice(0, 80)}) — showing rule-based advice.</div>}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------- plain-language summary */
export function Verdict({ r, inputs, onAdvisor, lang }: { r: Result; inputs: Inputs; onAdvisor: () => void; lang: "en" | "hi" }) {
  const t = r.twin, y = r.yield, d = r.disease;
  const crop = inputs.crop.replace(", paddy", "").replace(" and others", "");
  const v = t.health > 0.7 ? { word: "Good season", tone: "#7cc443", sub: "Conditions suit this crop well." }
    : t.health > 0.45 ? { word: "Some risks", tone: "#e8c66a", sub: "The crop will grow, but watch the points below." }
    : { word: "Poor fit", tone: "#e0784a", sub: "Expect low yield unless conditions change." };
  const water = { optimal: ["Rainfall is right", "good"], dry: ["Too little water — irrigate", "bad"], waterlogged: ["Too much water — drain the field", "warn"] }[t.water];
  const rows: [JSX.Element, string, string][] = [
    [Icon.leaf("#a8e07a"), `About ${(y.t_per_ha * 4).toFixed(1)} quintal per bigha`, `${y.t_per_ha} t/ha · ${y.ratio >= 1 ? "above" : "below"} the India average`],
    [Icon.drop("#7cc6e8"), water[0], `Soil moisture ${Math.round(t.moisture * 100)}%`],
    [Icon.bug(d.level === "High" ? "#e0784a" : d.level === "Moderate" ? "#e8c66a" : "#a8e07a"),
      `${d.level} disease risk`, d.threats[0] && d.score >= 0.3 ? `Watch for ${d.threats[0].name.toLowerCase()}` : "No major disease expected"],
  ];
  const better = r.recommendation.crop !== (inputs.crop === "Rice, paddy" ? "rice" : inputs.crop.toLowerCase());
  return (
    <div className="panel p-4 rise">
      <div className="flex items-start gap-3">
        <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: v.tone, boxShadow: `0 0 12px ${v.tone}` }} />
        <div>
          <div className="font-display text-[24px] leading-tight text-bone" style={{ textWrap: "balance" } as React.CSSProperties}>
            {v.word} for {crop}
          </div>
          <div className="text-[12px] text-bone/55 mt-0.5">{v.sub}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {rows.map(([icon, a, b], i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-0.5">{icon}</span>
            <div><div className="text-[13px] text-bone/90">{a}</div><div className="text-[11px] text-bone/45">{b}</div></div>
          </li>
        ))}
        {better && (
          <li className="flex gap-2.5">
            <span className="mt-0.5">{Icon.sun("#e8c66a")}</span>
            <div><div className="text-[13px] text-bone/90">Also suits this soil: {lang === "hi" ? r.recommendation.crop_hi : cap(r.recommendation.crop)}</div>
              <div className="text-[11px] text-bone/45">Crop-recommendation model · {pct(r.recommendation.confidence)} match</div></div>
          </li>
        )}
      </ul>
      <button onClick={onAdvisor}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-wheat-400 py-2.5 text-[13.5px] font-semibold text-soil-950 hover:bg-wheat-300 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wheat-300">
        {Icon.spark("#0d0b08")} Ask AI Farm Advisor
      </button>
    </div>
  );
}
