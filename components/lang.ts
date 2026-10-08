"use client";

import { useEffect, useState } from "react";
import type { LS } from "@/lib/types";

export type Lang = "en" | "zh";
const KEY = "aitutor.lang";

export function currentLang(): Lang {
  if (typeof document === "undefined") return "en";
  return document.documentElement.dataset.lang === "zh" ? "zh" : "en";
}

export function setLang(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("aitutor:lang"));
}

/** For client components that need the language as a value (select options, placeholders). */
export function useLang(): Lang {
  const [lang, set] = useState<Lang>("en");
  useEffect(() => {
    const sync = () => set(currentLang());
    sync();
    window.addEventListener("aitutor:lang", sync);
    return () => window.removeEventListener("aitutor:lang", sync);
  }, []);
  return lang;
}

export const pick = (v: LS, lang: Lang) => v[lang];
