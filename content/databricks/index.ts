import { t, type LS } from "@/lib/types";
import { phasesA } from "./phases-a";
import { phasesB } from "./phases-b";
import type { Incident, MapRow, Phase, RStep, Runbook } from "./types";

/**
 * Replicating the local build on Databricks.
 *
 * Nothing on Databricks was executed for this page: there was no workspace. The API names come from
 * vendor pages read in October 2026 (listed in `sources`), and each step that relies on a detail not
 * seen on one of those pages says so in `unconfirmed`. The portable parts (ranking, chunking, edges,
 * guard, harness rules, scorers, the learner's proof rule) were run here by replicate/databricks/check.py.
 *
 * Text may refer to another step as [[step-id]]; it is replaced by that step's number below, and the
 * audit fails on an unknown id.
 */

const raw: Phase[] = [...phasesA, ...phasesB];

export const order: string[] = raw.flatMap((p) => p.steps.map((s) => s.id));
export const numberOf: Record<string, number> = Object.fromEntries(order.map((id, i) => [id, i + 1]));
export const unknownRefs: string[] = [];

const fill = (v: LS): LS => {
  const sub = (s: string) => s.replace(/\[\[([a-z-]+)\]\]/g, (_m, id: string) => {
    if (!numberOf[id]) { unknownRefs.push(id); return id; }
    return String(numberOf[id]);
  });
  return { en: sub(v.en), zh: sub(v.zh) };
};
const fillStep = (s: RStep): RStep => ({
  ...s,
  title: fill(s.title), local: fill(s.local), why: fill(s.why), what: fill(s.what), done: fill(s.done),
  how: s.how.map(fill), interpret: s.interpret.map(fill),
  trouble: s.trouble.map((x) => ({ s: fill(x.s), c: fill(x.c), f: fill(x.f) })),
  unconfirmed: s.unconfirmed ? fill(s.unconfirmed) : undefined,
});
export const phases: Phase[] = raw.map((p) => ({ ...p, title: fill(p.title), goal: fill(p.goal), steps: p.steps.map(fillStep) }));
export const rsteps: RStep[] = phases.flatMap((p) => p.steps);
export const rstepById: Record<string, RStep> = Object.fromEntries(rsteps.map((s) => [s.id, s]));
export const phaseOf: Record<string, string> = Object.fromEntries(phases.flatMap((p) => p.steps.map((s) => [s.id, p.id])));

export const intro = {
  title: t("Replicate the local build on Databricks", "在 Databricks 上复刻本地构建"),
  lede: t(
    "A step-by-step port of the whole local stack (models, gateway, knowledge bank, hybrid retrieval and graph, tools and MCP, skills, memory, the harness and its guard, evaluation, the learning loop and operations) to a Databricks workspace. Every step says why it sits where it does, what it does, how to run it, how to read the result, and what to do when it breaks.",
    "把整套本地技术栈（模型、网关、知识库、混合检索与图、工具与 MCP、技能、记忆、Harness 及其护栏、评估、学习循环与运维）一步一步移植到 Databricks 工作区。每一步都说明它为什么在这个位置、做什么、怎么运行、如何解读结果，以及出问题时怎么办。",
  ),
  honesty: t(
    "Nothing on Databricks was run for this page: there was no workspace. API names and commands come from the vendor pages listed at the bottom, read in October 2026. Where a step depends on a detail those pages did not show, it says so in a 'Not confirmed' box. The portable logic (ranking, chunking, graph edges, the answer guard, the harness rules, the scorers and the learner's proof rule) was executed here: see the check results below.",
    "本页涉及的 Databricks 操作一项都没有实际运行过：这里没有工作区。API 名称和命令来自页面底部列出的厂商文档，阅读时间为 2026 年 10 月。凡是某一步依赖了这些页面没有展示的细节，都会在“未确认”框中注明。可移植的逻辑（排序、切块、图的边、答案护栏、Harness 规则、scorer 以及学习器的证明规则）已在这里执行过：见下方的检查结果。",
  ),
  scriptsHow: t(
    "All scripts live in replicate/databricks/ in this repository. Clone it, keep that folder's layout (the bundle syncs it as one unit), and run the steps in the order below, or in any order the dependency map allows.",
    "所有脚本都在本仓库的 replicate/databricks/ 目录中。克隆仓库，保持该目录的结构（bundle 会把它作为一个整体同步），然后按下面的顺序运行各步骤，或按依赖图允许的任意顺序运行。",
  ),
};

