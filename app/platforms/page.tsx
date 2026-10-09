import Link from "next/link";
import T from "@/components/T";
import { modules, platformIds, platformNames } from "@/lib/curriculum";
import { guides } from "@/lib/platforms";
import { ui } from "@/lib/ui";

export const metadata = { title: "Platforms · 各平台" };

export default function Platforms() {
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.plEyebrow} /></div>
        <h1><T v={ui.plTitle} /></h1>
        <p className="lede"><T v={ui.plLede} /></p>
      </header>
      <div className="note" style={{ marginBottom: 18 }}><T v={ui.plWarn} /></div>

      <Link href="/databricks/build" className="card mod" style={{ display: "block", marginBottom: 12, borderColor: "var(--accent)" }}>
        <div className="eyebrow"><T v={ui.nbEyebrow} /></div>
        <h3><T v={ui.nbTabNative} /></h3>
        <p className="muted small"><T v={ui.nbCard} /></p>
      </Link>
      <Link href="/databricks" className="card mod" style={{ display: "block", marginBottom: 18, borderColor: "var(--accent)" }}>
        <div className="eyebrow"><T v={ui.dbxEyebrow} /> · Databricks</div>
        <h3><T v={ui.dbxPlaybook} /></h3>
        <p className="muted small"><T v={ui.dbxCard} /></p>
      </Link>

      <h2 style={{ marginTop: 0 }}><T v={ui.guide} /></h2>
      <div className="mods">
        {guides.map((g) => (
          <Link key={g.id} href={`/platforms/${g.id}`} className="card mod">
            <div className="eyebrow"><T v={g.kind} /> · {g.steps.length} <T v={ui.steps} /></div>
            <h3>{g.name}</h3>
            <p className="muted small"><T v={g.summary} /></p>
          </Link>
        ))}
      </div>

      <h2><T v={ui.matrix} /></h2>
      <div className="table-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th className="rowh"><T v={ui.module} /></th>
              {platformIds.map((p) => (<th key={p}>{platformNames[p]}</th>))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id}>
                <td className="rowh"><Link href={`/modules/${m.id}#platforms`}>{m.n}. <T v={m.title} /></Link></td>
                {platformIds.map((p) => (<td key={p}><T v={m.portability[p]} /></td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
