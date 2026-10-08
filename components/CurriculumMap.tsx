"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/lang";
import { makeGraph, type Slim } from "@/lib/graph";
import { t } from "@/lib/types";
import { ui } from "@/lib/ui";

const W = 1180;
const H = 470;
const NW = 148;
const NH = 50;
const COLS = [
  t("FOUNDATION", "基础"), t("CONTRACTS", "契约"), t("RETRIEVAL", "检索"), t("ACTIONS", "动作"),
  t("THE LOOP", "循环"), t("BEHAVIOR", "行为"), t("SYSTEMS", "系统"),
];
const GAP = (W - 30 - NW) / (COLS.length - 1);

function layout(modules: Slim[]) {
  const cols: Record<number, string[]> = {};
  for (const m of modules) (cols[m.layer] ??= []).push(m.id);
  const pos: Record<string, { x: number; y: number }> = {};
  for (const [layer, ids] of Object.entries(cols)) {
    const x = 15 + Number(layer) * GAP;
    ids.forEach((id, i) => {
      pos[id] = { x, y: 44 + ((H - 60) / ids.length) * (i + 0.5) - NH / 2 };
    });
  }
  return pos;
}

function clip(s: string, lang: string) {
  const max = lang === "zh" ? 10 : 20;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default function CurriculumMap({ mods: modules }: { mods: Slim[] }) {
  const lang = useLang();
  const { byId, dependents, ancestors } = useMemo(() => makeGraph(modules), [modules]);
  const pos = useMemo(() => layout(modules), [modules]);
  const [sel, setSel] = useState("harness");
  const needs = useMemo(() => ancestors(sel), [sel, ancestors]);
  const unlocks = useMemo(() => new Set(dependents(sel).map((m) => m.id)), [sel, dependents]);
  const m = byId[sel];
  const cls = (id: string) => (id === sel ? "sel" : needs.has(id) ? "needs" : unlocks.has(id) ? "unlocks" : "dim");

  return (
    <div>
      <div className="map-scroll">
        <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Curriculum dependency map">
          {COLS.map((c, i) => (
            <text key={c.en} className="map-col" x={15 + i * GAP + NW / 2} y={22} textAnchor="middle">{c[lang]}</text>
          ))}
          {modules.flatMap((mod) =>
            mod.prereqs.map((p) => {
              const a = pos[p.id];
              const b = pos[mod.id];
              const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
              let k = "dim";
              if (mod.id === sel || (needs.has(mod.id) && needs.has(p.id))) k = "needs";
              if (p.id === sel) k = "unlocks";
              return <path key={`${p.id}-${mod.id}`} className={`map-edge ${k}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />;
            }),
          )}
          {modules.map((mod) => (
            <g
              key={mod.id}
              className={`map-node ${cls(mod.id)}`}
              transform={`translate(${pos[mod.id].x},${pos[mod.id].y})`}
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
              aria-label={mod.title[lang]}
            >
              <rect width={NW} height={NH} rx={8} />
              <text x={11} y={22}>{clip(mod.title[lang], lang)}</text>
              <text className="sub" x={11} y={38}>
                {String(mod.n).padStart(2, "0")} · {mod.steps} {ui.steps[lang]}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="legend">
        <span><i className="lg-needs" /><T v={ui.legendNeeds} /></span>
        <span><i className="lg-unlocks" /><T v={ui.legendUnlocks} /></span>
        <span className="muted"><T v={ui.legendHint} /></span>
      </div>

      <aside className="panel" aria-live="polite" style={{ marginTop: 16 }}>
        <div className="eyebrow"><T v={ui.selected} /> · <T v={ui.module} /> {m.n}</div>
        <h3 style={{ fontSize: "1.3rem", marginTop: 4 }}><T v={m.title} /></h3>
        <p className="muted small" style={{ marginTop: 6 }}><T v={m.short} /></p>
        <Link className="btn" href={`/modules/${m.id}`}><T v={ui.openLesson} /></Link>
        <div className="two" style={{ marginTop: 18 }}>
          <div>
            <h3><T v={ui.whyFirst} /></h3>
            {m.prereqs.length === 0 ? (
              <p className="muted small" style={{ marginTop: 6 }}><T v={ui.nothingFirst} /></p>
            ) : (
              <ul className="why-list">
                {m.prereqs.map((p) => (
                  <li key={p.id}>
                    <b><T v={byId[p.id].title} /></b>
                    <span><T v={p.why} /></span>
                    <span className="stub"><b><T v={ui.outOfOrder} /></b> <T v={ui.stubWith} /> <T v={p.stub} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            {unlocks.size > 0 && (
              <>
                <h3><T v={ui.unlocks} /></h3>
                <ul className="why-list">
                  {dependents(sel).map((d) => (
                    <li key={d.id} className="un">
                      <b><T v={d.title} /></b>
                      <span><T v={d.prereqs.find((p) => p.id === sel)!.why} /></span>
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
