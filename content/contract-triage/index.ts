import { t, type LS } from "@/lib/types";
import { stagesA } from "./stage-0";
import { stage1 } from "./stage-1";
import { stage2 } from "./stage-2";
import { stage3 } from "./stage-3";
import { stage4 } from "./stage-4";
import { stage5, stage6 } from "./stage-5-6";
import type { FStep, Stage } from "./types";

export * from "./types";

export const stages: Stage[] = [...stagesA, stage1, stage2, stage3, stage4, stage5, stage6];
export const fsteps: FStep[] = stages.flatMap((s) => s.steps);
export const fstepById: Record<string, FStep> = Object.fromEntries(fsteps.map((s) => [s.id, s]));
export const fnumber: Record<string, number> = Object.fromEntries(fsteps.map((s, i) => [s.id, i + 1]));

/** Every action card in the blueprint document. The audit fails if one has no step. */
export const BLUEPRINT_CARDS = [
  "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "0.10",
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10",
  "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9",
  "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7",
  "4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8",
  "6.1", "6.2", "6.3", "6.4", "6.5", "6.6",
];

export const intro = {
  eyebrow: t("Follow-along · Contract Triage Blueprint v2", "跟做指南 · Contract Triage Blueprint v2"),
  title: t("Contract triage on public data, from a Mac to Databricks", "基于公共数据的合同分诊：从 Mac 到 Databricks"),
  lede: t(
    "Open \"Contract Triage Blueprint v2: Public Data on Databricks\" beside this page. Every action card in it (0.1 to 6.6) is a step here, in the same order, with four things spelled out: where you act, what you produce, why it sits at that point, and how, as blocks you copy and paste. Each step ends with a test and the output to expect.",
    "把《Contract Triage Blueprint v2: Public Data on Databricks》放在本页旁边。其中的每张行动卡（0.1 至 6.6）都是这里的一步，顺序相同，并写清四件事：在哪里操作、产出什么、为什么放在这个位置、以及怎么做（可直接复制粘贴的代码块）。每一步都以一个测试和预期输出结束。",
  ),
  honesty: t(
    "Steps marked \"replayed\" were run end to end by native/contract-triage/replay.py in a clean clone of GSA-TTS/mcp-hackathon-template at commit 6e5fb39: the rename, the laptop pipeline, the server, 60 tests, lint, every tool call, the answer key against the tools. Their recorded output is shown under the step. Steps marked \"run by you\" need your GitHub account, your API keys, the public internet or the Databricks workspace; their commands follow vendor pages read in October 2026 and were not executed here. Anything those pages did not show is in a \"Not confirmed\" box.",
    "标为 “已回放” 的步骤，已由 native/contract-triage/replay.py 在 GSA-TTS/mcp-hackathon-template 提交 6e5fb39 的干净克隆中完整运行过：改名、笔记本流水线、服务器、60 个测试、lint、每一次工具调用、答案键与工具的核对。它们的记录输出显示在步骤下方。标为 “需你运行” 的步骤需要你的 GitHub 账号、API 密钥、公共互联网或 Databricks 工作区；其命令依据 2026 年 10 月阅读的厂商文档编写，这里没有执行。那些文档没有说明的内容都放在 “未确认” 框中。",
  ),
  howToUse: t(
    "Each code block's label names its place: Mac Terminal (any folder), Mac Terminal in $REPO (the block starts with cd \"$REPO\"), a Databricks notebook, the SQL editor, the workspace UI, or GitHub. Every name you reuse ($REPO, $KIT, $PROFILE, $CATALOG, $APP_NAME) comes from ~/.contract-triage.env, which step S2 creates; in SQL blocks, replace <your_catalog> by hand. Tick a step when its test passes; your progress stays in this browser.",
    "每个代码块的标签都写明了操作位置：Mac 终端（任意目录）、在 $REPO 中的 Mac 终端（代码块以 cd \"$REPO\" 开头）、Databricks notebook、SQL 编辑器、工作区界面或 GitHub。所有反复使用的名字（$REPO、$KIT、$PROFILE、$CATALOG、$APP_NAME）都来自第 S2 步创建的 ~/.contract-triage.env；在 SQL 代码块中，请手动替换 <your_catalog>。测试通过后勾选该步；进度保存在本浏览器中。",
  ),
};

