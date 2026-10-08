import Link from "next/link";
import T from "@/components/T";
import { audit } from "@/lib/audit";
import { stepByKey } from "@/lib/curriculum";
import { t } from "@/lib/types";

export const metadata = { title: "Self-audit · 自检" };

export default function Audit() {
  const r = audit();
  if (r.errors.length) {
    // Fail the build. A site with a broken link or an unverified number does not ship.
    throw new Error("AUDIT FAILED\n" + r.errors.join("\n"));
  }
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><T v={t("Self-audit", "自检")} /></div>
        <h1><T v={t("What was checked, and what was not", "检查了什么，没检查什么")} /></h1>
        <p className="lede">
          <T v={t(
            "This page is produced by a check that runs on every build. If a step link is broken, a translation is missing, a lab file is gone, or a lesson quotes a result the labs did not print, the build stops and the site is not published.",
            "这个页面由每次构建都会运行的检查生成。如果步骤之间的链接断了、缺少翻译、lab 文件丢失，或课程引用了 lab 并未输出的结果，构建就会中止，网站不会发布。",
          )} />
        </p>
      </header>

      <div className="panel stats">
        {Object.entries(r.stats).map(([k, v]) => (
          <div className="stat" key={k}><b>{v}</b><span>{k}</span></div>
        ))}
      </div>

      <h2><T v={t("What this does not prove", "这些检查不能证明什么")} /></h2>
      <ul className="bullets">
        <li><T v={t("The labs ran against a deterministic fake model. They prove the plumbing. They say nothing about how a real model behaves.", "lab 是用确定性的假模型运行的。它们证明管道是通的，但说明不了真实模型的表现。")} /></li>
        <li><T v={t("Steps marked as not executed describe work on your own machine or account. Their commands were written from experience and documentation, and were not run.", "标记为“未执行”的步骤描述的是在你自己的机器或账号上的操作。其中的命令依据经验和文档编写，没有实际运行过。")} /></li>
        <li><T v={t("Platform guides were written from vendor pages and never executed. Product names and commands change.", "各平台指南依据厂商页面编写，从未实际执行。产品名称和命令会变化。")} /></li>
        <li><T v={t("The Chinese text was written by the same author as the English and has not been reviewed by a second reader.", "中文内容与英文出自同一作者，没有经过第二位读者的审校。")} /></li>
        <li><T v={t("Failure stories from the reference build are paraphrased from its own notes and commit history. Details were removed to keep the site public.", "参考系统的故障案例转述自它自己的笔记和提交历史。为了让网站可以公开，细节已被删去。")} /></li>
      </ul>

      <h2><T v={t("Steps not executed in the labs", "lab 中未执行的步骤")} /> ({r.notExecuted.length})</h2>
      <ul className="feed">
        {r.notExecuted.map((s) => {
          const ref = stepByKey[s.key];
          return (
            <li key={s.key}>
              <span className="meta">{s.key}</span>
              <Link href={`/modules/${ref.module.id}#step-${ref.step.id}`}><T v={s.title} /></Link>
            </li>
          );
        })}
      </ul>

      <h2><T v={t("Links that point to a later module", "指向后续模块的链接")} /> ({r.forward.length})</h2>
      <p className="muted">
        <T v={t(
          "These steps use something built in a later module. The playbook order places them after what they need.",
          "这些步骤用到了后面模块才搭建的东西。操作手册的顺序已把它们排在所依赖的步骤之后。",
        )} />
      </p>
      <ul className="feed">
        {r.forward.map((f) => (<li key={f.from + f.to}><span className="meta">{f.from} → {f.to}</span></li>))}
      </ul>

      <h2><T v={t("Warnings", "警告")} /> ({r.warnings.length})</h2>
      <ul className="feed">
        {r.warnings.map((w) => (<li key={w}><span className="meta">{w}</span></li>))}
      </ul>
    </div>
  );
}
