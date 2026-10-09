import { t, type LS } from "@/lib/types";
import { phases1 } from "./phases-1";
import { phases2 } from "./phases-2";
import { phases3 } from "./phases-3";
import { models } from "./models";
import { symptoms } from "./diagnose";
import { FAMILY_IDS, type FamilyId, type HPhase, type HStep } from "./types";

/**
 * Building a harness around an LLM: steps and templates that apply to any model, model-specific guidance,
 * a tracked build loop and a diagnoser. Evidence: a public corpus of reported vendor prompts and harness
 * files (measured by harness/corpus/measure.py; numbers in content/harness-corpus.json), vendor pages read
 * on 2026-10-09, and the kit in harness/, whose checks content/harness-check.json records. No model ran
 * the structure experiment while the page was built; content/harness-results.json holds model runs.
 */

const raw: HPhase[] = [...phases1, ...phases2, ...phases3];

export const order: string[] = raw.flatMap((p) => p.steps.map((s) => s.id));
export const numberOf: Record<string, number> = Object.fromEntries(order.map((id, i) => [id, i + 1]));
export const unknownRefs: string[] = [];

const fill = (v: LS): LS => {
  const sub = (s: string) => s.replace(/\[\[([a-z-]+)\]\]/g, (_m, id: string) => {
    if (!numberOf[id]) { unknownRefs.push(id); return id; }
    return String(numberOf[id]);
  });
  return { en: sub(v.en), zh: sub(v.zh) };
};
const fillModels = (m?: Partial<Record<FamilyId, LS>>) =>
  m ? (Object.fromEntries(Object.entries(m).map(([k, v]) => [k, fill(v as LS)])) as Partial<Record<FamilyId, LS>>) : undefined;
const fillStep = (s: HStep): HStep => ({
  ...s,
  title: fill(s.title), local: fill(s.local), why: fill(s.why), what: fill(s.what), done: fill(s.done),
  how: s.how.map(fill), interpret: s.interpret.map(fill),
  trouble: s.trouble.map((x) => ({ s: fill(x.s), c: fill(x.c), f: fill(x.f) })),
  unconfirmed: s.unconfirmed ? fill(s.unconfirmed) : undefined,
  scale: s.scale?.map(fill),
  challenge: s.challenge?.map((c) => ({ q: fill(c.q), a: fill(c.a) })),
  models: fillModels(s.models),
});
export const phases: HPhase[] = raw.map((p) => ({ ...p, title: fill(p.title), goal: fill(p.goal), steps: p.steps.map(fillStep) }));
export const rsteps: HStep[] = phases.flatMap((p) => p.steps);
export const rstepById: Record<string, HStep> = Object.fromEntries(rsteps.map((s) => [s.id, s]));
export { models, symptoms, FAMILY_IDS };

export const intro = {
  title: t("Build a harness around any LLM", "为任意大模型搭建智能体框架"),
  lede: t(
    "A harness is everything around the model that makes it an agent: the system prompt, tools, skills, project instructions, subagents, memory, the loop, the gates and the evals. This page walks you through building one in 19 steps, with a complete kit you can copy, guidance for eleven model families, a process map that tracks where you are and loops you back when the evals find a failure, and a diagnoser that tells you, case by case, what is wrong and what to try.",
    "智能体框架是模型周围让它成为智能体的一切：系统提示词、工具、技能、项目指令、子智能体、记忆、循环、闸门和评估。本页分 19 步带你搭建一个框架，提供可以直接复制的完整工具包、针对十一个模型系列的指导、一张记录你所处位置并在评估发现问题时把你带回相应步骤的流程图，以及一个逐个分析问题所在、告诉你该尝试什么的诊断工具。",
  ),
  example: t(
    "The worked example is an expense desk agent: it answers questions about submitted expenses and the policy, and proposes flags that a person approves. It is small enough to read in full and has every part a production agent needs: a policy skill, an approval gate, a denied outward action, untrusted text in the data, and an eval set with safety cases.",
    "示例是一个报销服务台智能体：它回答有关已提交报销和政策的问题，并提出由人工批准的标记建议。它小到可以完整读完，却具备生产级智能体所需的每个部分：一个政策技能、一个审批闸门、一个被禁止的对外动作、数据中的不可信文本，以及包含安全用例的评估集。",
  ),
  honesty: t(
    "Nothing on this page ran against a language model: the workspace that built it had no model access. What did run is shown with its counts: the kit's tests, the oracle and null baselines through the real loop, gate and graders, the linter over every template for every family, and the corpus measurements. The structure experiment is a runnable kit; its results appear below only after someone runs it against a model with --write. Vendor facts come from vendor pages read on 2026-10-09. Corpus facts come from reported, unverified prompts: they show how vendors write, not proof of what works.",
    "本页的任何内容都没有在语言模型上运行过：构建本页的工作环境无法访问模型。实际运行过的内容都附有计数：工具包的测试、经过真实循环、闸门和评分器的理想基线与空白基线、对每个系列的每个模板运行的检查器，以及语料测量。结构实验是一个可运行的工具包；只有在有人用 --write 对模型运行之后，它的结果才会出现在下方。厂商事实来自 2026-10-09 阅读的厂商页面。语料事实来自据称泄露、未经核实的提示词：它们展示的是厂商如何写，而不是什么方法有效的证明。",
  ),
  scriptsHow: t(
    "All files live in harness/ in this repository and need only Python 3.10 and the standard library. Copy the folder, run python3 harness/check.py, then follow the steps in order or in any order the map allows.",
    "所有文件都在本仓库的 harness/ 目录中，只需要 Python 3.10 和标准库。复制这个文件夹，运行 python3 harness/check.py，然后按顺序或按流程图允许的任意顺序完成各个步骤。",
  ),
  corpus: t(
    "The evidence base is a public GitHub collection of reported system prompts and harness files from about fifteen vendors (asgeirtj/system_prompts_leaks), studied in full and measured by a script. The page never reproduces their text: it cites counts, file paths and paraphrased patterns.",
    "证据基础是 GitHub 上一个公开的合集，收录了约十五家厂商据称泄露的系统提示词和框架文件（asgeirtj/system_prompts_leaks），我们完整研读了它并用脚本做了测量。本页从不转载其中的文字：只引用计数、文件路径和转述的模式。",
  ),
};

