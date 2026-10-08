import Link from "next/link";
import { notFound } from "next/navigation";
import CodeBlock from "@/components/CodeBlock";
import Progress from "@/components/Progress";
import T from "@/components/T";
import TutorChat from "@/components/TutorChat";
import { byId, dependents, feeds, lessonDigest, modules, platformIds, platformNames, stepByKey } from "@/lib/curriculum";
import { labOutput, readLab } from "@/lib/labs";
import { liveFor } from "@/lib/live";
import { machine, machineKeys } from "@/lib/machine";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

export function generateStaticParams() {
  return modules.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = byId[id];
  return m ? { title: `${m.title.en} · ${m.title.zh}`, description: m.short.en } : {};
}

function StepLink({ k }: { k: string }) {
  const r = stepByKey[k];
  return (
    <Link href={`/modules/${r.module.id}#step-${r.step.id}`}>
      <T v={r.module.title} /> {r.index}: <T v={r.step.title} />
    </Link>
  );
}

export default async function Lesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = byId[id];
  if (!m) notFound();
  const deps = dependents(m.id);
  const lv = liveFor(m.id);
  const hasLive = lv.commits.length + lv.docs.length + lv.files.length > 0;
  const idx = modules.findIndex((x) => x.id === m.id);
  const prev = modules[idx - 1];
  const next = modules[idx + 1];

  const toc = [
    ["#what", ui.tocWhat], ["#order", ui.tocOrder], m.flow && ["#flow", ui.tocFlow], ["#build", ui.tocBuild],
    ["#together", ui.tocTogether], ["#failures", ui.tocFailures], ["#platforms", ui.tocPlatforms],
    ["#check", ui.tocCheck], hasLive && ["#live", ui.tocLive], ["#ask", ui.tocAsk],
  ].filter(Boolean) as [string, LS][];

  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">
          <Link href="/"><T v={ui.crumbMap} /></Link> / <T v={ui.module} /> {m.n} / labs/m{String(m.n).padStart(2, "0")}_*
        </div>
        <h1><T v={m.title} /></h1>
        <p className="lede"><T v={m.short} /></p>
        <ul className="toc">
          {toc.map(([h, label]) => (
            <li key={h}><a href={h}><T v={label} /></a></li>
          ))}
        </ul>
      </header>

      <h2 id="what"><T v={ui.hWhat} /></h2>
      <div className="two">
        <div className="card"><h3><T v={ui.what} /></h3><p><T v={m.what} /></p></div>
        <div className="card"><h3><T v={ui.why} /></h3><p><T v={m.why} /></p></div>
      </div>
      <h3 className="sub"><T v={ui.howItWorks} /></h3>
      <ul className="bullets">
        {m.how.map((h) => (<li key={h.en}><T v={h} /></li>))}
      </ul>

      <h2 id="order"><T v={ui.hOrder} /></h2>
      <div className="two">
        <div className="card">
          <h3><T v={ui.needsFirst} /></h3>
          {m.prereqs.length === 0 ? (
            <p className="muted"><T v={ui.startPoint} /></p>
          ) : (
            <ul className="why-list">
              {m.prereqs.map((p) => (
                <li key={p.id}>
                  <b><Link href={`/modules/${p.id}`}><T v={byId[p.id].title} /></Link></b>
                  <span><T v={p.why} /></span>
                  <span className="stub"><b><T v={ui.outOfOrder} /></b> <T v={ui.stubWith} /> <T v={p.stub} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3><T v={ui.unlocksH} /></h3>
          {deps.length === 0 ? (
            <p className="muted"><T v={ui.endPoint} /></p>
          ) : (
            <ul className="why-list">
              {deps.map((d) => (
                <li key={d.id} className="un">
                  <b><Link href={`/modules/${d.id}`}><T v={d.title} /></Link></b>
                  <span><T v={d.prereqs.find((p) => p.id === m.id)!.why} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 className="sub"><T v={ui.inBuild} /></h3>
      <div className="table-scroll">
        <table>
          <thead><tr><th><T v={ui.path} /></th><th><T v={ui.role} /></th></tr></thead>
          <tbody>
            {m.inBuild.map((f) => (
              <tr key={f.path}><td className="path">{f.path}</td><td><T v={f.role} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {m.flow && (
        <>
          <h2 id="flow"><T v={ui.hFlow} /></h2>
          <p className="muted"><T v={m.flow.caption} /></p>
          <ol className="flow">
            {m.flow.stages.map((s, i) => (
              <li key={s.label.en} className={`k-${s.kind ?? "input"}`}>
                <div className="dot">{i + 1}</div>
                <div>
                  <b><T v={s.label} /></b>
                  <span><T v={s.detail} /></span>
                  {m.flow!.loop && m.flow!.loop.from === i && (
                    <div>
                      <span className="loop">
                        ↺ <T v={ui.loopsTo} /> {m.flow!.loop.to + 1}<T v={ui.loopsToEnd} />: <T v={m.flow!.loop.label} />
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 id="build"><T v={ui.hBuild} /></h2>
      <p className="muted"><T v={ui.buildLede} /></p>
      <ol className="rail">
        {m.steps.map((s, i) => (
          <li key={s.id}><a href={`#step-${s.id}`}><span>{i + 1}</span><T v={s.title} /></a></li>
        ))}
      </ol>

      {m.steps.map((s, i) => {
        const key = `${m.id}.${s.id}`;
        const lab = s.lab ? readLab(s.lab) : null;
        const out = s.output ? labOutput(s.output, s.pick) : null;
        const fed = feeds(key);
        return (
          <details key={s.id} id={`step-${s.id}`} className="step" open>
            <summary>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t"><T v={s.title} /></span>
              {s.notExecuted && <span className="tag warn"><T v={ui.notExecuted} /></span>}
            </summary>
            <div className="body">
              <div className="whyhere"><b><T v={ui.whyHere} /></b><T v={s.why} /></div>

              <div className="io in">
                <b><T v={ui.uses} /></b>
                {s.needs?.length ? (
                  <ul>
                    {s.needs.map((n) => (
                      <li key={n.step}><T v={n.what} /> <span className="muted">← <StepLink k={n.step} /></span></li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted"><T v={ui.usesNothing} /></span>
                )}
              </div>

              <h4><T v={ui.doThis} /></h4>
              <ol className="do">
                {s.do.map((d) => (<li key={d.en}><T v={d} /></li>))}
              </ol>

              {lab && <CodeBlock text={lab.text} label={`${s.lab!.file}${s.lab!.region ? `  ·  ${s.lab!.region}` : ""}`} />}
              {s.code && <CodeBlock text={s.code.text} label={s.code.file ?? s.code.lang} />}
              {s.codeNote && <p className="small muted"><T v={s.codeNote} /></p>}
              {s.run && <CodeBlock text={s.run} label="run" />}
              {out && <CodeBlock text={out} label={`${ui.recorded.en} / ${ui.recorded.zh}  ·  ${s.output}`} tone="out" />}
              {s.notExecuted && <p className="small muted"><T v={ui.notExecutedNote} /></p>}
              {s.notExecuted && (() => {
                const res = machine.results[key];
                const checkable = machineKeys().checks.includes(key);
                if (res && res.status !== "manual") {
                  return (
                    <div className={`machine m-${res.status}`}>
                      <b><T v={ui.machineTitle} /> · {machine.checkedAt?.slice(0, 10)} · {res.status.toUpperCase()}</b>
                      <span>{res.detail}</span>
                    </div>
                  );
                }
                if (checkable) {
                  return (
                    <div className="machine">
                      <b><T v={ui.machineTitle} /></b>
                      <span><T v={ui.machineNone} /></span>
                      <CodeBlock text="python3 labs/machine/check.py --write" label="run" />
                    </div>
                  );
                }
                return <p className="small muted"><T v={ui.machineManual} /></p>;
              })()}

              <div className="verify"><b><T v={ui.doneWhen} /></b><T v={s.verify} /></div>

              <div className="io out">
                <b><T v={ui.produces} /></b>
                <span><T v={s.produces} /></span>
              </div>
              <div className="io out">
                <b><T v={ui.feedsInto} /></b>
                {fed.length ? (
                  <ul>
                    {fed.map((f) => (
                      <li key={f.ref.key}><StepLink k={f.ref.key} /> <span className="muted">(<T v={f.what} />)</span></li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted"><T v={ui.feedsNothing} /></span>
                )}
              </div>
            </div>
          </details>
        );
      })}

      <h2 id="together"><T v={ui.hTogether} /></h2>
      <ul className="why-list">
        {m.together.map((x) => (
          <li key={x.with} className="un">
            <b><Link href={`/modules/${x.with}`}><T v={byId[x.with].title} /></Link></b>
            <span><T v={x.how} /></span>
          </li>
        ))}
      </ul>

      <h2 id="failures"><T v={ui.hFailures} /></h2>
      <div className="two">
        {m.failures.map((f) => (
          <div key={f.title.en} className="card fail">
            <div className="when">{f.when === "lab" ? <T v={ui.failLab} /> : f.when}</div>
            <h3><T v={f.title} /></h3>
            <dl>
              <div><dt><T v={ui.whatHappened} /></dt><dd><T v={f.what} /></dd></div>
              <div><dt><T v={ui.fix} /></dt><dd><T v={f.fix} /></dd></div>
              <div><dt><T v={ui.lesson} /></dt><dd><b><T v={f.lesson} /></b></dd></div>
            </dl>
          </div>
        ))}
      </div>

      <h2 id="platforms"><T v={ui.hPlatforms} /></h2>
      <div className="table-scroll">
        <table>
          <thead><tr><th><T v={ui.platform} /></th><th><T v={ui.howMaps} /></th></tr></thead>
          <tbody>
            {platformIds.map((p) => (
              <tr key={p}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}><Link href={`/platforms/${p}`}>{platformNames[p]}</Link></td>
                <td><T v={m.portability[p]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small"><Link href="/platforms"><T v={ui.fullGuide} /></Link></p>

      <h2 id="check"><T v={ui.hCheck} /></h2>
      <p className="muted"><T v={ui.checkLede} /></p>
      {m.checks.map((c) => (
        <details key={c.q.en} className="check">
          <summary><T v={c.q} /></summary>
          <div className="ans"><b><T v={ui.strongAnswer} /></b><T v={c.a} /></div>
        </details>
      ))}
      <Progress id={m.id} />

      {m.terms && (
        <>
          <h3 className="sub"><T v={ui.terms} /></h3>
          <div className="table-scroll">
            <table>
              <tbody>
                {m.terms.map((x) => (
                  <tr key={x.term.en}><td style={{ fontWeight: 600, whiteSpace: "nowrap" }}><T v={x.term} /></td><td><T v={x.def} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasLive && (
        <>
          <h2 id="live"><T v={ui.hLive} /></h2>
          <p className="muted"><T v={ui.liveLede} /></p>
          <ul className="feed">
            {lv.commits.map((c) => (
              <li key={c.hash}><span className="meta">{c.date} · {c.hash}</span><span>{c.subject}</span></li>
            ))}
            {lv.docs.map((d) => (
              <li key={d.path}><span className="meta">{d.updated} · {d.path}</span><span>{d.title}</span></li>
            ))}
            {lv.files.map((f) => (
              <li key={f.path}><span className="meta">{f.updated} · {f.path} · {f.lines}</span><span>{f.summary}</span></li>
            ))}
          </ul>
        </>
      )}

      <h2 id="ask"><T v={ui.hAsk} /></h2>
      <div className="panel">
        <TutorChat context={{ en: lessonDigest(m, "en"), zh: lessonDigest(m, "zh") }} topic={m.title} />
      </div>

      <nav className="pager">
        {prev ? <Link href={`/modules/${prev.id}`}>← <T v={ui.prev} />: <T v={prev.title} /></Link> : <span />}
        {next ? <Link href={`/modules/${next.id}`}><T v={ui.next} />: <T v={next.title} /> →</Link> : <span />}
      </nav>
    </div>
  );
}
