"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { currentFamily } from "@/lib/harness-family";
import { BUDGETS, guessKind, KINDS, lintText, type Finding, type Kind } from "@/lib/harness-lint";
import { ui } from "@/lib/ui";

/** Paste a harness file and get the linter's findings, case by case, with why and how to fix. */
export default function HarnessLinter({ examples }: { examples: { label: string; kind: Kind; family: string; text: string }[] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind | "auto">("auto");
  const [fam, setFam] = useState("generic");
  const [out, setOut] = useState<{ kind: Kind; fam: string; findings: Finding[] } | null>(null);

  useEffect(() => {
    const f = currentFamily();
    if (f !== "all") setFam(f);
    const on = (e: Event) => { const d = (e as CustomEvent<string>).detail; if (d !== "all") setFam(d); };
    window.addEventListener("hx-family", on);
    return () => window.removeEventListener("hx-family", on);
  }, []);

  const run = (t = text, k: Kind | "auto" = kind, f = fam) => {
    const kk = k === "auto" ? guessKind(t) : k;
    setOut({ kind: kk, fam: f, findings: lintText(t, kk, f) });
  };

  return (
    <div className="hlint">
      <div className="hlint-controls">
        <label><span><T v={ui.hxKind} /></span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind | "auto")}>
            <option value="auto">{ui.hxDetect.en} / {ui.hxDetect.zh}</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label><span><T v={ui.hxModelTitle} /></span>
          <select value={fam} onChange={(e) => setFam(e.target.value)}>
            {Object.keys(BUDGETS).map((f) => <option key={f} value={f}>{f === "generic" ? `${ui.hxGenericFam.en} / ${ui.hxGenericFam.zh}` : f}</option>)}
          </select>
        </label>
        <label><span><T v={ui.hxTryExample} /></span>
          <select value="" onChange={(e) => {
            const ex = examples[Number(e.target.value)];
            if (!ex) return;
            setText(ex.text); setKind(ex.kind); setFam(ex.family); run(ex.text, ex.kind, ex.family);
          }}>
            <option value="">...</option>
            {examples.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
          </select>
        </label>
      </div>
      <textarea className="hlint-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false}
        placeholder={`${ui.hxPasteHere.en}\n${ui.hxPasteHere.zh}`} aria-label={`${ui.hxAriaFile.en} / ${ui.hxAriaFile.zh}`} />
      <button type="button" onClick={() => run()} disabled={!text.trim()}><T v={ui.hxRun} /></button>

      {out && (
        <div className="hlint-out" aria-live="polite">
          <p className="small muted"><T v={ui.hxLintedAs} />: {out.kind} · {out.fam === "generic" ? ui.hxGenericFam.en : out.fam} · {out.findings.length}</p>
          {out.findings.length === 0 ? <p><T v={ui.hxNoFindings} /></p> : (
            <ul>
              {out.findings.map((f) => (
                <li key={f.rule} className={`sev-${f.severity}`}>
                  <div className="hlint-head"><span className="sev">{f.severity}</span> <code>{f.rule}</code> <b><T v={f.message} /></b></div>
                  <div className="small mono-ev">{f.evidence}</div>
                  <div><span className="lab"><T v={ui.hxWhyL} /></span><T v={f.why} /></div>
                  <div><span className="lab"><T v={ui.hxFixL} /></span><T v={f.fix} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
