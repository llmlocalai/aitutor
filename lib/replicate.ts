import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import check from "@/content/replicate-check.json";

const ROOT = process.cwd();
const LANG: Record<string, string> = { ".py": "python", ".sql": "sql", ".sh": "bash", ".yml": "yaml", ".yaml": "yaml" };

export interface CheckEntry { sha256: string; check: string; error?: string }
export interface CheckReport {
  checked_at: string;
  python: string;
  files: Record<string, CheckEntry>;
  tests: { run: number; failed: number; names: string[] };
  failures: number;
}
export const replicateCheck = check as CheckReport;

/** A replication script, read at build time, with its recorded check. Throws if the file is missing. */
export function readScript(rel: string): { text: string; lang: string; check?: CheckEntry; stale: boolean } {
  const raw = fs.readFileSync(path.join(ROOT, rel));
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  const entry = replicateCheck.files[rel];
  return { text: raw.toString("utf8").trimEnd(), lang: LANG[path.extname(rel)] ?? "text", check: entry, stale: !entry || entry.sha256 !== sha };
}

/** Every file under replicate/databricks that the check skipped or recorded with a different hash. */
export function staleScripts(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.name === "__pycache__" || e.name === "agent_app") continue;
      if (e.isDirectory()) walk(rel);
      else if (e.name !== "check.py" && readScript(rel).stale) out.push(rel);
    }
  };
  walk("replicate/databricks");
  return out;
}

export function checkCounts() {
  const v = Object.values(replicateCheck.files);
  const n = (p: string) => v.filter((e) => e.check === p).length;
  return { py: n("compiles"), yaml: n("yaml parses"), bash: n("bash -n passes"), sql: n("read only"), failed: replicateCheck.failures };
}
