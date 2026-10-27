"use client";
import { ReactNode } from "react";

export function Slider({
  label, value, min, max, step = 1, unit, onChange, hint, ideal,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; hint?: string; ideal?: [number, number];
}) {
  const p = ((value - min) / (max - min)) * 100;
  const inIdeal = ideal ? value >= ideal[0] && value <= ideal[1] : undefined;
  return (
    <label className="block group">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] text-bone/75">{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            type="number" value={value} min={min} max={max} step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="num w-16 bg-transparent text-right text-[13px] text-bone outline-none focus:text-wheat-400"
          />
          {unit && <span className="text-[11px] text-bone/40 num">{unit}</span>}
        </span>
      </div>
      <div className="relative h-4 flex items-center">
        {ideal && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[12px] rounded-full bg-leaf-400/15 border border-leaf-400/40 pointer-events-none"
            style={{ left: `${((ideal[0] - min) / (max - min)) * 100}%`, width: `${((ideal[1] - ideal[0]) / (max - min)) * 100}%` }}
          />
        )}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ["--p" as string]: `${p}%`, ["--fill" as string]: inIdeal === false ? "#e0784a" : "#e8c66a" }}
          className="relative z-[1]"
        />
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-bone/35">{hint}</div>}
    </label>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="py-4 border-b border-soil-700/60 last:border-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="label">{title}</h3>
        {right}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export function Card({ title, children, className = "", right, delay = 0 }: { title: string; children: ReactNode; className?: string; right?: ReactNode; delay?: number }) {
  return (
    <div className={`panel p-4 rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="label">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Bar({ value, color = "#e8c66a", track = "#2f281d", h = 6 }: { value: number; color?: string; track?: string; h?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: track, height: h }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" | "info" }) {
  const t = {
    good: "bg-leaf-500/15 text-leaf-300 border-leaf-500/30",
    warn: "bg-wheat-500/15 text-wheat-300 border-wheat-500/30",
    bad: "bg-rust-500/15 text-rust-400 border-rust-500/35",
    info: "bg-sky-400/10 text-sky-400 border-sky-400/30",
    neutral: "bg-soil-800 text-bone/70 border-soil-600",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Ring({ value, size = 64, stroke = 6, color }: { value: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(239,232,216,.12)" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset .8s ease" }} />
    </svg>
  );
}

export const healthColor = (h: number) => (h > 0.66 ? "#7cc443" : h > 0.4 ? "#e8c66a" : "#e0784a");

export const Icon = {
  leaf: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
  ),
  drop: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
  ),
  sun: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
  ),
  bug: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5m3 8H2m1 8c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4m-.8 4c2.1.1 3.8 1.9 3.8 4"/></svg>
  ),
  spark: (c = "currentColor") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/></svg>
  ),
  play: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>),
  pause: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>),
  pin: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>),
  loc: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
};
