"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui";

const KEY = "aitutor.explained";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function Progress({ id }: { id: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(read().includes(id)), [id]);
  const toggle = () => {
    const cur = new Set(read());
    if (on) cur.delete(id);
    else cur.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...cur]));
    } catch {
      /* storage unavailable */
    }
    setOn(!on);
  };
  return (
    <label className="progress">
      <input type="checkbox" checked={on} onChange={toggle} />
      <span><T v={ui.canExplain} /></span>
    </label>
  );
}
