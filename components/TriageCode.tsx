"use client";

import { useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

/** A copy-paste block that names where it runs. Copy takes exactly the text shown. */
export default function TriageCode({ text, where, whereKey, label, tone }: {
  text: string; where: LS; whereKey: string; label?: string; tone?: "out";
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className={`code ct-code ${tone === "out" ? "out" : ""}`}>
      <div className="bar">
        <span><i className={`ct-where w-${whereKey}`}><T v={where} /></i>{label ? <> · {label}</> : null}</span>
        <button type="button" onClick={copy}><T v={done ? ui.copied : ui.copy} /></button>
      </div>
      <pre><code>{text}</code></pre>
    </div>
  );
}
