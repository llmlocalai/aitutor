import type { Module, PlatformId } from "./types";
import { inference } from "@/content/modules/inference";
import { ragGraph } from "@/content/modules/rag-graph";
import { harness } from "@/content/modules/harness";
import { evaluation } from "@/content/modules/evaluation";
import { outlines } from "@/content/modules/outlines";

const all: Module[] = [inference, ragGraph, harness, evaluation, ...outlines];

export const modules: Module[] = [...all].sort(
  (a, b) => a.layer - b.layer || a.title.localeCompare(b.title),
);

export const byId: Record<string, Module> = Object.fromEntries(modules.map((m) => [m.id, m]));

export const platforms: { id: Exclude<PlatformId, "local">; name: string; kind: string }[] = [
  { id: "databricks", name: "Databricks", kind: "Managed data and AI platform" },
  { id: "watsonx", name: "IBM watsonx", kind: "Managed AI platform" },
  { id: "codex", name: "Codex", kind: "Coding agent and SDK" },
  { id: "cursor", name: "Cursor", kind: "Editor with an agent" },
  { id: "claude", name: "Claude Code / Agent SDK", kind: "Coding agent and SDK" },
  { id: "other", name: "Another machine", kind: "Self-hosted" },
];

/** Modules that list `id` as a prerequisite. */
export function dependents(id: string): Module[] {
  return modules.filter((m) => m.prereqs.some((p) => p.id === id));
}

/** Every module that must exist before `id`, direct or indirect. */
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

/** A valid build order for the given set (default: everything). Stable and deterministic. */
export function buildOrder(only?: Set<string>): Module[] {
  const pool = modules.filter((m) => !only || only.has(m.id));
  const done = new Set<string>();
  const out: Module[] = [];
  while (out.length < pool.length) {
    const next = pool.find(
      (m) => !done.has(m.id) && m.prereqs.every((p) => done.has(p.id) || (only && !only.has(p.id))),
    );
    if (!next) break; // cycle guard: should never happen
    done.add(next.id);
    out.push(next);
  }
  return out;
}

/** The shortest chain of prerequisite edges from `from` up to `to`, if `to` depends on `from`. */
export function chain(from: string, to: string): { id: string; why: string }[] | null {
  const queue: { id: string; path: { id: string; why: string }[] }[] = [{ id: to, path: [] }];
  const seen = new Set<string>([to]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const p of byId[cur.id]?.prereqs ?? []) {
      const path = [{ id: cur.id, why: p.why }, ...cur.path];
      if (p.id === from) return path;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        queue.push({ id: p.id, path });
      }
    }
  }
  return null;
}

export type Relation =
  | { kind: "same" }
  | { kind: "before"; first: string; second: string; steps: { id: string; why: string }[] }
  | { kind: "independent"; shared: string[] };

/** Answers "why does A come before B?" for any pair. */
export function relate(a: string, b: string): Relation {
  if (a === b) return { kind: "same" };
  const ab = chain(a, b);
  if (ab) return { kind: "before", first: a, second: b, steps: ab };
  const ba = chain(b, a);
  if (ba) return { kind: "before", first: b, second: a, steps: ba };
  const aa = ancestors(a);
  const bb = ancestors(b);
  return { kind: "independent", shared: [...aa].filter((x) => bb.has(x)) };
}

/** Plain-text digest of a lesson, sent to the tutor as context. */
export function lessonDigest(m: Module): string {
  const lines: string[] = [
    `MODULE: ${m.title}`,
    `WHAT: ${m.what}`,
    `WHY: ${m.why}`,
    `HOW:\n- ${m.how.join("\n- ")}`,
  ];
  if (m.prereqs.length) {
    lines.push(
      "PREREQUISITES:\n" +
        m.prereqs.map((p) => `- ${byId[p.id]?.title ?? p.id}: ${p.why}`).join("\n"),
    );
  }
  if (m.steps) {
    lines.push(
      "BUILD STEPS:\n" +
        m.steps.map((s, i) => `${i + 1}. ${s.title}. Why here: ${s.why}`).join("\n"),
    );
  }
  if (m.failures) {
    lines.push("FAILURES SEEN:\n" + m.failures.map((f) => `- ${f.title}: ${f.lesson}`).join("\n"));
  }
  lines.push(
    "ON OTHER PLATFORMS:\n" +
      platforms.map((p) => `- ${p.name}: ${m.portability[p.id]}`).join("\n"),
  );
  return lines.join("\n\n").slice(0, 9000);
}
