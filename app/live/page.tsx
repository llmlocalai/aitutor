import Link from "next/link";
import LiveStatus from "@/components/LiveStatus";
import { byId } from "@/lib/curriculum";
import { live } from "@/lib/live";

export const metadata = { title: "Live build" };

function Chips({ ids }: { ids: string[] }) {
  return (
    <span className="chips">
      {ids.map((id) => (
        <Link key={id} className="chip" href={`/modules/${id}`}>
          {byId[id]?.title ?? id}
        </Link>
      ))}
    </span>
  );
}

export default function Live() {
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">Live build</div>
        <h1>What changed in the reference build</h1>
        <p className="lede">
          A job on the build machine scans the project, removes anything sensitive, sorts each
          change into a module, and pushes a snapshot here. The status line shows whether the
          machine is reachable right now.
        </p>
        <p style={{ marginTop: 12 }}>
          <LiveStatus />
        </p>
      </header>

      {!live.generatedAt ? (
        <div className="note">
          No snapshot yet. On the build machine run <code>python3 sync/sync.py --push</code> from the
          repository folder.
        </div>
      ) : (
        <>
          <div className="panel stats">
            <div className="stat"><b>{live.generatedAt.slice(0, 10)}</b><span>snapshot date (UTC)</span></div>
            <div className="stat"><b>{live.stats.commits}</b><span>changes</span></div>
            <div className="stat"><b>{live.stats.docs}</b><span>design notes</span></div>
            <div className="stat"><b>{live.stats.files}</b><span>source files</span></div>
            <div className="stat"><b>{live.stats.redactions}</b><span>redactions applied</span></div>
          </div>

          {live.digest && (
            <>
              <h2>Digest</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{live.digest}</p>
            </>
          )}

          {live.evals.length > 0 && (
            <>
              <h2>Latest eval runs</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Eval</th>
                      <th>When</th>
                      <th>Metrics</th>
                    </tr>
                  </thead>
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

          <h2>Recent changes</h2>
          <p className="muted">Each line is a commit subject. They are written as lessons learned.</p>
          <ul className="feed">
            {live.commits.map((c) => (
              <li key={c.hash}>
                <span className="meta">{c.date} · {c.hash}</span>
                <span>{c.subject}</span>
                <Chips ids={c.modules} />
              </li>
            ))}
          </ul>

          <h2>Design notes</h2>
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

          <h2>Source files</h2>
          <ul className="feed">
            {live.files.map((f) => (
              <li key={f.path}>
                <span className="meta">{f.updated} · {f.path} · {f.lines} lines</span>
                <span>{f.summary}</span>
                <Chips ids={f.modules} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
