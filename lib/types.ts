/** Every piece of lesson text exists in both languages. */
export type LS = { en: string; zh: string };
export const t = (en: string, zh: string): LS => ({ en, zh });

export type PlatformId = "databricks" | "watsonx" | "codex" | "cursor" | "claude" | "other";

export interface Prereq {
  id: string;
  why: LS;
  /** What to stand in for this prerequisite if you build out of order. */
  stub: LS;
}

export interface CodeBlock {
  lang: string;
  file?: string;
  text: string;
}

/** Code that is read from labs/ at build time, so the lesson shows what was tested. */
export interface Lab {
  file: string;
  /** Show only the part between `# region: name` and `# endregion`. */
  region?: string;
}

export interface StepLink {
  /** "<module id>.<step id>" */
  step: string;
  what: LS;
}

export interface Step {
  id: string;
  title: LS;
  /** Why this step sits at this point in the order. */
  why: LS;
  /** Exact actions, in order. */
  do: LS[];
  lab?: Lab;
  code?: CodeBlock;
  codeNote?: LS;
  /** Command that runs the lab for this step. */
  run?: string;
  /** Key into content/lab-output.json. */
  output?: string;
  /** Show only output lines that start with one of these prefixes (plus their indented continuation lines). */
  pick?: string[];
  verify: LS;
  /** Earlier steps this one consumes something from. */
  needs?: StepLink[];
  /** The artifact this step leaves behind for later steps. */
  produces: LS;
  /** True when the step describes work the labs do not execute. */
  notExecuted?: boolean;
}

export interface FlowStage {
  label: LS;
  detail: LS;
  kind?: "input" | "model" | "store" | "check" | "output" | "tool";
}

export interface Module {
  id: string;
  /** Lab folder number, 1 to 15. Also the default build position. */
  n: number;
  title: LS;
  short: LS;
  layer: number;
  what: LS;
  why: LS;
  how: LS[];
  prereqs: Prereq[];
  inBuild: { path: string; role: LS }[];
  flow?: { caption: LS; stages: FlowStage[]; loop?: { from: number; to: number; label: LS } };
  steps: Step[];
  together: { with: string; how: LS }[];
  failures: { when: string; title: LS; what: LS; fix: LS; lesson: LS }[];
  portability: Record<PlatformId, LS>;
  checks: { q: LS; a: LS }[];
  terms?: { term: LS; def: LS }[];
}

export interface PlatformStep {
  title: LS;
  /** Curriculum module this step corresponds to. */
  module: string;
  do: LS[];
  code?: CodeBlock;
  verify: LS;
}

export interface PlatformGuide {
  id: PlatformId;
  name: string;
  kind: LS;
  summary: LS;
  /** Who runs each part on this platform. */
  owns: { you: LS; platform: LS };
  steps: PlatformStep[];
  sources: { title: string; url: string }[];
}

export interface LiveCommit { hash: string; date: string; subject: string; modules: string[] }
export interface LiveDoc { path: string; title: string; updated: string; headings: string[]; modules: string[] }
export interface LiveFile { path: string; lines: number; updated: string; summary: string; modules: string[] }
export interface LiveManifest {
  generatedAt: string | null;
  source: string;
  stats: { commits: number; docs: number; files: number; redactions: number };
  commits: LiveCommit[];
  docs: LiveDoc[];
  files: LiveFile[];
  evals: { name: string; ts: string; metrics: Record<string, number | string> }[];
  digest?: string;
}
