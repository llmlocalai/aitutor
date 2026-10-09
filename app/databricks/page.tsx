import Link from "next/link";
import DbxTabs from "@/components/DbxTabs";
import OpenAll from "@/components/OpenAll";
import PhaseSteps from "@/components/PhaseSteps";
import ReplicateMap, { type MapPhase } from "@/components/ReplicateMap";
import T from "@/components/T";
import {
  componentMap, costLevers, gaps, incidents, intro, numberOf, phases, rstepById, runbooks, sources,
} from "@/content/databricks";
import { byId } from "@/lib/curriculum";
import { checkCounts, replicateCheck } from "@/lib/replicate";
import { ui } from "@/lib/ui";

export const metadata = {
  title: "Databricks replication · 在 Databricks 上复刻",
  description: "Step-by-step replication of the local agent build on Databricks, with scripts, interpretation, troubleshooting and a playbook.",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function Databricks() {
  const counts = checkCounts();
  const mapPhases: MapPhase[] = phases.map((p) => ({
    id: p.id, title: p.title,
    nodes: p.steps.map((s) => ({ id: s.id, n: numberOf[s.id], title: s.title, after: s.after, afterAny: s.afterAny ?? [] })),
  }));

  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><Link href="/platforms"><T v={ui.navPlatforms} /></Link> / <T v={ui.dbxEyebrow} /></div>
        <h1><T v={intro.title} /></h1>
        <DbxTabs active="replicate" />
        <p className="lede"><T v={intro.lede} /></p>
      </header>

      <div className="note" style={{ marginBottom: 14 }}>
        <b className="lab warn-l"><T v={ui.dbxNotRun} /></b>
        <T v={intro.honesty} />
      </div>

      <div className="card dbx-check">
        <h3 style={{ marginTop: 0 }}><T v={ui.dbxChecked} /></h3>
        <p className="muted small"><T v={ui.dbxCheckedLede} /> {replicateCheck.checked_at}, Python {replicateCheck.python}.</p>
        <div className="stats">
          <div className="stat"><b>{counts.py}</b><span><T v={ui.dbxFilesCompile} /></span></div>
          <div className="stat"><b>{counts.yaml}</b><span><T v={ui.dbxYaml} /></span></div>
          <div className="stat"><b>{counts.bash}</b><span><T v={ui.dbxBash} /></span></div>
          <div className="stat"><b>{replicateCheck.tests.run - replicateCheck.tests.failed}/{replicateCheck.tests.run}</b><span><T v={ui.dbxTests} /></span></div>
          <div className="stat"><b>{counts.sql}</b><span><T v={ui.dbxSql} /></span></div>
        </div>
        <details className="check" style={{ marginTop: 12, marginBottom: 0 }}>
          <summary><T v={ui.dbxTestNames} /></summary>
          <div className="ans"><ul className="bullets mono-list">{replicateCheck.tests.names.map((n) => <li key={n}>{n}</li>)}</ul></div>
        </details>
        <p className="small" style={{ marginBottom: 0 }}><T v={intro.scriptsHow} /></p>
      </div>

      <h2><T v={ui.dbxMapTitle} /></h2>
      <p className="muted"><T v={ui.dbxMapLede} /></p>
      <div className="table-scroll">
        <table className="dbx-map">
          <thead><tr><th><T v={ui.dbxLocal} /></th><th><T v={ui.dbxOn} /></th><th><T v={ui.dbxChange} /></th><th><T v={ui.dbxStep} /></th></tr></thead>
          <tbody>
            {componentMap.map((r) => (
              <tr key={r.local.en}>
                <td><T v={r.local} /></td>
                <td><b><T v={r.dbx} /></b></td>
                <td className="muted"><T v={r.change} /></td>
                <td><a className="chip" href={`#r-${r.step}`}>{pad(numberOf[r.step])}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2><T v={ui.dbxOrderTitle} /></h2>
      <p className="muted"><T v={ui.dbxOrderLede} /></p>
      <ReplicateMap phases={mapPhases} />

      <OpenAll />
      <PhaseSteps phases={phases} numberOf={numberOf} byId={rstepById} localLabel={ui.dbxReplaces} kitRoot="replicate/databricks" />

      <h2 id="playbook"><T v={ui.dbxPlaybook} /></h2>
      <div className="two">
        {runbooks.map((r) => (
          <div key={r.title.en} className="card">
            <h3 style={{ marginTop: 0 }}><T v={r.title} /></h3>
            <p className="muted small"><T v={r.when} /></p>
            <ol className="do">{r.items.map((x) => (<li key={x.en}><T v={x} /></li>))}</ol>
          </div>
        ))}
      </div>

      <h3><T v={ui.dbxIncidents} /></h3>
      <div className="table-scroll">
        <table className="dbx-trouble">
          <thead><tr><th><T v={ui.dbxSymptom} /></th><th><T v={ui.dbxFirstCheck} /></th><th><T v={ui.dbxFix} /></th></tr></thead>
          <tbody>
            {incidents.map((x) => (<tr key={x.s.en}><td><b><T v={x.s} /></b></td><td><T v={x.check} /></td><td><T v={x.f} /></td></tr>))}
          </tbody>
        </table>
      </div>

      <div className="two" style={{ marginTop: 18 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}><T v={ui.dbxCost} /></h3>
          <ul className="bullets">{costLevers.map((x) => (<li key={x.en}><T v={x} /></li>))}</ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}><T v={ui.dbxGaps} /></h3>
          <ul className="bullets">{gaps.map((x) => (<li key={x.en}><T v={x} /></li>))}</ul>
        </div>
      </div>

      <h2><T v={ui.sources} /></h2>
      <ul className="bullets">
        {sources.map((s) => (<li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>))}
      </ul>
      <p className="muted small">
        <Link href="/platforms/databricks"><T v={ui.navPlatforms} />: Databricks</Link> · <Link href={`/modules/${byId["harness"].id}`}><T v={byId["harness"].title} /></Link>
      </p>
    </div>
  );
}
