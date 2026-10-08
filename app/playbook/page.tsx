import CodeBlock from "@/components/CodeBlock";
import PlaybookList, { type Row } from "@/components/PlaybookList";
import T from "@/components/T";
import { masterOrder, modules } from "@/lib/curriculum";
import { ui } from "@/lib/ui";

export const metadata = { title: "Playbook · 操作手册" };

export default function Playbook() {
  const rows: Row[] = masterOrder().map((r) => ({
    key: r.key,
    moduleId: r.module.id,
    moduleN: r.module.n,
    moduleTitle: r.module.title,
    index: r.index,
    stepId: r.step.id,
    title: r.step.title,
    why: r.step.why,
    produces: r.step.produces,
    verify: r.step.verify,
    run: r.step.run,
    lab: !!r.step.lab,
    notExecuted: !!r.step.notExecuted,
    needs: (r.step.needs ?? []).map((n) => ({ key: n.step, what: n.what })),
  }));
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.pbEyebrow} /></div>
        <h1><T v={ui.pbTitle} /></h1>
        <p className="lede"><T v={ui.pbLede} /></p>
      </header>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3><T v={ui.pbSetup} /></h3>
        <p className="muted"><T v={ui.pbSetupBody} /></p>
        <CodeBlock label="bash" text={`git clone <your repository url> aitutor && cd aitutor
python3 -m labs.run_all --check`} />
      </div>
      <PlaybookList rows={rows} modules={modules.map((m) => ({ id: m.id, n: m.n, title: m.title }))} />
    </div>
  );
}
