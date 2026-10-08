"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/lang";
import { makeGraph, type Slim } from "@/lib/graph";
import { ui } from "@/lib/ui";

export default function WhyBefore({ mods: modules }: { mods: Slim[] }) {
  const lang = useLang();
  const { byId, relate } = useMemo(() => makeGraph(modules), [modules]);
  const [a, setA] = useState("knowledge");
  const [b, setB] = useState("self-evolving");
  const r = relate(a, b);
  const options = modules.map((m) => (
    <option key={m.id} value={m.id}>{m.n}. {m.title[lang]}</option>
  ));

  return (
    <div className="panel">
      <div className="pair">
        <label>
          <span className="eyebrow"><T v={ui.moduleA} /></span><br />
          <select value={a} onChange={(e) => setA(e.target.value)}>{options}</select>
        </label>
        <label>
          <span className="eyebrow"><T v={ui.moduleB} /></span><br />
          <select value={b} onChange={(e) => setB(e.target.value)}>{options}</select>
        </label>
      </div>

      {r.kind === "same" && <p className="muted"><T v={ui.pickTwo} /></p>}

      {r.kind === "before" && (
        <>
          <p>
            <b><T v={byId[r.first].title} /></b> <T v={ui.comesBefore} /> <b><T v={byId[r.second].title} /></b>
          </p>
          <ol className="chain">
            {r.steps.map((s, i) => (
              <li key={s.id}>
                <b>
                  <Link href={`/modules/${s.id}`}><T v={byId[s.id].title} /></Link> <T v={ui.needs} />{" "}
                  <T v={byId[i === 0 ? r.first : r.steps[i - 1].id].title} />
                </b>
                <br />
                <span className="muted"><T v={s.why} /></span>
              </li>
            ))}
          </ol>
        </>
      )}

      {r.kind === "independent" && (
        <>
          <p><T v={ui.independent} /></p>
          <p className="muted small">
            {r.shared.length ? (
              <>
                <T v={ui.bothRest} /> {r.shared.map((x) => byId[x].title[lang]).join(lang === "zh" ? "、" : ", ")}
              </>
            ) : (
              <T v={ui.noShared} />
            )}
          </p>
        </>
      )}
    </div>
  );
}
