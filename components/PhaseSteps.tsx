import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import T from "@/components/T";
import type { Phase, RStep } from "@/content/databricks/types";
import { stepByKey } from "@/lib/curriculum";
import { readScript } from "@/lib/replicate";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

const pad = (n: number) => String(n).padStart(2, "0");

/** The phase and step body shared by the Databricks pages. Server component: reads kit files at build. */
export default function PhaseSteps({ phases, numberOf, byId, localLabel, kitRoot }: {
  phases: Phase[]; numberOf: Record<string, number>; byId: Record<string, RStep>; localLabel: LS; kitRoot: string;
}) {
  return (
    <>
      {phases.map((p, pi) => (
        <section key={p.id} id={`ph-${p.id}`} className="dbx-phase">
          <h2><span className="ph-n">{pi + 1}</span> <T v={p.title} /></h2>
          <p className="lede small-lede"><T v={p.goal} /></p>
          {p.steps.map((s) => (
            <details key={s.id} id={`r-${s.id}`} className="step dbx-step">
              <summary>
                <span className="n">{pad(numberOf[s.id])}</span>
                <span className="t"><T v={s.title} /></span>
                <span className="chev" />
              </summary>
              <div className="body">
                <div className="dbx-meta">
                  <div><b className="lab"><T v={localLabel} /></b><T v={s.local} /></div>
                  <div>
                    <b className="lab needs-l"><T v={ui.dbxAfter} /></b>
                    {s.after.length + (s.afterAny?.length ?? 0) === 0 ? <span className="muted"><T v={ui.nothingFirst} /></span> : (
                      <span className="chips">
                        {s.after.map((a) => (<a key={a} className="chip" href={`#r-${a}`}>{pad(numberOf[a])} <T v={byId[a].title} /></a>))}
                        {s.afterAny && (
                          <span className="chip any"><T v={ui.dbxOneOf} />: {s.afterAny.map((a) => pad(numberOf[a])).join(" / ")}</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div>
                    <b className="lab"><T v={ui.dbxLessons} /></b>
                    <span className="chips">
                      {s.links.map((k) => {
                        const st = stepByKey[k];
                        return (
                          <Link key={k} className="chip" href={`/modules/${st.module.id}#step-${st.step.id}`}>
                            {st.module.n}.{st.module.steps.findIndex((x) => x.id === st.step.id) + 1} <T v={st.step.title} />
                          </Link>
                        );
                      })}
                    </span>
                  </div>
                </div>

                <h4><T v={ui.dbxWhy} /></h4>
                <div className="whyhere"><T v={s.why} /></div>

                <h4><T v={ui.dbxWhat} /></h4>
                <p><T v={s.what} /></p>

                <h4><T v={ui.dbxHow} /></h4>
                <ol className="do">{s.how.map((h) => (<li key={h.en}><T v={h} /></li>))}</ol>

                {(s.files?.length || s.code?.length) ? <h4><T v={ui.dbxScripts} /></h4> : null}
                {s.files?.map((f) => {
                  const sc = readScript(f);
                  return <CodeBlock key={f} text={sc.text} label={`${f.replace(kitRoot + "/", "")} · ${sc.check?.check ?? ""}`} />;
                })}
                {s.code?.map((c) => (<CodeBlock key={c.text.slice(0, 40)} text={c.text} label={c.file ?? c.lang} />))}

                <h4><T v={ui.dbxInterpret} /></h4>
                <ul className="bullets">{s.interpret.map((x) => (<li key={x.en}><T v={x} /></li>))}</ul>

                <h4><T v={ui.dbxTrouble} /></h4>
                <div className="table-scroll">
                  <table className="dbx-trouble">
                    <thead><tr><th><T v={ui.dbxSymptom} /></th><th><T v={ui.dbxCause} /></th><th><T v={ui.dbxFix} /></th></tr></thead>
                    <tbody>
                      {s.trouble.map((x) => (
                        <tr key={x.s.en}><td><b><T v={x.s} /></b></td><td><T v={x.c} /></td><td><T v={x.f} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {s.scale?.length ? (
                  <>
                    <h4><T v={ui.nbScale} /></h4>
                    <ul className="bullets scale-list">{s.scale.map((x) => (<li key={x.en}><T v={x} /></li>))}</ul>
                  </>
                ) : null}

                {s.challenge?.length ? (
                  <div className="grill">
                    <b className="lab unlocks-l"><T v={ui.nbChallenge} /></b>
                    {s.challenge.map((c) => (
                      <details key={c.q.en} className="grill-q">
                        <summary><T v={c.q} /></summary>
                        <p><T v={c.a} /></p>
                      </details>
                    ))}
                  </div>
                ) : null}

                <div className="verify"><b><T v={ui.dbxDone} /></b><T v={s.done} /></div>
                {s.unconfirmed && (
                  <div className="note" style={{ marginTop: 10 }}>
                    <b className="lab warn-l"><T v={ui.dbxUnconfirmed} /></b><T v={s.unconfirmed} />
                  </div>
                )}
              </div>
            </details>
          ))}
        </section>
      ))}
    </>
  );
}
