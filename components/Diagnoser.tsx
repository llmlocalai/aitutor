"use client";

import { useEffect, useMemo, useState } from "react";
import T from "@/components/T";
import type { Symptom } from "@/content/harness/types";
import { currentFamily } from "@/lib/harness-family";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

interface Ranked { id: string; count: number }

/** Parse a run summary from harness/evals/run_eval.py and total its symptom counts across variants. */
function rank(text: string): Ranked[] | null {
  try {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.variants)) return null;
    const tot: Record<string, number> = {};
    for (const v of s.variants) for (const [k, n] of Object.entries(v.symptoms ?? {})) tot[k] = (tot[k] ?? 0) + Number(n);
    return Object.entries(tot).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  } catch {
    return null;
  }
}

export default function Diagnoser({ symptoms, steps, familyLabels }: {
  symptoms: Symptom[]; steps: { id: string; n: number; title: LS }[]; familyLabels: Record<string, string>;
}) {
  const [step, setStep] = useState("");
  const [pick, setPick] = useState(symptoms[0].id);
  const [fam, setFam] = useState("all");
  const [paste, setPaste] = useState("");
  const [ranked, setRanked] = useState<Ranked[] | null | "bad">(null);

  useEffect(() => {
    setFam(currentFamily());
    const onFam = (e: Event) => setFam((e as CustomEvent<string>).detail);
    const onStep = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setStep(id);
      const first = symptoms.find((s) => s.steps.includes(id));
      if (first) setPick(first.id);
    };
    window.addEventListener("hx-family", onFam);
    window.addEventListener("hx-diagnose", onStep);
    return () => { window.removeEventListener("hx-family", onFam); window.removeEventListener("hx-diagnose", onStep); };
  }, [symptoms]);

  const forStep = useMemo(() => (step ? symptoms.filter((s) => s.steps.includes(step)) : symptoms), [step, symptoms]);
  const shown = forStep.length ? forStep : symptoms;          // a step with no symptom of its own lists them all
  const sy = shown.find((s) => s.id === pick) ?? shown[0];
  const known = (id: string) => symptoms.some((s) => s.id === id);
  const stepN = Object.fromEntries(steps.map((s) => [s.id, s]));
  const note = sy && fam !== "all" ? sy.models?.[fam as keyof NonNullable<Symptom["models"]>] : undefined;

  return (
    <div className="diag">
      <div className="diag-controls">
        <label>
          <span><T v={ui.hxStepFilter} /></span>
          <select value={step} onChange={(e) => setStep(e.target.value)}>
            <option value="">{ui.hxAnyStep.en} / {ui.hxAnyStep.zh}</option>
            {steps.map((s) => <option key={s.id} value={s.id}>{String(s.n).padStart(2, "0")} {s.title.en} / {s.title.zh}</option>)}
          </select>
        </label>
      </div>

      <div className="diag-grid">
        {step && !forStep.length && <p className="small muted diag-none"><T v={ui.hxNoStepSymptoms} /></p>}
        <ul className="diag-list" aria-label={`${ui.hxAriaSymptoms.en} / ${ui.hxAriaSymptoms.zh}`}>
          {shown.map((s) => {
            const c = Array.isArray(ranked) ? ranked.find((r) => r.id === s.id)?.count : undefined;
            return (
              <li key={s.id}>
                <button type="button" className={s.id === sy?.id ? "on" : ""} aria-pressed={s.id === sy?.id} onClick={() => setPick(s.id)}>
                  <T v={s.title} />{c ? <b className="diag-count">{c}</b> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {sy && (
          <div className="diag-body">
            <h3><T v={sy.title} /></h3>
            <p><b className="lab"><T v={ui.hxSeen} /></b><T v={sy.seen} /></p>
            {note && <div className="fam-note-live"><b className="lab"><T v={ui.hxForModel} />: {familyLabels[fam]}</b><T v={note} /></div>}
            <h4><T v={ui.hxCauses} /></h4>
            <ol className="diag-causes">
              {sy.causes.map((c) => (
                <li key={c.cause.en}>
                  <b><T v={c.cause} /></b>
                  <div><span className="lab"><T v={ui.hxConfirm} /></span><T v={c.test} /></div>
                  <div><span className="lab"><T v={ui.hxFixL} /></span><T v={c.fix} /></div>
                  {c.options.length > 0 && (
                    <div><span className="lab"><T v={ui.hxOptions} /></span>
                      <ul>{c.options.map((o) => <li key={o.en}><T v={o} /></li>)}</ul>
                    </div>
                  )}
                  <div className="diag-files"><span className="lab"><T v={ui.hxFilesL} /></span>{c.files.map((f) => <code key={f}>{f}</code>)}</div>
                </li>
              ))}
            </ol>
            <div className="verify"><b><T v={ui.hxEvaluate} /></b><T v={sy.evaluate} /></div>
            <p className="small">
              {sy.steps.map((id) => stepN[id] && (
                <a key={id} className="chip" href={`#r-${id}`}>{String(stepN[id].n).padStart(2, "0")} <T v={stepN[id].title} /></a>
              ))}
            </p>
          </div>
        )}
      </div>

      <details className="check diag-paste">
        <summary><T v={ui.hxPasteSummary} /></summary>
        <div className="ans">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} spellCheck={false} placeholder='{"variants": [{"id": "family-default", "symptoms": {...}}]}' />
          <button type="button" onClick={() => { const r = rank(paste); setRanked(r ?? "bad"); const top = r?.find((x) => known(x.id)); if (top) { setStep(""); setPick(top.id); } }}><T v={ui.hxRank} /></button>
          {ranked === "bad" && <p className="warn-text"><T v={ui.hxSummaryBad} /></p>}
          {Array.isArray(ranked) && (
            <ol className="diag-ranked">
              {ranked.map((r) => {
                const s = symptoms.find((x) => x.id === r.id);
                return s
                  ? <li key={r.id}><button type="button" onClick={() => { setStep(""); setPick(r.id); }}><T v={s.title} /></button> <b>{r.count}</b></li>
                  : <li key={r.id}><code>{r.id}</code> <b>{r.count}</b> <span className="small muted">(<T v={ui.hxUnknownSymptom} />)</span></li>;
              })}
            </ol>
          )}
        </div>
      </details>
    </div>
  );
}
