import { byId, masterOrder, modules, platformIds, stepByKey, steps } from "./curriculum";
import { labOutput, labPython, readLab } from "./labs";
import { guides } from "./platforms";
import { machine, machineKeys } from "./machine";
import type { LS } from "./types";
import { ui } from "./ui";
import * as dbx from "@/content/databricks";
import { readScript, replicateCheck, staleScripts } from "./replicate";

/**
 * Self-audit. Runs at build time (the /audit page calls it), so a broken link,
 * a missing translation, a missing lab file, or a lesson that quotes a number
 * the labs did not print stops the build.
 */

const CJK = /[㐀-鿿]/;

/** Statements in lessons that quote lab results. Each must appear in the recorded output. */
const CLAIMS: [string, string][] = [
  ["m01.budget", "workhorse-35b  + vision-27b     =  51.3 GB  fits"],
  ["m02.demo", "(429, {'error': 'rate limit reached'})"],
  ["m03.demo", "not a real .pdf file"],
  ["m03.demo", "'unchanged': 3"],
  ["m04.demo", "600 rows, none lost"],
  ["m04.demo", "3 lines, then 1 new, then 0"],
  ["m05.demo", "[defines:approving official]"],
  ["m05.demo", "[cited-by:policy/travel-policy.md::5]"],
  ["m05.pg", "three writers at once : 600 rows, no lock errors"],
  ["m05.pg", "CTE read twice          : no index (table scan)"],
  ["m05.pg", "vector as a parameter   : index scan"],
  ["m02.route", "explicit model untouched: True"],
  ["m07.triage", "with triage: 1 model calls, 0 tool calls"],
  ["m07.stream", "rejected draft figure 312.40 reached the client: False"],
  ["m08.eval", "routing accuracy on 12 unseen requests: 0.667"],
  ["m09.tool", "schema properties: ['query']"],
  ["m09.tool", "refused, got an unexpected keyword argument 'partition'"],
  ["m10.tests", "11 tests, 0 failed"],
  ["m12.calibrate", "literal 0.72, semantic 0.72"],
  ["m12.calibrate", "true claims it would remove 2, false claims it would keep 3"],
  ["m15.logs", "naive cursor read 0 | fixed cursor read 3"],
  ["m15.nightly", "REGRESSED"],
  ["m06.demo", "month emptied this result"],
  ["m06.mcp", "1 row, total 219.0"],
  ["m07.demo", "[['planner'], ['tool', 'tool'], ['planner']]"],
  ["m07.demo", "model calls: 2"],
  ["m08.demo", "hi there                                       -> no skill"],
  ["m09.demo", "3 in dana prompt: True | in eli prompt: False"],
  ["m10.demo", "retried=True fallback=False"],
  ["m10.demo", "retried=True fallback=True"],
  ["m10.demo", "would_block = True"],
  ["m11.demo", "full          15  0.667  1.000  1.000"],
  ["m11.demo", "dense-only    15  0.600  0.733  0.800"],
  ["m11.demo", "no-authority  15  0.600"],
  ["m11.demo", "no-graph      15  0.667  1.000  1.000"],
  ["m11.demo", "deterministic model: 5 of 6"],
  ["m11.demo", "spread (2, 5)"],
  ["m11.demo", "run 1 alone says 5 of 6 and run 5 alone says 2 of 6"],
  ["m11.demo", "SEAL BROKEN"],
  ["m12.demo", "orchestrated 4 model calls, largest context 1477 chars | single agent 2 model calls, context 1961 chars"],
  ["m12.demo", "keep (one dissent, flag for review)"],
  ["m13.demo", "'before': 5, 'after': 6"],
  ["m13.demo", "sealed eval after: 6 of 6"],
  ["m13.demo", "358.60"],
  ["m13.demo", "tools used: ['query_expenses', 'query_expenses']"],
  ["m14.demo", "['human', 'ai', 'tool', 'ai']"],
  ["m14.demo", "['ToolCallItem', 'ToolCallOutputItem', 'MessageOutputItem']"],
  ["m15.demo", "'integrity': True"],
];

export interface AuditReport {
  errors: string[];
  warnings: string[];
  stats: Record<string, number | string>;
  notExecuted: { key: string; title: LS }[];
  forward: { from: string; to: string }[];
}