export const componentMap: MapRow[] = [
  { local: t("Ollama on the Mac, lineup in model_catalog.json", "Mac 上的 Ollama，阵容写在 model_catalog.json"), dbx: t("Foundation Model APIs (pay-per-token or provisioned throughput)", "Foundation Model API（按 token 计费或预置吞吐量）"), change: t("No memory budget to manage; availability and latency per region become the constraint. Your data leaves the machine.", "不用再管内存预算；各区域的可用性和延迟成为新的约束。你的数据会离开本机。"), step: "lineup" },
  { local: t("agent-server gateway: keys, rate limits, quotas", "agent-server 网关：密钥、限流、配额"), dbx: t("Unity Gateway: permissions, rate limits, usage tracking, inference tables", "Unity Gateway：权限、限流、用量追踪、推理表"), change: t("You stop writing auth code. Task-based routing still lives in your code.", "你不用再写认证代码。按任务的路由仍然写在你的代码里。"), step: "gateway" },
  { local: t("model_router.py and the local-then-cloud fallback chain", "model_router.py 以及先本地后云端的兜底链路"), dbx: t("router.py with the same before-first-token rule; gateway fallbacks for availability", "沿用“只在首 token 前兜底”规则的 router.py；可用性交给网关兜底"), change: t("Same rule, fewer local failure modes (no model loading, no keep-alive).", "规则相同，本地特有的失败情形更少（没有模型加载，没有 keep-alive）。"), step: "gateway" },
  { local: t(".env files, chmod 600", "chmod 600 的 .env 文件"), dbx: t("Secret scopes and service principals", "Secret scope 与服务主体"), change: t("Reading a secret becomes a permission you can audit.", "读取密钥变成了一项可以审计的权限。"), step: "secrets" },
  { local: t("knowledge-bank/ folders and source_authority.json", "knowledge-bank/ 目录与 source_authority.json"), dbx: t("A Unity Catalog volume with the same tree", "目录结构相同的 Unity Catalog volume"), change: t("Tier rules unchanged; access is now a grant on the volume.", "等级规则不变；访问权限变成了 volume 上的授权。"), step: "upload" },
  { local: t("The ledger, intake cursor, kb_extract.py", "台账、收件游标、kb_extract.py"), dbx: t("Delta tables with MERGE, an hourly Lakeflow job", "使用 MERGE 的 Delta 表，每小时运行的 Lakeflow job"), change: t("Idempotence by hash and MERGE instead of a file cursor; history via time travel.", "幂等性靠哈希和 MERGE 实现，而不是文件游标；历史靠 time travel。"), step: "ingest" },
  { local: t("Graph edges (defines, cites, section) in Postgres", "Postgres 中的图边（defines、cites、section）"), dbx: t("A three-column Delta table rebuilt from chunks", "从文本块重建的三列 Delta 表"), change: t("No graph database, as before.", "和以前一样，不需要图数据库。"), step: "edges" },
  { local: t("Postgres + pgvector HNSW + full-text, hybrid SQL", "Postgres + pgvector HNSW + 全文检索，混合检索 SQL"), dbx: t("Lakebase + Lakebase Search (ANN, BM25), or AI Search", "Lakebase + Lakebase Search（ANN、BM25），或 AI Search"), change: t("Lakebase keeps your SQL and plans; AI Search removes the database and some control.", "Lakebase 保留你的 SQL 和执行计划；AI Search 去掉了数据库，也拿走了一部分控制权。"), step: "choose" },
  { local: t("tools/knowledge_base.py ranking: RRF, authority, dedup, expansion", "tools/knowledge_base.py 的排序：RRF、权威、去重、扩展"), dbx: t("ranking.py, unchanged, after either backend", "ranking.py，原样保留，在任一后端之后执行"), change: t("Nothing: this is your code, and it is tested here.", "没有变化：这是你自己的代码，并在这里经过测试。"), step: "search-tool" },
  { local: t("Tool registry and the brainbank MCP server", "工具注册表与 brainbank MCP 服务"), dbx: t("Unity Catalog functions, managed MCP endpoints", "Unity Catalog 函数、托管 MCP 端点"), change: t("A tool is governed like a table; any MCP client can call it with OAuth.", "工具像表一样被治理；任何 MCP 客户端都可以用 OAuth 调用它。"), step: "tools" },
  { local: t("AGENT.md and skills/*/SKILL.md", "AGENT.md 与 skills/*/SKILL.md"), dbx: t("MLflow prompt registry in Unity Catalog, @production alias", "Unity Catalog 中的 MLflow 提示词注册表，@production 别名"), change: t("Rollback is moving an alias, no redeploy.", "回滚就是移动别名，无需重新部署。"), step: "prompts" },
  { local: t("memory_store.py, conversation index, recall tool", "memory_store.py、对话索引、回忆工具"), dbx: t("Lakebase Postgres tables, partition = signed-in user", "Lakebase Postgres 表，分区 = 登录用户"), change: t("The partition now comes from platform sign-in, which is stronger than a key.", "分区现在来自平台登录，这比密钥更可靠。"), step: "memory" },
  { local: t("agent_loop.py, graph.py, answer_guard.py, stream gate", "agent_loop.py、graph.py、answer_guard.py、流式闸门"), dbx: t("OpenAI Agents SDK app template + harness.py + answer_guard.py", "OpenAI Agents SDK 应用模板 + harness.py + answer_guard.py"), change: t("The SDK provides the loop and tracing; triage, budget and guard stay yours.", "SDK 提供循环和追踪；分流、预算和护栏仍由你负责。"), step: "agent" },
  { local: t("Install-Autostart, supervised services, Tailscale funnel", "Install-Autostart、受守护的服务、Tailscale funnel"), dbx: t("Databricks Apps deployed by an asset bundle", "由 asset bundle 部署的 Databricks Apps"), change: t("Callers sign in with OAuth; the app has its own identity and grants.", "调用方用 OAuth 登录；App 拥有自己的身份和授权。"), step: "deploy" },
  { local: t("Sealed eval folder, nightly chat and stream evals", "封存的评估目录、夜间对话与流式评估"), dbx: t("UC evaluation dataset, mlflow.genai.evaluate, code scorers, a digest", "UC 评估数据集、mlflow.genai.evaluate、代码 scorer、摘要"), change: t("The seal is a grant plus a digest; repeats and spread are unchanged.", "封存 = 一条授权 + 一个摘要；重复运行和波动范围的做法不变。"), step: "evals" },
  { local: t("launchd timers and the duty-cycle scheduler", "launchd 定时器与占空比调度器"), dbx: t("Lakeflow Jobs on serverless, in the bundle", "bundle 中定义的 serverless Lakeflow Jobs"), change: t("No GPU contention, so no duty cycle; cost is the new limit.", "没有 GPU 争用，所以不需要占空比；成本成了新的限制。"), step: "jobs" },
  { local: t("self_observe.py and the cursor table", "self_observe.py 与游标表"), dbx: t("A report-mode job over MLflow traces, cursor in Delta", "基于 MLflow 追踪、以报告模式运行的 job，游标存在 Delta 中"), change: t("Same discipline: prove, report, a person applies.", "纪律相同：证明、报告、由人应用。"), step: "learner" },
  { local: t("Check-All-LLM-Status, pg_backup.sh", "Check-All-LLM-Status、pg_backup.sh"), dbx: t("System tables dashboard, alerts, Delta time travel, Lakebase branches", "系统表仪表盘、告警、Delta time travel、Lakebase 分支"), change: t("You watch spend daily; backups are built in but restores still need a test.", "你需要每天关注花费；备份是内置的，但恢复仍需测试。"), step: "monitor" },
  { local: t("This tutor and datamatter on Vercel, local-first chain", "Vercel 上的本教程站与 datamatter，本地优先链路"), dbx: t("Stays on Vercel; Databricks becomes one more link via M2M OAuth", "仍留在 Vercel；Databricks 通过 M2M OAuth 成为链路中的又一个环节"), change: t("Apps require sign-in, so a public site cannot be one.", "App 需要登录，所以公开网站不能做成 App。"), step: "frontend" },
];

