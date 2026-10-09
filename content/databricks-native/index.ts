import { t, type LS } from "@/lib/types";
import type { Phase, RStep } from "@/content/databricks/types";
import { phases1 } from "./phases-1";
import { phases2 } from "./phases-2";
import { phases3 } from "./phases-3";

/**
 * Building natively on Databricks: one production workflow (spend exceptions) end to end, with
 * GitLab as the source of truth. Nothing on Databricks was executed for this page. API names come
 * from vendor pages read in October 2026 (`sources`); every step that relies on a detail those pages
 * did not show says so in `unconfirmed`. The pure parts of the kit are tested by
 * native/databricks/check.py, whose results the page shows and the audit verifies.
 */

const raw: Phase[] = [...phases1, ...phases2, ...phases3];

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
  scale: s.scale?.map(fill),
  challenge: s.challenge?.map((c) => ({ q: fill(c.q), a: fill(c.a) })),
});
export const phases: Phase[] = raw.map((p) => ({ ...p, title: fill(p.title), goal: fill(p.goal), steps: p.steps.map(fillStep) }));
export const rsteps: RStep[] = phases.flatMap((p) => p.steps);
export const rstepById: Record<string, RStep> = Object.fromEntries(rsteps.map((s) => [s.id, s]));

export const intro = {
  title: t("Build a production agent workflow on Databricks", "在 Databricks 上构建生产级智能体工作流"),
  lede: t(
    "One enterprise workflow, built end to end on Databricks with GitLab as the source of truth: invoices, purchase orders and receipts in Unity Catalog; Lakeflow pipelines for the three-way match; AI Functions on the invoice PDFs; policy in AI Search; numbers through Genie and Unity Catalog functions; an agent that proposes, code that checks, a person who approves in a Databricks App; an evaluation gate in CI; and the levers to scale it from one business unit to the enterprise.",
    "一个企业级工作流，以 GitLab 作为唯一可信来源，在 Databricks 上从头到尾构建：发票、采购订单和收货记录放在 Unity Catalog 中；用 Lakeflow pipeline 做三单匹配；用 AI Functions 处理发票 PDF；政策放在 AI Search 中；通过 Genie 和 Unity Catalog 函数获取数字；智能体负责提议，代码负责检查，人在 Databricks App 中批准；CI 中有评估门槛；以及把它从一个业务单元扩展到整个企业的各种杠杆。",
  ),
  workflow: t(
    "The workflow: for each invoice that fails the three-way match (invoice against purchase order against receipt) or disagrees with its own PDF, propose one resolution (approve payment, hold, request a credit memo, or escalate) with cited policy and grounded figures, for a person to approve. The agent never pays, holds or changes anything itself. Every pattern here carries over to other decisions: claims, onboarding, reconciliations, contract review.",
    "工作流：对于每张未通过三单匹配（发票对采购订单对收货记录）或与自身 PDF 不一致的发票，提出一个处置建议（批准付款、暂缓、要求贷项通知单或升级处理），附带引用的政策和有据的数字，交由人批准。智能体自己从不付款、暂缓或修改任何东西。这里的每一种模式都可以迁移到其他决策场景：理赔、准入、对账、合同审查。",
  ),
  honesty: t(
    "Nothing on Databricks was run for this page: there was no workspace. API names, SQL and YAML come from the vendor pages listed at the bottom, read in October 2026. Where a step depends on a detail those pages did not show, it says so in a 'Not confirmed' box. The parts of the kit that run without a workspace (contract validation, the proposal policy, the reviewer rules, the release gate, the scorers, the classifier gate, chunking, the Genie result comparison, batch and load-test logic) were executed here; the check results are below.",
    "本页涉及的 Databricks 操作一项都没有实际运行过：这里没有工作区。API 名称、SQL 和 YAML 来自页面底部列出的厂商文档，阅读时间为 2026 年 10 月。凡是某一步依赖了这些页面没有展示的细节，都会在“未确认”框中注明。工具包中无需工作区即可运行的部分（契约校验、提议政策、审核规则、发布门槛、scorer、分类器门槛、切块、Genie 结果比较、批处理和负载测试逻辑）已在这里执行过；检查结果见下方。",
  ),
  scriptsHow: t(
    "All files live in native/databricks/ in this repository and form a complete GitLab project: copy the folder as the root of a new repository, fill the placeholders marked <...>, and follow the steps in order, or in any order the dependency map allows.",
    "所有文件都在本仓库的 native/databricks/ 目录中，构成一个完整的 GitLab 项目：把这个目录复制为新仓库的根目录，填好标记为 <...> 的占位符，然后按顺序完成各步骤，或按依赖图允许的任意顺序进行。",
  ),
};

