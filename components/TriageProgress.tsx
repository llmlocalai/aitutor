"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { t, type LS } from "@/lib/types";

const KEY = "aitutor.triage.done";
const EVT = "triage-progress";

function load(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function save(v: Record<string, boolean>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVT));
}
function useDone() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const sync = () => setDone(load());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return done;
}

export interface ProgressStep { id: string; n: number; bp: string; title: LS; stage: string }

/** Overall progress and the next step whose prerequisites are all ticked. */
export function TriageProgress({ steps, after }: { steps: ProgressStep[]; after: Record<string, string[]> }) {
  const done = useDone();
  const count = steps.filter((s) => done[s.id]).length;
  const next = steps.find((s) => !done[s.id] && (after[s.id] ?? []).every((a) => done[a]));
  const stagesSeen: string[] = [];
  for (const s of steps) if (!stagesSeen.includes(s.stage)) stagesSeen.push(s.stage);
  return (
    <div className="card ct-progress">
      <div className="gates-bar" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={steps.length}>
        <div style={{ width: `${Math.round((count / steps.length) * 100)}%` }} />
        <span>{count} / {steps.length}</span>
      </div>
      <div className="ct-next">
        {next ? (
          <><b className="lab"><T v={t("Next step", "下一步")} /></b>
            <a href={`#f-${next.id}`}>{String(next.n).padStart(2, "0")} · {next.bp} · <T v={next.title} /></a></>
        ) : <T v={t("Every step is ticked.", "所有步骤都已勾选。")} />}
      </div>
      <div className="ct-dots">
        {stagesSeen.map((st) => (
          <div key={st} className="ct-dot-row">
            <span className="chip">{st}</span>
            {steps.filter((s) => s.stage === st).map((s) => (
              <a key={s.id} href={`#f-${s.id}`} className={`ct-dot ${done[s.id] ? "on" : ""} ${next?.id === s.id ? "nx" : ""}`}
                title={`${s.bp} ${s.title.en}`} aria-label={`${s.bp} ${s.title.en}${done[s.id] ? " (done)" : ""}`}>{s.bp}</a>
            ))}
          </div>
        ))}
      </div>
      <button type="button" className="quiet ct-reset" onClick={() => save({})}><T v={t("Clear my ticks", "清除我的勾选")} /></button>
    </div>
  );
}

/** The tick box inside a step. */
export function TriageCheck({ id }: { id: string }) {
  const done = useDone();
  return (
    <label className={`ct-check ${done[id] ? "on" : ""}`}>
      <input type="checkbox" checked={!!done[id]} onChange={(e) => save({ ...load(), [id]: e.target.checked })} />
      <T v={t("Test passed: mark this step done", "测试已通过：标记此步完成")} />
    </label>
  );
}