/** The process map: the loops that send you back from evaluation to the step that owns a failure. */
export const loops: { from: string; to: string[]; label: LS }[] = [
  { from: "experiment", to: ["prompt", "skills"], label: t("A structure wins outside the noise floor: change the rendering or skill loading for this family.", "某种结构在噪声下限之外胜出：修改该系列的渲染方式或技能加载方式。") },
  { from: "hillclimb", to: ["tools", "skills", "gate", "stop", "verify", "prompt"], label: t("Top failure label: fix it in the layer the taxonomy names, one change per round.", "排名第一的问题标签：在分类表指定的层级修复，每轮只改一处。") },
  { from: "release", to: ["cases"], label: t("A production failure no case covers: write the case, then climb again.", "一个没有用例覆盖的生产问题：先写用例，再继续迭代。") },
  { from: "model", to: ["model"], label: t("A model or server upgrade: probe again before trusting old results.", "模型或服务器升级：在相信旧结果之前重新探测。") },
];

/** Patterns that appear in independently written harnesses across vendors (convergence is evidence). */
export const consensus: { what: LS; where: string }[] = [
  { what: t("Dedicated read, search and edit tools instead of the shell for file work.", "文件操作使用专门的读取、搜索和编辑工具，而不是 shell。"), where: "Cursor, grok-build, Devin CLI, Amp, Claude Code" },
  { what: t("Exact-string replacement as the edit primitive, with read-before-edit enforced by the tool.", "以精确字符串替换作为编辑基本操作，并由工具强制要求先读后改。"), where: "Gemini CLI, Cursor, Grok CLI, Copilot CLI, Zed" },
  { what: t("Independent calls in parallel, dependent ones in order; never two writers on the same files.", "相互独立的调用并行，相互依赖的按顺序；绝不让两个写入者处理同一批文件。"), where: "10 of 12 coding harnesses" },
  { what: t("\"Done\" only with tool evidence: run the checks, never fake a green result.", "只有在有工具证据时才算“完成”：运行检查，绝不伪造通过结果。"), where: "Grok CLI, Amp, Copilot CLI, Muse Code, Claude Code" },
  { what: t("Ask only on a short, closed list of triggers; otherwise act and state the assumption.", "只在一份简短、封闭的触发清单上提问；其他情况直接行动并写明假设。"), where: "grok-build, Copilot CLI, Codex, Claude 5.5, Muse Code" },
  { what: t("Long commands run in the background with a completion notice; no polling with sleep.", "长命令在后台运行并在完成时通知；不用 sleep 轮询。"), where: "grok-build, Grok CLI, Antigravity, Copilot CLI, Claude Code" },
  { what: t("Subagent briefs are self-contained, and a parent's message is never the user's approval.", "子智能体的任务说明自成一体，父智能体的消息绝不等于用户的批准。"), where: "Claude Code, Muse Code, Zed, Amp, Copilot CLI" },
  { what: t("Skills as folders with name and description frontmatter, bodies loaded on demand.", "技能是带 name 和 description frontmatter 的文件夹，正文按需加载。"), where: "Claude Code, Codex, ChatGPT dots, Muse, Gemini CLI, grok-build, Kimi 3" },
  { what: t("Tool results, pages and documents are data, never instructions.", "工具结果、网页和文档都是数据，绝不是指令。"), where: "Claude in Chrome, Comet, Gemini CLI, Codex, Claude Code" },
  { what: t("Compaction into fixed sections, and the newest message treated as steering afterwards.", "压缩成固定的小节，之后把最新消息当作方向调整。"), where: "Claude Code, Muse Code, Copilot CLI, Codex, Amp" },
];

