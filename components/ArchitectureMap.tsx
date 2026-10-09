"use client";

import { useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

export interface ArchNodeView { id: string; label: LS; detail: LS; steps: { id: string; n: number; title: LS }[] }
export interface ArchLayerView { id: string; label: LS; nodes: ArchNodeView[] }

/** Layered architecture. Click a component: its role, and the steps that build it. */
export default function ArchitectureMap({ layers }: { layers: ArchLayerView[] }) {
  const all = layers.flatMap((l) => l.nodes);
  const [sel, setSel] = useState<string>("agent");
  const cur = all.find((n) => n.id === sel) ?? all[0];
  return (
    <div className="arch">
      <div className="arch-layers">
        {layers.map((l, i) => (
          <div key={l.id} className={`arch-layer L${i}`}>
            <div className="arch-label"><T v={l.label} /></div>
            <div className="arch-nodes">
              {l.nodes.map((n) => (
                <button key={n.id} type="button" className={`arch-node ${n.id === sel ? "sel" : ""}`}
                        aria-pressed={n.id === sel} onClick={() => setSel(n.id)}>
                  <T v={n.label} />
                  <i>{n.steps.map((s) => String(s.n).padStart(2, "0")).join(" ")}</i>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="arch-detail">
        <h3><T v={cur.label} /></h3>
        <p><T v={cur.detail} /></p>
        <b className="lab"><T v={ui.nbBuiltBy} /></b>
        <span className="chips">
          {cur.steps.map((s) => (<a key={s.id} className="chip" href={`#r-${s.id}`}>{String(s.n).padStart(2, "0")} · <T v={s.title} /></a>))}
        </span>
      </div>
    </div>
  );
}
