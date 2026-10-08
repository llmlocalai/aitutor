import TutorChat from "@/components/TutorChat";
import { modules } from "@/lib/curriculum";

export const metadata = { title: "Ask the tutor" };

export default function Tutor() {
  const context =
    "CURRICULUM OVERVIEW\n" +
    modules
      .map(
        (m) =>
          `- ${m.title}: ${m.short} Needs: ${m.prereqs.map((p) => p.id).join(", ") || "nothing"}.`,
      )
      .join("\n");
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">Tutor</div>
        <h1>Ask about any part of the build</h1>
        <p className="lede">
          Questions go to the local model when the build machine is reachable, and to a cloud model
          otherwise. For questions about one module, use the tutor at the bottom of that lesson. It
          is given the full lesson as context.
        </p>
      </header>
      <div className="panel">
        <TutorChat context={context} />
      </div>
    </div>
  );
}