/** The architecture, as layers of components. Step pages tag the components they build. */
export interface ArchNode { id: string; label: LS; detail: LS }
export interface ArchLayer { id: string; label: LS; nodes: ArchNode[] }
export const architecture: ArchLayer[] = [
  { id: "sources", label: t("Sources", "数据源"), nodes: [
    { id: "erp", label: t("ERP extracts", "ERP 抽取文件"), detail: t("Invoices, purchase orders, receipts, vendors, landed as JSON in a volume (or through a Lakeflow Connect connector).", "发票、采购订单、收货记录、供应商，以 JSON 形式落地到 volume 中（或通过 Lakeflow Connect 连接器）。") },
    { id: "docs", label: t("Invoice PDFs", "发票 PDF"), detail: t("The documents vendors sent; the evidence the ERP record is checked against.", "供应商寄来的文档；用来核对 ERP 记录的证据。") },
    { id: "policydocs", label: t("Policy documents", "政策文档"), detail: t("Approved, current payment and procurement policy only.", "只放已批准的、当前有效的付款和采购政策。") },
  ] },
  { id: "lakehouse", label: t("Lakehouse", "湖仓"), nodes: [
    { id: "uc", label: t("Unity Catalog", "Unity Catalog"), detail: t("One catalog per environment; ABAC row filter by business unit and column mask on bank accounts; lineage for every table.", "每个环境一个 catalog；按业务单元的 ABAC 行过滤和银行账号列掩码；每张表都有血缘。") },
    { id: "pipeline", label: t("Lakeflow pipeline", "Lakeflow pipeline"), detail: t("Bronze as landed, silver with expectations, gold three-way match exceptions with stable ids.", "Bronze 保持原样，silver 带期望规则，gold 是带稳定 id 的三单匹配异常。") },
    { id: "metric", label: t("Metric view", "指标视图"), detail: t("One governed definition of open exceptions, exposure and variance.", "未结异常、敞口和差异的唯一受治理定义。") },
  ] },
  { id: "intelligence", label: t("AI and knowledge", "AI 与知识"), nodes: [
    { id: "aifn", label: t("AI Functions", "AI Functions"), detail: t("ai_parse_document, ai_extract and ai_classify in streaming tables: once per document, with confidence.", "流式表中的 ai_parse_document、ai_extract 和 ai_classify：每份文档一次，附带置信度。") },
    { id: "search", label: t("AI Search", "AI Search"), detail: t("Policy chunks with heading paths, Delta Sync index, hybrid queries.", "带标题路径的政策文本块，Delta Sync 索引，混合检索。") },
    { id: "genie", label: t("Genie space", "Genie space"), detail: t("Questions to SQL over gold and the metric view, under the asker's permissions, benchmarked in CI.", "在 gold 和指标视图上把问题转为 SQL，使用提问者的权限，并在 CI 中做基准测试。") },
    { id: "tools", label: t("UC functions (MCP)", "UC 函数（MCP）"), detail: t("get_exception and vendor_history, fixed reviewed queries, reached through managed MCP.", "get_exception 和 vendor_history，固定的、经过审查的查询，通过托管 MCP 访问。") },
  ] },
  { id: "decision", label: t("Decision", "决策"), nodes: [
    { id: "gateway", label: t("Unity Gateway", "Unity Gateway"), detail: t("Every model call: rate limits per principal, guardrails, usage tracking, inference table.", "每一次模型调用：按主体限流、护栏、用量追踪、推理表。") },
    { id: "agent", label: t("Agent app", "智能体 App"), detail: t("Reads through MCP, returns one structured proposal; code checks it, retries once, writes to the queue or escalates.", "通过 MCP 读取，返回一个结构化提议；由代码检查，重试一次，然后写入队列或升级处理。") },
    { id: "queue", label: t("Review queue (Lakebase)", "审核队列（Lakebase）"), detail: t("One live proposal per exception; append-only decisions; a trigger that enforces the two-person rule in the database; exported to Delta as labels.", "每个异常只有一条在途提议；决定只追加；在数据库中强制执行双人复核规则的触发器；导出到 Delta 作为标签。") },
    { id: "reviewer", label: t("Reviewer app", "审核 App"), detail: t("Databricks App with user authorization: units from Unity Catalog, two-person rule, correction required on reject.", "启用用户授权的 Databricks App：单元范围来自 Unity Catalog，双人复核，拒绝时必须给出纠正。") },
  ] },
  { id: "quality", label: t("Quality", "质量"), nodes: [
    { id: "evals", label: t("Eval set and gate", "评估集与门槛"), detail: t("Past human decisions, versioned and sealed; repeated runs; gate on contract, baseline and spread.", "过往的人工决定，带版本并封存；多次运行；按契约、基线和波动范围设置门槛。") },
    { id: "monitor", label: t("Production monitoring", "生产监控"), detail: t("Scorers on sampled live traces; weekly approval rate; SME labeling.", "在抽样线上追踪上运行的 scorer；每周批准率；专家标注。") },
  ] },
  { id: "delivery", label: t("Delivery and operations", "交付与运维"), nodes: [
    { id: "gitlab", label: t("GitLab", "GitLab"), detail: t("Protected main and release, CODEOWNERS, OIDC federation by branch, a gate verified per commit, a protected production environment.", "受保护的 main 和 release、CODEOWNERS、按分支的 OIDC 联合、按提交验证的门槛、受保护的生产环境。") },
    { id: "bundle", label: t("Bundle", "Bundle"), detail: t("Every resource in git; dev, stg and prd targets; production runs as a service principal.", "所有资源都在 git 中；dev、stg、prd 三个 target；生产以服务主体身份运行。") },
    { id: "jobs", label: t("Lakeflow Jobs", "Lakeflow Jobs"), detail: t("File-arrival orchestrator, weekly policy refresh, nightly quality.", "按文件到达触发的编排、每周政策刷新、每晚质量检查。") },
    { id: "observe", label: t("System tables", "系统表"), detail: t("Cost by workload tag, cost per exception, approval rate, backlog age, data quality.", "按 workload 标签的成本、每个异常的成本、批准率、积压时长、数据质量。") },
  ] },
];