const runbooksRaw: Runbook[] = [
  {
    title: t("Every morning (10 minutes)", "每天早上（10 分钟）"),
    when: t("Before anyone relies on the agent that day.", "在当天有人依赖这个智能体之前。"),
    items: [
      t("Open the status dashboard. Did ingest, eval and learner each run last night? (query 5)", "打开状态仪表盘。昨晚 ingest、评估和学习器是否都跑了？（第 5 条查询）"),
      t("Read the eval job's output: mean and spread per scorer. grounded_figures must be 1.0.", "查看评估 job 的输出：每个 scorer 的均值和波动范围。grounded_figures 必须是 1.0。"),
      t("Read new findings (query 4). Each one is a proof line; open a ticket for any new key.", "查看新的发现（第 4 条查询）。每一条都是一行证据；对任何新出现的键开一个工单。"),
      t("Check yesterday's spend against the budget (query 1). A jump with flat traffic means larger prompts or more rounds.", "对照预算检查昨天的花费（第 1 条查询）。流量持平而花费跳升，说明提示词变大了或轮次变多了。"),
    ],
  },
  {
    title: t("Every change (prompt, skill, tool, model, ranking)", "每次改动（提示词、技能、工具、模型、排序）"),
    when: t("Before anything reaches production users.", "在任何东西到达生产用户之前。"),
    items: [
      t("Branch. Run `python replicate/databricks/check.py`: portable tests must pass.", "开分支。运行 `python replicate/databricks/check.py`：可移植测试必须全部通过。"),
      t("`databricks bundle deploy -t dev`, then the frozen eval with --repeats 5 against the dev app.", "执行 `databricks bundle deploy -t dev`，然后针对 dev App 用 --repeats 5 跑冻结评估。"),
      t("Compare with the last production run. Keep the change only if it beats the spread, or is neutral and fixes a finding.", "与最近一次生产运行对比。只有当改动超出波动范围，或者效果持平但修复了某条发现时，才保留这个改动。"),
      t("For prompts: register a new version and move @production. For code: merge and `bundle deploy -t prod`.", "提示词：注册新版本并移动 @production。代码：合并后执行 `bundle deploy -t prod`。"),
      t("Write one line in the change log: what, why, the eval numbers before and after.", "在变更日志里写一行：改了什么、为什么改、改动前后的评估数据。"),
    ],
  },
  {
    title: t("Every week", "每周"),
    when: t("A fixed slot, so it happens.", "固定一个时间段，确保它会发生。"),
    items: [
      t("Read the week's findings as a whole: what keeps recurring is a design problem, not a bug.", "把一周的发现放在一起看：反复出现的是设计问题，而不是 bug。"),
      t("Review rejected files in the ledger and fix the sources.", "检查台账中被拒绝的文件，修正源文件。"),
      t("Run the retrieval parity script (step [[parity]]) to catch drift from new documents.", "运行检索一致性脚本（第 [[parity]] 步），发现新文档带来的漂移。"),
      t("Run bench.py at a busy hour; if first-token time grew, reconsider the lineup.", "在繁忙时段运行 bench.py；如果首 token 时间变长了，重新考虑模型阵容。"),
      t("Once a month: restore yesterday's chunk table into a scratch table and compare counts.", "每月一次：把昨天的文本块表恢复到一张临时表中，比较行数。"),
    ],
  },
];

