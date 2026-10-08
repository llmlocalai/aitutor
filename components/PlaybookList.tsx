"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/lang";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

export interface Row {
  key: string;
  moduleId: string;
  moduleN: number;
  moduleTitle: LS;
  index: number;
  stepId: string;
  title: LS;
  why: LS;
  produces: LS;
  verify: LS;
  run?: string;
  lab: boolean;
  notExecuted: boolean;
  needs: { key: string; what: LS }[];
}

const KEY = "aitutor.steps";

export default function PlaybookList({ rows, modules }: { rows: Row[]; modules: { id: string; n: number; title: LS }[] }) {
  const lang = useLang();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "lab" | "todo">("all");
  const [goal, setGoal] = useState("");
  const byKey = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r])), [rows]);

  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = (k: string) => {
    const next = new Set(done);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setDone(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable */
    }
  };

  // Steps needed to finish the chosen module: its own steps plus everything they use.
  const wanted = useMemo(() => {
    if (!goal) return null;
    const need = new Set<string>();
    const walk = (k: string) => {
      if (need.has(k)) return;
      need.add(k);
      byKey[k]?.needs.forEach((n) => walk(n.key));
    };
    rows.filter((r) => r.moduleId === goal).forEach((r) => walk(r.key));
    return need;
  }, [goal, rows, byKey]);

  const shown = rows.filter(
    (r) =>
      (!wanted || wanted.has(r.key)) &&
      (filter === "all" || (filter === "lab" && !r.notExecuted) || (filter === "todo" && !done.has(r.key))),
  );
  const scope = wanted ? rows.filter((r) => wanted.has(r.key)) : rows;
  const doneCount = scope.filter((r) => done.has(r.key)).length;

  return (
    <div>
      <div className="pb-bar">
        <label>
          <span className="eyebrow"><T v={ui.pbGoal} /></span>
          <select value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="">{ui.pbGoalAll[lang]}</option>
            {modules.map((m) => (<option key={m.id} value={m.id}>{m.n}. {m.title[lang]}</option>))}
          </select>
        </label>
        <label>
          <span className="eyebrow"><T v={ui.pbFilter} /></span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "lab" | "todo")}>
            <option value="all">{ui.pbAll[lang]}</option>
            <option value="lab">{ui.pbLab[lang]}</option>
            <option value="todo">{ui.pbTodo[lang]}</option>
          </select>
        </label>
        <div className="pb-count">
          <b>{doneCount} / {scope.length}</b> <T v={ui.pbProgress} />
          <div className="meter"><i style={{ width: `${scope.length ? (100 * doneCount) / scope.length : 0}%` }} /></div>
        </div>
      </div>
      {wanted && <p className="small muted"><T v={ui.pbGoalNote} /></p>}

      <ol className="pb">
        {shown.map((r) => {
          const pos = rows.indexOf(r) + 1;
          return (
            <li key={r.key} className={done.has(r.key) ? "done" : ""}>
              <input type="checkbox" checked={done.has(r.key)} onChange={() => toggle(r.key)} aria-label={r.title[lang]} />
              <div>
                <div className="meta">
                  <span className="num">{String(pos).padStart(3, "0")}</span>
                  <Link href={`/modules/${r.moduleId}`}>{r.moduleN}. <T v={r.moduleTitle} /></Link> · {r.index}
                  {r.notExecuted && <span className="tag warn"><T v={ui.notExecuted} /></span>}
                </div>
                <h3><Link href={`/modules/${r.moduleId}#step-${r.stepId}`}><T v={r.title} /></Link></h3>
                <p className="why"><T v={r.why} /></p>
                {r.needs.length > 0 && (
                  <p className="link in">
                    <b><T v={ui.uses} /></b>{" "}
                    {r.needs.map((n, i) => (
                      <span key={n.key}>
                        {i > 0 && " · "}
                        <T v={n.what} /> ← <Link href={`/modules/${byKey[n.key].moduleId}#step-${byKey[n.key].stepId}`}>
                          <T v={byKey[n.key].moduleTitle} /> {byKey[n.key].index}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
                <p className="link out"><b><T v={ui.produces} /></b> <T v={r.produces} /></p>
                {r.run && <code className="runline">{r.run}</code>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
