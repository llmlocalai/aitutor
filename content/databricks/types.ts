import type { CodeBlock, LS } from "@/lib/types";

/** One row of the component map: a part of the local build and where it goes on Databricks. */
export interface MapRow {
  local: LS;
  dbx: LS;
  /** What changes in the move: what you gain, what you lose, what you must now do yourself. */
  change: LS;
  step: string;
}

export interface Trouble {
  /** What you see. */
  s: LS;
  /** Why it happens. */
  c: LS;
  /** What to do. */
  f: LS;
}

export interface RStep {
  id: string;
  title: LS;
  /** The part of the local build this step replaces. */
  local: LS;
  /** Lesson steps ("module.step") that teach the idea this step carries over. */
  links: string[];
  /** Replication steps that must be done first. */
  after: string[];
  /** Steps of which any one must be done first (alternatives, such as the two retrieval backends). */
  afterAny?: string[];
  why: LS;
  what: LS;
  how: LS[];
  /** Script files under replicate/databricks/, shown in full and syntax-checked at build. */
  files?: string[];
  /** Short commands or snippets that are not files of their own. */
  code?: CodeBlock[];
  interpret: LS[];
  trouble: Trouble[];
  done: LS;
  /** What on this step could not be confirmed on a vendor page. Absent means every call was seen on one. */
  unconfirmed?: LS;
}

export interface Phase {
  id: string;
  title: LS;
  goal: LS;
  steps: RStep[];
}

export interface Runbook {
  title: LS;
  when: LS;
  items: LS[];
}

export interface Incident {
  s: LS;
  check: LS;
  f: LS;
}