/** The path every change takes. */
export const delivery: { id: string; label: LS; detail: LS; gate?: LS }[] = [
  { id: "mr", label: t("Merge request", "合并请求"), detail: t("Contract check and tests, including the review queue on a real Postgres. No workspace access at all.", "契约检查和测试，包括在真实 Postgres 上运行的审核队列测试。完全不访问任何工作区。"), gate: t("tests + approval", "测试 + 批准") },
  { id: "main", label: t("main", "main"), detail: t("Protected branch. Its pipeline is the only one the staging principal trusts.", "受保护分支。预发服务主体只信任它的流水线。") },
  { id: "stg", label: t("staging", "staging"), detail: t("Render settings, deploy, apply SQL, restart apps, then the eval set three times and the Genie benchmark.", "写入设置、部署、执行 SQL、重启 App，然后跑三遍评估集和 Genie 基准测试。"), gate: t("eval gate, per commit", "评估门槛（按提交）") },
  { id: "release", label: t("release", "release"), detail: t("Protected branch, fast-forwarded to a gated main commit by a maintainer. The only ref the production principal trusts.", "受保护分支，由维护者 fast-forward 到 main 上一个通过门槛的提交。生产服务主体只信任这一个分支。"), gate: t("same sha passed", "同一 sha 已通过") },
  { id: "prd", label: t("production", "production"), detail: t("Manual job in a protected environment, after verify_gate.", "在 verify_gate 之后，由受保护环境中的手动作业完成。"), gate: t("named approver", "具名审批人") },
  { id: "baseline", label: t("baseline", "基线"), detail: t("The release that reached production, kept as an artifact; the next gate compares against it.", "进入生产的版本，作为产出物保留；下一次门槛将与它比较。") },
];

