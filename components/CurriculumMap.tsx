"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ancestors, byId, dependents, modules } from "@/lib/curriculum";

const W = 1120;
const H = 470;
const NW = 158;
const NH = 50;
const COLS = ["FOUNDATION", "CONTRACTS", "CAPABILITIES", "THE LOOP", "BEHAVIOR", "SYSTEMS"];

function layout() {
  const cols: Record<number, string[]> = {};
  for (const m of modules) (cols[m.layer] ??= []).push(m.id);
  const pos: Record<string, { x: number; y: number }> = {};
  const n = COLS.length;
  const gap = (W - 40 - NW) / (n - 1);
  for (const [layer, ids] of Object.entries(cols)) {
    const x = 20 + Number(layer) * gap;
    const usable = H - 60;
    ids.forEach((id, i) => {
      const y = 44 + (usable / ids.length) * (i + 0.5) - NH / 2;
      pos[id] = { x, y };
    });
  }
  return pos;
}

export default function CurriculumMap() {
  const pos = useMemo(layout, []);
  const [sel, setSel] = useState<string>("harness");
  const needs = useMemo(() => ancestors(sel), [sel]);
  const unlocks = useMemo(() => new Set(dependents(sel).map((m) => m.id)), [sel]);
  const m = byId[sel];

  const cls = (id: string) => {
    if (id === sel) return "sel";
    if (needs.has(id)) return "needs";
    if (unlocks.has(id)) return "unlocks";
    return "dim";
  };

  return (
    <div className="map-wrap">
      <div>
        <div className="map-scroll">
          <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Curriculum dependency map">
            {COLS.map((c, i) => (
              <text key={c} className="map-col" x={20 + i * ((W - 40 - NW) / (COLS.length - 1)) + NW / 2} y={22} textAnchor="middle">
                {c}
              </text>
            ))}
            {modules.flatMap((mod) =>
              mod.prereqs.map((p) => {
                const a = pos[p.id];
                const b = pos[mod.id];
                if (!a || !b) return null;
                const x1 = a.x + NW;
                const y1 = a.y + NH / 2;
                const x2 = b.x;
                const y2 = b.y + NH / 2;
                const mx = (x1 + x2) / 2;
                let k = "dim";
                if (mod.id === sel || (needs.has(mod.id) && needs.has(p.id))) k = "needs";
                if (p.id === sel) k = "unlocks";
                return (
                  <path
                    key={`${p.id}-${mod.id}`}
                    className={`map-edge ${k}`}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  />
                );
              }),
            )}
            {modules.map((mod) => {
              const p = pos[mod.id];
              return (
                <g
                  key={mod.id}
                  className={`map-node ${mod.depth} ${cls(mod.id)}`}
                  transform={`translate(${p.x},${p.y})`}
                  onClick={() => setSel(mod.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSel(mod.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={mod.id === sel}
                  aria-label={`${mod.title}. ${mod.depth === "deep" ? "Full lesson." : "Outline."}`}
                >
                  <rect width={NW} height={NH} rx={8} />
                  <text x={12} y={22}>{mod.title.length > 22 ? mod.title.slice(0, 21) + "…" : mod.title}</text>
                  <text className="sub" x={12} y={38}>
                    {mod.depth === "deep" ? "FULL LESSON" : "OUTLINE"}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="legend">
          <span><i className="lg-deep" />Full lesson</span>
          <span><i className="lg-needs" />Must exist first</span>
          <span><i className="lg-unlocks" />Unlocked next</span>
          <span className="muted">Select a module. Scroll sideways on a small screen.</span>
        </div>
      </div>

      <aside className="panel" aria-live="polite" style={{ marginTop: 16 }}>
        <div className="eyebrow">Selected</div>
        <h3 style={{ fontSize: "1.3rem", marginTop: 4 }}>{m.title}</h3>
        <p className="muted small" style={{ marginTop: 6 }}>{m.short}</p>
        <Link className="btn" href={`/modules/${m.id}`}>
          Open {m.depth === "deep" ? "lesson" : "outline"}
        </Link>

        <div className="two" style={{ marginTop: 18 }}>
        <div>
        <h3>Why these come first</h3>
        {m.prereqs.length === 0 ? (
          <p className="muted small" style={{ marginTop: 6 }}>
            Nothing. This is a starting point.
          </p>
        ) : (
          <ul className="why-list">
            {m.prereqs.map((p) => (
              <li key={p.id}>
                <b>{byId[p.id].title}</b>
                <span>{p.why}</span>
                {p.stub && (
                  <span className="stub">
                    <b>Build out of order</b> Stub it with: {p.stub}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        </div>
        <div>
        {unlocks.size > 0 && (
          <>
            <h3>What this unlocks</h3>
            <ul className="why-list">
              {dependents(sel).map((d) => (
                <li key={d.id} className="un">
                  <b>{d.title}</b>
                  <span>{d.prereqs.find((p) => p.id === sel)?.why}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        </div>
        </div>
      </aside>
    </div>
  );
}
