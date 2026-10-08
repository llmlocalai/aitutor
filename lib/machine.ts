import fs from "node:fs";
import path from "node:path";
import raw from "@/content/machine-output.json";

export interface MachineResult { status: "pass" | "fail" | "skip" | "manual"; detail: string }
export const machine = raw as { checkedAt: string | null; results: Record<string, MachineResult> };

/** Step keys that labs/machine/check.py knows how to check, read from the script itself. */
export function machineKeys(): { checks: string[]; manual: string[] } {
  const src = fs.readFileSync(path.join(process.cwd(), "labs/machine/check.py"), "utf8");
  const block = (name: string) => {
    const m = src.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\}`));
    return m ? [...m[1].matchAll(/"([a-z-]+\.[a-z0-9-]+)":/g)].map((x) => x[1]) : [];
  };
  return { checks: block("CHECKS"), manual: block("MANUAL_STEPS") };
}