/** The two directions of the link, as a small flow. */
export const flow: { id: string; label: LS; detail: LS }[] = [
  { id: "mac", label: t("Mac", "Mac"), detail: t("Write and test code; laptop pipeline in DuckDB; deploy with the CLI.", "编写和测试代码；用 DuckDB 跑笔记本流水线；用 CLI 部署。") },
  { id: "github", label: t("GitHub", "GitHub"), detail: t("The source of truth. CI runs lint and 60 tests on every push, with no secrets.", "唯一可信来源。每次推送 CI 都运行 lint 和 60 个测试，不需要任何机密。") },
  { id: "gitfolder", label: t("Git folder", "Git 文件夹"), detail: t("The repo pulled into the workspace (repos update). Notebooks and jobs run from here.", "拉进工作区的仓库（repos update）。notebook 和 job 从这里运行。") },
  { id: "lakehouse", label: t("Unity Catalog", "Unity Catalog"), detail: t("Volume, bronze, silver, gold, dq_results, refreshed by the job.", "volume、bronze、silver、gold、dq_results，由 job 刷新。") },
  { id: "app", label: t("Databricks App", "Databricks App"), detail: t("mcp-server-contract-triage, deployed from the Mac by deploy-databricks-app.sh; reads gold as its own principal.", "mcp-server-contract-triage，由 Mac 上的 deploy-databricks-app.sh 部署；以自己的服务主体身份读取 gold。") },
  { id: "clients", label: t("Clients and eval", "客户端与评估"), detail: t("Playground, the exported agent, MLflow, Claude Code: all reach the same /mcp.", "Playground、导出的智能体、MLflow、Claude Code：都访问同一个 /mcp。") },
];

/** What the checks found that differs from the blueprint text. */
export const corrections: { title: LS; detail: LS }[] = [
  { title: t("Archive files are split, and named differently", "归档文件被拆分，且命名不同"), detail: t("A contracts archive zip holds FY2026_097_Contracts_Full_20260907_1.csv, _2.csv and so on (five parts for DoD FY2025), not *Contracts_PrimeTransactions*.csv. The loader reads every part.", "合同归档 zip 中是 FY2026_097_Contracts_Full_20260907_1.csv、_2.csv 等（DoD 2025 财年有五个分片），而不是 *Contracts_PrimeTransactions*.csv。加载程序会读取所有分片。") },
  { title: t("Base awards have no action type", "基础合同没有动作类型"), detail: t("11,456 of 12,000 sampled DoD rows had an empty action_type_code: the base award. The archive column is action_type, not action_type_description.", "抽样的 12,000 行 DoD 数据中有 11,456 行 action_type_code 为空：即基础合同。归档中的列名是 action_type，而不是 action_type_description。") },
  { title: t("Ended without a K action is mostly small purchases", "到期但没有 K 动作的，大多是小额采购"), detail: t("In the same sample, 11,149 of 11,976 awards ended with no K action, and only 89 had $250,000 or more obligated. The closeout tool takes min_obligation for that reason.", "在同一样本中，11,976 个合同里有 11,149 个到期时没有 K 动作，其中只有 89 个已承付 25 万美元及以上。因此结案工具提供 min_obligation 参数。") },
  { title: t("The rename check needs git grep", "改名检查要用 git grep"), detail: t("`grep -ri example_server .` also matches .venv, where uv wrote an editable-install file under the old name. `git grep` searches tracked files only.", "`grep -ri example_server .` 还会匹配 .venv，uv 在那里写了一个旧名字的可编辑安装文件。`git grep` 只搜索受跟踪的文件。") },
  { title: t("Line counts are not row counts", "行数不等于记录数"), detail: t("Descriptions contain line breaks inside quotes, so `wc -l` overcounts. The bronze check counts records with Python's csv module.", "描述字段的引号内含有换行，所以 `wc -l` 会多算。bronze 检查用 Python 的 csv 模块计算记录数。") },
  { title: t("Pull only closed records from SAM.gov", "只从 SAM.gov 拉取已结案记录"), detail: t("closedStatus is the only SAM.gov fact the logic needs. Asking for closed records alone fits a 1,000-a-day key; the 5 percent count check becomes a match rate.", "closedStatus 是逻辑唯一需要的 SAM.gov 事实。只请求已结案记录就能控制在每天 1,000 次的额度内；5% 的计数检查改为匹配率。") },
  { title: t("Resource keys must equal valueFrom", "资源键必须与 valueFrom 一致"), detail: t("app.yaml names sql_warehouse and sam_api_key; the resource keys typed in the app's settings must be those exact strings.", "app.yaml 中写的是 sql_warehouse 和 sam_api_key；在应用设置中输入的资源键必须是完全相同的字符串。") },
  { title: t("The weekly triage is its own job", "每周分诊是独立的 job"), detail: t("The refresh is monthly, so a task appended to it would run monthly. contract-triage-weekly has its own schedule and reads the same tables.", "刷新按月进行，追加到它上面的任务也只会按月运行。contract-triage-weekly 有自己的调度，读取同样的数据表。") },
];

