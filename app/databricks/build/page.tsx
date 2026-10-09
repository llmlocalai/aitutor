import ArchitectureMap, { type ArchLayerView } from "@/components/ArchitectureMap";
import DbxTabs from "@/components/DbxTabs";
import OpenAll from "@/components/OpenAll";
import PhaseSteps from "@/components/PhaseSteps";
import ReadinessGates from "@/components/ReadinessGates";
import ReplicateMap, { type MapPhase } from "@/components/ReplicateMap";
import T from "@/components/T";
import { architecture, autonomy, delivery, gates, intro, numberOf, phases, rstepById, rsteps, sources } from "@/content/databricks-native";
import { checkCounts, KITS } from "@/lib/replicate";
import { ui } from "@/lib/ui";

export const metadata = {
  title: "Build on Databricks · 在 Databricks 上构建",
  description: "A production agent workflow built natively on Databricks data, deployed to Databricks Apps with GitLab CI/CD.",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function DatabricksBuild() {
  const report = KITS.native.report;
  const counts = checkCounts(report);
  const layers: ArchLayerView[] = architecture.map((l) => ({
    ...l,
    nodes: l.nodes.map((n) => ({
      ...n,
      steps: rsteps.filter((s) => s.components?.includes(n.id)).map((s) => ({ id: s.id, n: numberOf[s.id], title: s.title })),
    })),
  }));
  const mapPhases: MapPhase[] = phases.map((p) => ({
    id: p.id, title: p.title,
    nodes: p.steps.map((s) => ({ id: s.id, n: numberOf[s.id], title: s.title, after: s.after, afterAny: s.afterAny ?? [] })),
  }));
  const questions = rsteps.flatMap((s) => (s.challenge ?? []).map((c) => ({ ...c, step: s })));

  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.nbEyebrow} /></div>
        <h1><T v={intro.title} /></h1>
        <DbxTabs active="native" />
        <p className="lede"><T v={intro.lede} /></p>
      </header>

      <div className="card workflow-card">
        <b className="lab"><T v={ui.nbWorkflow} /></b>
        <p style={{ margin: 0 }}><T v={intro.workflow} /></p>
      </div>

      <div className="note" style={{ margin: "14px 0" }}>
        <b className="lab warn-l"><T v={ui.dbxNotRun} /></b>
        <T v={intro.honesty} />
      </div>

      <div className="card dbx-check">
        <h3 style={{ marginTop: 0 }}><T v={ui.dbxChecked} /></h3>
        <p className="muted small"><T v={ui.dbxCheckedLede} /> {report.checked_at}, Python {report.python}.</p>
        <div className="stats">
          <div className="stat"><b>{counts.py}</b><span><T v={ui.dbxFilesCompile} /></span></div>
          <div className="stat"><b>{counts.yaml}</b><span><T v={ui.dbxYaml} /></span></div>
          <div className="stat"><b>{counts.bash}</b><span><T v={ui.dbxBash} /></span></div>
          <div className="stat"><b>{counts.sqlParsed}</b><span><T v={ui.nbSqlParsed} /></span></div>
          <div className="stat"><b>{report.tests.run - report.tests.failed}/{report.tests.run}</b><span><T v={ui.dbxTests} /></span></div>
        </div>
        <details className="check" style={{ marginTop: 12, marginBottom: 0 }}>
          <summary><T v={ui.dbxTestNames} /></summary>
          <div className="ans"><ul className="bullets mono-list">{report.tests.names.map((n) => <li key={n}>{n}</li>)}</ul></div>
        </details>
        <p className="small" style={{ marginBottom: 0 }}><T v={intro.scriptsHow} /></p>
      </div>

      <h2><T v={ui.nbArchTitle} /></h2>
      <p className="muted"><T v={ui.nbArchLede} /></p>
      <ArchitectureMap layers={layers} />

      <h2><T v={ui.nbDeliveryTitle} /></h2>
      <p className="muted"><T v={ui.nbDeliveryLede} /></p>
      <ol className="pipe">
        {delivery.map((d) => (
          <li key={d.id} className={`pipe-stage s-${d.id}`}>
            <b><T v={d.label} /></b>
            <span><T v={d.detail} /></span>
            {d.gate && <em className="pipe-gate"><T v={d.gate} /></em>}
          </li>
        ))}
      </ol>

      <h2><T v={ui.nbAutonomyTitle} /></h2>
      <p className="muted"><T v={ui.nbAutonomyLede} /></p>
      <div className="ladder">
        {autonomy.map((a) => (
          <div key={a.level} className={`rung ${a.level === 2 ? "here" : ""}`}>
            <div className="rung-n">{a.level}</div>
            <div>
              <b><T v={a.name} /></b>{a.level === 2 && <span className="chip any"><T v={ui.nbThisBuild} /></span>}
              <p><T v={a.means} /></p>
              <p className="small muted"><b><T v={ui.nbNeeds} />:</b> <T v={a.needs} /></p>
            </div>
          </div>
        ))}
      </div>

      <h2><T v={ui.nbOrderTitle} /></h2>
      <p className="muted"><T v={ui.dbxOrderLede} /></p>
      <ReplicateMap phases={mapPhases} />

      <OpenAll />
      <PhaseSteps phases={phases} numberOf={numberOf} byId={rstepById} localLabel={ui.nbProduces} kitRoot={KITS.native.root} />

      <h2 id="review"><T v={ui.nbReviewTitle} /></h2>
      <p className="muted"><T v={ui.nbReviewLede} /></p>
      <div className="review-list">
        {questions.map((q) => (
          <details key={q.q.en} className="grill-q card">
            <summary><span className="chip">{pad(numberOf[q.step.id])}</span> <T v={q.q} /></summary>
            <p><T v={q.a} /></p>
            <a className="small" href={`#r-${q.step.id}`}><T v={q.step.title} /></a>
          </details>
        ))}
      </div>

      <h2 id="gates"><T v={ui.nbGatesTitle} /></h2>
      <p className="muted"><T v={ui.nbGatesLede} /></p>
      <ReadinessGates gates={gates} />

      <h2><T v={ui.sources} /></h2>
      <ul className="bullets">
        {sources.map((s) => (<li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>))}
      </ul>
    </div>
  );
}
