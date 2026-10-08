import T from "@/components/T";
import TutorChat from "@/components/TutorChat";
import { modules } from "@/lib/curriculum";
import { ui } from "@/lib/ui";

export const metadata = { title: "Ask the tutor · 问导师" };

export default function Tutor() {
  const overview = (lang: "en" | "zh") =>
    "CURRICULUM OVERVIEW\n" +
    modules
      .map((m) => `${m.n}. ${m.title[lang]}: ${m.short[lang]} Needs: ${m.prereqs.map((p) => p.id).join(", ") || "nothing"}. Steps: ${m.steps.map((s) => s.title[lang]).join(" > ")}`)
      .join("\n");
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.tuEyebrow} /></div>
        <h1><T v={ui.tuTitle} /></h1>
        <p className="lede"><T v={ui.tuLede} /></p>
      </header>
      <div className="panel">
        <TutorChat context={{ en: overview("en"), zh: overview("zh") }} />
      </div>
    </div>
  );
}