/** Autonomy levels, and what moving up requires. */
export const autonomy: { level: number; name: LS; means: LS; needs: LS }[] = [
  { level: 0, name: t("Report", "报告"), means: t("The agent summarizes; people decide everything.", "智能体做汇总；所有事情由人决定。"), needs: t("Read access and tracing.", "读取权限和追踪。") },
  { level: 1, name: t("Recommend", "建议"), means: t("The agent suggests an action; people may ignore it.", "智能体建议一个动作；人可以忽略它。"), needs: t("An eval set and measured accuracy.", "一个评估集和实测准确率。") },
  { level: 2, name: t("Act with approval", "经批准后执行"), means: t("The agent proposes; nothing happens until a person approves. This build.", "智能体提议；在人批准之前什么都不会发生。本构建处于这一级。"), needs: t("Code-side checks, a review queue, a reviewer app, a release gate.", "代码侧检查、审核队列、审核 App、发布门槛。") },
  { level: 3, name: t("Act within limits", "在限额内执行"), means: t("For one class below an amount, the agent acts; people audit samples.", "对于某一类低于某个金额的事项，智能体直接执行；人做抽样审计。"), needs: t("A quarter at level 2 with zero unsafe errors, approval at the human agreement rate, an owner's signature, a kill switch.", "在第 2 级运行一个季度、不安全错误为零、批准率达到人与人一致率、负责人签字、紧急停止开关。") },
  { level: 4, name: t("Autonomous", "自主"), means: t("The agent acts; people review outcomes.", "智能体执行；人审查结果。"), needs: t("Rare for payment decisions. Regulators and auditors will ask who is accountable.", "付款决策中很少见。监管和审计人员会问谁来负责。") },
];

/** Production readiness: the audit a release must pass. Grouped; each item is checkable. */
export const gates: { area: LS; items: LS[] }[] = [
  { area: t("Scope and accountability", "范围与责任"), items: [
    t("contract.yml merged with the owner's approval; CODEOWNERS on it", "contract.yml 已在负责人批准后合并；并为它设置了 CODEOWNERS"),
    t("Autonomy level stated, and every write path listed", "写明了自主等级，并列出了所有写入路径"),
    t("A kill switch that stops new proposals in one action", "有一个一键就能停止产生新提议的紧急停止开关"),
  ] },
  { area: t("Security and identity", "安全与身份"), items: [
    t("No long-lived token anywhere in GitLab; OIDC federation per environment; merge-request pipelines have no workspace access", "GitLab 中任何地方都没有长期令牌；每个环境使用 OIDC 联合；合并请求流水线无法访问任何工作区"),
    t("Staging trusts only main and production only release, both tested negatively", "预发只信任 main、生产只信任 release，两者都做过反向测试"),
    t("Production deploys only a commit whose gate result matches its sha", "生产只部署门槛结果与其 sha 一致的提交"),
    t("Agent and app run as their own service principals with least privilege", "智能体和 App 以各自的服务主体运行，遵循最小权限"),
    t("Reviewer app reads data as the user (on-behalf-of), never as itself; only reviewers who are not auditors decide", "审核 App 以用户身份读取数据（代表用户），绝不以自身身份读取；只有非审计人员的审核人员才能做决定"),
    t("The two-person rule and append-only decisions are enforced by the database, and tested against it", "双人复核规则和只追加的决定由数据库强制执行，并针对数据库做过测试"),
    t("Policy functions live outside the tools schema, where agents cannot list or replace them", "策略函数放在 tools schema 之外，智能体无法列出或替换它们"),
    t("Model-written text escaped in every UI", "所有界面都对模型生成的文本做了转义"),
  ] },
  { area: t("Data governance", "数据治理"), items: [
    t("Row filter by business unit and column mask on sensitive columns, tested as two users", "按业务单元的行过滤和敏感列掩码，并以两个用户身份测试过"),
    t("Expectations on every silver table, with the drop or fail choice written beside each rule", "每张 silver 表都有期望规则，并在每条规则旁写明了丢弃或失败的选择"),
    t("Lineage from proposal back to source file (exception id, invoice id, bronze _source_file)", "从提议到源文件的血缘（异常 id、发票 id、bronze _source_file）"),
    t("Retention for traces and proposals enforced as the contract states", "按契约规定执行追踪和提议的保留期"),
  ] },
  { area: t("AI quality", "AI 质量"), items: [
    t("Eval set of at least 200 past decisions, versioned and sealed, no prompt examples in it", "评估集至少包含 200 条过往决定，带版本并封存，其中不含提示词示例"),
    t("Gate passed: contract thresholds, zero unsafe errors, no regression beyond spread", "通过门槛：契约门槛达标、不安全错误为零、退步不超过波动范围"),
    t("Extraction and classification measured per class, with confidence cuts", "抽取和分类都按类别衡量，并设有置信度阈值"),
    t("Genie benchmark at or above 90%", "Genie 基准测试达到或超过 90%"),
    t("Human agreement rate measured once, as the ceiling for accuracy", "测量过一次人与人的一致率，作为准确率的上限"),
  ] },
  { area: t("Operations", "运维"), items: [
    t("Load test knee measured; batch concurrency and gateway limits set below it", "测得了负载测试拐点；批处理并发和网关限额设在拐点之下"),
    t("Dashboard with cost per exception, approval rate, backlog age, data quality", "仪表盘包含每个异常的成本、批准率、积压时长、数据质量"),
    t("Alerts on backlog SLO, rejected payment proposals, cost per exception", "对积压 SLO、被拒绝的付款提议、每个异常的成本设置了告警"),
    t("Every rollback rehearsed with a recorded time", "每种回滚都演练过并记录了时间"),
    t("Model retirement dates tracked; upgrades go through the gate", "跟踪了模型下线日期；升级都要经过门槛"),
  ] },
];

