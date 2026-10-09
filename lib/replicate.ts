import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import replicateReport from "@/content/replicate-check.json";
import nativeReport from "@/content/native-check.json";

const ROOT = process.cwd();
const LANG: Record<string, string> = { ".py": "python", ".sql": "sql", ".sh": "bash", ".yml": "yaml", ".yaml": "yaml", ".json": "json", ".txt": "text", ".md": "markdown" };

export interface CheckEntry { sha256: string; check: string; error?: string }
export interface CheckReport {
  checked_at: string;
  python: string;
  files: Record<string, CheckEntry>;
  tests: { run: number; failed: number; names: string[] };
  failures: number;
}

/** A script kit: a folder of files a page shows, and the check report that vouches for them. */
export interface Kit { root: string; report: CheckReport; checker: string }
export const KITS: Record<"replicate" | "native", Kit> = {
  replicate: { root: "replicate/databricks", report: replicateReport as CheckReport, checker: "python3 replicate/databricks/check.py --write" },
  native: { root: "native/databricks", report: nativeReport as CheckReport, checker: "python3 native/databricks/check.py --write" },
};
export const replicateCheck = KITS.replicate.report;

const kitOf = (rel: string): Kit => (rel.startsWith(KITS.native.root + "/") ? KITS.native : KITS.replicate);

/** A kit file, read at build time, with its recorded check. Throws if the file is missing. */
export function readScript(rel: string): { text: string; lang: string; check?: CheckEntry; stale: boolean; checker: string } {
  const raw = fs.readFileSync(path.join(ROOT, rel));
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  const kit = kitOf(rel);
  const entry = kit.report.files[rel];
  const ext = path.basename(rel) === ".gitlab-ci.yml" ? ".yml" : path.extname(rel);
  return { text: raw.toString("utf8").trimEnd(), lang: LANG[ext] ?? "text", check: entry, stale: !entry || entry.sha256 !== sha, checker: kit.checker };
}

/** Every file in a kit that its check skipped or recorded with a different hash. */
export function staleScripts(kit: Kit = KITS.replicate): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.name === "__pycache__" || e.name === "agent_app" || e.name === ".pytest_cache") continue;
      if (e.isDirectory()) walk(rel);
      else if (e.name !== "check.py" && readScript(rel).stale) out.push(rel);
    }
  };
  walk(kit.root);
  return out;
}

export function checkCounts(report: CheckReport = KITS.replicate.report) {
  const v = Object.values(report.files);
  const n = (p: string) => v.filter((e) => e.check === p).length;
  return {
    py: n("compiles"), yaml: n("yaml parses"), bash: n("bash -n passes"), json: n("json parses"),
    readOnly: n("read only"), sql: n("read only"),
    sqlParsed: v.filter((e) => e.check.startsWith("sqlglot")).length,
    failed: report.failures,
  };
}
