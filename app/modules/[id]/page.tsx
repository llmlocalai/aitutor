import Link from "next/link";
import { notFound } from "next/navigation";
import CodeBlock from "@/components/CodeBlock";
import Progress from "@/components/Progress";
import TutorChat from "@/components/TutorChat";
import { byId, dependents, lessonDigest, modules, platforms } from "@/lib/curriculum";
import { liveFor } from "@/lib/live";

export function generateStaticParams() {
  return modules.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = byId[id];
  return m ? { title: m.title, description: m.short } : {};
}

const KIND_LABEL: Record<string, string> = {
  input: "input",
  model: "model call",
  store: "storage",
  check: "decision",
  tool: "tool",
  output: "output",
};

export default async function Lesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = byId[id];
  if (!m) notFound();
  const deps = dependents(m.id);
  const lv = liveFor(m.id);
  const hasLive = lv.commits.length + lv.docs.length + lv.files.length > 0;

  const toc = [
    ["#what", "What and why"],
    ["#order", "Where it sits"],
    m.flow && ["#flow", "Process map"],
    m.steps && ["#build", "Build steps"],
    m.together && ["#together", "Works with"],
    m.failures && ["#failures", "What went wrong"],
    ["#platforms", "Other platforms"],
    ["#check", "Explain it back"],
    hasLive && ["#live", "Live build"],
    ["#ask", "Ask"],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">
          <Link href="/">Map</Link> / {m.depth === "deep" ? "Full lesson" : "Outline"}
        </div>
        <h1>{m.title}</h1>
        <p className="lede">{m.short}</p>
        <ul className="toc">
          {toc.map(([h, t]) => (
            <li key={h}>
              <a href={h}>{t}</a>
            </li>
          ))}
        </ul>
      </header>

      <h2 id="what">What it is and why it exists</h2>
      <div className="two">
        <div className="card">
          <h3>What</h3>
          <p>{m.what}</p>
        </div>
        <div className="card">
          <h3>Why</h3>
          <p>{m.why}</p>
        </div>
      </div>
      <h3 style={{ marginTop: 22, marginBottom: 8 }}>How it works</h3>
      <ul className="bullets">
        {m.how.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>

      <h2 id="order">Where it sits in the build order</h2>
      <div className="two">
        <div className="card">
          <h3>Needs first</h3>
          {m.prereqs.length === 0 ? (
            <p className="muted">Nothing. You can start here.</p>
          ) : (
            <ul className="why-list">
              {m.prereqs.map((p) => (
                <li key={p.id}>
                  <b>
                    <Link href={`/modules/${p.id}`}>{byId[p.id].title}</Link>
                  </b>
                  <span>{p.why}</span>
                  {p.stub && (
                    <span className="stub">
                      <b>Build out of order</b> Stub it with: {p.stub}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>Unlocks</h3>
          {deps.length === 0 ? (
            <p className="muted">Nothing depends on this. It is an end point of the map.</p>
          ) : (
            <ul className="why-list">
              {deps.map((d) => (
                <li key={d.id} className="un">
                  <b>
                    <Link href={`/modules/${d.id}`}>{d.title}</Link>
                  </b>
                  <span>{d.prereqs.find((p) => p.id === m.id)?.why}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: 22, marginBottom: 8 }}>In the reference build</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {m.inBuild.map((f) => (
              <tr key={f.path}>
                <td className="path">{f.path}</td>
                <td>{f.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {m.flow && (
        <>
          <h2 id="flow">Process map</h2>
          <p className="muted">{m.flow.caption}</p>
          <ol className="flow">
            {m.flow.stages.map((s, i) => (
              <li key={s.label} className={`k-${s.kind ?? "input"}`}>
                <div className="dot">{i + 1}</div>
                <div>
                  <b>{s.label}</b>
                  <span>{s.detail}</span>
                  {s.kind && <span className="small muted"> ({KIND_LABEL[s.kind]})</span>}
                  {m.flow!.loop && m.flow!.loop.from === i && (
                    <div>
                      <span className="loop">
                        loops to step {m.flow!.loop.to + 1}: {m.flow!.loop.label}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {m.steps && (
        <>
          <h2 id="build">Build steps</h2>
          <p className="muted">
            Each step states why it sits at this point. Open any step on its own. The first is open.
          </p>
          {m.steps.map((s, i) => (
            <details key={s.title} className="step" open={i === 0}>
              <summary>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span className="t">{s.title}</span>
                <span className="chev" aria-hidden="true" />
              </summary>
              <div className="body">
                <div className="whyhere">
                  <b>Why this step is here</b>
                  {s.why}
                </div>
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.code && <CodeBlock code={s.code} />}
                {s.verify && (
                  <div className="verify">
                    <b>You are done when</b>
                    {s.verify}
                  </div>
                )}
              </div>
            </details>
          ))}
        </>
      )}

      {m.together && (
        <>
          <h2 id="together">How it works with the other parts</h2>
          <ul className="why-list">
            {m.together.map((t) => (
              <li key={t.with} className="un">
                <b>
                  <Link href={`/modules/${t.with}`}>{byId[t.with]?.title ?? t.with}</Link>
                </b>
                <span>{t.how}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {m.failures && (
        <>
          <h2 id="failures">What went wrong in the real build</h2>
          <div className="two">
            {m.failures.map((f) => (
              <div key={f.title} className="card fail">
                <div className="when">{f.when}</div>
                <h3>{f.title}</h3>
                <dl>
                  <div>
                    <dt>What happened</dt>
                    <dd>{f.what}</dd>
                  </div>
                  <div>
                    <dt>Fix</dt>
                    <dd>{f.fix}</dd>
                  </div>
                  <div>
                    <dt>Lesson</dt>
                    <dd>
                      <b>{f.lesson}</b>
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 id="platforms">The same idea on other platforms</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>How this module maps</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{p.name}</td>
                <td>{m.portability[p.id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="check">Explain it back</h2>
      <p className="muted">Answer aloud first. Then open the answer and compare.</p>
      {m.checks.map((c) => (
        <details key={c.q} className="check">
          <summary>{c.q}</summary>
          <div className="ans">
            <b>A strong answer</b>
            {c.a}
          </div>
        </details>
      ))}
      <Progress id={m.id} />

      {m.terms && (
        <>
          <h3 style={{ marginTop: 26, marginBottom: 8 }}>Terms</h3>
          <div className="table-scroll">
            <table>
              <tbody>
                {m.terms.map((t) => (
                  <tr key={t.term}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{t.term}</td>
                    <td>{t.def}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasLive && (
        <>
          <h2 id="live">From the live build</h2>
          <p className="muted">Recent changes and files the sync job filed under this module.</p>
          <ul className="feed">
            {lv.commits.map((c) => (
              <li key={c.hash}>
                <span className="meta">{c.date} · change</span>
                <span>{c.subject}</span>
              </li>
            ))}
            {lv.docs.map((d) => (
              <li key={d.path}>
                <span className="meta">{d.updated} · note · {d.path}</span>
                <span>{d.title}</span>
              </li>
            ))}
            {lv.files.map((f) => (
              <li key={f.path}>
                <span className="meta">{f.updated} · source · {f.path} · {f.lines} lines</span>
                <span>{f.summary}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 id="ask">Ask the tutor about this module</h2>
      <div className="panel">
        <TutorChat context={lessonDigest(m)} topic={m.title} />
      </div>
    </div>
  );
}
