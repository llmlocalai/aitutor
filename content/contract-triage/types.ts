import { t, type LS } from "@/lib/types";

/**
 * The contract triage follow-along guide. Every step says WHERE you act, WHAT you produce,
 * WHY it sits here, HOW (copy-paste blocks, each tagged with its place), and a TEST with
 * the output to expect. Steps marked "replayed" were run by native/contract-triage/replay.py
 * in a clean clone of the GSA template; their recorded output comes from that run.
 */

export type Where =
  | "mac" | "repo" | "aitutor" | "browser" | "github" | "email" | "meeting"
  | "dbx-ui" | "dbx-nb" | "dbx-sql" | "playground" | "claude";

export const WHERE: Record<Where, { label: LS; hint: LS }> = {
  mac: { label: t("Mac Terminal", "Mac 终端"), hint: t("Any folder. Open Terminal (or iTerm).", "任意目录。打开“终端”（或 iTerm）。") },
  repo: { label: t("Mac Terminal · $REPO", "Mac 终端 · $REPO"), hint: t("Your repo folder. The block starts with cd \"$REPO\".", "你的仓库目录。代码块以 cd \"$REPO\" 开头。") },
  aitutor: { label: t("Mac Terminal · $AITUTOR", "Mac 终端 · $AITUTOR"), hint: t("This guide's repository, where the kit lives.", "本指南所在的仓库，工具包就在这里。") },
  browser: { label: t("Browser", "浏览器"), hint: t("A web page outside Databricks and GitHub.", "Databricks 和 GitHub 之外的网页。") },
  github: { label: t("GitHub · browser", "GitHub · 浏览器"), hint: t("github.com, signed in.", "已登录的 github.com。") },
  email: { label: t("Email", "邮件"), hint: t("Your own mail client.", "你自己的邮件客户端。") },
  meeting: { label: t("Meeting", "会议"), hint: t("Office hours or an event; bring the listed questions.", "答疑时间或活动；带上列出的问题。") },
  "dbx-ui": { label: t("Databricks · workspace", "Databricks · 工作区"), hint: t("https://dbc-aae0ba16-8727.cloud.databricks.com, signed in.", "已登录的 https://dbc-aae0ba16-8727.cloud.databricks.com。") },
  "dbx-nb": { label: t("Databricks · notebook", "Databricks · notebook"), hint: t("A notebook in your Git folder, on Serverless compute.", "Git 文件夹中的 notebook，使用 Serverless 计算。") },
  "dbx-sql": { label: t("Databricks · SQL editor", "Databricks · SQL 编辑器"), hint: t("SQL Editor, with your SQL warehouse selected.", "SQL Editor，选中你的 SQL warehouse。") },
  playground: { label: t("Databricks · AI Playground", "Databricks · AI Playground"), hint: t("Playground in the left bar.", "左侧栏中的 Playground。") },
  claude: { label: t("Claude Code", "Claude Code"), hint: t("A Claude Code session in $REPO.", "在 $REPO 中的 Claude Code 会话。") },
};

export interface Cmd {
  w: Where;
  code: string;
  /** Short label for the code bar, such as a file name. */
  label?: string;
}

export interface Act {
  t: LS;
  c?: Cmd[];
}

export interface Test {
  w: Where;
  code?: string;
  expect: LS;
}

export interface Trouble { s: LS; c: LS; f: LS }

export interface FStep {
  id: string;
  /** Blueprint card number, such as "0.3"; setup steps use "S1"..; gates use "G0".. */
  bp: string;
  title: LS;
  what: LS;
  why: LS;
  how: Act[];
  /** Kit files (under native/contract-triage/) shown in full, with their recorded check. */
  files?: string[];
  test: Test[];
  /** Keys of content/triage-replay.json steps whose recorded output this step shows. */
  replay?: string[];
  trouble: Trouble[];
  done: LS;
  after: string[];
  /** replayed: the local commands ran in a clean clone; you: needs your account, keys or workspace. */
  ran: "replayed" | "you";
  unconfirmed?: LS;
  hours?: number;
}

export interface GateRow { check: LS; pass: LS; fail: LS; cmd?: string }

export interface Stage {
  id: string;
  n: string;
  title: LS;
  dates: LS;
  goal: LS;
  steps: FStep[];
  gate?: { id: string; title: LS; rows: GateRow[] };
}
