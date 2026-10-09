"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";
import { currentFamily, FAMILY_KEY } from "@/lib/harness-family";

/** Choose a model family. Sets <html data-family>, which CSS uses to show that family's notes and profile. */
export default function FamilyPicker({ families }: { families: { id: string; label: string; kind: LS }[] }) {
  const [fam, setFam] = useState("all");
  useEffect(() => setFam(currentFamily()), []);
  const pick = (id: string) => {
    setFam(id);
    document.documentElement.setAttribute("data-family", id);
    try { localStorage.setItem(FAMILY_KEY, id); } catch { /* storage unavailable: the choice lasts this visit */ }
    window.dispatchEvent(new CustomEvent("hx-family", { detail: id }));
  };
  return (
    <div className="fam-bar" role="group" aria-label={`${ui.hxAriaFamily.en} / ${ui.hxAriaFamily.zh}`}>
      <button type="button" className={fam === "all" ? "on" : ""} aria-pressed={fam === "all"} onClick={() => pick("all")}><T v={ui.hxAll} /></button>
      {families.map((f) => (
        <button key={f.id} type="button" className={fam === f.id ? "on" : ""} aria-pressed={fam === f.id} onClick={() => pick(f.id)} title={f.kind.en}>
          {f.id === "generic" ? <T v={ui.hxGenericFam} /> : f.label}
        </button>
      ))}
    </div>
  );
}
