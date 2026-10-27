"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Twin } from "@/lib/api";
import { stageName } from "./twin/Field";
import { healthColor, Icon, Pill, Ring } from "./ui/primitives";

const TwinCanvas = dynamic(() => import("./twin/TwinCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-bone/40 text-sm">Growing your farm…</div>,
});

export const SEASON_DAYS: Record<string, number> = {
  wheat: 125, rice: 130, maize: 110, sorghum: 115, potato: 100, soybean: 100, sweetpotato: 120, cassava: 300, yam: 240, plantain: 330,
};

export function useStage(initial = 0.62) {
  const [stage, setStage] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number>();
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setStage((s) => {
        const n = s + dt / 14;
        if (n >= 1) { setPlaying(false); return 1; }
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current!);
  }, [playing]);
  return { stage, setStage, playing, setPlaying };
}

export function Timeline({ stage, setStage, playing, setPlaying, cropKey, compact = false }: {
  stage: number; setStage: (s: number) => void; playing: boolean; setPlaying: (p: boolean) => void; cropKey: string; compact?: boolean;
}) {
  const days = SEASON_DAYS[cropKey] ?? 120;
  const marks = ["Sowing", "Vegetative", "Flowering", "Maturity", "Harvest"];
  return (
    <div className={`panel flex items-center gap-3 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <button
        onClick={() => { if (stage >= 1) setStage(0); setPlaying(!playing); }}
        className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-bone text-soil-950 hover:bg-wheat-300 transition"
        aria-label={playing ? "Pause" : "Play season"}
      >
        {playing ? <Icon.pause /> : <Icon.play />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[12.5px] text-bone">{stageName(stage)}</span>
          <span className="num text-[11px] text-bone/50">Day {Math.round(stage * days)} / {days}</span>
        </div>
        <input type="range" min={0} max={1} step={0.001} value={stage} onChange={(e) => { setPlaying(false); setStage(Number(e.target.value)); }}
          style={{ ["--p" as string]: `${stage * 100}%`, ["--fill" as string]: "#a8e07a" }} />
        {!compact && (
          <div className="flex justify-between mt-1 text-[9.5px] uppercase tracking-wider text-bone/30">
            {marks.map((m) => <span key={m}>{m}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TwinView({ twin, cropName, cropHindi, scanKey, quality = "high", compact = false, stageCtl, title, onAdvisor }: {
  twin: Twin; cropName: string; cropHindi: string; scanKey?: string | number; quality?: "high" | "low"; compact?: boolean;
  stageCtl: ReturnType<typeof useStage>; title?: string; onAdvisor?: () => void;
}) {
  const [labels, setLabels] = useState(false);
  const [rotate, setRotate] = useState(false);
  const water = { dry: ["Water stress", "bad"], waterlogged: ["Waterlogged", "warn"], optimal: ["Water optimal", "good"] }[twin.water] as [string, "bad" | "warn" | "good"];
  const dz = twin.disease > 0.6 ? "bad" : twin.disease > 0.3 ? "warn" : "good";

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-soil-700/80 bg-soil-850">
      <div className="absolute inset-0">
        <TwinCanvas twin={twin} stage={stageCtl.stage} quality={quality} labels={labels} autoRotate={rotate} scanKey={scanKey} />
      </div>

      {/* HUD — top left */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-3 rounded-2xl bg-soil-950/60 backdrop-blur-md border border-bone/10 pl-2 pr-4 py-2">
        <div className="relative">
          <Ring value={twin.health} size={compact ? 44 : 54} stroke={5} color={healthColor(twin.health)} />
          <div className="absolute inset-0 grid place-items-center num text-[12px] text-bone">{Math.round(twin.health * 100)}</div>
        </div>
        <div>
          {title && <div className="label text-wheat-400/80">{title}</div>}
          <div className={`font-display ${compact ? "text-[17px]" : "text-[21px]"} leading-tight text-bone`}>{cropName}</div>
          <div className="text-[11px] text-bone/50">{cropHindi} · crop health</div>
        </div>
      </div>

      {/* HUD — top right */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="flex gap-1.5 flex-wrap justify-end pointer-events-none rounded-full bg-soil-950/75 backdrop-blur-md p-1 border border-bone/10">
          <Pill tone={water[1]}>{Icon.drop()} {water[0]}</Pill>
          <Pill tone={dz}>{Icon.bug()} Disease {Math.round(twin.disease * 100)}%</Pill>
          {!compact && <Pill tone="neutral">{Icon.sun()} {twin.temperature}°C · {twin.humidity}%</Pill>}
        </div>
        {!compact && (
          <div className="flex gap-1.5">
            <button onClick={() => setLabels(!labels)} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${labels ? "border-leaf-400/50 text-leaf-300" : "border-soil-600 text-bone/50"} bg-soil-950/60 backdrop-blur`}>{labels ? "Hide" : "Show"} sensors</button>
            <button onClick={() => setRotate(!rotate)} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${rotate ? "border-leaf-400/50 text-leaf-300" : "border-soil-600 text-bone/50"} bg-soil-950/60 backdrop-blur`}>Auto-rotate</button>
          </div>
        )}
      </div>

      {/* bottom timeline */}
      {!compact && (
        <div className="absolute left-3 right-3 bottom-3">
          <Timeline {...stageCtl} cropKey={twin.crop_key} />
        </div>
      )}
      {!compact && (
        <div className="absolute left-3 right-3 bottom-[94px] flex items-end justify-between gap-3">
          <div className="pointer-events-none rounded-xl bg-soil-950/65 backdrop-blur-md border border-bone/10 px-3 py-2 text-[10.5px] text-bone/70 space-y-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#467a2a]" />Healthy</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#b9a540]" />Stressed</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-[#8f4d22]" />Disease</span>
            </div>
            <div className="text-bone/40 hidden sm:block">Drag to rotate · scroll to zoom</div>
          </div>
          {onAdvisor && (
            <button onClick={onAdvisor}
              className="flex items-center gap-2 rounded-full bg-wheat-400 pl-3 pr-4 py-2.5 text-[13px] font-semibold text-soil-950 shadow-lg shadow-black/40 hover:bg-wheat-300 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wheat-300">
              {Icon.spark("#0d0b08")} Ask AI Farm Advisor
            </button>
          )}
        </div>
      )}
    </div>
  );
}
