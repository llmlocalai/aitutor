"use client";

import { setLang, useLang } from "./lang";

export default function LangToggle() {
  const lang = useLang();
  return (
    <div className="lang" role="group" aria-label="Language / 语言">
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
      <button type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中文</button>
    </div>
  );
}
