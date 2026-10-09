import rulesFile from "@/harness/lint/rules.json";
import type { LS } from "./types";

/**
 * The browser interpreter of harness/lint/rules.json. It mirrors harness/lint/harness_lint.py rule type
 * by rule type; the audit runs both against harness/lint/fixtures/expected.json, so they cannot drift.
 */

export type Kind = "system" | "skill" | "agents" | "tools" | "subagent" | "memory";
export interface Finding { rule: string; severity: "error" | "warn" | "info"; evidence: string; message: LS; why: LS; fix: LS }

interface Rule {
  id: string; kinds: string[]; severity: "error" | "warn" | "info"; type: string; families?: string[];
  pattern?: string; flags?: string; message: LS; why: LS; fix: LS;
  [k: string]: unknown;
}
const RULES = rulesFile as unknown as { kinds: Kind[]; budgets: Record<string, number>; rules: Rule[] };
export const KINDS = RULES.kinds;
export const BUDGETS = RULES.budgets;

const re = (p: string, flags = "", global = false) => new RegExp(p, flags.replace(/[^im]/g, "") + (global ? "g" : ""));
const count = (p: string, flags: string, text: string) => (text.match(re(p, flags, true)) ?? []).length;

function frontmatter(text: string): { meta: Record<string, string> | null; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: null, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i >= 0 && !line.startsWith(" ") && !line.startsWith("#")) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

function tools(text: string): { name: string; description: string; schema: unknown }[] | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  const items = Array.isArray(data) ? data : (data as { tools?: unknown[] })?.tools ?? [];
  const out: { name: string; description: string; schema: unknown }[] = [];
  for (const t of Array.isArray(items) ? items : []) {
    if (!t || typeof t !== "object" || (t as { x_eval_only?: boolean }).x_eval_only) continue;
    const f = ((t as { function?: Record<string, unknown> }).function ?? t) as Record<string, unknown>;
    out.push({ name: String(f.name ?? ""), description: String(f.description ?? ""), schema: f.parameters ?? f.input_schema });
  }
  return out;
}

function firstLine(text: string, idx: number): string {
  const start = text.lastIndexOf("\n", idx) + 1;
  const end = text.indexOf("\n", idx);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, 100);
}

