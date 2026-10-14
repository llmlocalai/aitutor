import T from "@/components/T";
import TriageCode from "@/components/TriageCode";
import { TriageCheck } from "@/components/TriageProgress";
import { WHERE, type Cmd, type Stage, type Where } from "@/content/contract-triage";
import replay from "@/content/triage-replay.json";
import { readScript } from "@/lib/replicate";
import { t, type LS } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const KIT = "native/contract-triage/";

interface ReplayStep { step: string; cmd: string; exit: number; seconds: number; output: string }
const R = replay as unknown as { replayed_at: string; template_commit: string; steps: ReplayStep[] };

/** The text a block copies: repo blocks start in $REPO, aitutor blocks in $AITUTOR. */
export function cmdText(c: Cmd): string {
  if (c.w === "repo") return `cd "$REPO"\n${c.code}`;
  if (c.w === "aitutor") return `cd "$AITUTOR"\n${c.code}`;
  return c.code;
}

function Block({ c }: { c: Cmd }) {
  return <TriageCode text={cmdText(c)} where={WHERE[c.w].label} whereKey={c.w} label={c.label} />;
}

function WhereChips({ ws }: { ws: Where[] }) {
  return (
    <span className="chips">
      {[...new Set(ws)].map((w) => <span key={w} className={`ct-where w-${w}`}><T v={WHERE[w].label} /></span>)}
    </span>
  );
}

const L = {
  where: t("Where", "在哪里"), what: t("What", "做什么"), why: t("Why here", "为什么在这里"), how: t("How", "怎么做"),
  test: t("Test", "测试"), expect: t("Expect", "预期结果"), files: t("Files this step copies (full text)", "本步复制的文件（全文）"),
  trouble: t("If it fails", "如果失败"), symptom: t("You see", "你看到"), cause: t("Why", "原因"), fix: t("Do", "处理"),
  done: t("Done when", "完成标准"), after: t("Do first", "先完成"), nothing: t("Nothing", "无"),
  replayed: t("Replayed", "已回放"), you: t("Run by you", "需你运行"), unconfirmed: t("Not confirmed", "未确认"),
  recorded: t("Recorded output from the replay", "回放的记录输出"), hours: t("hours", "小时"),
  gate: t("Check", "检查"), pass: t("Pass", "通过标准"), fail: t("If it fails", "未通过时"),
};

