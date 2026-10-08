"use client";

import { useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui";

export default function CodeBlock({ text, label, tone }: { text: string; label: string; tone?: "out" }) {
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
    <div className={`code ${tone === "out" ? "out" : ""}`}>
      <div className="bar">
        <span>{label}</span>
        <button type="button" onClick={copy}><T v={done ? ui.copied : ui.copy} /></button>
      </div>
      <pre><code>{text}</code></pre>
    </div>
  );
}