function check(r: Rule, text: string, family: string): string | null {
  const t = r.type, flags = r.flags ?? "";
  const { meta, body } = frontmatter(text);
  const words = text.split(/\s+/).filter(Boolean).length;
  const num = (k: string) => Number(r[k]);
  switch (t) {
    case "regex_absent": { const m = re(r.pattern!, flags).exec(text); return m ? `found: ${firstLine(text, m.index)}` : null; }
    case "regex_present": return re(r.pattern!, flags).test(text) ? null : "not found";
    case "regex_present_head": return re(r.pattern!, flags).test(text.slice(0, num("head_chars"))) ? null : `not in the first ${num("head_chars")} characters`;
    case "density_max": {
      const n = count(r.pattern!, flags, text);
      const d = words ? (n / words) * num("per_words") : 0;
      return words && n >= 3 && d > num("max") ? `${n} in ${words} words (${d.toFixed(1)} per ${num("per_words")}, limit ${num("max")})` : null;
    }
    case "ratio_min": {
      const a = count(String(r.numerator), flags, text), b = count(String(r.denominator), flags, text);
      return b >= num("min_denominator") && a / b < num("min") ? `${a} reasons for ${b} rules (${(a / b).toFixed(2)}, want at least ${num("min")})` : null;
    }
    case "both_present": {
      const a = count(String(r.a), flags, text), b = count(String(r.b), flags, text);
      return a >= num("min_each") && b >= num("min_each") ? `${a} XML section tags and ${b} Markdown headings` : null;
    }
    case "max_tokens":
    case "max_tokens_family": {
      const limit = t === "max_tokens" ? num("max") : (BUDGETS[family] ?? BUDGETS.generic);
      const n = Math.ceil(text.length / 4);
      return n > limit ? `about ${n} tokens, budget ${limit}` : null;
    }
    case "max_lines": {
      const lines = body.split(/\r?\n/);
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      return lines.length > num("max") ? `${lines.length} lines` : null;
    }
  }
  if (t.startsWith("frontmatter_")) {
    if (!meta) return t === "frontmatter_required" ? "no frontmatter block" : null;
    if (t === "frontmatter_required") {
      const miss = (r.fields as string[]).filter((f) => !meta[f]);
      return miss.length ? `missing: ${miss.join(", ")}` : null;
    }
    const v = meta[String(r.field)] ?? "";
    if (!v) return null;
    if (t === "frontmatter_pattern") return re(r.pattern!, flags).test(v) && v.length <= (r.max ? num("max") : 1e9) ? null : `${r.field}: ${v.slice(0, 60)}`;
    if (t === "frontmatter_max_len") return v.length > num("max") ? `${v.length} characters` : null;
    if (t === "frontmatter_min_len") return v.length < num("min") ? `${v.length} characters` : null;
    if (t === "frontmatter_regex_present") return re(r.pattern!, flags).test(v) ? null : `${r.field}: ${v.slice(0, 80)}`;
    if (t === "frontmatter_regex_absent") return re(r.pattern!, flags).test(v) ? `${r.field}: ${v.slice(0, 80)}` : null;
  }
  if (t.startsWith("tools_")) {
    const tl = tools(text);
    if (!tl) return t === "tools_object_schema" ? "not valid JSON" : null;
    if (t === "tools_min_description") { const s = tl.filter((x) => x.description.length < num("min")).map((x) => x.name); return s.length ? `short: ${s.join(", ")}` : null; }
    if (t === "tools_object_schema") {
      const bad = tl.filter((x) => !(x.schema && typeof x.schema === "object" && (x.schema as { type?: string }).type === "object")).map((x) => x.name);
      return bad.length ? `not an object: ${bad.join(", ")}` : null;
    }
    if (t === "tools_max_count") return tl.length > num("max") ? `${tl.length} tools` : null;
    if (t === "tools_name_pattern") {
      const p = re(r.pattern!, flags);
      const names = tl.map((x) => x.name);
      const bad = names.filter((n) => !p.test(n));
      const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))].sort();
      return bad.length || dup.length ? `bad: ${[...bad, ...dup].join(", ")}` : null;
    }
  }
  throw new Error(`unknown rule type ${t}`);
}

const ORDER = { error: 0, warn: 1, info: 2 } as const;

export function lintText(text: string, kind: Kind, family = "generic"): Finding[] {
  const out: Finding[] = [];
  for (const r of RULES.rules) {
    if (!r.kinds.includes(kind) || (r.families && !r.families.includes(family))) continue;
    const ev = check(r, text, family);
    if (ev !== null) out.push({ rule: r.id, severity: r.severity, evidence: ev, message: r.message, why: r.why, fix: r.fix });
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

/** Guess the kind of a pasted text, so the checker works without a choice. */
export function guessKind(text: string): Kind {
  const s = text.trimStart();
  if (s.startsWith("{") || s.startsWith("[")) return "tools";
  const fm = /^---\n([\s\S]*?)\n---/.exec(s)?.[1] ?? "";
  const head = s.slice(0, 1500);
  if (/^(when_to_use|whenToUse):/m.test(fm)) return "subagent";
  if (/^name:\s*memory/m.test(fm) || /^#\s*(MEMORY(\.md)?|Memory)\b/m.test(head)) return "memory";
  if (/^name:/m.test(fm) && /^description:/m.test(fm)) return "skill";
  const body = s.replace(/^---\n[\s\S]*?\n---\n?/, "").slice(0, 3000);
  if (/^#\s*AGENTS\.md|^#{1,3}\s+(commands?|build|tests?|testing|setup)\b/im.test(body)) return "agents";
  return "system";
}
