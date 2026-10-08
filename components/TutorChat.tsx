"use client";

import { useRef, useState } from "react";
import T from "@/components/T";
import { useLang } from "@/components/lang";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

type Msg = { role: "user" | "assistant"; content: string; via?: string; model?: string };

export default function TutorChat({ context, topic }: { context?: LS; topic?: LS }) {
  const lang = useLang();
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const starters = [ui.tuS1, ui.tuS2, ui.tuS3];

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
          context: context ? context[lang] : "",
          lang,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `${r.status}`);
      setLog([...next, { role: "assistant", content: data.reply, via: data.via, model: data.model }]);
    } catch (e) {
      setErr(e instanceof Error && e.message.length > 3 ? e.message : ui.tuError[lang]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ block: "nearest" }), 50);
    }
  };

  return (
    <div className="chat">
      {log.length === 0 && (
        <div className="chips">
          {starters.map((s) => (
            <button key={s.en} type="button" className="btn ghost" onClick={() => send(s[lang])} disabled={busy}>
              <T v={s} />
            </button>
          ))}
        </div>
      )}
      <div className="log" aria-live="polite">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
            {m.via && (
              <span className="via"><T v={ui.tuVia} /> <T v={m.via === "local" ? ui.tuLocal : ui.tuCloud} />{m.model ? ` · ${m.model}` : ""}</span>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant muted"><T v={ui.tuThinking} /></div>}
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
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder={topic ? `${ui.tuPlaceholderTopic[lang]} ${topic[lang]}` : ui.tuPlaceholder[lang]}
          aria-label={ui.tuAsk[lang]}
          maxLength={2000}
        />
        <button className="btn" type="submit" disabled={busy || !text.trim()}><T v={ui.tuAsk} /></button>
      </form>
    </div>
  );
}
