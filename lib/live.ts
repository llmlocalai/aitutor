import type { LiveManifest } from "./types";
import raw from "@/content/live/manifest.json";

export const live = raw as LiveManifest;

export function liveFor(moduleId: string) {
  return {
    commits: live.commits.filter((c) => c.modules.includes(moduleId)).slice(0, 8),
    docs: live.docs.filter((d) => d.modules.includes(moduleId)).slice(0, 6),
    files: live.files.filter((f) => f.modules.includes(moduleId)).slice(0, 8),
  };
}
