"use client";

import { useMemo, useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

export interface MapNode { id: string; n: number; title: LS; after: string[]; afterAny: string[] }
export interface MapPhase { id: string; title: LS; nodes: MapNode[] }

/** Phases as columns, steps as nodes. Selecting a step lights up what it needs and what it unlocks. */
export default function ReplicateMap({ phases }: { phases: MapPhase[] }) {
  const all = useMemo(() => phases.flatMap((p) => p.nodes), [phases]);
  const byId = useMemo(() => Object.fromEntries(all.map((n) => [n.id, n])), [all]);
  const [sel, setSel] = useState<string>(all.find((n) => n.id === "agent")?.id ?? all[0].id);

  // everything upstream (transitively) and the direct dependents
  const needs = useMemo(() => {
    const out = new Set<string>();
    const walk = (id: string) => {
      for (const a of [...byId[id].after, ...byId[id].afterAny]) if (!out.has(a)) { out.add(a); walk(a); }
    };
    walk(sel);
    return out;
  }, [sel, byId]);
  const unlocks = useMemo(() => {
    const out = new Set<string>();
    const walk = (id: string) => {
      for (const n of all) if ((n.after.includes(id) || n.afterAny.includes(id)) && !out.has(n.id)) { out.add(n.id); walk(n.id); }
    };
    walk(sel);
    return out;
  }, [sel, all]);

  const cur = byId[sel];
  const cls = (id: string) => (id === sel ? "sel" : needs.has(id) ? "needs" : unlocks.has(id) ? "unlocks" : "dim");

  return (
    <div className="rmap">
      <div className="rmap-cols">
        {phases.map((p, i) => (
          <div key={p.id} className="rmap-col">
            <div className="rmap-ph"><span>{i + 1}</span> <T v={p.title} /></div>
            {p.nodes.map((n) => (
              <button key={n.id} type="button" className={`rmap-node ${cls(n.id)}`} onClick={() => setSel(n.id)} aria-pressed={n.id === sel}>
                <b>{String(n.n).padStart(2, "0")}</b> <T v={n.title} />
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="rmap-detail">
        <div>
          <b className="lab"><T v={ui.selected} /></b>
          <a href={`#r-${cur.id}`}>{String(cur.n).padStart(2, "0")} <T v={cur.title} /></a>
        </div>
        <div>
          <b className="lab needs-l"><T v={ui.dbxNeeds} /></b>
          {cur.after.length + cur.afterAny.length === 0 ? <span className="muted"><T v={ui.nothingFirst} /></span> : (
            <span className="chips">
              {cur.after.map((a) => (<a key={a} className="chip" href={`#r-${a}`}>{byId[a].n} · <T v={byId[a].title} /></a>))}
              {cur.afterAny.length > 0 && (
                <span className="chip any"><T v={ui.dbxOneOf} />: {cur.afterAny.map((a) => byId[a].n).join(" / ")}</span>
              )}
            </span>
          )}
        </div>
        <div>
          <b className="lab unlocks-l"><T v={ui.dbxUnlocks} /></b>
          {all.some((n) => n.after.includes(sel) || n.afterAny.includes(sel)) ? (
            <span className="chips">
              {all.filter((n) => n.after.includes(sel) || n.afterAny.includes(sel)).map((n) => (
                <a key={n.id} className="chip" href={`#r-${n.id}`}>{n.n} · <T v={n.title} /></a>
              ))}
            </span>
          ) : <span className="muted"><T v={ui.dbxNoDependents} /></span>}
        </div>
      </div>
    </div>
  );
}