/** The placement rule: where each kind of content belongs (step 3). */
export const placement: { kind: LS; where: LS }[] = [
  { kind: t("Behavior needed on every turn", "每一轮都需要的行为"), where: t("The core system prompt, short, every rule with its reason", "核心系统提示词，简短，每条规则带理由") },
  { kind: t("Facts about this session (date, user, repository state)", "关于本次会话的事实（日期、用户、仓库状态）"), where: t("An injected environment block, labeled as a snapshot", "注入的环境块，标注为快照") },
  { kind: t("How to use one tool", "某个工具的用法"), where: t("That tool's description and parameter descriptions", "该工具的说明和参数说明") },
  { kind: t("Long or occasional procedures and domain knowledge", "冗长或偶尔用到的流程和领域知识"), where: t("Skills, loaded on demand from a one-line index", "技能，从一行索引按需加载") },
  { kind: t("Anything that must happen every time", "每次都必须发生的事情"), where: t("Code: the gate, loop budgets, hooks, verification", "代码：闸门、循环预算、钩子、验证") },
  { kind: t("Work whose raw output should not fill the main context", "原始输出不该塞满主上下文的工作"), where: t("A subagent with a fixed output contract", "带固定输出约定的子智能体") },
  { kind: t("Facts for coding agents that change the harness", "供修改框架的编码智能体使用的事实"), where: t("AGENTS.md (or CLAUDE.md, GEMINI.md)", "AGENTS.md（或 CLAUDE.md、GEMINI.md）") },
  { kind: t("What the user stated, across sessions", "用户跨会话说过的事"), where: t("Memory files, written after the turn, data only", "记忆文件，在本轮结束后写入，只存数据") },
];

/** Corpus numbers the text quotes. The audit checks each against content/harness-corpus.json. */
export const corpusClaims: { label: string; field: string; value: number }[] = [
  { label: "Claude Sonnet 4.5", field: "emphatic_per_1k_words", value: 3.41 },
  { label: "Claude Opus 5.5", field: "emphatic_per_1k_words", value: 1.01 },
  { label: "Claude 3.7 Sonnet", field: "because_per_10kb", value: 0.27 },
  { label: "Claude Opus 5.5", field: "because_per_10kb", value: 1.39 },
  { label: "Codex CLI, GPT-5", field: "emphatic_per_1k_words", value: 1.17 },
  { label: "Codex, GPT-6.1 Sol", field: "emphatic_per_1k_words", value: 0.26 },
  { label: "DeepSeek chat", field: "bytes", value: 438 },
];

export const sources = [
  { title: "Corpus: asgeirtj/system_prompts_leaks (reported, unverified)", url: "https://github.com/asgeirtj/system_prompts_leaks" },
  ...models.flatMap((m) => m.docs).filter((d, i, a) => a.findIndex((x) => x.url === d.url) === i),
];

export function orderProblems(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const s = rstepById[id];
    for (const a of s.after) {
      if (!numberOf[a]) out.push(`${id}: after unknown step ${a}`);
      else if (!seen.has(a)) out.push(`${id}: after ${a}, which comes later`);
    }
    for (const k of Object.keys(s.models ?? {})) if (!FAMILY_IDS.includes(k as FamilyId)) out.push(`${id}: unknown model family ${k}`);
    seen.add(id);
  }
  for (const l of loops) for (const x of [l.from, ...l.to]) if (!numberOf[x]) out.push(`loop refers to unknown step ${x}`);
  for (const sy of symptoms) for (const st of sy.steps) if (!numberOf[st]) out.push(`symptom ${sy.id}: unknown step ${st}`);
  const ids = models.map((m) => m.id).sort().join(",");
  if (ids !== [...FAMILY_IDS].sort().join(",")) out.push(`model profiles ${ids} do not match the family ids`);
  return out;
}