export default function FollowSteps({ stages, number, titleOf }: {
  stages: Stage[]; number: Record<string, number>; titleOf: Record<string, LS>;
}) {
  return (
    <>
      {stages.map((st) => (
        <section key={st.id} id={`st-${st.id}`} className="dbx-phase ct-stage">
          <h2><span className="ph-n">{st.n}</span> <T v={st.title} /></h2>
          <p className="ct-dates"><T v={st.dates} /></p>
          <p className="lede small-lede"><T v={st.goal} /></p>
          {st.steps.map((s) => {
            const where: Where[] = [...s.how.flatMap((a) => (a.c ?? []).map((c) => c.w)), ...s.test.map((x) => x.w)];
            const rec = (s.replay ?? []).flatMap((k) => R.steps.filter((r) => r.step === k));
            return (
              <details key={s.id} id={`f-${s.id}`} className="step dbx-step ct-step">
                <summary>
                  <span className="n">{pad(number[s.id])}</span>
                  <span className="t"><span className="ct-bp">{s.bp}</span> <T v={s.title} /></span>
                  <span className={`ct-ran ${s.ran}`}><T v={s.ran === "replayed" ? L.replayed : L.you} /></span>
                </summary>
                <div className="body">
                  <div className="dbx-meta">
                    <div><b className="lab"><T v={L.where} /></b><WhereChips ws={where} /></div>
                    <div>
                      <b className="lab needs-l"><T v={L.after} /></b>
                      {s.after.length === 0 ? <span className="muted"><T v={L.nothing} /></span> : (
                        <span className="chips">
                          {s.after.map((a) => <a key={a} className="chip" href={`#f-${a}`}>{pad(number[a])} <T v={titleOf[a]} /></a>)}
                        </span>
                      )}
                    </div>
                    {s.hours ? <div><b className="lab"><T v={t("Time", "用时")} /></b>{s.hours} <T v={L.hours} /></div> : null}
                  </div>

                  <h4><T v={L.what} /></h4>
                  <p><T v={s.what} /></p>
                  <h4><T v={L.why} /></h4>
                  <div className="whyhere"><T v={s.why} /></div>

                  <h4><T v={L.how} /></h4>
                  <ol className="do ct-how">
                    {s.how.map((a) => (
                      <li key={a.t.en}>
                        <T v={a.t} />
                        {a.c?.map((c) => <Block key={c.code.slice(0, 60)} c={c} />)}
                      </li>
                    ))}
                  </ol>

                  {s.files?.length ? (
                    <details className="check ct-files">
                      <summary><T v={L.files} /> ({s.files.length})</summary>
                      {s.files.map((f) => {
                        const sc = readScript(f);
                        return <TriageCode key={f} text={sc.text} where={t("File", "文件")} whereKey="file"
                          label={`${f.replace(KIT + "overlay/", "$KIT/")} · ${sc.check?.check ?? ""}`} />;
                      })}
                    </details>
                  ) : null}

                  <h4><T v={L.test} /></h4>
                  {s.test.map((x) => (
                    <div key={x.expect.en} className="ct-test">
                      {x.code ? <Block c={{ w: x.w, code: x.code }} /> : (
                        <div className="ct-test-where"><span className={`ct-where w-${x.w}`}><T v={WHERE[x.w].label} /></span></div>
                      )}
                      <div className="verify"><b><T v={L.expect} /></b><T v={x.expect} /></div>
                    </div>
                  ))}
                  {rec.length ? (
                    <details className="check ct-rec">
                      <summary><T v={L.recorded} /> · {R.replayed_at} · {rec.length}</summary>
                      {rec.map((r, i) => (
                        <TriageCode key={i} tone="out" where={t("Replay", "回放")} whereKey="replay"
                          label={`exit ${r.exit} · ${r.seconds}s`} text={`$ ${r.cmd}\n${r.output}`} />
                      ))}
                    </details>
                  ) : null}

                  <h4><T v={L.trouble} /></h4>
                  <div className="table-scroll">
                    <table className="dbx-trouble">
                      <thead><tr><th><T v={L.symptom} /></th><th><T v={L.cause} /></th><th><T v={L.fix} /></th></tr></thead>
                      <tbody>{s.trouble.map((x) => (
                        <tr key={x.s.en}><td><b><T v={x.s} /></b></td><td><T v={x.c} /></td><td><T v={x.f} /></td></tr>
                      ))}</tbody>
                    </table>
                  </div>

                  {s.unconfirmed && (
                    <div className="note" style={{ marginTop: 12 }}>
                      <b className="lab warn-l"><T v={L.unconfirmed} /></b><T v={s.unconfirmed} />
                    </div>
                  )}
                  <div className="verify"><b><T v={L.done} /></b><T v={s.done} /></div>
                  <TriageCheck id={s.id} />
                </div>
              </details>
            );
          })}
          {st.gate && (
            <div id={`f-${st.gate.id}`} className="card ct-gate">
              <h3><T v={st.gate.title} /></h3>
              <div className="table-scroll">
                <table className="dbx-trouble">
                  <thead><tr><th><T v={L.gate} /></th><th><T v={L.pass} /></th><th><T v={L.fail} /></th></tr></thead>
                  <tbody>{st.gate.rows.map((g) => (
                    <tr key={g.check.en}>
                      <td><b><T v={g.check} /></b>{g.cmd ? <code className="ct-gate-cmd">{g.cmd}</code> : null}</td>
                      <td><T v={g.pass} /></td><td><T v={g.fail} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
