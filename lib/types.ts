export type PlatformId =
  | "local"
  | "databricks"
  | "watsonx"
  | "codex"
  | "cursor"
  | "claude"
  | "other";

export interface Prereq {
  id: string;
  /** Why this prerequisite has to exist first. Shown on the map edge. */
  why: string;
  /** What to stub if you want to build this module before the prerequisite. */
  stub?: string;
}

export interface CodeBlock {
  lang: string;
  file?: string;
  text: string;
}

export interface Step {
  title: string;
  /** The reason this step sits where it does in the order. */
  why: string;
  body: string[];
  code?: CodeBlock;
  /** How you know the step worked. */
  verify?: string;
}

export interface FlowStage {
  label: string;
  detail: string;
  kind?: "input" | "model" | "store" | "check" | "output" | "tool";
}

export interface Flow {
  caption: string;
  stages: FlowStage[];
  loop?: { from: number; to: number; label: string };
}

export interface Failure {
  when: string;
  title: string;
  what: string;
  fix: string;
  lesson: string;
}

export interface Check {
  q: string;
  a: string;
}

export interface Module {
  id: string;
  title: string;
  short: string;
  /** Column on the curriculum map. 0 is the foundation. */
  layer: number;
  depth: "deep" | "outline";
  what: string;
  why: string;
  how: string[];
  prereqs: Prereq[];
  /** Where this lives in the reference build (paths are relative and sanitized). */
  inBuild: { path: string; role: string }[];
  flow?: Flow;
  steps?: Step[];
  /** How this piece cooperates with its neighbors at run time. */
  together?: { with: string; how: string }[];
  failures?: Failure[];
  portability: Record<Exclude<PlatformId, "local">, string>;
  checks: Check[];
  terms?: { term: string; def: string }[];
}

export interface LiveCommit {
  hash: string;
  date: string;
  subject: string;
  modules: string[];
}

export interface LiveDoc {
  path: string;
  title: string;
  updated: string;
  headings: string[];
  modules: string[];
}

export interface LiveFile {
  path: string;
  lines: number;
  updated: string;
  summary: string;
  modules: string[];
}

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