const incidentsRaw: Incident[] = [
  { s: t("Answers suddenly wrong, no errors anywhere", "答案突然出错，到处都没有报错"), check: t("Ledger query 2 and chunks query 3: did an ingest retire a collection? Then the prompt alias history.", "台账查询（第 2 条）和文本块查询（第 3 条）：是不是某次 ingest 停用了一整个集合？然后查看提示词别名的历史。"), f: t("Time-travel the chunk table back, or move the prompt alias back. Then find the cause.", "用 time travel 把文本块表恢复回去，或者把提示词别名移回去。然后再查原因。") },
  { s: t("Users get 429", "用户收到 429"), check: t("Gateway usage for the endpoint: per-user limit or endpoint limit?", "查看该端点的网关用量：是每用户限流还是端点限流？"), f: t("Raise the per-user limit, route chat turns to the fast model, or move to provisioned throughput.", "调高每用户限额、把闲聊轮次路由到快速模型，或者改用预置吞吐量。") },
  { s: t("App returns 401 for everyone", "所有人访问 App 都返回 401"), check: t("Was the app redeployed or renamed? Are clients sending OAuth tokens?", "App 是否被重新部署或改名了？客户端发送的是 OAuth 令牌吗？"), f: t("Restore CAN_USE grants; personal access tokens are not accepted.", "恢复 CAN_USE 授权；个人访问令牌不被接受。") },
  { s: t("New documents never show up in answers", "新文档从不出现在答案里"), check: t("Ingest printed changed N? Did refresh_search run after it and print COMPLETED?", "ingest 是否打印了 changed N？之后 refresh_search 是否运行并打印了 COMPLETED？"), f: t("Rerun refresh_search; TRIGGERED pipelines and indexes never update on their own.", "重跑 refresh_search；TRIGGERED 模式的管道和索引不会自行更新。") },
  { s: t("Eval job stops with SEAL BROKEN", "评估 job 因 SEAL BROKEN 而终止"), check: t("DESCRIBE HISTORY on the dataset table: who wrote, when.", "对数据集表执行 DESCRIBE HISTORY：谁写入的、什么时候。"), f: t("Revoke that write path. Never reseal to continue; version a new set if the change was legitimate.", "撤销那条写入途径。绝不为了继续而重新封存；如果改动合理，就新建一个带版本号的问题集。") },
  { s: t("Memory or Lakebase retrieval fails after about an hour", "记忆或 Lakebase 检索大约一小时后失败"), check: t("Is any code holding a connection longer than 60 minutes?", "是否有代码持有连接超过 60 分钟？"), f: t("Use common/pg.py's pool (fresh credential per connection, 45-minute recycle).", "使用 common/pg.py 中的连接池（每个连接都用新凭证，45 分钟回收）。") },
  { s: t("Spend doubled overnight", "花费一夜之间翻倍"), check: t("Billing query by product, then tokens per request in the inference table.", "按产品查询计费，再查看推理表中每个请求的 token 数。"), f: t("Usually a loop (budget_exhaustion findings), a prompt that grew, or a job that runs far more often than intended.", "通常是陷入循环（会有 budget_exhaustion 发现）、提示词变大了，或者某个 job 运行得远比预期频繁。") },
];

