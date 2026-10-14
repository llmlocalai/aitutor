import DbxTabs from "@/components/DbxTabs";
import FollowSteps from "@/components/FollowSteps";
import OpenAll from "@/components/OpenAll";
import T from "@/components/T";
import { TriageProgress } from "@/components/TriageProgress";
import { WHERE, corrections, cutOrder, flow, fnumber, fstepById, fsteps, intro, risks, sources, stages, type Where } from "@/content/contract-triage";
import replay from "@/content/triage-replay.json";
import { KITS } from "@/lib/replicate";
import { t } from "@/lib/types";

export const metadata = {
  title: "Contract triage follow-along · 合同分诊跟做指南",
  description: "Every card of the Contract Triage Blueprint v2 as a testable, copy-paste step: Mac setup, GitHub, Databricks, evaluation.",
};

const R = replay as unknown as { replayed_at: string; template_commit: string; platform: string; steps: { step: string; seconds: number; exit: number }[]; failures: number };

export default function ContractTriage() {
  const report = KITS.triage.report;
  const titleOf = Object.fromEntries(fsteps.map((s) => [s.id, s.title]));
  const progress = stages.flatMap((st) => st.steps.map((s) => ({ id: s.id, n: fnumber[s.id], bp: s.bp, title: s.title, stage: st.n })));
  const after = Object.fromEntries(fsteps.map((s) => [s.id, s.after]));
  const replayed = fsteps.filter((s) => s.ran === "replayed").length;
  const total = R.steps.find((s) => s.step === "fresh-clone")?.seconds ?? 0;
  const order: Where[] = ["mac", "repo", "github", "browser", "email", "meeting", "dbx-ui", "dbx-nb", "dbx-sql", "playground", "claude"];

  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={intro.eyebrow} /></div>
        <h1><T v={intro.title} /></h1>
        <DbxTabs active="triage" />
        <p className="lede"><T v={intro.lede} /></p>
      </header>

      <div className="note" style={{ margin: "14px 0" }}>
        <b className="lab warn-l"><T v={t("What was run, and what was not", "运行了什么，没运行什么")} /></b>
        <T v={intro.honesty} />
      </div>

      <div className="card dbx-check">
        <h3 style={{ marginTop: 0 }}><T v={t("Checked on this build", "本次构建的检查")} /></h3>
        <p className="muted small">
          <T v={t("Replay", "回放")} /> {R.replayed_at} · {R.platform} · template {R.template_commit} · <T v={t("files checked", "文件检查")} /> {report.checked_at}
        </p>
        <div className="stats">
          <div className="stat"><b>{fsteps.length}</b><span><T v={t("steps, every blueprint card", "个步骤，覆盖全部蓝图卡片")} /></span></div>
          <div className="stat"><b>{replayed}</b><span><T v={t("steps replayed in a clean clone", "个步骤在干净克隆中回放")} /></span></div>
          <div className="stat"><b>{R.steps.length - R.failures}/{R.steps.length}</b><span><T v={t("replayed commands as expected", "条回放命令符合预期")} /></span></div>
          <div className="stat"><b>{report.tests.run - report.tests.failed}/{report.tests.run}</b><span><T v={t("tests passed", "个测试通过")} /></span></div>
          <div className="stat"><b>{Object.keys(report.files).length}</b><span><T v={t("kit files checked", "个工具包文件已检查")} /></span></div>
          <div className="stat"><b>{Math.round(total)}s</b><span><T v={t("clone to last tool call, keyless", "从克隆到最后一次工具调用（无密钥）")} /></span></div>
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          <T v={t("The kit is native/contract-triage/ in this repository. After you change any file in it, run python3 native/contract-triage/check.py --write; the site will not build if a file changed after its check.", "工具包位于本仓库的 native/contract-triage/。修改其中任何文件后，运行 python3 native/contract-triage/check.py --write；如果某个文件在检查之后被改动，网站将无法构建。")} />
        </p>
      </div>

      <h2><T v={t("How to use this page", "如何使用本页")} /></h2>
      <p className="muted"><T v={intro.howToUse} /></p>
      <div className="ct-legend">
        {order.map((w) => (
          <div key={w}><span className={`ct-where w-${w}`}><T v={WHERE[w].label} /></span> <span className="small muted"><T v={WHERE[w].hint} /></span></div>
        ))}
      </div>

      <h2><T v={t("Where the code goes: Mac, GitHub, Databricks", "代码去向：Mac、GitHub、Databricks")} /></h2>
      <p className="muted"><T v={t("Code is written on the Mac and pushed to GitHub. A Git folder pulls it into the workspace for notebooks and jobs; the deploy script sends it to the app. You can also edit in the Git folder and commit back; pull before you start, and edit in one place at a time.", "代码在 Mac 上编写并推送到 GitHub。Git 文件夹把它拉进工作区供 notebook 和 job 使用；部署脚本把它发送给应用。你也可以在 Git 文件夹中编辑并提交回去；开始前先拉取，同一时间只在一个地方编辑。")} /></p>
      <ol className="pipe">
        {flow.map((f) => (<li key={f.id} className="pipe-stage"><b><T v={f.label} /></b><span><T v={f.detail} /></span></li>))}
      </ol>

      <h2><T v={t("Your progress", "你的进度")} /></h2>
      <TriageProgress steps={progress} after={after} />

      <h2><T v={t("What the checks changed in the blueprint", "检查中发现的、与蓝图不同之处")} /></h2>
      <div className="ct-corr">
        {corrections.map((c) => (
          <div key={c.title.en} className="card"><h3><T v={c.title} /></h3><p className="small"><T v={c.detail} /></p></div>
        ))}
      </div>

      <OpenAll />
      <FollowSteps stages={stages} number={fnumber} titleOf={titleOf} />

      <h2 id="risks"><T v={t("Risks, fallbacks and cut order", "风险、后备方案与删减顺序")} /></h2>
      <div className="table-scroll">
        <table className="dbx-trouble">
          <thead><tr><th><T v={t("Risk", "风险")} /></th><th><T v={t("Fallback", "后备方案")} /></th><th><T v={t("Checked at", "检查于")} /></th></tr></thead>
          <tbody>{risks.map((r) => (
            <tr key={r.risk.en}><td><T v={r.risk} /></td><td><T v={r.fallback} /></td>
              <td><a className="chip" href={`#f-${r.at}`}>{fstepById[r.at].bp}</a></td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="small"><T v={cutOrder} /></p>

      <h2><T v={t("Sources", "来源")} /></h2>
      <ul className="bullets">{sources.map((s) => (<li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>))}</ul>
    </div>
  );
}
