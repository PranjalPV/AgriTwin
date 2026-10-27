"use client";
import { useEffect, useRef } from "react";
import type { Advice } from "@/lib/api";
import { AdviceCard } from "./Results";
import { Icon } from "./ui/primitives";

/** Slide-in panel holding the AI Farm Advisor. */
export function AdvisorDrawer({
  open, onClose, cropName, advice, loading, error, lang, setLang,
}: {
  open: boolean; onClose: () => void; cropName: string; advice: Advice | null; loading: boolean; error?: string;
  lang: "en" | "hi"; setLang: (l: "en" | "hi") => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-soil-950/60 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog" aria-modal="true" aria-label="AI Farm Advisor"
        className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-soil-900 border-l border-soil-700 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-soil-700/70">
          <div className="w-9 h-9 rounded-xl bg-wheat-400 grid place-items-center">{Icon.spark("#0d0b08")}</div>
          <div className="flex-1">
            <div className="font-display text-[20px] leading-none">AI Farm Advisor</div>
            <div className="text-[11.5px] text-bone/50 mt-1">Advice for your {cropName} scenario</div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close advisor"
            className="w-9 h-9 rounded-full border border-soil-600 text-bone/70 hover:text-bone hover:border-bone/40 grid place-items-center text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {open && <AdviceCard advice={advice} loading={loading} lang={lang} setLang={setLang} error={error} />}
          <p className="text-[11px] text-bone/35 mt-4 px-1">Advice supports decisions; confirm doses with your local Krishi Vigyan Kendra.</p>
        </div>
      </aside>
    </div>
  );
}

const STEPS = [
  { t: "Pick a crop", d: "Choose what you want to grow. The 3D farm switches to that crop." },
  { t: "Set the place and soil", d: "Tap a city to load its weather, then pick the closest soil type. Move any slider — the farm updates instantly." },
  { t: "Read the result", d: "The card on the right says whether it's a good season, the expected harvest and disease risk. Tap “Ask AI Farm Advisor” for what to do." },
  { t: "Play the season", d: "Press ▶ under the farm to watch the crop grow from sowing to harvest. Drag to rotate, scroll to zoom." },
];

/** First-visit walkthrough. */
export function Guide({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="How to use AgriTwin">
      <div className="absolute inset-0 bg-soil-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative panel max-w-lg w-full p-6 rise">
        <div className="font-display text-[26px] leading-tight">Welcome to AgriTwin</div>
        <p className="text-[13px] text-bone/60 mt-1">A virtual copy of a farm. Try a season here before trying it in the field.</p>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-wheat-400 text-soil-950 text-[12px] font-semibold num">{i + 1}</span>
              <div><div className="text-[14px] text-bone">{s.t}</div><div className="text-[12.5px] text-bone/55 leading-snug">{s.d}</div></div>
            </li>
          ))}
        </ol>
        <button autoFocus onClick={onClose} className="mt-6 w-full rounded-xl bg-wheat-400 py-2.5 text-[14px] font-semibold text-soil-950 hover:bg-wheat-300">Start</button>
      </div>
    </div>
  );
}