export const sources = [
  { title: "Enable workload identity federation for GitLab CI/CD", url: "https://docs.databricks.com/aws/en/dev-tools/auth/provider-gitlab" },
  { title: "CI/CD for Databricks Apps (GitHub Actions pattern, adapted to GitLab)", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/cicd-github-actions" },
  { title: "Declarative Automation Bundles", url: "https://docs.databricks.com/aws/en/dev-tools/bundles/" },
  { title: "Bundle resource examples", url: "https://docs.databricks.com/aws/dev-tools/bundles/resource-examples" },
  { title: "Connect your Git provider (GitLab) to Databricks", url: "https://docs.databricks.com/aws/repos/get-access-tokens-from-git-provider" },
  { title: "ABAC row filter and column mask policies (tutorial)", url: "https://docs.databricks.com/aws/en/data-governance/unity-catalog/abac/tutorial-sql" },
  { title: "Manage data quality with pipeline expectations", url: "https://docs.databricks.com/aws/en/ldp/expectations" },
  { title: "AI Functions", url: "https://docs.databricks.com/en/large-language-models/ai-functions" },
  { title: "ai_parse_document", url: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document" },
  { title: "ai_extract", url: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract" },
  { title: "ai_classify", url: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_classify" },
  { title: "Metric views with SQL", url: "https://docs.databricks.com/aws/en/metric-views/create/sql" },
  { title: "Query an AI Search index", url: "https://docs.databricks.com/aws/en/ai-search/query-ai-search" },
  { title: "Managed MCP servers", url: "https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp" },
  { title: "Configure authorization in a Databricks app", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth" },
  { title: "Databricks Apps: deploy", url: "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy" },
  { title: "Author an agent and deploy it on Databricks Apps", url: "https://docs.databricks.com/aws/en/agents/custom-agents/author-agent" },
  { title: "Agent Bricks CLI (Beta)", url: "https://docs.databricks.com/aws/en/agents/custom-agents/agent-bricks-cli" },
  { title: "Deploy agents (Agent Runtime)", url: "https://docs.databricks.com/aws/en/agents/deploy/" },
  { title: "Lakebase: connect an external app", url: "https://docs.databricks.com/aws/en/oltp/projects/external-apps-connect" },
  { title: "MLflow: monitor in production", url: "https://docs.databricks.com/gcp/en/mlflow3/genai/eval-monitor/monitor-in-production" },
  { title: "Code-based scorer examples", url: "https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/code-based-scorer-examples" },
  { title: "Foundation Model APIs: supported models", url: "https://docs.databricks.com/aws/en/machine-learning/foundation-model-apis/supported-models" },
  { title: "Configure Unity Gateway endpoints", url: "https://docs.databricks.com/aws/en/ai-gateway/configure-endpoints" },
];

export function orderProblems(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const comps = new Set(architecture.flatMap((l) => l.nodes.map((n) => n.id)));
  for (const s of rsteps) {
    for (const a of s.after) if (!seen.has(a)) out.push(`${s.id}: after ${a}, which is not an earlier step`);
    if (s.afterAny && !s.afterAny.some((a) => seen.has(a))) out.push(`${s.id}: none of ${s.afterAny.join(", ")} is an earlier step`);
    for (const c of s.components ?? []) if (!comps.has(c)) out.push(`${s.id}: unknown architecture component ${c}`);
    seen.add(s.id);
  }
  for (const c of comps) if (!rsteps.some((s) => s.components?.includes(c))) out.push(`component ${c} is built by no step`);
  return out;
}
