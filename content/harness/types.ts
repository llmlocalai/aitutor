import type { LS } from "@/lib/types";
import type { Phase, RStep } from "@/content/databricks/types";

/** Model families the page gives specific guidance for. Ids match harness/template/prompts/families.yml. */
export type FamilyId = "generic" | "claude" | "gpt" | "gemini" | "grok" | "qwen" | "deepseek" | "kimi" | "glm" | "mistral" | "llama";
export const FAMILY_IDS: FamilyId[] = ["generic", "claude", "gpt", "gemini", "grok", "qwen", "deepseek", "kimi", "glm", "mistral", "llama"];

/** A harness step: a replication-style step plus what changes for each model family. */
export interface HStep extends RStep {
  /** `generic` applies to every model and is always shown; the others show for the chosen family. */
  models?: Partial<Record<FamilyId, LS>>;
}

export interface HPhase extends Omit<Phase, "steps"> {
  steps: HStep[];
}

export interface ModelProfile {
  id: FamilyId;
  label: string;
  /** One line: what kind of model this is and how it is usually run. */
  kind: LS;
  structure: LS;
  tools: LS;
  reasoning: LS;
  sampling: LS;
  context: LS;
  /** The harness profile this page recommends as a starting point, before your evals tune it. */
  profile: LS[];
  gotchas: LS[];
  /** Corpus files that show how the vendor itself writes for this family (paths in the public corpus). */
  evidence: { path: string; note: LS }[];
  docs: { title: string; url: string }[];
}

export interface Cause {
  cause: LS;
  /** How to confirm this is the cause before changing anything. */
  test: LS;
  fix: LS;
  /** Other things to try if the fix does not move the number. */
  options: LS[];
  /** Which harness files the fix touches. */
  files: string[];
}

export interface Symptom {
  /** Matches a label in harness/ops/failure_taxonomy.json. */
  id: string;
  title: LS;
  /** What you see in the transcript or the eval report. */
  seen: LS;
  steps: string[];
  causes: Cause[];
  /** How to tell the fix worked: which number, which case. */
  evaluate: LS;
  models?: Partial<Record<FamilyId, LS>>;
}