export const costLevers: LS[] = [
  t("Triage first: greetings and chit-chat go to the fast model with no tools. On the local build this removed most model calls from small talk.", "先分流：问候和闲聊交给不带工具的快速模型。在本地构建中，这样做去掉了闲聊中的大部分模型调用。"),
  t("Keep the briefing and the skill text short; they are paid for on every turn.", "让用户简报和技能文本保持简短；每一轮都要为它们付费。"),
  t("Retrieve 5 passages, not 20. Candidates are cheap; text in the prompt is not.", "检索 5 段，而不是 20 段。候选很便宜，放进提示词的文本却不便宜。"),
  t("Hourly ingest that finds nothing changed costs one listing and one hash pass; keep it hourly only if documents really change that often.", "每小时运行一次、却没发现任何变化的 ingest，代价是一次列目录和一轮哈希计算；只有文档真的变得这么频繁，才保持每小时一次。"),
  t("Evals with --repeats 5 cost five times one run. Use 3 nightly and 5 for decisions.", "--repeats 5 的评估花费是单次运行的五倍。夜间用 3 次，做决定时用 5 次。"),
  t("Stop dev apps you are not using; apps bill per hour of provisioned compute.", "停掉不用的 dev App；App 按预置计算资源的运行小时计费。"),
];

