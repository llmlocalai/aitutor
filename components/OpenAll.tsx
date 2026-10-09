"use client";

import T from "@/components/T";
import { ui } from "@/lib/ui";

/** Opens or closes every <details class="step"> on the page. */
export default function OpenAll() {
  const set = (open: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>("details.step").forEach((d) => { d.open = open; });
  };
  return (
    <div className="openall">
      <button type="button" className="btn ghost" onClick={() => set(true)}><T v={ui.dbxOpenAll} /></button>
      <button type="button" className="btn ghost" onClick={() => set(false)}><T v={ui.dbxCloseAll} /></button>
    </div>
  );
}
