import fs from "node:fs";
import path from "node:path";
import type { Lab } from "./types";
import outputs from "@/content/lab-output.json";

const ROOT = process.cwd();
const EXT_LANG: Record<string, string> = {
  ".py": "python", ".md": "markdown", ".json": "json", ".sh": "bash", ".sql": "sql",
  ".plist": "xml", ".service": "ini", ".timer": "ini", ".csv": "csv",
};

/** Read lab source from disk. Throws at build time if the file or region is missing. */
export function readLab(lab: Lab): { text: string; lang: string } {
  const full = path.join(ROOT, lab.file);
  const raw = fs.readFileSync(full, "utf8");
  const lang = EXT_LANG[path.extname(lab.file)] ?? "text";
  if (!lab.region) {
    return { text: raw.split("\n").filter((l) => !/^\s*# (region: .*|endregion)\s*$/.test(l)).join("\n").trimEnd(), lang };
  }
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => l.trim() === `# region: ${lab.region}`);
  if (start < 0) throw new Error(`region "${lab.region}" not found in ${lab.file}`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === "# endregion");
  if (end < 0) throw new Error(`region "${lab.region}" in ${lab.file} has no # endregion`);
  const body = lines.slice(start + 1, end);
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return { text: body.map((l) => l.slice(indent)).join("\n").trimEnd(), lang };
}

const OUT = (outputs as { outputs: Record<string, string> }).outputs;
export const labPython = (outputs as { python: string }).python;

/** Recorded stdout of a lab run, optionally narrowed to lines with the given prefixes. */
export function labOutput(key: string, pick?: string[]): string {
  const text = OUT[key];
  if (text === undefined) throw new Error(`no recorded lab output for "${key}". Run: python3 -m labs.run_all`);
  if (!pick?.length) return text;
  const lines = text.split("\n");
  const keep: string[] = [];
  let on = false;
  for (const l of lines) {
    if (pick.some((p) => l.startsWith(p))) {
      on = true;
      keep.push(l);
    } else if (on && /^\s/.test(l)) {
      keep.push(l);
    } else {
      on = false;
    }
  }
  if (!keep.length) throw new Error(`pick ${JSON.stringify(pick)} matched nothing in lab output "${key}"`);
  return keep.join("\n");
}
