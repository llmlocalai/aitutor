"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; via?: string };

const STARTERS = [
  "Quiz me on why this module sits where it does.",
  "What would I stub to build this first?",
  "How would I build this on Databricks?",
];

export default function TutorChat({ context, topic }: { context?: string; topic?: string }) {
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...log, { role: "user", content: question }];
    setLog(next);
    setText("");
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12).map(({ role, content }) => ({ role, content })),
          context: context ?? "",
          topic: topic ?? "",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `The tutor returned ${r.status}.`);
      setLog([...next, { role: "assistant", content: data.reply, via: data.via }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The tutor could not be reached.");
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ block: "nearest" }), 50);
    }
  };

  return (
    <div className="chat">
      {log.length === 0 && (
        <div className="chips">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="btn ghost" onClick={() => send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="log" aria-live="polite">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
            {m.via && <span className="via">answered by {m.via} model</span>}
          </div>
        ))}
        {busy && <div className="msg assistant muted">Thinking. A cold local model can take up to a minute.</div>}
        <div ref={end} />
      </div>
      {err && <div className="note">{err}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder={topic ? `Ask about ${topic}` : "Ask about any part of the build"}
          aria-label="Your question"
          maxLength={2000}
        />
        <button className="btn" type="submit" disabled={busy || !text.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
