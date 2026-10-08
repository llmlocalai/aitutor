import { guides } from "@/content/platforms";
import type { PlatformGuide, PlatformId } from "./types";

export { guides };
export const guideById = Object.fromEntries(guides.map((g) => [g.id, g])) as Record<PlatformId, PlatformGuide>;
