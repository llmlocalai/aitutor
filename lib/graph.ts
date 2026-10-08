import type { LS, Prereq } from "./types";

/** The part of a module the map needs. Kept small so client bundles do not carry lesson text. */
export interface Slim {
  id: string;
  n: number;
  layer: number;
  title: LS;
  short: LS;
  steps: number;
  prereqs: Prereq[];
}

export type Relation =
  | { kind: "same" }
  | { kind: "before"; first: string; second: string; steps: { id: string; why: LS }[] }
  | { kind: "independent"; shared: string[] };

export function makeGraph(mods: Slim[]) {
  const byId: Record<string, Slim> = Object.fromEntries(mods.map((m) => [m.id, m]));
  const dependents = (id: string) => mods.filter((m) => m.prereqs.some((p) => p.id === id));
  const ancestors = (id: string) => {
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
  };
  const chain = (from: string, to: string) => {
    const queue: { id: string; path: { id: string; why: LS }[] }[] = [{ id: to, path: [] }];
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
  };
  const relate = (a: string, b: string): Relation => {
    if (a === b) return { kind: "same" };
    const ab = chain(a, b);
    if (ab) return { kind: "before", first: a, second: b, steps: ab };
    const ba = chain(b, a);
    if (ba) return { kind: "before", first: b, second: a, steps: ba };
    const aa = ancestors(a);
    const bb = ancestors(b);
    return { kind: "independent", shared: [...aa].filter((x) => bb.has(x)) };
  };
  return { byId, dependents, ancestors, relate };
}
