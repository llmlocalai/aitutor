import fs from "node:fs";
import path from "node:path";
import BuildTracker, { type TrackPhase } from "@/components/BuildTracker";
import CodeBlock from "@/components/CodeBlock";
import Diagnoser from "@/components/Diagnoser";
import FamilyPicker from "@/components/FamilyPicker";
import HarnessLinter from "@/components/HarnessLinter";
import OpenAll from "@/components/OpenAll";
import PhaseSteps from "@/components/PhaseSteps";
import T from "@/components/T";
import corpus from "@/content/harness-corpus.json";
import results from "@/content/harness-results.json";
import { consensus, FAMILY_IDS, intro, loops, models, numberOf, phases, placement, rstepById, rsteps, sources, symptoms } from "@/content/harness";
import type { FamilyId, HStep } from "@/content/harness/types";
import { FAMILY_BOOT } from "@/lib/harness-family";
import type { Kind } from "@/lib/harness-lint";
import { KITS } from "@/lib/replicate";
import type { LS } from "@/lib/types";
import { ui } from "@/lib/ui";

export const metadata = {
  title: "Harness engineering · 智能体框架工程",
  description: "Build the harness around any LLM, step by step: layout, system prompt, tools, skills, loop, gates, evals and a structure experiment, with guidance for eleven model families and a diagnoser.",
};

const pad = (n: number) => String(n).padStart(2, "0");
const label = Object.fromEntries(models.map((m) => [m.id, m.label])) as Record<FamilyId, string>;

interface CorpusFile { group: string; label: string; path: string; bytes: number; prose_bytes: number; emphatic_per_1k_words: number; because_per_10kb: number; behavioral_core_bytes?: number }
interface SkillSet { label: string; path: string; skills: number; median_bytes: number; fields: Record<string, number>; with_references: number; with_scripts: number; with_evals: number }
interface Run {
  run: string; agent?: string; model: string; served_models?: string[]; family: string; label: string; date: string;
  noise_floor: number; cases: number; repeats: number; infra_errors: number; split?: string;
  variants: { id: string; pass_rate: number; by_category: Record<string, number>; mean_steps: number; mean_prompt_tokens: number;
    vs_control?: { delta: number; lo: number; hi: number }; verdict?: string; symptoms: Record<string, number> }[];
}
interface HarnessReport {
  checked_at: string; python: string; files: Record<string, { check: string }>; tests: { run: number; failed: number; names: string[] };
  baselines: { oracle: { runs: number; passed: number }; null: { runs: number; passed: number } };
  lint_findings: Record<string, number>; prompt_tokens: Record<string, number>; cases: number; variants: number;
}

function Bars({ rows, unit, digits = 2 }: { rows: { label: string; value: number; path: string }[]; unit: string; digits?: number }) {
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.path} className="hb-row" title={`${r.label}: ${r.value.toFixed(digits)} ${unit} (${r.path})`}>
          <span className="hb-label">{r.label}</span>
          <span className="hb-track"><span className="hb-bar" style={{ width: `${Math.max(0.6, (r.value / max) * 100)}%` }} /></span>
          <span className="hb-val">{r.value.toFixed(digits)}</span>
        </div>
      ))}
    </div>
  );
}

function ModelNotes({ s }: { s: HStep }) {
  const m = s.models ?? {};
  const fams = FAMILY_IDS.filter((f) => f !== "generic" && m[f]);
  if (!m.generic && fams.length === 0) return null;
  return (
    <div className="fam-notes">
      <h4><T v={ui.hxForModel} /></h4>
      {m.generic && <div className="fam-note-generic"><b className="lab"><T v={ui.hxEveryModel} /></b><T v={m.generic} /></div>}
      {fams.map((f) => (
        <div key={f} className="fam-note" data-fam={f}><b className="lab">{label[f]}</b><T v={m[f] as LS} /></div>
      ))}
    </div>
  );
}

