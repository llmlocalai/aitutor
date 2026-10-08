"use client";

import Link from "next/link";
import { useState } from "react";
import { byId, modules, relate } from "@/lib/curriculum";

export default function WhyBefore() {
  const [a, setA] = useState("knowledge");
  const [b, setB] = useState("evaluation");
  const r = relate(a, b);

  return (
    <div className="panel">
      <div className="pair">
        <label>
          <span className="eyebrow">Module A </span>
          <br />
          <select value={a} onChange={(e) => setA(e.target.value)}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="eyebrow">Module B </span>
          <br />
          <select value={b} onChange={(e) => setB(e.target.value)}>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </label>
      </div>

      {r.kind === "same" && <p className="muted">Pick two different modules.</p>}

      {r.kind === "before" && (
        <>
          <p>
            <b>{byId[r.first].title}</b> comes before <b>{byId[r.second].title}</b>
            {r.steps.length > 1 ? `, through ${r.steps.length - 1} module${r.steps.length > 2 ? "s" : ""} in between.` : "."}
          </p>
          <ol className="chain">
            {r.steps.map((s, i) => (
              <li key={s.id}>
                <b>
                  <Link href={`/modules/${s.id}`}>{byId[s.id].title}</Link> needs{" "}
                  {byId[i === 0 ? r.first : r.steps[i - 1].id].title}
                </b>
                <br />
                <span className="muted">{s.why}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {r.kind === "independent" && (
        <>
          <p>
            Neither depends on the other. You can build <b>{byId[a].title}</b> and{" "}
            <b>{byId[b].title}</b> in either order, or at the same time.
          </p>
          <p className="muted small">
            {r.shared.length
              ? `Both rest on: ${r.shared.map((x) => byId[x].title).join(", ")}.`
              : "They share no prerequisites."}
          </p>
        </>
      )}
    </div>
  );
}
