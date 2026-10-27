"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Controls from "@/components/Controls";
import { AdvisorDrawer, Guide } from "@/components/Overlays";
import { DiseaseCard, Recommendation, TwinStats, Verdict, YieldCard } from "@/components/Results";
import TwinView, { useStage } from "@/components/TwinView";
import { CompareView, HistoryView, type Scenario } from "@/components/Views";
import { Icon, Pill } from "@/components/ui/primitives";
import { api, DEMO, DEFAULT_INPUTS, type Advice, type Inputs, type Meta, type Result } from "@/lib/api";

type Tab = "farm" | "compare" | "history";
const TABS: [Tab, string][] = [["farm", "My farm"], ["compare", "Compare"], ["history", "Saved"]];
const GUIDE_KEY = "agritwin-guide-seen";

export default function Home() {
  const [tab, setTab] = useState<Tab>("farm");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [health, setHealth] = useState<{ gemini: boolean; storage: string } | null>(null);
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [ran, setRan] = useState<{ inputs: Inputs; result: Result } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [err, setErr] = useState<string>();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [adviceFor, setAdviceFor] = useState<string>("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceErr, setAdviceErr] = useState<string>();
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [pinA, setPinA] = useState<Scenario | null>(null);
  const [pinB, setPinB] = useState<Scenario | null>(null);
  const [savedId, setSavedId] = useState<string>("");
  const [toast, setToast] = useState<string>("");
  const [history, setHistory] = useState<{ id: string; created_at: string; inputs: Inputs; outputs: Result }[]>([]);
  const [histErr, setHistErr] = useState<string>();
  const stageCtl = useStage(0.62);
  const seq = useRef(0);
  const booted = useRef(false);

  const notify = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2200); };

  // live simulation: re-run whenever inputs change (debounced, not saved to history)
  useEffect(() => {
    const id = ++seq.current;
    setUpdating(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await api.simulate(inputs, false);
        if (id !== seq.current) return;
        setRan({ inputs, result: r });
        setErr(undefined);
      } catch (e) {
        if (id !== seq.current) return;
        setErr(DEMO ? `Simulation failed: ${(e as Error).message}` : `Can't reach the AgriTwin server. Start the backend: uvicorn app.main:app --reload`);
      } finally {
        if (id === seq.current) setUpdating(false);
      }
    }, ran ? 380 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  useEffect(() => {
    if (booted.current) return; // React StrictMode runs effects twice in dev
    booted.current = true;
    api.meta().then(setMeta).catch(() => {});
    api.health().then(setHealth).catch(() => {});
    try { if (!localStorage.getItem(GUIDE_KEY)) setGuideOpen(true); } catch { setGuideOpen(true); }
  }, []);

  // advisor fetches lazily — only when the panel is open and the scenario or language changed
  const adviceKey = useRef("");
  useEffect(() => {
    if (!advisorOpen || !ran) return;
    const key = `${ran.result.id}-${lang}`;
    if (key === adviceKey.current) return;
    adviceKey.current = key;
    setAdviceLoading(true); setAdviceErr(undefined);
    api.advice(ran.inputs, ran.result, lang)
      .then((a) => { if (adviceKey.current === key) { setAdvice(a); setAdviceFor(key); setAdviceLoading(false); } })
      .catch((e) => { if (adviceKey.current === key) { setAdviceErr(`Advisor unavailable: ${e.message}`); setAdviceLoading(false); adviceKey.current = ""; } });
  }, [advisorOpen, ran, lang]);

  useEffect(() => {
    if (tab === "history") api.history().then((h) => { setHistory(h); setHistErr(undefined); }).catch((e) => setHistErr(e.message));
  }, [tab]);

  const closeGuide = useCallback(() => { setGuideOpen(false); try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* ignore */ } }, []);
  const closeAdvisor = useCallback(() => setAdvisorOpen(false), []);

  async function save() {
    if (!ran) return;
    try {
      const r = await api.simulate(ran.inputs, true);
      setRan({ inputs: ran.inputs, result: r });
      setSavedId(r.id);
      notify("Saved — find it under Saved");
    } catch (e) { notify(`Couldn't save: ${(e as Error).message}`); }
  }
  function pin(which: "A" | "B") {
    if (!ran) return;
    (which === "A" ? setPinA : setPinB)(ran);
    const other = which === "A" ? pinB : pinA;
    notify(other ? `Pinned as ${which}. Open Compare to see both.` : `Pinned as ${which}. Change something, then pin the other one.`);
  }

  const r = ran?.result;
  const cropMeta = meta?.crops.find((c) => c.name === ran?.inputs.crop);
  const cropName = (ran?.inputs.crop ?? inputs.crop).replace(", paddy", "").replace(" and others", "");
  const pinBtn = (which: "A" | "B", p: Scenario | null) => (
    <button onClick={() => pin(which)}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[12px] transition ${p && p.result.id === r?.id ? "border-leaf-400/60 text-leaf-300" : "border-soil-600 text-bone/70 hover:text-bone"}`}>
      <Icon.pin /> {p ? `Pinned ${which}` : `Pin as ${which}`}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen lg:h-screen">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-soil-700/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-leaf-400 to-wheat-500 grid place-items-center">{Icon.leaf("#0d0b08")}</div>
          <div>
            <div className="font-display text-[20px] leading-none">AgriTwin</div>
            <div className="text-[10.5px] text-bone/45 mt-0.5">Try your crop season before you sow</div>
          </div>
        </div>
        <nav className="flex gap-1 rounded-full border border-soil-700 p-1 overflow-x-auto max-w-full">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1 text-[12.5px] transition ${tab === t ? "bg-bone text-soil-950" : "text-bone/60 hover:text-bone"}`}>
              {label}{t === "compare" && (pinA || pinB) ? ` (${[pinA, pinB].filter(Boolean).length}/2)` : ""}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {DEMO && <Pill tone="info">Demo</Pill>}
          <button onClick={() => setAdvisorOpen(true)} disabled={!r}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-wheat-400/50 px-3 py-1.5 text-[12px] text-wheat-300 hover:bg-wheat-400/10 disabled:opacity-40">
            {Icon.spark()} AI Advisor
          </button>
          <button onClick={() => setGuideOpen(true)} aria-label="How to use"
            className="w-8 h-8 rounded-full border border-soil-600 text-bone/70 hover:text-bone text-[13px]" title="How to use">?</button>
        </div>
      </header>

      {err && <div className="mx-5 mt-3 rounded-xl border border-rust-500/40 bg-rust-500/10 px-4 py-2 text-[12.5px] text-rust-400">{err}</div>}

      <main className="flex-1 min-h-0 p-3">
        {tab === "farm" && (
          <div className="grid gap-3 h-full lg:grid-cols-[310px_minmax(0,1fr)_360px]">
            <aside className="panel min-h-0 flex flex-col overflow-hidden order-2 lg:order-1">
              <Controls inputs={inputs} setInputs={setInputs} meta={meta} updating={updating} />
            </aside>

            <section className="min-h-[480px] lg:min-h-0 order-1 lg:order-2">
              {r ? (
                <TwinView twin={r.twin} cropName={cropName} cropHindi={cropMeta?.hindi ?? ""} scanKey={r.id} stageCtl={stageCtl}
                  onAdvisor={() => setAdvisorOpen(true)} />
              ) : (
                <div className="h-full panel grid place-items-center text-bone/40 text-sm">{err ? "Waiting for the server…" : "Preparing your farm…"}</div>
              )}
            </section>

            <aside className="min-h-0 overflow-y-auto space-y-3 order-3 pr-0.5">
              {r && ran && (
                <>
                  <Verdict r={r} inputs={ran.inputs} lang={lang} onAdvisor={() => setAdvisorOpen(true)} />
                  <div className="flex gap-2">
                    {pinBtn("A", pinA)}
                    {pinBtn("B", pinB)}
                    <button onClick={save} disabled={savedId === r.id}
                      className="flex-1 rounded-xl border border-soil-600 px-2 py-2 text-[12px] text-bone/70 hover:text-bone disabled:text-leaf-300 disabled:border-leaf-400/50">
                      {savedId === r.id ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                  {pinA && pinB && (
                    <button onClick={() => setTab("compare")} className="w-full rounded-xl border border-wheat-400/60 py-2 text-[12.5px] text-wheat-300 hover:bg-wheat-400/10">Compare A and B →</button>
                  )}
                  <div className="label pt-2 px-1">Details</div>
                  <YieldCard r={r} inputs={ran.inputs} />
                  <DiseaseCard r={r} />
                  <TwinStats r={r} />
                  <Recommendation r={r} lang={lang} />
                </>
              )}
            </aside>
          </div>
        )}

        {tab === "compare" && <CompareView a={pinA} b={pinB} onGo={() => setTab("farm")} />}
        {tab === "history" && (
          <HistoryView items={history} error={histErr} onLoad={(s) => { setInputs(s.inputs); setTab("farm"); }} />
        )}
      </main>

      <AdvisorDrawer open={advisorOpen} onClose={closeAdvisor} cropName={cropName}
        advice={adviceFor === `${r?.id}-${lang}` ? advice : null} loading={adviceLoading} error={adviceErr} lang={lang} setLang={setLang} />
      <Guide open={guideOpen} onClose={closeGuide} />

      <div aria-live="polite" className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 rounded-full bg-bone text-soil-950 px-4 py-2 text-[12.5px] font-medium shadow-xl transition ${toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
        {toast}
      </div>
    </div>
  );
}