export const risks: { risk: LS; fallback: LS; at: string }[] = [
  { risk: t("Workspace compute cannot reach public sites", "工作区计算无法访问公共网站"), fallback: t("Download on the laptop (fetch_usaspending.py); databricks fs cp to the volume; mode volume", "在笔记本上下载（fetch_usaspending.py）；用 databricks fs cp 上传到 volume；使用 mode volume"), at: "uc-egress" },
  { risk: t("No permission to create schema, volume or job", "无权创建 schema、volume 或 job"), fallback: t("Use GSA's catalog; else Parquet inside the app (DATA_BACKEND=snapshot)", "使用 GSA 的 catalog；否则把 Parquet 放在应用内（DATA_BACKEND=snapshot）"), at: "uc-egress" },
  { risk: t("No workspace admin for the eval principal", "评估服务主体缺少工作区管理员权限"), fallback: t("Phoenix harness on the laptop", "在笔记本上使用 Phoenix 评估框架"), at: "phoenix" },
  { risk: t("Template default eval model not in the workspace", "工作区中没有模板默认的评估模型"), fallback: t("Use the endpoint chosen in 3.4", "使用第 3.4 步选定的端点"), at: "playground" },
  { risk: t("SAM.gov key limited to 10 calls a day", "SAM.gov 密钥每天只能调用 10 次"), fallback: t("Request a federal role; else K closeout only", "申请联邦角色；否则只用 K 结案"), at: "keys" },
  { risk: t("USAspending and SAM.gov disagree on closeout", "USAspending 与 SAM.gov 的结案信息不一致"), fallback: t("Return both signals; report the rate as a finding", "同时返回两个信号；把一致率作为发现报告"), at: "pilots" },
  { risk: t("App cannot read Unity Catalog", "应用无法读取 Unity Catalog"), fallback: t("DATA_BACKEND=snapshot in app.yaml", "在 app.yaml 中设 DATA_BACKEND=snapshot"), at: "grants" },
  { risk: t("Deadline earlier than Nov. 30", "截止日期早于 11 月 30 日"), fallback: t("Start the deck in stage 4", "在第 4 阶段就开始做演示稿"), at: "gsa-questions" },
  { risk: t("Flags on named vendors read as accusations", "对具名供应商的标记被理解为指控"), fallback: t("\"Review candidate\" wording; evidence shown; aggregates in the demo", "使用 “review candidate” 措辞；展示证据；演示中使用汇总数据"), at: "scorers" },
  { risk: t("Clearance delayed", "许可迟迟未到"), fallback: t("Keep the repo private until cleared", "在获得许可前保持仓库私有"), at: "clearance" },
];

export const cutOrder: LS = t(
  "Cut order when a gate slips by more than a day: 5.4 Genie; 5.3 decision memory; 5.1 workflow; 2.4 live award brief; 1.3 SAM.gov (fall back to K closeout only). Never cut the hand checks, the eval, SECURITY.md, or the documents.",
  "某个关卡延误超过一天时的删减顺序：5.4 Genie；5.3 决策记忆；5.1 工作流；2.4 实时合同简报；1.3 SAM.gov（退回到只用 K 结案）。绝不删减手工核对、评估、SECURITY.md 和文档。",
);

export const sources = [
  { title: "GSA: MCP Server and AI Agent Government Hackathon", url: "https://www.gsa.gov/artificial-intelligence/ai-community-of-practice/events-and-training/mcp-server-and-ai-agent-government-hackathon" },
  { title: "GSA-TTS/mcp-hackathon-template (commit 6e5fb39, FastMCP 4.0.11 in uv.lock)", url: "https://github.com/GSA-TTS/mcp-hackathon-template" },
  { title: "Databricks: host custom MCP servers using Databricks Apps", url: "https://docs.databricks.com/aws/en/generative-ai/mcp/custom-mcp" },
  { title: "Databricks Apps: environment variables and valueFrom", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/environment-variables" },
  { title: "Databricks: Git folders", url: "https://docs.databricks.com/aws/en/repos/" },
  { title: "Databricks: MLflow 3 predefined judges", url: "https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/predefined-judge-scorers" },
  { title: "SAM.gov Contract Awards API", url: "https://open.gsa.gov/api/contract-awards/" },
  { title: "Data.gov Catalog API v4", url: "https://resources.data.gov/catalog-api/" },
  { title: "USAspending API: bulk_download/list_monthly_files", url: "https://api.usaspending.gov/docs/endpoints" },
];

export function stepProblems(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of fsteps) {
    if (seen.has(s.id)) out.push(`${s.id}: duplicate id`);
    for (const a of s.after) if (!seen.has(a)) out.push(`${s.id}: after ${a}, which is not an earlier step`);
    seen.add(s.id);
  }
  const bps = new Set(fsteps.map((s) => s.bp.replace(/[a-zL]$/, "")));
  for (const c of BLUEPRINT_CARDS) if (!bps.has(c)) out.push(`blueprint card ${c} has no step`);
  for (const r of risks) if (!fstepById[r.at]) out.push(`risk points at unknown step ${r.at}`);
  return out;
}
