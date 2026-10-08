"use client";

import { useState } from "react";
import type { CodeBlock as CB } from "@/lib/types";

export default function CodeBlock({ code }: { code: CB }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="code">
      <div className="bar">
        <span>{code.file ?? code.lang}</span>
        <button type="button" onClick={copy}>{done ? "Copied" : "Copy"}</button>
      </div>
      <pre>
        <code>{code.text}</code>
      </pre>
    </div>
  );
}
