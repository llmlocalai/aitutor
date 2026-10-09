import { t } from "@/lib/types";
import type { Phase } from "./types";

/** Phases 1 to 4: foundation, models, knowledge, retrieval. */
export const phasesA: Phase[] = [
  {
    id: "foundation",
    title: t("Foundation: identity, storage layout, secrets", "地基：身份、存储布局、密钥"),
    goal: t(
      "Before any model or document moves, decide who is acting and where everything lives. On the Mac these were implicit: you were the only user and the disk was the catalog. On Databricks every read and write is checked against an identity and a Unity Catalog object, so they come first.",
      "在迁移任何模型或文档之前，先确定由谁来操作、所有东西放在哪里。在 Mac 上这些都是隐含的：你是唯一的用户，磁盘就是目录。在 Databricks 上，每一次读写都要对照一个身份和一个 Unity Catalog 对象做检查，所以这些必须最先做。",
    ),
    steps: [
      {
        id: "workspace",
        title: t("Connect the CLI and prove what the workspace offers", "连接 CLI，并确认工作区提供了哪些能力"),
        local: t("Check-All-LLM-Status: one screen that lists every service and model on the machine.", "Check-All-LLM-Status：一屏列出本机所有服务和模型。"),
        links: ["ops.inventory", "inference.budget"],
        after: [],
        why: t(
          "Everything later assumes four things: you can log in with OAuth, Unity Catalog is enabled, the model endpoints you plan to use exist in your region, and there is a SQL warehouse. Finding out at step [[agent]] that the workspace has no Qwen endpoint costs a day. Finding out now costs a minute.",
          "后面的每一步都假定四件事成立：你能用 OAuth 登录，Unity Catalog 已启用，你打算使用的模型端点在你的区域存在，并且有一个 SQL warehouse。到第 [[agent]] 步才发现工作区没有 Qwen 端点，会浪费一天；现在就发现，只花一分钟。",
        ),
        what: t(
          "Logs the CLI in under a named profile, mints an OAuth token, and lists catalogs, serving endpoints and warehouses. It is the Databricks version of the local inventory: what exists, before you build on it.",
          "用一个具名 profile 登录 CLI，生成 OAuth 令牌，并列出 catalog、服务端点和 warehouse。这是本地资产清单的 Databricks 版本：在动手之前先弄清有什么。",
        ),
        how: [
          t("Install a recent Databricks CLI (one that has the `bundle` and `apps` command groups).", "安装较新版本的 Databricks CLI（需要带有 `bundle` 和 `apps` 命令组）。"),
          t("Set DATABRICKS_HOST to your workspace URL and run the script. A browser opens once for the OAuth login.", "把 DATABRICKS_HOST 设为你的工作区 URL，然后运行脚本。浏览器会弹出一次用于 OAuth 登录。"),
          t("Save the printed endpoint list. Step 4 compares it with the lineup.", "保存打印出来的端点列表。第 [[lineup]] 步会拿它和模型阵容做对比。"),
          t("Export DATABRICKS_CONFIG_PROFILE=agent in your shell so the Python SDK uses the same login.", "在 shell 里 export DATABRICKS_CONFIG_PROFILE=agent，让 Python SDK 使用同一个登录。"),
        ],
        files: ["replicate/databricks/setup/00_workspace.sh"],
        interpret: [
          t("`token: ok` means OAuth works. The deployed agent accepts only OAuth tokens, so if this fails, nothing later will answer you.", "`token: ok` 说明 OAuth 可用。已部署的智能体只接受 OAuth 令牌，所以这里失败的话，后面没有任何东西会回应你。"),
          t("The endpoint list is the truth for your workspace. The vendor's model page lists what exists somewhere; your region may have fewer.", "端点列表才是你这个工作区的真实情况。厂商的模型页面列的是某处存在的模型，你所在的区域可能更少。"),
          t("No warehouse in the list means you cannot run the SQL files in steps [[catalog]] and [[tools]] yet. Ask an admin for one, or create a serverless warehouse.", "列表里没有 warehouse，说明你还不能运行第 [[catalog]] 步和第 [[tools]] 步的 SQL 文件。请管理员开一个，或者自己创建一个 serverless warehouse。"),
        ],
        trouble: [
          { s: t("`databricks auth login` opens no browser or hangs", "`databricks auth login` 没有打开浏览器，或者卡住"), c: t("Remote shell or a blocked localhost callback port.", "处于远程 shell 中，或者 localhost 回调端口被拦截。"), f: t("Run it on a machine with a browser, then copy ~/.databrickscfg; or use a service principal with client ID and secret (M2M).", "在有浏览器的机器上运行，再复制 ~/.databrickscfg；或者改用带 client ID 和 secret 的服务主体（M2M）。") },
          { s: t("`catalogs list` returns an error about Unity Catalog", "`catalogs list` 报 Unity Catalog 相关的错误"), c: t("The workspace is not attached to a metastore.", "工作区没有挂载 metastore。"), f: t("An account admin must assign a metastore. Nothing in this guide works without Unity Catalog.", "需要账号管理员分配 metastore。没有 Unity Catalog，本指南里的任何步骤都无法进行。") },
          { s: t("`unknown command \"bundle\"` or `\"apps\"`", "`unknown command \"bundle\"` 或 `\"apps\"`"), c: t("An old CLI, often the legacy pip package named databricks-cli.", "CLI 版本太旧，常见的是名为 databricks-cli 的旧版 pip 包。"), f: t("Uninstall the pip package and install the current CLI from the vendor's setup-cli script or Homebrew tap.", "卸载这个 pip 包，用厂商的 setup-cli 脚本或 Homebrew tap 安装当前版本的 CLI。") },
        ],
        done: t("All five sections print, and the endpoint list contains at least one chat model and one embedding model.", "五个部分都有输出，且端点列表里至少有一个对话模型和一个 embedding 模型。"),
        unconfirmed: t("The `-o json` output shapes of `serving-endpoints list` and `warehouses list` differ between CLI versions; the script accepts both a list and an object.", "不同 CLI 版本中 `serving-endpoints list` 和 `warehouses list` 的 `-o json` 输出结构不同；脚本两种结构（列表和对象）都能处理。"),
      },
      {
        id: "catalog",
        title: t("Create the catalog, schemas, volume and core tables", "创建 catalog、schema、volume 和核心表"),
        local: t("The folder layout under the AI data drive, the Postgres schema, and the read-only sealed eval folder.", "AI 数据盘下的目录结构、Postgres 的表结构，以及只读封存的评估目录。"),
        links: ["state.schema", "knowledge.taxonomy", "evaluation.seal"],
        after: ["workspace"],
        why: t(
          "Permissions in Unity Catalog attach to catalogs, schemas, tables and volumes. If you put chunks, logs and sealed eval questions in one schema, you cannot give the jobs write access to chunks without also letting them edit the exam. Splitting by concern on day one makes the seal a grant, not a promise.",
          "Unity Catalog 的权限是挂在 catalog、schema、表和 volume 上的。如果把文本块、日志和封存的评估问题放在同一个 schema，你就没法只给 job 文本块的写权限，而不同时让它能改考题。第一天就按职责拆分，封存就成了一条授权，而不是一句承诺。",
        ),
        what: t(
          "Creates catalog agentlab with schemas kb, ops and evals, a volume for raw files, the ledger and chunk tables with change data feed on, a findings table, and the grants that separate builders, jobs and the eval owner.",
          "创建 catalog agentlab 及其下的 kb、ops、evals 三个 schema，一个存放原始文件的 volume，开启了 change data feed 的台账表和文本块表，一张 findings 表，以及区分开发者、job 和评估负责人的授权。",
        ),
        how: [
          t("Open the SQL editor, attach a warehouse, paste the file and run it as a user who can create catalogs.", "打开 SQL 编辑器，挂上 warehouse，粘贴文件内容，以有权限创建 catalog 的用户身份运行。"),
          t("Replace `agent-builders` and `agent-jobs-sp` with your group and your jobs' service principal before the GRANT lines.", "在执行 GRANT 语句前，把 `agent-builders` 和 `agent-jobs-sp` 换成你的用户组和 job 的服务主体。"),
          t("Keep `delta.enableChangeDataFeed = true` on chunks. Both retrieval backends need it for incremental sync.", "文本块表上要保留 `delta.enableChangeDataFeed = true`。两种检索后端做增量同步都依赖它。"),
          t("If you rename the catalog, set AGENT_CATALOG everywhere; config.py reads every name from the environment.", "如果你改了 catalog 名字，请在所有地方设置 AGENT_CATALOG；config.py 的所有名字都从环境变量读取。"),
        ],
        files: ["replicate/databricks/setup/01_catalog.sql", "replicate/databricks/src/common/config.py"],
        interpret: [
          t("`SHOW GRANTS ON SCHEMA agentlab.evals` must show SELECT for builders and no MODIFY for anyone except the owner. That line is the seal.", "`SHOW GRANTS ON SCHEMA agentlab.evals` 应该显示开发者只有 SELECT，除负责人外没有人有 MODIFY。这一行就是封存。"),
          t("The PRIMARY KEY on chunks is informational in Delta (not enforced), but the index and the synced table both read it as the key, so keep chunk_id unique yourself. ingest.py does, by MERGE.", "文本块表上的 PRIMARY KEY 在 Delta 中只是信息性的（不强制），但索引和同步表都会把它当作主键，所以你自己必须保证 chunk_id 唯一。ingest.py 用 MERGE 做到了这一点。"),
        ],
        trouble: [
          { s: t("PERMISSION_DENIED on CREATE CATALOG", "CREATE CATALOG 报 PERMISSION_DENIED"), c: t("Only metastore admins or users with CREATE CATALOG can create one.", "只有 metastore 管理员或拥有 CREATE CATALOG 权限的用户才能创建。"), f: t("Ask for a catalog to be created for you, then run the rest with AGENT_CATALOG set to its name.", "请管理员为你创建一个 catalog，然后把 AGENT_CATALOG 设为它的名字，再运行其余部分。") },
          { s: t("PRIMARY KEY constraint rejected", "PRIMARY KEY 约束被拒绝"), c: t("Informational constraints need the column to be NOT NULL and a recent runtime or warehouse.", "信息性约束要求该列为 NOT NULL，并且需要较新的运行时或 warehouse。"), f: t("Keep NOT NULL on chunk_id; if your warehouse still refuses, drop the constraint line. The index takes the key as an argument anyway.", "保留 chunk_id 上的 NOT NULL；如果 warehouse 仍然拒绝，就删掉约束那一行。索引本来就会把主键作为参数传入。") },
          { s: t("GRANT fails with principal not found", "GRANT 报找不到主体"), c: t("The group or service principal name does not exist in the account.", "账号里不存在这个用户组或服务主体名。"), f: t("Create the group and the service principal first (admin UI), then rerun only the GRANT lines.", "先在管理界面创建用户组和服务主体，然后只重跑 GRANT 语句。") },
        ],
        done: t("The four schemas-and-volume objects exist and SHOW GRANTS matches the three roles.", "四个 schema 和 volume 对象都已存在，SHOW GRANTS 的结果与三种角色相符。"),
      },
      {
        id: "secrets",
        title: t("Put secrets in a secret scope and create the service principal", "把密钥放进 secret scope，并创建服务主体"),
        local: t(".env files with chmod 600, the gateway's issued keys, and the funnel secret.", "chmod 600 的 .env 文件、网关签发的密钥，以及 funnel 的 secret。"),
        links: ["api-gateway.keys", "api-gateway.issue"],
        after: ["workspace"],
        why: t(
          "Models hosted by Databricks need no key, so the secret list is shorter than on the Mac. What remains (an external tool token, the public tutor's credentials) must never appear in a notebook, a bundle file or git. A scope is the only place code reads them from by name, and reading is itself a permission.",
          "Databricks 托管的模型不需要密钥，所以需要管理的密钥比 Mac 上少。剩下的那些（外部工具的令牌、公开教程站的凭证）绝不能出现在 notebook、bundle 文件或 git 里。scope 是代码按名字读取密钥的唯一地方，而读取本身也是一种权限。",
        ),
        what: t(
          "Creates scope `agent`, shows how to put a secret from stdin so it stays out of shell history, and names the service principal that jobs and the eval will run as.",
          "创建名为 `agent` 的 scope，演示如何通过 stdin 写入密钥，使其不进入 shell 历史，并指明 job 和评估将以哪个服务主体身份运行。",
        ),
        how: [
          t("Run the script. Uncomment the `put` line only for secrets that live outside Databricks.", "运行脚本。只有存在于 Databricks 之外的密钥才需要取消 `put` 那一行的注释。"),
          t("Create a service principal in the admin UI, add it to `agent-jobs-sp`, and generate an OAuth secret for it.", "在管理界面创建服务主体，把它加入 `agent-jobs-sp`，并为它生成 OAuth secret。"),
          t("Store that client ID and secret in your password manager, not in the scope it is used to read.", "把这个 client ID 和 secret 存进你的密码管理器，而不是存进它要读取的那个 scope。"),
        ],
        files: ["replicate/databricks/setup/02_secrets.sh"],
        code: [{ lang: "python", text: `# inside a job or notebook
token = dbutils.secrets.get(scope="agent", key="external-tool-token")
print(token)   # prints [REDACTED]: notebooks mask secret values on output` }],
        interpret: [
          t("`list-secrets` shows key names and timestamps, never values. If you can read a value back from the CLI, something is wrong with how it was stored.", "`list-secrets` 只显示键名和时间戳，从不显示值。如果你能从 CLI 读回密钥的值，说明存储方式出了问题。"),
          t("[REDACTED] in notebook output is the platform masking the value, not proof the secret is right. Test it by using it.", "notebook 输出中的 [REDACTED] 是平台在遮蔽这个值，并不能证明密钥是对的。要验证，就实际用一次。"),
        ],
        trouble: [
          { s: t("`create-scope` fails: scope already exists", "`create-scope` 失败：scope 已存在"), c: t("A previous run created it.", "之前的运行已经创建过了。"), f: t("Harmless; the script continues. Use `list-scopes` to confirm the owner.", "无害，脚本会继续执行。可用 `list-scopes` 确认所有者。") },
          { s: t("A job gets PERMISSION_DENIED reading a secret", "job 读取密钥时报 PERMISSION_DENIED"), c: t("The job runs as the service principal, which has no READ on the scope.", "job 以服务主体身份运行，而它对该 scope 没有 READ 权限。"), f: t("`databricks secrets put-acl agent <sp-application-id> READ`.", "`databricks secrets put-acl agent <sp-application-id> READ`。") },
        ],
        done: t("The scope exists, the service principal exists and is in the jobs group.", "scope 已存在，服务主体已存在并已加入 job 用户组。"),
        unconfirmed: t("The `put-acl` command form in the troubleshooting line is from the CLI's command list, not from the secrets page read for this guide.", "排障那一行中 `put-acl` 的命令写法来自 CLI 的命令列表，而不是本指南参考的密钥文档页面。"),
      },
    ],
  },
  {
    id: "models",
    title: t("Models: the lineup and the gateway", "模型：模型阵容与网关"),
    goal: t(
      "On the Mac you chose models by what fit in unified memory and measured them yourself. On Databricks memory is not your problem, availability and latency from your region are. The rule that carries over unchanged: measure first, then choose, and never switch models after the first token.",
      "在 Mac 上，你按统一内存能装下什么来选模型，并亲自测量。在 Databricks 上，内存不再是你的问题，你所在区域的可用性和延迟才是。原样保留的规则是：先测量再选择，首个 token 发出后绝不换模型。",
    ),
    steps: [
      {
        id: "lineup",
        title: t("Choose the lineup by measuring it", "通过测量来确定模型阵容"),
        local: t("ollama-env.sh and model_catalog.json: default qwen3.8:27b, fast qwen3.6:35b-a3b, cloud fallback gemini flash lite.", "ollama-env.sh 和 model_catalog.json：默认 qwen3.8:27b，快速 qwen3.6:35b-a3b，云端兜底 gemini flash lite。"),
        links: ["inference.measure", "inference.latency", "inference.contract"],
        after: ["workspace"],
        why: t(
          "The lineup decides latency, cost and answer quality for everything after it, and the embedding model decides the index. Changing the embedding model later means re-embedding every chunk, so it is chosen here, once, and recorded. Time to first token is what the user feels; it varies by endpoint and by hour, so the number must come from your workspace.",
          "模型阵容决定了后续所有环节的延迟、成本和回答质量，而 embedding 模型决定了索引。日后更换 embedding 模型意味着要重新嵌入每一个文本块，所以要在这里一次选定并记录下来。首 token 时间是用户直接感受到的，它随端点和时段变化，所以这个数字必须来自你自己的工作区。",
        ),
        what: t(
          "Checks which of the configured endpoints exist, streams the same prompt three times through each chat model and prints the median time to first token and tokens per second, then prints the embedding dimension.",
          "检查配置中的端点哪些存在，对每个对话模型用同一个提示词流式请求三次，打印首 token 时间和每秒 token 数的中位数，然后打印 embedding 的维度。",
        ),
        how: [
          t("`pip install -U databricks-sdk databricks-openai` on your laptop.", "在你的笔记本上执行 `pip install -U databricks-sdk databricks-openai`。"),
          t("Run `python replicate/databricks/src/models/bench.py` with your profile exported.", "export 好 profile 后，运行 `python replicate/databricks/src/models/bench.py`。"),
          t("If an endpoint is MISSING, pick the nearest one from step [[workspace]]'s list and set AGENT_CHAT_DEFAULT, AGENT_CHAT_FAST or AGENT_CHAT_FALLBACK.", "如果某个端点显示 MISSING，就从第 [[workspace]] 步的列表里挑最接近的一个，设置 AGENT_CHAT_DEFAULT、AGENT_CHAT_FAST 或 AGENT_CHAT_FALLBACK。"),
          t("Run it again at a busy hour. Keep the slower of the two numbers.", "在繁忙时段再跑一次。两次结果取较慢的那个。"),
          t("Set AGENT_EMBEDDING_DIM to the printed dimension. Never change it without re-embedding.", "把 AGENT_EMBEDDING_DIM 设为打印出的维度。没有重新嵌入的话，绝不要改它。"),
        ],
        files: ["replicate/databricks/src/models/bench.py"],
        interpret: [
          t("The mapping from the local lineup: databricks-qwen35-122b-a10b stands in for the 27B default (a mixture of experts with 10B active), databricks-qwen3-next-80b-a3b-instruct for the 35B-A3B fast model (3B active, the same idea), and databricks-gemini-3-5-flash-lite is the same family as the local cloud fallback.", "与本地阵容的对应关系：databricks-qwen35-122b-a10b 替代 27B 默认模型（混合专家，激活 10B），databricks-qwen3-next-80b-a3b-instruct 替代 35B-A3B 快速模型（激活 3B，思路相同），databricks-gemini-3-5-flash-lite 与本地的云端兜底属于同一系列。"),
          t("A first token under about 1.5 s feels immediate in chat. Above 4 s, users start retyping. Compare with your local numbers from module 1: if the hosted model is slower than the Mac, the tutor's local-first chain was the right call for interactive use.", "对话中首 token 在约 1.5 秒以内会让人觉得是即时的；超过 4 秒，用户就会开始重新输入。和第 1 模块中的本地数据比较：如果托管模型比 Mac 还慢，说明教程站“本地优先”的链路对交互场景是正确的选择。"),
          t("A wide ttft_spread (for example 0.8 to 6 s) means a shared, loaded endpoint. That is an argument for the fast model on chat turns, or for provisioned throughput if the workload justifies it.", "如果 ttft_spread 很宽（例如 0.8 到 6 秒），说明这是一个共享且负载较高的端点。这就是对话轮次改用快速模型的理由，或者在工作负载足够大时改用预置吞吐量（provisioned throughput）。"),
          t("tok_s is estimated at 4 characters per token, as in module 1. Use it to compare models with each other, not as an exact figure.", "tok_s 按每 token 4 个字符估算，与第 1 模块相同。用它来比较模型之间的快慢，不要当作精确数字。"),
        ],
        trouble: [
          { s: t("Every model prints MISSING", "所有模型都显示 MISSING"), c: t("Foundation Model APIs are not enabled in the workspace, or the region has none of these names.", "工作区没有启用 Foundation Model API，或者该区域没有这些名字的模型。"), f: t("Pick names from step [[workspace]]'s list. If the list has no `databricks-` chat models at all, an admin must enable Foundation Model APIs.", "从第 [[workspace]] 步的列表里选名字。如果列表里完全没有 `databricks-` 开头的对话模型，就需要管理员启用 Foundation Model API。") },
          { s: t("FAILED RateLimitError or HTTP 429", "报 FAILED RateLimitError 或 HTTP 429"), c: t("Pay-per-token endpoints have per-workspace rate limits, and a gateway rate limit may also apply.", "按 token 计费的端点有工作区级别的限流，网关层面的限流也可能生效。"), f: t("Rerun with fewer runs; for production traffic, request higher limits or use provisioned throughput.", "减少运行次数后重跑；生产流量的话，申请更高的限额或改用预置吞吐量。") },
          { s: t("`stream ended with no text`", "报 `stream ended with no text`"), c: t("Some reasoning models stream reasoning first, or the endpoint does not support streaming chat.", "有些推理模型会先流式输出推理内容，或者该端点不支持流式对话。"), f: t("Try the model without stream=True in a notebook to see the response shape, then choose another model for the chat role.", "在 notebook 里去掉 stream=True 试一下，看看响应的结构，然后为对话角色换一个模型。") },
        ],
        done: t("You have three present chat models with measured numbers and a recorded embedding dimension.", "你已有三个可用的对话模型及其实测数据，并记录了 embedding 的维度。"),
        unconfirmed: t("Endpoint names were read from the supported-models page in October 2026. Availability per region was not confirmed; the script exists to check it.", "端点名称来自 2026 年 10 月的支持模型页面。各区域的可用性未经确认；这个脚本就是用来检查这一点的。"),
      },
      {
        id: "gateway",
        title: t("Route through the gateway and keep the fallback rule", "经由网关路由，并保留兜底规则"),
        local: t("The agent-server gateway: keys, rate limits, quotas, and model_router.py with the primary, secondary, cloud chain.", "agent-server 网关：密钥、限流、配额，以及按主模型、次模型、云端顺序工作的 model_router.py。"),
        links: ["api-gateway.route", "inference.router", "api-gateway.handler"],
        after: ["lineup", "secrets"],
        why: t(
          "On the Mac the gateway was your code: it checked keys, counted requests and swapped models. On Databricks the Unity Gateway does the first two for every endpoint, centrally, with usage logged. What it cannot know is your task: whether a turn is chat or analysis. So availability moves to the platform and task routing stays in your code, with the same rule as before: fall back only before the first token.",
          "在 Mac 上，网关是你自己的代码：它检查密钥、统计请求、切换模型。在 Databricks 上，Unity Gateway 会集中为每个端点完成前两件事，并记录用量。它无法知道的是你的任务：这一轮是闲聊还是分析。所以可用性交给平台，任务路由留在你的代码里，规则和以前一样：只在首个 token 之前兜底。",
        ),
        what: t(
          "router.py builds the ordered lineup for a task and streams from the first model that produces text, recording why each earlier one failed. The gateway configuration (rate limits, usage tracking, inference tables, fallbacks) is set in the Unity Gateway UI.",
          "router.py 为某个任务构建有序的模型阵容，从第一个产出文本的模型开始流式输出，并记录前面每个模型失败的原因。网关配置（限流、用量追踪、推理表、兜底）在 Unity Gateway 界面里设置。",
        ),
        how: [
          t("In the Unity Gateway UI, for each endpoint in the lineup, turn on usage tracking and an inference table in agentlab.ops.", "在 Unity Gateway 界面中，为阵容里的每个端点开启用量追踪，并在 agentlab.ops 下开启推理表。"),
          t("Set a per-user rate limit. Start at the limit your local gateway used per key; it is the same protection against one runaway client.", "设置每用户的限流。起点可以用本地网关为每个密钥设置的限额；它防范的是同一件事：某个客户端失控。"),
          t("Use the agent code's client with `use_ai_gateway=True` so calls are governed and logged.", "智能体代码中的客户端使用 `use_ai_gateway=True`，这样调用就会受到治理并被记录。"),
          t("Keep router.py for task choice. Use gateway fallbacks only for the same task's availability.", "任务选择仍由 router.py 负责。网关的兜底只用于同一任务下的可用性。"),
        ],
        files: ["replicate/databricks/src/models/router.py"],
        code: [{ lang: "python", text: `from databricks_openai import DatabricksOpenAI
from models.router import stream_with_fallback

client = DatabricksOpenAI()
for model, delta in stream_with_fallback(client, [{"role": "user", "content": "hello"}], task="fast"):
    print(delta, end="", flush=True)
print("\\nanswered by", model)` }],
        interpret: [
          t("`answered by` names the model that produced the first token. If it is often the fallback, the primary is unhealthy or too slow for your first-token timeout. Look at the gateway's usage before raising the timeout.", "`answered by` 显示的是产出首个 token 的模型。如果经常是兜底模型，说明主模型不健康，或者对你设定的首 token 超时来说太慢。在调大超时之前，先看看网关的用量数据。"),
          t("`No model answered. a: reason | b: reason` lists every attempt. That is the same message format as the tutor on this site, so a failure reads the same in both places.", "`No model answered. a: reason | b: reason` 会列出每一次尝试。这和本站教程使用的消息格式相同，所以两处的失败信息读起来是一样的。"),
          t("The inference table is your new requests.jsonl. Module 15's log lessons apply: read it incrementally, by timestamp, never by full scan.", "推理表就是你新的 requests.jsonl。第 15 模块中关于日志的经验同样适用：按时间戳增量读取，绝不全表扫描。"),
        ],
        trouble: [
          { s: t("A user sees half an answer followed by a different style of answer", "用户看到半个回答后面接着另一种风格的回答"), c: t("Something retried after text was sent: a gateway fallback on a streaming request, or your own retry wrapper.", "在文本已经发出之后又发生了重试：可能是流式请求上的网关兜底，也可能是你自己写的重试包装。"), f: t("Retries and fallbacks belong before the first token only. router.py re-raises once `sent` is true; keep any wrapper the same.", "重试和兜底只能发生在首个 token 之前。router.py 在 `sent` 为真后会直接抛出异常；你写的任何包装都要保持同样的行为。") },
          { s: t("429 from the gateway in tests, not from the model", "测试时 429 来自网关，而不是模型"), c: t("Your per-user rate limit applies to your test runs too.", "你设置的每用户限流同样作用于你的测试运行。"), f: t("Run evals as the service principal with its own limit.", "以服务主体身份运行评估，并给它单独的限额。") },
          { s: t("No rows in the inference table", "推理表里没有数据"), c: t("The table is created empty when you enable it and fills only for requests through the gateway, with some delay.", "开启时表是空的，只有经过网关的请求才会写入，而且会有一些延迟。"), f: t("Check that the client uses the gateway, send a request, and wait several minutes before concluding.", "检查客户端是否走了网关，发送一个请求，等几分钟再下结论。") },
        ],
        done: t("A request through the router answers, appears in gateway usage, and a forced failure of the first model falls through to the second before any text.", "通过路由器发出的请求能得到回答，并出现在网关用量中；人为让第一个模型失败时，会在任何文本输出之前转到第二个模型。"),
        unconfirmed: t("Rate-limit field names, fallback configuration and the inference table schema are set in the UI and were not shown on the gateway page read for this guide. The `timeout=` keyword is passed through the OpenAI client.", "限流字段名、兜底配置和推理表结构都在界面中设置，本指南参考的网关页面没有展示这些。`timeout=` 参数是经由 OpenAI 客户端传入的。"),
      },
    ],
  },
  {
    id: "knowledge",
    title: t("Knowledge: files, ledger, chunks, graph", "知识：文件、台账、文本块、图"),
    goal: t(
      "The knowledge bank moves from a folder to a volume, the ledger from SQLite or Postgres rows to a Delta table, and the chunker from a script to a job. The validation, tier and chunking rules do not change at all: chunking.py is the same logic, and it is tested in this repository.",
      "知识库从一个文件夹搬到 volume，台账从 SQLite 或 Postgres 的行变成 Delta 表，切块器从脚本变成 job。校验、等级和切块规则完全不变：chunking.py 的逻辑与本地相同，并且在本仓库中经过测试。",
    ),
    steps: [
      {
        id: "upload",
        title: t("Upload the knowledge bank to the volume", "把知识库上传到 volume"),
        local: t("knowledge-bank/ with its folder taxonomy, source_authority.json, and the publish denylist.", "knowledge-bank/ 及其目录分类、source_authority.json，以及发布用的拒绝清单。"),
        links: ["knowledge.taxonomy", "knowledge.tiers"],
        after: ["catalog"],
        why: t(
          "Folders carry meaning: the authority tier of a file comes from its path. Upload with the same tree and the tier rules work unchanged. The denylist runs before upload, because a file that reaches the volume is readable by every principal with READ VOLUME, and deleting it later does not undo an index built from it.",
          "目录本身带有含义：文件的权威等级来自它的路径。按同样的目录树上传，等级规则就无需改动。拒绝清单必须在上传之前执行，因为文件一旦进入 volume，所有拥有 READ VOLUME 权限的主体都能读到，事后删除也撤销不了已经基于它建好的索引。",
        ),
        what: t(
          "Copies the bank to a temporary staging folder without the denylisted paths, prints the file count, and uploads the staging folder recursively to /Volumes/agentlab/kb/raw.",
          "把知识库复制到临时暂存目录（排除拒绝清单中的路径），打印文件数，然后把暂存目录递归上传到 /Volumes/agentlab/kb/raw。",
        ),
        how: [
          t("Edit the --exclude lines to match your denylist. Treat the list as code: review changes to it.", "修改 --exclude 行，使其与你的拒绝清单一致。把这份清单当代码对待：对它的改动要经过审查。"),
          t("Run `bash replicate/databricks/setup/03_upload_knowledge.sh /path/to/knowledge-bank`.", "运行 `bash replicate/databricks/setup/03_upload_knowledge.sh /path/to/knowledge-bank`。"),
          t("Make sure source_authority.json lands at the volume root. ingest.py reads it from there.", "确保 source_authority.json 位于 volume 根目录。ingest.py 从那里读取它。"),
        ],
        files: ["replicate/databricks/setup/03_upload_knowledge.sh"],
        interpret: [
          t("Compare `files to upload` with a count of the local folder. The difference must equal what the denylist removed, no more.", "把 `files to upload` 与本地目录的文件数比较。差额应当恰好等于拒绝清单排除的数量，不能更多。"),
          t("`fs ls` on the volume root shows the top-level collections. Each becomes a value of the `collection` column, which the search tool filters on.", "对 volume 根目录执行 `fs ls` 会显示顶层的集合。每个集合都会成为 `collection` 列的一个取值，检索工具会按它过滤。"),
        ],
        trouble: [
          { s: t("`fs cp` fails with a path error", "`fs cp` 报路径错误"), c: t("The volume path needs the `dbfs:/Volumes/...` form for the CLI.", "CLI 要求 volume 路径使用 `dbfs:/Volumes/...` 的形式。"), f: t("Keep the dbfs: prefix as in the script, and check the catalog, schema and volume names.", "像脚本里那样保留 dbfs: 前缀，并核对 catalog、schema 和 volume 的名字。") },
          { s: t("Upload is slow for many small files", "大量小文件上传很慢"), c: t("Each file is a separate request.", "每个文件都是一个单独的请求。"), f: t("Upload a tar file and extract it in a job, or upload once and let later runs copy only changed files (rsync to staging first does this locally).", "上传一个 tar 包，在 job 里解压；或者只全量上传一次，之后只复制改动过的文件（先 rsync 到暂存目录就能在本地做到这一点）。") },
        ],
        done: t("The volume tree matches the local tree minus the denylist, with source_authority.json at the root.", "volume 中的目录树与本地目录树一致（去掉拒绝清单部分），且根目录有 source_authority.json。"),
        unconfirmed: t("The `fs cp -r --overwrite` flags are the CLI's general file commands; the volume-specific upload page was not read for this guide.", "`fs cp -r --overwrite` 这些参数属于 CLI 的通用文件命令；本指南没有参考 volume 专门的上传文档页。"),
      },
      {
        id: "ingest",
        title: t("Validate, record in the ledger, and chunk, as one idempotent job", "校验、记入台账、切块，合成一个幂等的 job"),
        local: t("Intake from _inbox, magic-byte validation, the ledger, kb_extract.py, and the cursor that made reruns change nothing.", "从 _inbox 收件、按魔数校验、台账、kb_extract.py，以及让重跑不产生任何变化的游标。"),
        links: ["knowledge.validate", "knowledge.ledger", "knowledge.intake", "rag-graph.chunk", "state.merge"],
        after: ["upload", "lineup"],
        why: t(
          "Every later stage reads the chunk table, so its correctness bounds everything. Idempotence is the property that lets the job run hourly: a file that did not change is skipped by hash, a file that changed retires its old chunks before the new ones go in, and a file that turned bad takes its chunks out of service. Without the retire step, a shortened document keeps answering with paragraphs it no longer has.",
          "后面所有阶段都读取文本块表，所以它的正确性决定了一切的上限。幂等性让这个 job 可以每小时运行：未变化的文件按哈希跳过；变化了的文件先停用旧文本块，再写入新的；变坏的文件会让它的文本块退出服务。没有停用这一步，一份被删短的文档仍会用它已经不存在的段落来回答。",
        ),
        what: t(
          "Reads every file in the volume, hashes it, skips known hashes, validates the rest with the local rules, MERGEs ledger rows, chunks text files by heading with the heading path kept as context, retires stale chunks, MERGEs new ones, and optionally embeds `context + text` with the step [[lineup]] embedding model.",
          "读取 volume 中的每个文件并计算哈希，跳过已知哈希，用本地规则校验其余文件，MERGE 台账行，对文本文件按标题切块并保留标题路径作为上下文，停用过期的文本块，MERGE 新的文本块，并可选地用第 [[lineup]] 步的 embedding 模型对 `context + text` 做嵌入。",
        ),
        how: [
          t("Deploy it with the bundle (step [[deploy]]), or for a first run upload src/ to the workspace and run ingest.py as a one-off job task.", "用 bundle 部署（第 [[deploy]] 步）；或者首次运行时，把 src/ 上传到工作区，把 ingest.py 作为一次性 job 任务运行。"),
          t("Pass `--backend` with your choice from step [[choose]] (the bundle passes it from a variable). `lakebase` makes the job compute embeddings; AI Search computes them itself.", "用 `--backend` 传入你在第 [[choose]] 步的选择（bundle 会从变量中传入）。选 `lakebase` 时 job 会自己计算 embedding；AI Search 则由平台计算。"),
          t("For PDF and DOCX, install your extractor as a job dependency and emit the same chunk tuple where the comment says. The rest of the job does not change.", "对于 PDF 和 DOCX，把你的提取器作为 job 依赖安装，在注释标明的位置产出同样结构的文本块元组。job 的其余部分不用改。"),
          t("Run it twice. The second run must print `changed 0`.", "运行两次。第二次必须打印 `changed 0`。"),
        ],
        files: ["replicate/databricks/src/knowledge/ingest.py", "replicate/databricks/src/knowledge/chunking.py"],
        interpret: [
          t("`changed N, unchanged M`: on the first run M is 0; on every later run N should equal the files you actually touched. A large N with no edits means hashes are not being compared, usually because the ledger table was recreated.", "`changed N, unchanged M`：首次运行时 M 为 0；之后每次运行，N 应当等于你实际改动过的文件数。没改文件却出现很大的 N，说明没在比对哈希，通常是因为台账表被重建了。"),
          t("`rejected` lines name the file and the reason. `not a real .pdf file` is the module 3 lesson: an export renamed by hand. Fix the source, never the validator.", "`rejected` 行会列出文件名和原因。`not a real .pdf file` 就是第 3 模块的教训：手动改了扩展名的导出文件。要修的是源文件，而不是校验器。"),
          t("Check one chunk's context column. `Travel > Section 5 Lodging` means the heading path survived; an empty context on a long policy means the file has no markdown headings and will retrieve worse.", "查看某个文本块的 context 列。`Travel > Section 5 Lodging` 说明标题路径保留下来了；如果一份很长的政策文档 context 为空，说明它没有 markdown 标题，检索效果会更差。"),
        ],
        trouble: [
          { s: t("ModuleNotFoundError: common", "ModuleNotFoundError: common"), c: t("The script ran without the rest of src/ next to it.", "运行脚本时，src/ 的其他部分没有和它放在一起。"), f: t("Deploy the whole src/ folder (the bundle does). Each script adds its parent src/ to sys.path.", "部署整个 src/ 目录（bundle 会这样做）。每个脚本都会把它上级的 src/ 加进 sys.path。") },
          { s: t("MERGE fails: multiple source rows matched", "MERGE 失败：多个源行匹配同一目标行"), c: t("Two files produced the same chunk_id, or the same file appears twice under different path spellings.", "两个文件产出了相同的 chunk_id，或者同一个文件以不同的路径写法出现了两次。"), f: t("chunk_id is `<relative path>::<index>`; make sure the volume has no duplicate folders differing only by case.", "chunk_id 的格式是 `<相对路径>::<序号>`；确保 volume 里没有仅大小写不同的重复目录。") },
          { s: t("Embedding step is slow or rate-limited", "嵌入步骤很慢或被限流"), c: t("Pay-per-token embedding has throughput limits; the first run embeds everything.", "按 token 计费的 embedding 有吞吐量上限；首次运行要嵌入全部内容。"), f: t("Lower the batch size, run the first load off-hours, or use AI Search with managed embeddings instead.", "调小 batch 大小，在非高峰时段做首次加载，或者改用由 AI Search 托管 embedding 的方式。") },
        ],
        done: t("Two consecutive runs: the first loads, the second prints `changed 0`. A deliberately renamed bad file appears as rejected and has no chunks.", "连续运行两次：第一次加载，第二次打印 `changed 0`。故意改名的坏文件显示为 rejected，并且没有任何文本块。"),
        unconfirmed: t("Reading source_authority.json with open() on the /Volumes path relies on volumes being mounted as files on the job's compute, which is how serverless and Unity Catalog compute expose them.", "在 /Volumes 路径上用 open() 读取 source_authority.json，依赖于 volume 在 job 计算资源上以文件形式挂载，serverless 和 Unity Catalog 计算正是这样提供 volume 的。"),
      },
      {
        id: "edges",
        title: t("Build graph edges as a table", "把图的边建成一张表"),
        local: t("nightly/defines.py and nightly/citations.py: definition edges and 'see Section N' citation edges.", "nightly/defines.py 和 nightly/citations.py：定义边和“见第 N 节”引用边。"),
        links: ["rag-graph.edges", "rag-graph.expand"],
        after: ["ingest"],
        why: t(
          "Dense and lexical search find passages that look like the question. They do not follow 'see Section 5' or find where a term is defined. Those links are deterministic and cheap to extract, and a table of three columns is all a graph needs at this size. No graph database is required, and none was used locally either.",
          "稠密检索和词法检索找到的是看起来像问题的段落。它们不会顺着“见第 5 节”走，也找不到某个术语是在哪里定义的。这些链接是确定性的，提取成本很低；在这个规模下，一张三列的表就是图所需的全部。不需要图数据库，本地也没有用。",
        ),
        what: t(
          "Reads chunks in service, applies the three edge rules (section, cites, defines), deduplicates, and overwrites agentlab.kb.edges. Rebuilding from chunks each run means an edge can never outlive the chunk it points to.",
          "读取在服务中的文本块，应用三条边规则（section、cites、defines），去重，然后覆盖写入 agentlab.kb.edges。每次都从文本块重建，意味着边永远不会比它指向的文本块活得更久。",
        ),
        how: [
          t("Run edges.py as the task after ingest (the bundle in step [[jobs]] chains them).", "在 ingest 之后把 edges.py 作为下一个任务运行（第 [[jobs]] 步的 bundle 会把它们串起来）。"),
          t("Look at the printed counts per relation.", "查看打印出来的每种关系的数量。"),
          t("Spot-check five `defines` rows by reading the chunk they point to.", "抽查五行 `defines`，读一读它们指向的文本块。"),
        ],
        files: ["replicate/databricks/src/graph/edges.py"],
        interpret: [
          t("`edges written: {'section': 40, 'cites': 12, 'defines': 9}` is a plausible shape for a policy bank. Zero `section` edges means your headings do not start with 'Section N'; adjust SECTION to your documents' convention.", "`edges written: {'section': 40, 'cites': 12, 'defines': 9}` 对政策类知识库来说是一个合理的分布。`section` 边为零，说明你的标题不是以“Section N”开头的；按你的文档习惯调整 SECTION 正则。"),
          t("A `cites` edge whose target has no `section` edge is a dangling reference. The search tool simply adds nothing for it, which is the safe failure.", "如果某条 `cites` 边的目标没有对应的 `section` 边，就是悬空引用。检索工具对它什么也不会添加，这是安全的失败方式。"),
        ],
        trouble: [
          { s: t("The edges table is empty after a run that printed counts", "运行时打印了数量，但边表是空的"), c: t("The job wrote to a different catalog: --catalog was not passed, so the default was used.", "job 写到了另一个 catalog：没有传入 --catalog，于是用了默认值。"), f: t("Pass --catalog as the bundle does, or set AGENT_CATALOG on the job.", "像 bundle 那样传入 --catalog，或者在 job 上设置 AGENT_CATALOG。") },
          { s: t("Hundreds of `defines` edges for common words", "常用词产生了数百条 `defines` 边"), c: t("The pattern matched sentences like 'This means that...'.", "正则匹配到了 “This means that...” 这类句子。"), f: t("Tighten DEFINES to your glossary format, or require the term to be quoted or bold. Then rerun; the table is rebuilt.", "把 DEFINES 收紧到你的术语表格式，或者要求术语带引号或加粗。然后重跑，表会被重建。") },
        ],
        done: t("The edges table has rows for all three relations, and the module 5 example (a 'see Section 5' chunk) has a cites edge to a section edge.", "边表中三种关系都有数据，第 5 模块的例子（一个写着“见第 5 节”的文本块）有一条 cites 边连到一条 section 边。"),
      },
    ],
  },
  {
    id: "retrieval",
    title: t("Retrieval: choose a backend, keep the ranking", "检索：选择后端，保留排序逻辑"),
    goal: t(
      "This is the phase with a real decision. Two backends can serve the chunks; the ranking that made the local search good (fusion by rank, an authority nudge, dedup, graph expansion, a diagnostic on empty) runs after either one, in your code. The gold set from module 11 decides whether the replica retrieves as well as the original.",
      "这是需要真正做决定的阶段。有两种后端可以提供文本块检索；让本地检索效果好的排序逻辑（按名次融合、权威加权、去重、图扩展、空结果诊断）在任一后端之后都由你的代码执行。第 11 模块的标准集用来判定副本的检索是否和原版一样好。",
    ),
    steps: [
      {
        id: "choose",
        title: t("Decide: Lakebase hybrid or AI Search", "做决定：Lakebase 混合检索还是 AI Search"),
        local: t("Postgres with pgvector and full-text search, hybrid SQL, HNSW, the CTE lesson.", "带 pgvector 和全文检索的 Postgres、混合检索 SQL、HNSW，以及关于 CTE 的教训。"),
        links: ["rag-graph.production", "state.postgres", "rag-graph.fuse"],
        after: ["ingest"],
        why: t(
          "The choice decides who computes embeddings, where BM25 runs, whether you operate a database, and how much of the hybrid query you control. Choosing after building the tool means rewriting the tool. Both options keep Delta as the source of truth, so the choice can be reversed by building the other one from the same table.",
          "这个选择决定了由谁计算 embedding、BM25 在哪里运行、你是否要运维一个数据库，以及你对混合查询有多少控制权。先写检索工具再做选择，就意味着要重写工具。两种方案都以 Delta 作为唯一可信来源，所以这个选择可以撤回：用同一张表再搭建另一种即可。",
        ),
        what: t(
          "A decision, recorded in AGENT_RETRIEVAL. Lakebase: Postgres with pgvector-compatible ANN and BM25 indexes (Lakebase Search), fed by a synced table, closest to the local build. AI Search: a managed Delta Sync index with managed embeddings, nothing to operate, keyword search via query_type FULL_TEXT and fused search via query_type hybrid.",
          "一个决定，记录在 AGENT_RETRIEVAL 中。Lakebase：带 pgvector 兼容的 ANN 和 BM25 索引的 Postgres（Lakebase Search），由同步表供数，最接近本地构建。AI Search：托管的 Delta Sync 索引，embedding 也是托管的，无需运维，关键词检索用 query_type FULL_TEXT，融合检索用 query_type hybrid。",
        ),
        how: [
          t("Choose Lakebase if you want the same SQL, the same index behavior and EXPLAIN plans you can read, and you will also use Lakebase for memory (step [[memory]]).", "如果你想要同样的 SQL、同样的索引行为以及能看懂的 EXPLAIN 执行计划，并且还会用 Lakebase 做记忆（第 [[memory]] 步），就选 Lakebase。"),
          t("Choose AI Search if nobody on the team will operate Postgres. It can fuse dense and keyword results itself (query_type=\"hybrid\"), or return two lists for your own fusion.", "如果团队里没人会运维 Postgres，就选 AI Search。它可以自己融合稠密和关键词结果（query_type=\"hybrid\"），也可以返回两个列表由你自己融合。"),
          t("Set AGENT_RETRIEVAL=lakebase or ai_search. Do steps [[lakebase]] or [[ai-search]] accordingly, then step [[parity]] either way.", "设置 AGENT_RETRIEVAL=lakebase 或 ai_search。相应地做第 [[lakebase]] 步或第 [[ai-search]] 步，然后无论如何都要做第 [[parity]] 步。"),
        ],
        code: [{ lang: "text", text: `                        Lakebase (Postgres + Lakebase Search)   AI Search (Delta Sync index)
embeddings computed by  your ingest job (--embed)               the platform (managed)
dense index             lakebase_ann, cosine                    managed ANN
keyword (BM25)          lakebase_bm25 on a tsvector              query_type="FULL_TEXT"
hybrid query            yours: two SQL lists + RRF in Python    two calls + RRF (default), or query_type="hybrid"
you operate             a Postgres project, a refresh           nothing
EXPLAIN / plan visible  yes                                     no
reuse for memory        yes (same project)                      no
closest to local build  yes                                     no` }],
        interpret: [
          t("If you cannot decide, build Lakebase first. It reproduces the local behavior, so step [[parity]]'s comparison with the local gold numbers is about the platform, not about a different retrieval design.", "如果拿不定主意，先搭 Lakebase。它重现了本地的行为，所以第 [[parity]] 步与本地标准集数据的对比只反映平台差异，而不是检索设计上的差异。"),
          t("Whichever you pick, the ranking constants stay: RRF k = 60, 20 candidates per list, authority weight 0.0004. Module 5 explains why that weight is one rank step near the top.", "无论选哪个，排序常量都不变：RRF k = 60，每个列表 20 个候选，权威加权 0.0004。第 5 模块解释了为什么这个权重恰好相当于头部的一个名次差。"),
        ],
        trouble: [
          { s: t("The workspace has no Lakebase", "工作区里没有 Lakebase"), c: t("Lakebase is not available in every region or tier.", "并非每个区域或套餐都提供 Lakebase。"), f: t("Choose AI Search for retrieval, and keep memory in a Delta table with a small cache in the app until Lakebase is available.", "检索选 AI Search；在 Lakebase 可用之前，把记忆放在 Delta 表中，并在 App 里做一个小缓存。") },
          { s: t("You want both", "两个都想要"), c: t("They serve the same table.", "它们服务的是同一张表。"), f: t("Build both, switch with AGENT_RETRIEVAL, and let the gold set pick. That is a variant comparison, as in module 11.", "两个都搭，用 AGENT_RETRIEVAL 切换，让标准集来选。这就是第 11 模块里的变体对比。") },
        ],
        done: t("AGENT_RETRIEVAL is set and the reason is written down next to the gold numbers you will produce in step [[parity]].", "AGENT_RETRIEVAL 已设置，选择理由已写下来，放在第 [[parity]] 步将产出的标准集数据旁边。"),
      },
      {
        id: "lakebase",
        title: t("Lakebase backend: synced table, ANN and BM25 indexes", "Lakebase 后端：同步表、ANN 和 BM25 索引"),
        local: t("pgvector HNSW index, Postgres full-text search, the hybrid SQL in tools/knowledge_base.py.", "pgvector 的 HNSW 索引、Postgres 全文检索、tools/knowledge_base.py 里的混合检索 SQL。"),
        links: ["rag-graph.load", "rag-graph.dense", "rag-graph.lexical", "state.postgres"],
        after: ["choose"],
        why: t(
          "The chunks are written in Delta, where jobs and governance live, and read in Postgres, where millisecond index lookups live. A synced table connects the two without a copy job of your own. Lakebase Search provides the two index types the local build used: an ANN index for vectors and BM25 for words.",
          "文本块写在 Delta 里，那是 job 和治理所在的地方；读取在 Postgres 里，那是毫秒级索引查找所在的地方。同步表把两者连接起来，不需要你自己写复制任务。Lakebase Search 提供了本地构建用到的两类索引：向量用 ANN 索引，词语用 BM25。",
        ),
        what: t(
          "lakebase_sync.py creates a TRIGGERED synced table from agentlab.kb.chunks with the embedding column mapped to vector(n). lakebase_search.sql installs the extensions, creates a plain search table with a tsvector column, its ANN and BM25 indexes, and the two ranked queries with the vector as a bound parameter. refresh.py is the last ingest task: it runs the synced table's pipeline update, waits, and rebuilds the search table in one transaction.",
          "lakebase_sync.py 从 agentlab.kb.chunks 创建一个 TRIGGERED 模式的同步表，并把 embedding 列映射为 vector(n)。lakebase_search.sql 安装扩展，创建一张带 tsvector 列的普通检索表及其 ANN 和 BM25 索引，并定义两个排序查询，其中向量作为绑定参数传入。refresh.py 是 ingest 的最后一个任务：它触发同步表的管道更新，等待完成，然后在一个事务中重建检索表。",
        ),
        how: [
          t("Create a Lakebase project (Autoscaling) on Postgres 16 or later. In a dev project first, enable Lakebase Search in project settings; this restarts its computes and cannot be undone.", "创建一个 Postgres 16 或更高版本的 Lakebase 项目（Autoscaling）。先在开发项目里，于项目设置中启用 Lakebase Search；这会重启它的计算资源，且无法撤销。"),
          t("Run `python lakebase_sync.py --branch projects/<project>/branches/production --database <db>`. If the SDK rejects the type override, run the printed CLI command instead.", "运行 `python lakebase_sync.py --branch projects/<project>/branches/production --database <db>`。如果 SDK 不接受类型覆盖参数，就改为运行它打印出来的 CLI 命令。"),
          t("Connect with psql using the details from the Lakebase console and run lakebase_search.sql.", "用 Lakebase 控制台里的连接信息通过 psql 连接，运行 lakebase_search.sql。"),
          t("Keep refresh.py as the last ingest task (resources/jobs.yml already chains it). A TRIGGERED synced table never updates by itself.", "让 refresh.py 保持为 ingest 的最后一个任务（resources/jobs.yml 已经把它串上了）。TRIGGERED 模式的同步表不会自行更新。"),
          t("Run both EXPLAIN lines at the end of the SQL file.", "运行 SQL 文件末尾的两条 EXPLAIN 语句。"),
        ],
        files: ["replicate/databricks/src/retrieval/lakebase_sync.py", "replicate/databricks/src/retrieval/lakebase_search.sql", "replicate/databricks/src/retrieval/refresh.py"],
        interpret: [
          t("EXPLAIN must name kb_search_ann for the dense query and kb_search_bm25 for the lexical one. `Seq Scan on kb_search` means the index is not used: check that the vector is a parameter, not an expression, which is exactly the module 5 lesson.", "EXPLAIN 必须显示稠密查询使用了 kb_search_ann，词法查询使用了 kb_search_bm25。出现 `Seq Scan on kb_search` 说明没用上索引：检查向量是否作为参数传入，而不是一个表达式，这正是第 5 模块的教训。"),
          t("BM25 scores from `<@>` are lower-is-better, so the lexical list orders ascending. If the top lexical hit is obviously irrelevant, the order is reversed somewhere.", "`<@>` 返回的 BM25 分数越低越相关，所以词法列表按升序排列。如果词法第一名明显不相关，说明某处排序方向反了。"),
          t("refresh.py prints `synced table update: ...COMPLETED` and `kb_search rows: N`. N must equal the chunks in service in Delta. Fewer means the sync ran before ingest finished, or a row has a null key.", "refresh.py 会打印 `synced table update: ...COMPLETED` 和 `kb_search rows: N`。N 必须等于 Delta 中在服务的文本块数。如果更少，说明同步在 ingest 完成之前就运行了，或者某行的主键为空。"),
        ],
        trouble: [
          { s: t("embedding arrives as double precision[] instead of vector", "embedding 列变成了 double precision[] 而不是 vector"), c: t("The synced table was created without the type override.", "创建同步表时没有带类型覆盖。"), f: t("The primary key and types cannot be changed in place: delete the synced table and create it again with `type_overrides`.", "主键和类型无法就地修改：删除同步表，带上 `type_overrides` 重新创建。") },
          { s: t("A full re-sync of the synced table fails: other objects depend on it", "同步表全量重同步失败：有其他对象依赖它"), c: t("Something (a view, a foreign key) was built on the synced table.", "有东西（视图、外键）建在了同步表上。"), f: t("Build nothing on it. That is why kb_search is a separate table rebuilt by refresh.py.", "不要在它上面建任何东西。这正是 kb_search 被做成一张由 refresh.py 重建的独立表的原因。") },
          { s: t("refresh.py: no pipeline id on the synced table", "refresh.py 报：同步表上找不到 pipeline id"), c: t("The SDK version names the status field differently.", "该 SDK 版本中状态字段的名字不同。"), f: t("Print the object returned by get_synced_table once and add its path to _pipeline_id, or trigger the sync from the table's Overview tab.", "把 get_synced_table 返回的对象打印一次，把对应的字段路径加到 _pipeline_id 中；或者在该表的 Overview 标签页手动触发同步。") },
          { s: t("Sync pipeline fails: duplicate primary key", "同步管道失败：主键重复"), c: t("chunk_id repeated in the source.", "源表中 chunk_id 重复了。"), f: t("Fix the source (step [[ingest]]'s MERGE prevents this); never set a timeseries key to hide it, because that silently keeps only one row.", "修正源表（第 [[ingest]] 步的 MERGE 可防止这种情况）；绝不要用 timeseries key 来掩盖，因为那样会悄悄地只保留一行。") },
          { s: t("Password authentication failed after about an hour", "大约一小时后密码认证失败"), c: t("Database credentials expire after 60 minutes.", "数据库凭证 60 分钟后过期。"), f: t("Use common/pg.py: it mints a credential per connection and recycles connections at 45 minutes.", "使用 common/pg.py：它为每个连接生成凭证，并在 45 分钟时回收连接。") },
        ],
        done: t("Both EXPLAIN plans use their index, and kb_search has one row per chunk in service.", "两条 EXPLAIN 都用上了各自的索引，且 kb_search 中每个在服务的文本块各有一行。"),
        unconfirmed: t("Not confirmed: the `type_overrides` attribute name in the Python SDK (the CLI JSON form is from the vendor page), `w.postgres.get_synced_table` and where it reports the pipeline id. Triggering the pipeline with `w.pipelines.start_update` is the general SDK call for pipelines. The fallbacks are in the troubleshooting lines.", "未确认：Python SDK 中 `type_overrides` 属性的名字（CLI 的 JSON 写法来自厂商页面）、`w.postgres.get_synced_table` 以及它在哪个字段报告 pipeline id。用 `w.pipelines.start_update` 触发管道是 SDK 中针对管道的通用调用。替代方案见排障部分。"),
      },
      {
        id: "ai-search",
        title: t("AI Search backend: a Delta Sync index with managed embeddings", "AI Search 后端：托管 embedding 的 Delta Sync 索引"),
        local: t("The same retrieval, without operating Postgres.", "同样的检索，但不用运维 Postgres。"),
        links: ["rag-graph.dense", "rag-graph.lexical"],
        after: ["choose"],
        why: t(
          "An index that follows the Delta table removes the embedding job, the database and the refresh. The price is control: you send queries and receive rows. The index can fuse for you (query_type=\"hybrid\"), but by default the script asks for a dense list and a full-text list and fuses them in Python, so the replica ranks exactly like the local build and every hit keeps its dense and lexical rank for debugging.",
          "一个跟随 Delta 表的索引省掉了嵌入任务、数据库和刷新。代价是控制权：你只能发查询、收结果。索引可以替你融合（query_type=\"hybrid\"），但脚本默认分别请求一个稠密列表和一个全文列表，再在 Python 里融合，这样副本的排序与本地构建完全一致，而且每条结果都保留了稠密和词法名次，便于排查。",
        ),
        what: t(
          "Creates a STANDARD endpoint and a TRIGGERED Delta Sync index on `embed_text` with the embedding endpoint from step [[lineup]], starts a sync on demand, and runs the two-list query with the collection and retired filters applied in the index. hybrid_list() is the one-call alternative.",
          "创建一个 STANDARD 类型的 endpoint，以及基于 `embed_text` 列、使用第 [[lineup]] 步 embedding 端点的 TRIGGERED 模式 Delta Sync 索引，按需启动同步，并执行双列表查询，collection 和 retired 过滤在索引内完成。hybrid_list() 是单次调用的替代方案。",
        ),
        how: [
          t("`python ai_search_index.py create`, then wait until the index shows as ready in the Catalog UI.", "运行 `python ai_search_index.py create`，然后在 Catalog 界面里等到索引显示为就绪。"),
          t("Each ingest run ends with refresh.py, which starts the index sync when AGENT_RETRIEVAL=ai_search. By hand: `python ai_search_index.py sync`.", "每次 ingest 运行都以 refresh.py 结束；当 AGENT_RETRIEVAL=ai_search 时，它会启动索引同步。手动执行：`python ai_search_index.py sync`。"),
          t("`python ai_search_index.py query lodging cap` to see both lists.", "运行 `python ai_search_index.py query lodging cap` 查看两个列表。"),
        ],
        files: ["replicate/databricks/src/retrieval/ai_search_index.py"],
        interpret: [
          t("The dense and lexical lists should overlap for a plain question and differ for an exact token like a form number. If they are identical for 'NW-FIN-012', full-text is not active on the index.", "对于普通问题，稠密和词法两个列表应有重叠；对于表单编号这类精确词，两者应有差异。如果搜 'NW-FIN-012' 两个列表完全一样，说明索引上的全文检索没有生效。"),
          t("The time printed is two round trips. If it is above about 600 ms, retrieval dominates the agent's first token; consider the Lakebase backend or a single query.", "打印出的时间是两次往返的耗时。如果超过约 600 毫秒，检索就成了智能体首 token 延迟的主要部分；可以考虑改用 Lakebase 后端，或者只发一个查询。"),
        ],
        trouble: [
          { s: t("Index creation fails: change data feed required", "创建索引失败：需要 change data feed"), c: t("Standard endpoints need CDF on the source.", "STANDARD 端点要求源表开启 CDF。"), f: t("`ALTER TABLE agentlab.kb.chunks SET TBLPROPERTIES (delta.enableChangeDataFeed = true)`; 01_catalog.sql already sets it on new tables.", "执行 `ALTER TABLE agentlab.kb.chunks SET TBLPROPERTIES (delta.enableChangeDataFeed = true)`；01_catalog.sql 在新表上已经设置了它。") },
          { s: t("query_type FULL_TEXT returns an error", "query_type FULL_TEXT 报错"), c: t("Full-text needs an index that supports it (the vendor page marks the full-text subtype as Beta).", "全文检索需要索引本身支持（厂商页面把全文子类型标为 Beta）。"), f: t("Try hybrid_list() (query_type=\"hybrid\") instead; or set RAG_HYBRID=0 to run dense-only and measure the loss in step [[parity]].", "改用 hybrid_list()（query_type=\"hybrid\"）；或者设置 RAG_HYBRID=0，只跑稠密检索，并在第 [[parity]] 步测量损失。") },
          { s: t("Results include retired chunks", "结果里包含已停用的文本块"), c: t("The index syncs all rows; retired is just a column, and the filter was dropped or retired is not in columns_to_sync.", "索引会同步所有行；retired 只是一个列，而过滤条件被去掉了，或者 retired 不在 columns_to_sync 里。"), f: t("Keep `retired` in columns_to_sync and in the filters dict; only synced columns can be filtered on.", "保证 `retired` 在 columns_to_sync 和过滤字典中；只有同步过来的列才能用于过滤。") },
        ],
        done: t("Both lists come back, and a query for an exact code ranks its chunk first in the lexical list.", "两个列表都能返回，并且查询一个精确编码时，它对应的文本块在词法列表中排第一。"),
        unconfirmed: t("query_type=\"hybrid\" and dict filters on standard endpoints are on the vendor's query page. Not confirmed: the exact result shape (manifest columns plus data_array is what the client has returned historically; the code reads it defensively).", "query_type=\"hybrid\" 和 STANDARD 端点上的字典过滤都写在厂商的查询页面上。未确认：结果的确切结构（manifest 中的列加 data_array 是该客户端以往返回的结构；代码读取时做了防御处理）。"),
      },
      {
        id: "search-tool",
        title: t("The search tool: fusion, authority, dedup, graph, diagnostic", "检索工具：融合、权威、去重、图扩展、诊断"),
        local: t("tools/knowledge_base.py and tools/passage_dedup.py.", "tools/knowledge_base.py 和 tools/passage_dedup.py。"),
        links: ["rag-graph.fuse", "rag-graph.authority", "rag-graph.expand", "rag-graph.diagnose", "tools-mcp.design"],
        after: ["edges"],
        afterAny: ["lakebase", "ai-search"],
        why: t(
          "Managed indexes return candidates. Turning candidates into the five passages a model should read is where the local build earned its accuracy, and none of it is a platform feature. Keeping it as one portable module (ranking.py, tested here) means the Databricks agent and the local agent rank identically, so a difference in answers points at data or models, not at code drift.",
          "托管索引返回的只是候选。把候选变成模型该读的那五段，才是本地构建准确率的来源，而这些都不是平台功能。把它保留为一个可移植的模块（ranking.py，在这里经过测试），意味着 Databricks 智能体和本地智能体的排序完全一致；答案出现差异时，原因就指向数据或模型，而不是代码漂移。",
        ),
        what: t(
          "search_kb gets two lists from the chosen backend, fuses them with RRF, adds the tier bonus, collapses copies of a paragraph to its most authoritative source, expands through the edges table, and returns a trace. An empty result carries a diagnostic naming the likely cause.",
          "search_kb 从所选后端取回两个列表，用 RRF 融合，加上等级加分，把同一段落的多个副本合并为最权威的来源，通过边表扩展，并返回追踪信息。空结果会带上指出可能原因的诊断信息。",
        ),
        how: [
          t("Set DATABRICKS_WAREHOUSE_ID for the edges lookup. In the app it comes from the sql_warehouse resource (step [[deploy]]); without it, expansion is skipped and the trace says so.", "为边表查询设置 DATABRICKS_WAREHOUSE_ID。在 App 中它来自 sql_warehouse 资源（第 [[deploy]] 步）；没有它时，图扩展会被跳过，追踪信息里会注明。"),
          t("Run `python search_tool.py what does approving official mean` and read the JSON.", "运行 `python search_tool.py what does approving official mean`，阅读输出的 JSON。"),
          t("Run `python replicate/databricks/check.py`: the ranking tests run without a workspace.", "运行 `python replicate/databricks/check.py`：排序相关的测试不需要工作区也能跑。"),
          t("Flip RAG_AUTHORITY, RAG_DEDUP, RAG_GRAPH to 0 one at a time when you run step [[parity]], to see what each feature is worth here.", "做第 [[parity]] 步时，逐个把 RAG_AUTHORITY、RAG_DEDUP、RAG_GRAPH 设为 0，看看每个功能在这里的价值。"),
        ],
        files: ["replicate/databricks/src/retrieval/ranking.py", "replicate/databricks/src/retrieval/search_tool.py"],
        interpret: [
          t("Each result shows dense_rank and lexical_rank. A top hit with lexical_rank only is a keyword win (a code or a name); dense_rank only is a meaning win. Both null is a graph expansion, and `via` says which edge.", "每条结果都显示 dense_rank 和 lexical_rank。只有 lexical_rank 的首条结果是关键词胜出（编码或名称）；只有 dense_rank 的是语义胜出。两者都为 null 的是图扩展结果，`via` 会说明是哪条边。"),
          t("`trace` counts are the first thing to read on a bad answer: dense 20, lexical 0 means BM25 found nothing, which is a tokenization or index problem, not a model problem.", "答案不对时，最先看 `trace` 里的计数：dense 20、lexical 0 说明 BM25 什么也没找到，这是分词或索引的问题，不是模型的问题。"),
          t("`diagnostic: collection 'hr' has no chunks; known collections: [...]` is the tool telling the model its own parameter was wrong. The model can correct it in the next round; that is module 6's design rule working.", "`diagnostic: collection 'hr' has no chunks; known collections: [...]` 是工具在告诉模型它自己的参数错了。模型可以在下一轮纠正；这就是第 6 模块的设计规则在起作用。"),
        ],
        trouble: [
          { s: t("trace says `expanded: skipped: no DATABRICKS_WAREHOUSE_ID`", "追踪信息显示 `expanded: skipped: no DATABRICKS_WAREHOUSE_ID`"), c: t("Graph expansion needs a warehouse to read the edges table, and none is configured.", "图扩展需要 warehouse 来读取边表，而当前没有配置。"), f: t("Set the warehouse id (locally) or add the sql_warehouse resource and its valueFrom entry (in the app).", "在本地设置 warehouse id，或者在 App 中添加 sql_warehouse 资源及其 valueFrom 配置。") },
          { s: t("The same paragraph appears twice with different sources", "同一段落以不同来源出现了两次"), c: t("Whitespace or punctuation differs between the copies, so the normalized text differs.", "副本之间空白或标点不同，所以规范化后的文本不同。"), f: t("Strengthen _norm (strip punctuation) in ranking.py and add a test with your two strings.", "加强 ranking.py 中的 _norm（去掉标点），并用你这两段文字添加一个测试。") },
        ],
        done: t("The approving-official question returns the defining chunk with via `defines:approving official`, and the portable tests pass.", "“approving official”的问题返回了定义它的文本块，via 为 `defines:approving official`，并且可移植测试全部通过。"),
        unconfirmed: t("The SQL connector's `?` parameter markers and `credentials_provider=lambda: cfg.authenticate` follow the connector's documented app pattern; not run here.", "SQL connector 的 `?` 参数占位符和 `credentials_provider=lambda: cfg.authenticate` 用的是该连接器文档中针对 App 的写法；这里没有实际运行。"),
      },
      {
        id: "parity",
        title: t("Prove retrieval parity with the local gold set", "用本地标准集证明检索效果一致"),
        local: t("nightly/retrieval_eval.py: hit rate and MRR on the hand-written gold set.", "nightly/retrieval_eval.py：在人工编写的标准集上计算命中率和 MRR。"),
        links: ["evaluation.gold", "evaluation.score", "evaluation.variants"],
        after: ["search-tool"],
        why: t(
          "A migration that changes retrieval quality silently changes every answer. The gold set already exists, was written by a person, and was sealed before anything learned from it, so it is the fair judge. Running it now, before the agent exists, isolates retrieval: if the agent is worse later and retrieval matched here, the cause is elsewhere.",
          "如果迁移悄悄改变了检索质量，那么每一个答案都会悄悄改变。标准集已经存在，由人编写，并且在任何学习发生之前就已封存，所以它是公正的裁判。在智能体还不存在的时候就跑它，能把检索单独隔离出来：如果之后智能体变差了，而这里的检索结果是一致的，那原因就在别处。",
        ),
        what: t(
          "Runs every gold question through search_kb, finds the rank of the gold chunk, and prints hit@1, hit@5 and MRR, for the full ranking and with each feature switched off.",
          "把每个标准问题都送进 search_kb，找出标准答案文本块的名次，打印 hit@1、hit@5 和 MRR，分别对应完整排序以及逐个关闭各功能的情况。",
        ),
        how: [
          t("Copy the local gold file (the module 11 format: q, gold chunk id) next to the script.", "把本地标准文件（第 11 模块的格式：问题、标准文本块 id）复制到脚本旁边。"),
          t("Run the snippet with each flag combination.", "用每种开关组合运行这段代码。"),
          t("Put the local numbers from your last nightly run beside these.", "把你最近一次夜间运行得到的本地数据放在旁边对比。"),
        ],
        code: [{ lang: "python", file: "parity.py", text: `import json, os, sys
sys.path.insert(0, "replicate/databricks/src")
from retrieval.search_tool import search_kb

gold = json.load(open("gold_v1.json"))["items"]          # [{"q": ..., "gold": "policy/x.md::3"}, ...]
def run(label):
    ranks = []
    for g in gold:
        ids = [r["chunk_id"] for r in search_kb(g["q"], g.get("collection", "policy"), top_k=10)["results"]]
        ranks.append(ids.index(g["gold"]) + 1 if g["gold"] in ids else None)
    n = len(ranks)
    hit = lambda k: sum(1 for r in ranks if r and r <= k) / n
    mrr = sum(1 / r for r in ranks if r) / n
    print(f"{label:14} n={n}  hit@1 {hit(1):.3f}  hit@5 {hit(5):.3f}  mrr {mrr:.3f}")

run("full")
for flag in ("RAG_HYBRID", "RAG_AUTHORITY", "RAG_DEDUP", "RAG_GRAPH"):
    os.environ[flag] = "0"; run("no-" + flag[4:].lower()); os.environ[flag] = "1"` }],
        interpret: [
          t("Read it like the module 11 table: `full 15 0.667 1.000 1.000` locally. A replica within one question of that on hit@5 is at parity; with 15 questions, one question is 0.067, so smaller differences are noise.", "像读第 11 模块那张表一样读它：本地是 `full 15 0.667 1.000 1.000`。副本在 hit@5 上与之相差不超过一道题，就算一致；只有 15 道题时，一道题就是 0.067，比这更小的差异属于噪声。"),
          t("If `no-hybrid` equals `full`, keyword search contributes nothing on your questions; if it drops, BM25 is earning its cost. The local build saw dense-only lose on exact tokens.", "如果 `no-hybrid` 与 `full` 相同，说明在你的问题上关键词检索没有贡献；如果下降了，说明 BM25 物有所值。本地构建中，只用稠密检索在精确词上会输。"),
          t("A large drop in hit@1 with hit@5 unchanged usually means the authority nudge or dedup is not working: the right passage is retrieved but a copy from a lower tier sits above it.", "hit@1 大幅下降而 hit@5 不变，通常说明权威加权或去重没起作用：正确的段落找到了，但一个来自较低等级的副本排在了它前面。"),
          t("Gold chunk ids include the path. If every rank is None, the paths differ between the local bank and the volume (for example a different root folder); fix the ids, not the search.", "标准文本块 id 包含路径。如果所有名次都是 None，说明本地知识库与 volume 之间路径不同（例如根目录不同）；要改的是 id，而不是检索。"),
        ],
        trouble: [
          { s: t("Numbers are much lower than locally", "数据比本地低很多"), c: t("Different embedding model, or context not embedded with the text.", "embedding 模型不同，或者没有把上下文和文本一起嵌入。"), f: t("Confirm the index embeds `embed_text` (context + text). Then accept that a different embedding model is a different system and re-tune only after measuring.", "确认索引嵌入的是 `embed_text`（上下文加文本）。然后要接受：不同的 embedding 模型就是一个不同的系统，先测量再调参。") },
          { s: t("Results vary between runs", "每次运行结果都不同"), c: t("A sync or refresh happened between runs.", "两次运行之间发生了同步或刷新。"), f: t("Pause the ingest job while you measure, or record the Delta version you measured against.", "测量期间暂停 ingest job，或者记录你测量时所用的 Delta 版本。") },
        ],
        done: t("A written comparison: local and replica hit@1, hit@5, MRR side by side, with each difference explained or within one question.", "一份书面对比：本地与副本的 hit@1、hit@5、MRR 并排列出，每个差异要么有解释，要么在一道题以内。"),
      },
    ],
  },
];