export function audit(): AuditReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let strings = 0;

  const ls = (v: LS | undefined, where: string) => {
    strings++;
    if (!v || !v.en?.trim() || !v.zh?.trim()) return errors.push(`missing text: ${where}`);
    const norm = (x: string) => x.replace(/[^A-Za-z0-9]+/g, "");
    // Text that is only code or identifiers reads the same in both languages.
    if (!CJK.test(v.zh) && norm(v.zh) !== norm(v.en)) errors.push(`zh has no Chinese: ${where} -> "${v.zh.slice(0, 40)}"`);
    if (/—/.test(v.en)) warnings.push(`em-dash in en: ${where}`);
  };

  for (const [k, v] of Object.entries(ui)) {
    strings++;
    if (k !== "loopsToEnd" && (!v.en.trim() || !v.zh.trim())) errors.push(`missing ui text: ${k}`);
  }

  for (const m of modules) {
    const w = `module ${m.id}`;
    ls(m.title, `${w}.title`); ls(m.short, `${w}.short`); ls(m.what, `${w}.what`); ls(m.why, `${w}.why`);
    m.how.forEach((h, i) => ls(h, `${w}.how[${i}]`));
    for (const p of m.prereqs) {
      if (!byId[p.id]) errors.push(`${w}: unknown prerequisite ${p.id}`);
      else if (byId[p.id].layer >= m.layer) errors.push(`${w}: layer ${m.layer} is not after prerequisite ${p.id} (layer ${byId[p.id].layer})`);
      ls(p.why, `${w}.prereq.${p.id}.why`); ls(p.stub, `${w}.prereq.${p.id}.stub`);
    }
    m.inBuild.forEach((f) => ls(f.role, `${w}.inBuild.${f.path}`));
    if (m.flow) {
      ls(m.flow.caption, `${w}.flow.caption`);
      m.flow.stages.forEach((s, i) => { ls(s.label, `${w}.flow[${i}].label`); ls(s.detail, `${w}.flow[${i}].detail`); });
      if (m.flow.loop) ls(m.flow.loop.label, `${w}.flow.loop`);
    } else warnings.push(`${w}: no process map`);
    for (const x of m.together) { if (!byId[x.with]) errors.push(`${w}: together -> unknown ${x.with}`); ls(x.how, `${w}.together.${x.with}`); }
    if (m.failures.length < 2) errors.push(`${w}: fewer than 2 failure stories`);
    m.failures.forEach((f, i) => { ls(f.title, `${w}.fail[${i}].title`); ls(f.what, `${w}.fail[${i}].what`); ls(f.fix, `${w}.fail[${i}].fix`); ls(f.lesson, `${w}.fail[${i}].lesson`); });
    for (const p of platformIds) ls(m.portability[p], `${w}.portability.${p}`);
    if (m.checks.length < 4) errors.push(`${w}: fewer than 4 explain-it-back questions`);
    m.checks.forEach((c, i) => { ls(c.q, `${w}.check[${i}].q`); ls(c.a, `${w}.check[${i}].a`); });
    (m.terms ?? []).forEach((x, i) => { ls(x.term, `${w}.term[${i}]`); ls(x.def, `${w}.term[${i}].def`); });

    if (m.steps.length < 6) errors.push(`${w}: fewer than 6 steps`);
    const ids = new Set<string>();
    let executed = 0;
    for (const s of m.steps) {
      const sw = `${m.id}.${s.id}`;
      if (ids.has(s.id)) errors.push(`duplicate step id ${sw}`);
      ids.add(s.id);
      ls(s.title, `${sw}.title`); ls(s.why, `${sw}.why`); ls(s.verify, `${sw}.verify`); ls(s.produces, `${sw}.produces`);
      if (s.do.length < 2) errors.push(`${sw}: fewer than 2 actions`);
      s.do.forEach((d, i) => ls(d, `${sw}.do[${i}]`));
      if (s.codeNote) ls(s.codeNote, `${sw}.codeNote`);
      for (const n of s.needs ?? []) {
        ls(n.what, `${sw}.needs.${n.step}`);
        if (!stepByKey[n.step]) errors.push(`${sw}: needs unknown step ${n.step}`);
        if (n.step === sw) errors.push(`${sw}: needs itself`);
      }
      try { if (s.lab) readLab(s.lab); } catch (e) { errors.push(`${sw}: ${(e as Error).message}`); }
      try { if (s.output) labOutput(s.output, s.pick); } catch (e) { errors.push(`${sw}: ${(e as Error).message}`); }
      if (s.notExecuted && s.output) errors.push(`${sw}: marked not executed but shows recorded output`);
      if ((s.lab || s.output) && !s.notExecuted) executed++;
    }
    if (executed < 3) errors.push(`${w}: fewer than 3 steps backed by executed lab code`);
    if (m.steps.every((s) => !s.output)) errors.push(`${w}: no step shows recorded output`);
  }

  // step graph
  let order = 0;
  try { order = masterOrder().length; } catch (e) { errors.push((e as Error).message); }
  const forward: { from: string; to: string }[] = [];
  for (const s of steps) {
    for (const n of s.step.needs ?? []) {
      const t = stepByKey[n.step];
      if (t && t.module.n > s.module.n) forward.push({ from: s.key, to: n.step });
    }
  }
  const orphans = steps.filter((s) => !(s.step.needs?.length) && !steps.some((o) => o.step.needs?.some((n) => n.step === s.key)));
  for (const o of orphans) warnings.push(`step ${o.key} is linked to no other step`);

  // machine checks: every unexecuted step is either checkable on a machine or named as manual
  const mk = machineKeys();
  for (const k of [...mk.checks, ...mk.manual]) {
    if (!stepByKey[k]) errors.push(`machine check names unknown step ${k}`);
    else if (!stepByKey[k].step.notExecuted) warnings.push(`machine check for ${k}, which the labs already execute`);
  }
  for (const s of steps.filter((x) => x.step.notExecuted)) {
    if (!mk.checks.includes(s.key) && !mk.manual.includes(s.key)) errors.push(`${s.key}: not executed and not covered by labs/machine/check.py`);
  }

  // quoted lab results
  for (const [key, text] of CLAIMS) {
    try { if (!labOutput(key).includes(text)) errors.push(`lesson claim not in recorded output ${key}: "${text}"`); }
    catch (e) { errors.push((e as Error).message); }
  }

  // platform guides
  for (const g of guides) {
    const w = `platform ${g.id}`;
    ls(g.kind, `${w}.kind`); ls(g.summary, `${w}.summary`); ls(g.owns.you, `${w}.owns.you`); ls(g.owns.platform, `${w}.owns.platform`);
    if (g.id !== "other" && g.sources.length === 0) errors.push(`${w}: no vendor sources listed`);
    g.steps.forEach((s, i) => {
      if (!byId[s.module]) errors.push(`${w} step ${i + 1}: unknown module ${s.module}`);
      ls(s.title, `${w}[${i}].title`); ls(s.verify, `${w}[${i}].verify`);
      s.do.forEach((d, j) => ls(d, `${w}[${i}].do[${j}]`));
    });
  }

  // Databricks replication page
  {
    const w = "databricks";
    ls(dbx.intro.title, `${w}.title`); ls(dbx.intro.lede, `${w}.lede`); ls(dbx.intro.honesty, `${w}.honesty`); ls(dbx.intro.scriptsHow, `${w}.scriptsHow`);
    for (const id of new Set(dbx.unknownRefs)) errors.push(`${w}: text refers to unknown step [[${id}]]`);
    for (const p of dbx.orderProblems()) errors.push(`${w}: ${p}`);
    const ids = new Set<string>();
    for (const p of dbx.phases) {
      ls(p.title, `${w}.${p.id}.title`); ls(p.goal, `${w}.${p.id}.goal`);
      for (const s of p.steps) {
        const sw = `${w}.${s.id}`;
        if (ids.has(s.id)) errors.push(`${sw}: duplicate step id`);
        ids.add(s.id);
        ls(s.title, `${sw}.title`); ls(s.local, `${sw}.local`); ls(s.why, `${sw}.why`); ls(s.what, `${sw}.what`); ls(s.done, `${sw}.done`);
        if (s.unconfirmed) ls(s.unconfirmed, `${sw}.unconfirmed`);
        if (s.how.length < 2) errors.push(`${sw}: fewer than 2 actions`);
        if (s.interpret.length < 2) errors.push(`${sw}: fewer than 2 notes on reading the result`);
        if (s.trouble.length < 1) errors.push(`${sw}: no troubleshooting`);
        else if (s.trouble.length < 2) warnings.push(`${sw}: only one troubleshooting entry`);
        if (!s.files?.length && !s.code?.length) warnings.push(`${sw}: no script`);
        s.how.forEach((x, i) => ls(x, `${sw}.how[${i}]`));
        s.interpret.forEach((x, i) => ls(x, `${sw}.interpret[${i}]`));
        s.trouble.forEach((x, i) => { ls(x.s, `${sw}.trouble[${i}].s`); ls(x.c, `${sw}.trouble[${i}].c`); ls(x.f, `${sw}.trouble[${i}].f`); });
        if (s.links.length === 0) errors.push(`${sw}: linked to no lesson step`);
        for (const k of s.links) if (!stepByKey[k]) errors.push(`${sw}: links unknown lesson step ${k}`);
        for (const f of s.files ?? []) {
          try {
            const sc = readScript(f);
            if (!sc.check) errors.push(`${sw}: ${f} has no recorded check. Run: python3 replicate/databricks/check.py --write`);
            else if (sc.stale) errors.push(`${sw}: ${f} changed after its check. Run: python3 replicate/databricks/check.py --write`);
            else if (sc.check.check.startsWith("FAILED")) errors.push(`${sw}: ${f} ${sc.check.check}`);
            const head = sc.text.split("\n").slice(0, 3).join(" ").match(/\bSteps? ((?:\d+(?:, | and | or )?)+)/);
            if (head) {
              const nums = head[1].match(/\d+/g)!.map(Number);
              if (!nums.includes(dbx.numberOf[s.id])) errors.push(`${sw}: ${f} says "Step ${head[1].trim()}" but is shown on step ${dbx.numberOf[s.id]}`);
            }
          } catch (e) { errors.push(`${sw}: ${(e as Error).message}`); }
        }
      }
    }
    for (const r of dbx.componentMap) {
      ls(r.local, `${w}.map.local`); ls(r.dbx, `${w}.map.dbx`); ls(r.change, `${w}.map.change`);
      if (!dbx.rstepById[r.step]) errors.push(`${w}.map: unknown step ${r.step}`);
    }
    dbx.runbooks.forEach((r, i) => { ls(r.title, `${w}.runbook[${i}]`); ls(r.when, `${w}.runbook[${i}].when`); r.items.forEach((x, j) => ls(x, `${w}.runbook[${i}][${j}]`)); });
    dbx.incidents.forEach((x, i) => { ls(x.s, `${w}.incident[${i}].s`); ls(x.check, `${w}.incident[${i}].check`); ls(x.f, `${w}.incident[${i}].f`); });
    dbx.costLevers.forEach((x, i) => ls(x, `${w}.cost[${i}]`));
    dbx.gaps.forEach((x, i) => ls(x, `${w}.gap[${i}]`));
    if (dbx.sources.length === 0) errors.push(`${w}: no vendor sources`);
    for (const f of staleScripts()) errors.push(`${w}: ${f} changed after its check (or was never checked). Run: python3 replicate/databricks/check.py --write`);
    if (replicateCheck.failures) errors.push(`${w}: replicate/databricks/check.py recorded ${replicateCheck.failures} failures`);
  }

  const links = steps.reduce((n, s) => n + (s.step.needs?.length ?? 0), 0);
  return {
    errors, warnings, forward,
    notExecuted: steps.filter((s) => s.step.notExecuted).map((s) => ({ key: s.key, title: s.step.title })),
    stats: {
      modules: modules.length, steps: steps.length, "steps in master order": order,
      "steps backed by lab code that ran": steps.filter((s) => (s.step.lab || s.step.output) && !s.step.notExecuted).length,
      "decision steps with no code": steps.filter((s) => !s.step.lab && !s.step.output && !s.step.code && !s.step.notExecuted).length,
      "steps with code that was run by hand, not by the lab suite": steps.filter((s) => !s.step.lab && !s.step.output && s.step.code && !s.step.notExecuted).length,
      "steps not executed": steps.filter((s) => s.step.notExecuted).length,
      "steps showing recorded output": steps.filter((s) => s.step.output).length,
      "step-to-step links": links, "bilingual strings checked": strings,
      "quoted results verified": CLAIMS.length, "platform guides": guides.length,
      "platform guide steps": guides.reduce((n, g) => n + g.steps.length, 0),
      "lab python": labPython,
      "unexecuted steps a machine check covers": mk.checks.length,
      "unexecuted steps checked by hand": mk.manual.length,
      "Databricks replication steps": dbx.rsteps.length,
      "Databricks scripts checked": Object.keys(replicateCheck.files).length,
      "Databricks portable tests passed": `${replicateCheck.tests.run - replicateCheck.tests.failed}/${replicateCheck.tests.run}`,
      "machine checks passed on the reference machine": Object.values(machine.results).filter((r) => r.status === "pass").length,
    },
  };
}
