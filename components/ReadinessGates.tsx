"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

const KEY = "aitutor.dbx.gates";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** The production readiness audit as a checklist. Ticks stay in this browser only. */
export default function ReadinessGates({ gates }: { gates: { area: LS; items: LS[] }[] }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => setDone(read()), []);
  const total = gates.reduce((n, g) => n + g.items.length, 0);
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const pct = Math.round((done.length / total) * 100);
  return (
    <div className="gates">
      <div className="gates-bar" role="progressbar" aria-valuenow={done.length} aria-valuemin={0} aria-valuemax={total}>
        <div style={{ width: `${pct}%` }} />
        <span>{done.length} / {total} · {done.length === total ? <T v={ui.nbReady} /> : <T v={ui.nbNotReady} />}</span>
      </div>
      <div className="gates-grid">
        {gates.map((g, gi) => (
          <div key={g.area.en} className="card gate-card">
            <h3><T v={g.area} /></h3>
            <ul>
              {g.items.map((it, ii) => {
                const id = `${gi}.${ii}`;
                return (
                  <li key={id}>
                    <label>
                      <input type="checkbox" checked={done.includes(id)} onChange={() => toggle(id)} />
                      <span><T v={it} /></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