const gapsRaw: LS[] = [
  t("Local-first privacy does not carry over. On the Mac nothing left the machine; here documents, prompts and answers live in the workspace's cloud account. Decide what may move before step [[upload]], not after.", "“本地优先”的隐私保障无法沿用。在 Mac 上没有任何东西离开本机；而在这里，文档、提示词和答案都存放在工作区所在的云账号中。在第 [[upload]] 步之前就决定哪些可以迁移，而不是之后。"),
  t("Serving knobs disappear: context length, keep-alive, parallelism and quantization were yours to set in ollama-env.sh. Hosted endpoints decide them. If an answer depended on a long context, test it again.", "服务参数不复存在：上下文长度、keep-alive、并发数和量化方式原本由你在 ollama-env.sh 中设置。托管端点会自己决定这些。如果某个答案依赖长上下文，请重新测试。"),
  t("Exact local models may not exist. qwen3.8:27b and qwen3.6:35b-a3b are stood in for by the nearest hosted Qwen endpoints; answers will differ. That is why step [[evals]] compares against local history rather than assuming parity.", "确切的本地模型可能并不存在。qwen3.8:27b 和 qwen3.6:35b-a3b 由最接近的托管 Qwen 端点替代；答案会有差异。这就是为什么第 [[evals]] 步要与本地历史数据对比，而不是假定两者一致。"),
  t("The coding-client translation proxy (claude-code-gateway) has no counterpart here, and needs none: coding agents can call the workspace's endpoints directly.", "编程客户端的协议转换代理（claude-code-gateway）在这里没有对应物，也不需要：编程智能体可以直接调用工作区的端点。"),
  t("A public, sign-in-free page cannot be a Databricks App. The public tutor stays on Vercel (step [[frontend]]).", "无需登录的公开页面不能做成 Databricks App。公开教程站留在 Vercel 上（第 [[frontend]] 步）。"),
  t("Agent Bricks can build some of this (a knowledge assistant, a supervisor) without code. It was not used here, because it replaces the parts this curriculum teaches you to own; evaluate it against the same frozen set if you try it.", "Agent Bricks 可以无需代码地构建其中一部分（知识助手、主管智能体）。这里没有使用它，因为它替代的正是本课程教你自己掌握的那些部分；如果你要尝试，请用同一套冻结问题集来评估它。"),
];

export const runbooks: Runbook[] = runbooksRaw.map((r) => ({ title: fill(r.title), when: fill(r.when), items: r.items.map(fill) }));
export const incidents: Incident[] = incidentsRaw.map((x) => ({ s: fill(x.s), check: fill(x.check), f: fill(x.f) }));
export const gaps: LS[] = gapsRaw.map(fill);

export const sources = [
  { title: "Author an agent and deploy it on Databricks Apps", url: "https://docs.databricks.com/aws/en/agents/custom-agents/author-agent" },
  { title: "Create and query an AI Search index", url: "https://docs.databricks.com/aws/en/generative-ai/create-query-vector-search" },
  { title: "Managed MCP servers", url: "https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp" },
  { title: "Create a custom agent tool (Unity Catalog functions)", url: "https://docs.databricks.com/aws/en/generative-ai/agent-framework/create-custom-tool" },
  { title: "Foundation Model APIs: supported models", url: "https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models" },
  { title: "Query chat models", url: "https://docs.databricks.com/aws/en/machine-learning/model-serving/query-chat-models" },
  { title: "Configure Unity Gateway endpoints", url: "https://docs.databricks.com/aws/en/ai-gateway/configure-endpoints" },
  { title: "Lakebase: connect an external app with the SDK", url: "https://docs.databricks.com/aws/en/oltp/projects/external-apps-connect" },
  { title: "Lakebase: supported Postgres extensions", url: "https://docs.databricks.com/aws/en/oltp/projects/extensions" },
  { title: "Lakebase Search (hybrid vector and BM25)", url: "https://docs.databricks.com/aws/en/oltp/projects/lakebase-search" },
  { title: "Lakebase: serve lakehouse data with synced tables", url: "https://docs.databricks.com/aws/en/oltp/projects/sync-tables" },
  { title: "MLflow prompt registry", url: "https://docs.databricks.com/aws/en/mlflow3/genai/prompt-version-mgmt/prompt-registry/" },
  { title: "Code-based scorer examples", url: "https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/code-based-scorer-examples" },
  { title: "Tutorial: evaluate and improve an agent", url: "https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/evaluate-app" },
  { title: "Databricks Apps: deploy", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy" },
  { title: "Databricks Apps: environment variables", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/environment-variables" },
  { title: "Bundle resource examples (jobs, schedules, serverless)", url: "https://docs.databricks.com/aws/dev-tools/bundles/resource-examples" },
  { title: "Secret management", url: "https://docs.databricks.com/aws/en/security/secrets/" },
  { title: "ResponsesAgent (MLflow)", url: "https://mlflow.org/docs/latest/genai/serving/responses-agent/" },
];

/** Steps in dependency order is checked by the audit: every `after` and `afterAny` id appears earlier. */
export function orderProblems(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of rsteps) {
    for (const a of s.after) if (!seen.has(a)) out.push(`${s.id}: after ${a}, which is not an earlier step`);
    if (s.afterAny && !s.afterAny.some((a) => seen.has(a))) out.push(`${s.id}: none of ${s.afterAny.join(", ")} is an earlier step`);
    seen.add(s.id);
  }
  return out;
}
