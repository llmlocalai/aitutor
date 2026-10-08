import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import CurriculumMap from "@/components/CurriculumMap";
import T from "@/components/T";
import WhyBefore from "@/components/WhyBefore";
import { modules, steps } from "@/lib/curriculum";
import { live } from "@/lib/live";
import { ui } from "@/lib/ui";

export default function Home() {
  const labSteps = steps.filter((s) => (s.step.lab || s.step.output) && !s.step.notExecuted).length;
  const slim = modules.map((m) => ({ id: m.id, n: m.n, layer: m.layer, title: m.title, short: m.short, steps: m.steps.length, prereqs: m.prereqs }));
  return (
    <div className="wrap">
      <section className="hero">
        <div className="eyebrow"><T v={ui.heroEyebrow} /></div>
        <h1><T v={ui.heroTitle} /></h1>
        <p className="lede"><T v={ui.heroLede} /></p>
        <div className="facts">
          <span><b>{modules.length}</b> <span className="en">modules</span><span className="zh">个模块</span></span>
          <span><b>{steps.length}</b> <span className="en">steps</span><span className="zh">个步骤</span></span>
          <span><b>{labSteps}</b> <span className="en">backed by tested lab code</span><span className="zh">步有经过测试的 lab 代码支撑</span></span>
          <span><b>2</b> <span className="en">languages</span><span className="zh">种语言</span></span>
        </div>
        <p style={{ marginTop: 18 }}>
          <Link className="btn" href="/playbook"><T v={ui.startHere} /></Link>
        </p>
      </section>

      <CurriculumMap mods={slim} />

      <h2 id="run"><T v={ui.runLabs} /></h2>
      <p className="muted"><T v={ui.pbSetupBody} /></p>
      <CodeBlock label="bash" text={`git clone <your repository url> aitutor && cd aitutor
python3 -m labs.run_all          # every lab, offline, about 20 seconds
python3 -m labs.m07_harness.demo # one lab

# use your own model instead of the fake one
export LAB_BASE_URL=http://127.0.0.1:11434/v1
export LAB_MODEL=<your model tag>`} />

      <h2 id="why"><T v={ui.whyTitle} /></h2>
      <p className="muted"><T v={ui.whyLede} /></p>
      <WhyBefore mods={slim} />

      <h2><T v={ui.allModules} /></h2>
      <div className="mods">
        {modules.map((m) => (
          <Link key={m.id} href={`/modules/${m.id}`} className="card mod">
            <div className="eyebrow">{String(m.n).padStart(2, "0")} · {m.steps.length} <T v={ui.steps} /></div>
            <h3><T v={m.title} /></h3>
            <p className="muted small"><T v={m.short} /></p>
          </Link>
        ))}
      </div>

      <h2><T v={ui.liveTitle} /></h2>
      <p className="muted">
        {live.generatedAt ? (
          <>
            <span className="en">Last snapshot {live.generatedAt.slice(0, 10)}: {live.stats.commits} changes, {live.stats.docs} design notes, {live.stats.files} source files, sorted into modules.</span>
            <span className="zh">最近快照 {live.generatedAt.slice(0, 10)}：{live.stats.commits} 项变更、{live.stats.docs} 篇设计笔记、{live.stats.files} 个源文件，已按模块归类。</span>
          </>
        ) : (
          <T v={ui.lvNone} />
        )}{" "}
        <Link href="/live"><T v={ui.seeChanges} /></Link>
      </p>
    </div>
  );
}