export default function HarnessPage() {
  const report = KITS.harness.report as unknown as HarnessReport;
  const files = corpus.files as unknown as CorpusFile[];
  const skills = corpus.skills as unknown as SkillSet[];
  const runs = (results as unknown as { runs: Run[] }).runs.filter((r) => (r.agent ?? "model") === "model");
  const group = (g: string) => files.filter((f) => f.group === g);
  const famCss = FAMILY_IDS.map((f) =>
    `html[data-family="${f}"] .fam-note[data-fam="${f}"],html[data-family="${f}"] .model-card[data-fam="${f}"]{display:block}`).join("");

  const trackPhases: TrackPhase[] = phases.map((p) => ({
    id: p.id, title: p.title,
    steps: p.steps.map((s) => ({ id: s.id, n: numberOf[s.id], title: s.title, after: s.after, done: s.done })),
  }));
  const extra = Object.fromEntries(rsteps.map((s) => [s.id, <ModelNotes key={s.id} s={s} />]));
  const fixtures = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "harness/lint/fixtures/expected.json"), "utf8")).cases as { file: string; kind: Kind; family: string }[])
    .filter((c) => c.file.startsWith("fixtures/bad"))
    .map((c) => ({ label: `${c.file.replace("fixtures/", "")} (${c.family})`, kind: c.kind, family: c.family,
      text: fs.readFileSync(path.join(process.cwd(), "harness/lint", c.file), "utf8") }));
  const questions = rsteps.flatMap((s) => (s.challenge ?? []).map((c) => ({ ...c, step: s })));
  const lintClean = Object.values(report.lint_findings).filter((n) => n === 0).length;
  const parsed = Object.values(report.files).filter((f) => !f.check.startsWith("FAILED") && f.check !== "read only").length;

  return (
    <div className="wrap hx-page">
      <script dangerouslySetInnerHTML={{ __html: FAMILY_BOOT }} />
      <style dangerouslySetInnerHTML={{ __html: famCss }} />
      <header className="lesson-head">
        <div className="eyebrow"><T v={ui.hxEyebrow} /></div>
        <h1><T v={intro.title} /></h1>
        <p className="lede"><T v={intro.lede} /></p>
      </header>

      <nav className="hx-toc" aria-label="On this page">
        <a href="#map"><T v={ui.hxMapTitle} /></a>
        <a href={`#ph-${phases[0].id}`}>01 to {pad(rsteps.length)}</a>
        <a href="#results"><T v={ui.hxResultsTitle} /></a>
        <a href="#diagnose"><T v={ui.hxDiagTitle} /></a>
        <a href="#lint"><T v={ui.hxLintTitle} /></a>
        <a href="#models"><T v={ui.hxGuideTitle} /></a>
        <a href="#evidence"><T v={ui.hxEvidenceTitle} /></a>
      </nav>

      <div className="card workflow-card">
        <b className="lab"><T v={ui.nbWorkflow} /></b>
        <p style={{ margin: 0 }}><T v={intro.example} /></p>
      </div>

      <div className="note" style={{ margin: "14px 0" }}>
        <b className="lab warn-l"><T v={ui.hxNotRun} /></b>
        <T v={intro.honesty} />
      </div>

      <h2 id="pick-title" className="hx-pick-title"><T v={ui.hxModelTitle} /></h2>
      <p className="muted"><T v={ui.hxModelLede} /></p>
      <section className="hx-pick" aria-labelledby="pick-title">
        <FamilyPicker families={models.map((m) => ({ id: m.id, label: m.label, kind: m.kind }))} />
      </section>

      <div className="card dbx-check">
        <h3 style={{ marginTop: 0 }}><T v={ui.hxCheckTitle} /></h3>
        <p className="muted small"><T v={ui.hxCheckLede} /> {report.checked_at}, Python {report.python}.</p>
        <div className="stats">
          <div className="stat"><b>{report.tests.run - report.tests.failed}/{report.tests.run}</b><span><T v={ui.hxTestsPassed} /></span></div>
          <div className="stat"><b>{report.baselines.oracle.passed}/{report.baselines.oracle.runs}</b><span><T v={ui.hxOracle} /></span></div>
          <div className="stat"><b>{report.baselines.null.passed}/{report.baselines.null.runs}</b><span><T v={ui.hxNull} /></span></div>
          <div className="stat"><b>{lintClean}/{Object.keys(report.lint_findings).length}</b><span><T v={ui.hxLintClean} /></span></div>
          <div className="stat"><b>{parsed}</b><span><T v={ui.hxFilesChecked} /></span></div>
          <div className="stat"><b>{report.cases}×{report.variants}</b><span><T v={ui.hxCasesVariants} /></span></div>
        </div>
        <details className="check" style={{ marginTop: 12, marginBottom: 0 }}>
          <summary><T v={ui.dbxTestNames} /></summary>
          <div className="ans"><ul className="bullets mono-list">{report.tests.names.map((n) => <li key={n}>{n}</li>)}</ul></div>
        </details>
        <p className="small" style={{ marginBottom: 0 }}><T v={intro.scriptsHow} /></p>
      </div>

      <h2 id="map"><T v={ui.hxMapTitle} /></h2>
      <p className="muted"><T v={ui.hxMapLede} /></p>
      <BuildTracker phases={trackPhases} loops={loops} />

      <h2><T v={ui.hxPlacement} /></h2>
      <div className="table-scroll">
        <table className="dbx-trouble">
          <tbody>{placement.map((p) => <tr key={p.kind.en}><td><b><T v={p.kind} /></b></td><td><T v={p.where} /></td></tr>)}</tbody>
        </table>
      </div>

      <OpenAll />
      <PhaseSteps phases={phases} numberOf={numberOf} byId={rstepById} localLabel={ui.hxProduces} kitRoot={KITS.harness.root} extra={extra} />

      <h2 id="results"><T v={ui.hxResultsTitle} /></h2>
      {runs.length === 0 ? (
        <div className="note">
          <p style={{ marginTop: 0 }}><b><T v={ui.hxResultsNone} /></b></p>
          <p><T v={ui.hxResultsHow} /></p>
          <CodeBlock text={`python3 harness/probe/probe.py --base-url http://localhost:11434/v1 --model <name>
python3 harness/evals/run_eval.py --base-url http://localhost:11434/v1 --model <name> \\
    --family <id> --variants all --repeats 3 --label "<hardware, quantization>" --write`} label="bash" />
        </div>
      ) : runs.map((r) => (
        <div key={r.run} className="card hx-run">
          <h3 style={{ marginTop: 0 }}>{r.model} · {r.family} · {r.label} · {r.date}</h3>
          <p className="small muted">{r.cases} × {r.repeats} · <T v={ui.hxNoise} /> {r.noise_floor} · infra {r.infra_errors}
            {r.split && r.split !== "all" ? ` · split ${r.split}` : ""}
            {r.served_models?.length ? ` · served ${r.served_models.join(", ")}` : ""}</p>
          <div className="table-scroll">
            <table className="dbx-trouble">
              <thead><tr><th><T v={ui.hxVariant} /></th><th><T v={ui.hxPass} /></th><th><T v={ui.hxSafety} /></th><th><T v={ui.hxSteps} /></th><th><T v={ui.hxTokens} /></th><th><T v={ui.hxDelta} /></th><th><T v={ui.hxVerdict} /></th><th><T v={ui.hxSymptoms} /></th></tr></thead>
              <tbody>
                {r.variants.map((v) => (
                  <tr key={v.id}>
                    <td><code>{v.id}</code></td><td>{v.pass_rate.toFixed(3)}</td><td>{v.by_category.safety ?? ""}</td><td>{v.mean_steps}</td><td>{v.mean_prompt_tokens}</td>
                    <td>{v.vs_control ? `${v.vs_control.delta >= 0 ? "+" : ""}${v.vs_control.delta.toFixed(3)} [${v.vs_control.lo.toFixed(3)}, ${v.vs_control.hi.toFixed(3)}]` : <T v={ui.hxControl} />}</td>
                    <td>{v.verdict ?? ""}</td>
                    <td>{Object.entries(v.symptoms).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <h2 id="diagnose"><T v={ui.hxDiagTitle} /></h2>
      <p className="muted"><T v={ui.hxDiagLede} /></p>
      <Diagnoser symptoms={symptoms} steps={rsteps.map((s) => ({ id: s.id, n: numberOf[s.id], title: s.title }))} familyLabels={label} />

      <h2 id="lint"><T v={ui.hxLintTitle} /></h2>
      <p className="muted"><T v={ui.hxLintLede} /></p>
      <HarnessLinter examples={fixtures} />

      <h2 id="models"><T v={ui.hxGuideTitle} /></h2>
      <p className="muted"><T v={ui.hxGuideLede} /></p>
      <div className="model-grid">
        {models.map((m) => (
          <article key={m.id} className="card model-card" data-fam={m.id}>
            <h3>{m.id === "generic" ? <T v={ui.hxGenericFam} /> : m.label}</h3>
            <p className="small muted"><T v={m.kind} /></p>
            <dl className="model-dl">
              <dt><T v={ui.hxStructure} /></dt><dd><T v={m.structure} /></dd>
              <dt><T v={ui.hxTools} /></dt><dd><T v={m.tools} /></dd>
              <dt><T v={ui.hxReasoning} /></dt><dd><T v={m.reasoning} /></dd>
              <dt><T v={ui.hxSampling} /></dt><dd><T v={m.sampling} /></dd>
              <dt><T v={ui.hxContext} /></dt><dd><T v={m.context} /></dd>
            </dl>
            <h4><T v={ui.hxProfile} /></h4>
            <ul className="bullets">{m.profile.map((x) => <li key={x.en}><T v={x} /></li>)}</ul>
            <h4><T v={ui.hxGotchas} /></h4>
            <ul className="bullets">{m.gotchas.map((x) => <li key={x.en}><T v={x} /></li>)}</ul>
            <h4><T v={ui.hxEvidence} /></h4>
            <ul className="bullets">{m.evidence.map((x) => <li key={x.path}><code>{x.path}</code> <T v={x.note} /></li>)}</ul>
            <h4><T v={ui.hxDocs} /></h4>
            <ul className="bullets">{m.docs.map((d) => <li key={d.url}><a href={d.url} rel="noreferrer">{d.title}</a></li>)}</ul>
          </article>
        ))}
      </div>

      <h2 id="evidence"><T v={ui.hxEvidenceTitle} /></h2>
      <p className="muted"><T v={intro.corpus} /> <T v={ui.hxMeasured} /> {corpus.measured_at}, {corpus.files_in_corpus} files.</p>

      <div className="chart-grid">
        <figure className="card chart">
          <figcaption><T v={ui.hxChartEmph} /></figcaption>
          {(["claude-chat", "codex", "grok"] as const).map((g) => (
            <div key={g} className="chart-group"><div className="chart-gl">{g === "claude-chat" ? "Claude chat" : g === "codex" ? "Codex" : "Grok"}</div>
              <Bars rows={group(g).map((f) => ({ label: f.label, value: f.emphatic_per_1k_words, path: f.path }))} unit="per 1k words" />
            </div>
          ))}
        </figure>
        <figure className="card chart">
          <figcaption><T v={ui.hxChartBecause} /></figcaption>
          <Bars rows={group("claude-chat").map((f) => ({ label: f.label, value: f.because_per_10kb, path: f.path }))} unit="per 10 KB" />
          <figcaption style={{ marginTop: 16 }}><T v={ui.hxChartCore} /></figcaption>
          <Bars rows={group("claude-code").map((f) => ({ label: f.label.replace("Claude Code, ", ""), value: (f.behavioral_core_bytes ?? 0) / 1024, path: f.path }))} unit="KB" digits={1} />
        </figure>
        <figure className="card chart">
          <figcaption><T v={ui.hxChartSize} /></figcaption>
          <Bars rows={[...group("open-weight"), ...group("coding-agents"), ...files.filter((f) => ["Claude Opus 5.5", "Codex, GPT-6.1 Sol", "Grok 4.7"].includes(f.label))]
            .sort((a, b) => a.prose_bytes - b.prose_bytes).map((f) => ({ label: f.label, value: f.prose_bytes / 1024, path: f.path }))} unit="KB" digits={1} />
        </figure>
      </div>

      <details className="check">
        <summary><T v={ui.hxShowNumbers} /></summary>
        <div className="ans table-scroll">
          <table className="dbx-trouble small">
            <thead><tr><th><T v={ui.hxFile} /></th><th>bytes</th><th>prose</th><th>MUST.../1k</th><th>because/10KB</th></tr></thead>
            <tbody>{files.map((f) => <tr key={f.path}><td>{f.label}<br /><code>{f.path}</code></td><td>{f.bytes}</td><td>{f.prose_bytes}</td><td>{f.emphatic_per_1k_words}</td><td>{f.because_per_10kb}</td></tr>)}</tbody>
          </table>
        </div>
      </details>

      <h3><T v={ui.hxChartFields} /></h3>
      <div className="table-scroll">
        <table className="dbx-trouble">
          <thead><tr><th><T v={ui.hxSkillsCol} /></th><th>SKILL.md</th><th>median KB</th><th>frontmatter fields</th><th>references/ · scripts/ · evals/</th></tr></thead>
          <tbody>{skills.map((s) => (
            <tr key={s.path}><td>{s.label}<br /><code>{s.path}</code></td><td>{s.skills}</td><td>{(s.median_bytes / 1024).toFixed(1)}</td>
              <td>{Object.entries(s.fields).map(([k, n]) => `${k} ${n}`).join(", ")}</td><td>{s.with_references} · {s.with_scripts} · {s.with_evals}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <h3><T v={ui.hxPatterns} /></h3>
      <div className="table-scroll">
        <table className="dbx-trouble">
          <tbody>{consensus.map((c) => <tr key={c.what.en}><td><T v={c.what} /></td><td className="small">{c.where}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 id="review"><T v={ui.nbReviewTitle} /></h2>
      <p className="muted"><T v={ui.nbReviewLede} /></p>
      <div className="review-list">
        {questions.map((q) => (
          <details key={q.q.en} className="grill-q card">
            <summary><span className="chip">{pad(numberOf[q.step.id])}</span> <T v={q.q} /></summary>
            <p><T v={q.a} /></p>
            <a className="small" href={`#r-${q.step.id}`}><T v={q.step.title} /></a>
          </details>
        ))}
      </div>

      <h2 id="sources"><T v={ui.sources} /></h2>
      <ul className="bullets">{sources.map((s) => <li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>)}</ul>
    </div>
  );
}
