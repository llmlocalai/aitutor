import Link from "next/link";
import LiveStatus from "@/components/LiveStatus";
import T from "@/components/T";
import { byId } from "@/lib/curriculum";
import { live } from "@/lib/live";
import { ui } from "@/lib/ui";

export const metadata = { title: "Live build · 实时构建" };

function Chips({ ids }: { ids: string[] }) {
  return (
    <span className="chips">
      {ids.filter((id) => byId[id]).map((id) => (
        <Link key={id} className="chip" href={`/modules/${id}`}><T v={byId[id].title} /></Link>
      ))}
    </span>
  );
}

export default function Live() {
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.lvEyebrow} /></div>
        <h1><T v={ui.lvTitle} /></h1>
        <p className="lede"><T v={ui.lvLede} /></p>
        <p style={{ marginTop: 12 }}><LiveStatus /></p>
      </header>

      {!live.generatedAt ? (
        <div className="note"><T v={ui.lvNone} /> <code>python3 sync/sync.py --push</code></div>
      ) : (
        <>
          <div className="panel stats">
            <div className="stat"><b>{live.generatedAt.slice(0, 10)}</b><span><T v={ui.lvSnapshot} /></span></div>
            <div className="stat"><b>{live.stats.commits}</b><span><T v={ui.lvChanges} /></span></div>
            <div className="stat"><b>{live.stats.docs}</b><span><T v={ui.lvNotes} /></span></div>
            <div className="stat"><b>{live.stats.files}</b><span><T v={ui.lvFiles} /></span></div>
            <div className="stat"><b>{live.stats.redactions}</b><span><T v={ui.lvRedactions} /></span></div>
          </div>

          {live.evals.length > 0 && (
            <>
              <h2><T v={ui.lvEvals} /></h2>
              <div className="table-scroll">
                <table>
                  <tbody>
                    {live.evals.map((e) => (
                      <tr key={e.name + e.ts}>
                        <td style={{ fontWeight: 600 }}>{e.name}</td>
                        <td className="path">{e.ts.slice(0, 10)}</td>
                        <td className="path" style={{ whiteSpace: "normal" }}>
                          {Object.entries(e.metrics).map(([k, v]) => `${k} ${v}`).join("  ·  ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2><T v={ui.lvRecent} /></h2>
          <p className="muted"><T v={ui.lvRecentLede} /></p>
          <ul className="feed">
            {live.commits.map((c) => (
              <li key={c.hash}><span className="meta">{c.date} · {c.hash}</span><span>{c.subject}</span><Chips ids={c.modules} /></li>
            ))}
          </ul>

          <h2><T v={ui.lvDesign} /></h2>
          <ul className="feed">
            {live.docs.map((d) => (
              <li key={d.path}>
                <span className="meta">{d.updated} · {d.path}</span>
                <b>{d.title}</b>
                {d.headings.length > 0 && <span className="small muted">{d.headings.join(" · ")}</span>}
                <Chips ids={d.modules} />
              </li>
            ))}
          </ul>

          <h2><T v={ui.lvSource} /></h2>
          <ul className="feed">
            {live.files.map((f) => (
              <li key={f.path}><span className="meta">{f.updated} · {f.path} · {f.lines}</span><span>{f.summary}</span><Chips ids={f.modules} /></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
