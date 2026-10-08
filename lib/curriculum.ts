import type { LS, Module, PlatformId, Step } from "./types";
import { inference } from "@/content/modules/inference";
import { apiGateway } from "@/content/modules/api-gateway";
import { knowledge } from "@/content/modules/knowledge";
import { state } from "@/content/modules/state";
import { ragGraph } from "@/content/modules/rag-graph";
import { toolsMcp } from "@/content/modules/tools-mcp";
import { harness } from "@/content/modules/harness";
import { skills } from "@/content/modules/skills";
import { memory } from "@/content/modules/memory";
import { guardrails } from "@/content/modules/guardrails";
import { evaluation } from "@/content/modules/evaluation";
import { multiAgent } from "@/content/modules/multi-agent";
import { selfEvolving } from "@/content/modules/self-evolving";
import { sdk } from "@/content/modules/sdk";
import { ops } from "@/content/modules/ops";

/** In lab order, 1 to 15. */
export const modules: Module[] = [
  inference, apiGateway, knowledge, state, ragGraph, toolsMcp, harness, skills,
  memory, guardrails, evaluation, multiAgent, selfEvolving, sdk, ops,
].sort((a, b) => a.n - b.n);

export const byId: Record<string, Module> = Object.fromEntries(modules.map((m) => [m.id, m]));

export const platformNames: Record<PlatformId, string> = {
  databricks: "Databricks",
  watsonx: "IBM watsonx",
  codex: "Codex",
  cursor: "Cursor",
  claude: "Claude Code / Agent SDK",
  other: "Another machine",
};
export const platformIds = Object.keys(platformNames) as PlatformId[];

export function dependents(id: string): Module[] {
  return modules.filter((m) => m.prereqs.some((p) => p.id === id));
}

export function ancestors(id: string): Set<string> {
  const seen = new Set<string>();
  const walk = (x: string) => {
    for (const p of byId[x]?.prereqs ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        walk(p.id);
      }
    }
  };
  walk(id);
  return seen;
}

// ---- steps ----------------------------------------------------------------

export interface StepRef {
  key: string; // "<module>.<step>"
  module: Module;
  step: Step;
  index: number; // 1-based position inside its module
}

export const steps: StepRef[] = modules.flatMap((m) =>
  m.steps.map((s, i) => ({ key: `${m.id}.${s.id}`, module: m, step: s, index: i + 1 })),
);
export const stepByKey: Record<string, StepRef> = Object.fromEntries(steps.map((s) => [s.key, s]));

/** Steps that consume something from the given step. */
export function feeds(key: string): { ref: StepRef; what: LS }[] {
  const out: { ref: StepRef; what: LS }[] = [];
  for (const s of steps) {
    for (const n of s.step.needs ?? []) {
      if (n.step === key) out.push({ ref: s, what: n.what });
    }
  }
  return out;
}

/**
 * One valid order for every step: each step comes after everything it needs.
 * Ties are broken by lab order, so the result is stable and close to module order.
 */
export function masterOrder(): StepRef[] {
  const done = new Set<string>();
  const out: StepRef[] = [];
  const pending = [...steps];
  while (pending.length) {
    const i = pending.findIndex((s) => (s.step.needs ?? []).every((n) => done.has(n.step)));
    if (i < 0) throw new Error("cycle in step links: " + pending.map((p) => p.key).join(", "));
    const [next] = pending.splice(i, 1);
    done.add(next.key);
    out.push(next);
  }
  return out;
}

/** Everything a step transitively needs, in build order. */
export function pathTo(key: string): StepRef[] {
  const need = new Set<string>();
  const walk = (k: string) => {
    for (const n of stepByKey[k]?.step.needs ?? []) {
      if (!need.has(n.step)) {
        need.add(n.step);
        walk(n.step);
      }
    }
  };
  walk(key);
  return masterOrder().filter((s) => need.has(s.key));
}

/** Plain-text digest of a lesson in one language, sent to the tutor as context. */
export function lessonDigest(m: Module, lang: "en" | "zh"): string {
  const L = (v: LS) => v[lang];
  const lines: string[] = [
    `MODULE ${m.n}: ${L(m.title)}`,
    `WHAT: ${L(m.what)}`,
    `WHY: ${L(m.why)}`,
    "HOW:\n- " + m.how.map(L).join("\n- "),
  ];
  if (m.prereqs.length) {
    lines.push("NEEDS FIRST:\n" + m.prereqs.map((p) => `- ${L(byId[p.id].title)}: ${L(p.why)} | stub: ${L(p.stub)}`).join("\n"));
  }
  lines.push(
    "STEPS:\n" +
      m.steps
        .map((s, i) => {
          const needs = (s.needs ?? []).map((n) => `${n.step} (${L(n.what)})`).join("; ");
          return `${i + 1}. ${L(s.title)}\n   why here: ${L(s.why)}\n   do: ${s.do.map(L).join(" / ")}\n   uses: ${needs || "nothing"}\n   produces: ${L(s.produces)}\n   done when: ${L(s.verify)}${s.run ? `\n   run: ${s.run}` : ""}`;
        })
        .join("\n"),
  );
  lines.push("FAILURES:\n" + m.failures.map((f) => `- ${L(f.title)}: ${L(f.lesson)}`).join("\n"));
  return lines.join("\n\n").slice(0, 12000);
}
