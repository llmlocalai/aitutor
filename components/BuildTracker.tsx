"use client";

import { useEffect, useMemo, useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

type State = "todo" | "doing" | "done" | "stuck";
const STATES: State[] = ["todo", "doing", "done", "stuck"];
const LABEL: Record<State, LS> = { todo: ui.hxTodo, doing: ui.hxDoing, done: ui.hxDoneS, stuck: ui.hxStuck };
const KEY = "aitutor.harness.track";
const LOOP_STEPS = ["cases", "graders", "experiment", "hillclimb"];
// A new round also reopens the release gate: a changed harness has to pass it again.
const ROUND_STEPS = [...LOOP_STEPS, "release"];

export interface TrackStep { id: string; n: number; title: LS; after: string[]; done: LS }
export interface TrackPhase { id: string; title: LS; steps: TrackStep[] }

interface Saved { s: Record<string, State>; round: number }

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object" && v.s) return { s: v.s, round: Number(v.round) || 1 };
  } catch { /* fall through */ }
  return { s: {}, round: 1 };
}

/** The process map with progress: click a step to change its state; the eval steps form a loop with rounds. */
export default function BuildTracker({ phases, loops }: { phases: TrackPhase[]; loops: { from: string; to: string[]; label: LS }[] }) {
  const [saved, setSaved] = useState<Saved>({ s: {}, round: 1 });
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSaved(load()), []);
  const save = (v: Saved) => {
    setSaved(v);
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
  };
  const all = useMemo(() => phases.flatMap((p) => p.steps), [phases]);
  const byId = useMemo(() => Object.fromEntries(all.map((s) => [s.id, s])), [all]);
  const st = (id: string): State => saved.s[id] ?? "todo";
  const next = all.find((s) => st(s.id) !== "done" && s.after.every((a) => st(a) === "done"));
  const doneCount = all.filter((s) => st(s.id) === "done").length;
  const setState = (id: string, v: State) => save({ ...saved, s: { ...saved.s, [id]: v } });
  const newRound = () => {
    const s = { ...saved.s };
    for (const id of ROUND_STEPS) s[id] = "todo";
    save({ s, round: saved.round + 1 });
  };
  const stuckHelp = (id: string) => {
    window.dispatchEvent(new CustomEvent("hx-diagnose", { detail: id }));
    document.getElementById("diagnose")?.scrollIntoView({ behavior: "smooth" });
  };
  const s = sel ? byId[sel] : null;

  return (
    <div className="track">
      <div className="track-head">
        <div className="gates-bar" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={all.length}>
          <div style={{ width: `${Math.round((doneCount / all.length) * 100)}%` }} />
          <span>{doneCount} / {all.length}</span>
        </div>
        <div className="track-round"><b className="lab"><T v={ui.hxRound} /></b> {saved.round}</div>
        <div className="track-actions">
          <button type="button" onClick={newRound}><T v={ui.hxNewRound} /></button>
          <button type="button" className="quiet" onClick={() => save({ s: {}, round: 1 })}><T v={ui.hxReset} /></button>
        </div>
      </div>

      <div className="track-next">
        {next ? (
          <><b className="lab"><T v={ui.hxNext} /></b> <a href={`#r-${next.id}`}>{String(next.n).padStart(2, "0")} <T v={next.title} /></a></>
        ) : <T v={ui.hxAllDone} />}
      </div>

      <div className="track-phases">
        {phases.map((p) => (
          <div key={p.id} className="track-phase">
            <div className="track-ph-title"><T v={p.title} /></div>
            <div className="track-steps">
              {p.steps.map((x) => (
                <button key={x.id} type="button" className={`track-step st-${st(x.id)} ${LOOP_STEPS.includes(x.id) ? "in-loop" : ""} ${sel === x.id ? "sel" : ""} ${next?.id === x.id ? "is-next" : ""}`}
                  onClick={() => setSel(x.id)} aria-pressed={sel === x.id} aria-label={`${x.n}. ${x.title.en} / ${x.title.zh}: ${LABEL[st(x.id)].en} / ${LABEL[st(x.id)].zh}`}>
                  <i>{String(x.n).padStart(2, "0")}</i>
                  <span><T v={x.title} /></span>
                  <em><T v={LABEL[st(x.id)]} /></em>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {s && (
        <div className="track-detail">
          <div className="track-detail-title">{String(s.n).padStart(2, "0")} <T v={s.title} /></div>
          <div className="track-states" role="group" aria-label={`${ui.hxAriaStepState.en} / ${ui.hxAriaStepState.zh}`}>
            {STATES.map((v) => (
              <button key={v} type="button" className={`st-btn st-${v} ${st(s.id) === v ? "on" : ""}`} aria-pressed={st(s.id) === v} onClick={() => setState(s.id, v)}>
                <T v={LABEL[v]} />
              </button>
            ))}
          </div>
          <div><b className="lab"><T v={ui.hxDoneWhen} /></b><T v={s.done} /></div>
          <div className="track-detail-links">
            <a href={`#r-${s.id}`}><T v={ui.hxOpenStep} /></a>
            {st(s.id) === "stuck" && <button type="button" className="stuck-help" onClick={() => stuckHelp(s.id)}><T v={ui.hxStuckHelp} /></button>}
          </div>
        </div>
      )}

      <h3 className="track-loops-title"><T v={ui.hxLoopsTitle} /></h3>
      <ul className="track-loops">
        {loops.map((l) => (
          <li key={l.from + l.to.join()}>
            <span className="chip">{String(byId[l.from]?.n ?? "").padStart(2, "0")}</span>
            <span className="loop-arrow" aria-hidden>↺</span>
            {l.to.map((x) => <a key={x} className="chip" href={`#r-${x}`}>{String(byId[x]?.n ?? "").padStart(2, "0")}</a>)}
            <span className="loop-label"><T v={l.label} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
