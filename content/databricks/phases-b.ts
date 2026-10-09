import { t } from "@/lib/types";
import type { Phase } from "./types";

/** Phases 5 to 7: the agent, shipping and evaluation, operating and learning. */
export const phasesB: Phase[] = [
  {
    id: "agent",
    title: t("The agent: tools, prompts, memory, harness", "智能体：工具、提示词、记忆、Harness"),
    goal: t(
      "The pieces the agent loop calls are built first, each tested on its own, so that when the loop is assembled every failure has one place to be. This is the same order as the curriculum: tools before the harness, the guard inside the harness, memory behind a partition argument.",
      "先构建智能体循环要调用的各个部件，并逐一单独测试，这样循环组装起来之后，每种失败都只有一个可能的出处。这与课程的顺序相同：工具先于 Harness，护栏在 Harness 内部，记忆藏在分区参数之后。",
    ),
    steps: [
      {
        id: "tools",
        title: t("Data tools as Unity Catalog functions, exposed through managed MCP", "把数据工具做成 Unity Catalog 函数，并通过托管 MCP 暴露"),
        local: t("The tool registry with typed schemas, row limits and diagnostics, and the brainbank MCP server.", "带类型化 schema、行数上限和诊断信息的工具注册表，以及 brainbank MCP 服务。"),
        links: ["tools-mcp.design", "tools-mcp.tools", "tools-mcp.limits", "tools-mcp.mcp-server"],
        after: ["catalog"],
        why: t(
          "A tool that reads company data is a permission boundary. As a Unity Catalog function it is governed like a table: who may EXECUTE it is a grant, its description is the COMMENT, and the same function serves your agent, a notebook, and any MCP client through the managed endpoint. Writing it in SQL keeps the query inside the governed engine; the caller never holds a warehouse token.",
          "读取公司数据的工具就是一道权限边界。作为 Unity Catalog 函数，它像表一样被治理：谁能 EXECUTE 是一条授权，它的说明就是 COMMENT，同一个函数可以同时服务你的智能体、notebook，以及通过托管端点接入的任何 MCP 客户端。用 SQL 编写，让查询留在受治理的引擎内部；调用方从不持有 warehouse 令牌。",
        ),
        what: t(
          "query_expenses.sql creates agentlab.tools.query_expenses(employee_id, claim_month) returning JSON with rows, count, total, and a diagnostic that says which filter emptied the result. claim_month has a DEFAULT, so it can be left out, which is what lets the learner prove a month filter emptied a result. uc_tools.py calls it twice through unitycatalog-ai and checks the module 6 contract.",
          "query_expenses.sql 创建 agentlab.tools.query_expenses(employee_id, claim_month)，返回包含 rows、count、total 的 JSON，以及一个说明是哪个过滤条件导致结果为空的诊断字段。claim_month 带有默认值，可以省略，学习器正是靠这一点来证明是月份过滤导致了空结果。uc_tools.py 通过 unitycatalog-ai 调用它两次，检查第 6 模块定下的工具契约。",
        ),
        how: [
          t("Point the function at your table (agentlab.finance.expenses is a placeholder) and run the SQL file.", "把函数指向你自己的表（agentlab.finance.expenses 只是占位名），然后运行 SQL 文件。"),
          t("Run `python uc_tools.py`. Both lines must print PASS.", "运行 `python uc_tools.py`。两行都必须打印 PASS。"),
          t("For MCP clients, use the managed endpoint `https://<workspace-host>/api/2.0/mcp/functions/agentlab/tools/query_expenses`. The vendor page recommends the Unity Gateway MCP pattern for new connections.", "MCP 客户端使用托管端点 `https://<workspace-host>/api/2.0/mcp/functions/agentlab/tools/query_expenses`。厂商页面建议新连接采用 Unity Gateway 的 MCP 方式。"),
          t("Grant EXECUTE to the app's service principal after step [[deploy]] creates it.", "在第 [[deploy]] 步创建好 App 的服务主体后，向它授予 EXECUTE。"),
        ],
        files: ["replicate/databricks/src/tools/query_expenses.sql", "replicate/databricks/src/tools/uc_tools.py"],
        interpret: [
          t("`PASS {... '2026-03'} -> 4 rows, total 219.0` is a working tool. `PASS {... '1999-01'} -> employee E-1042 has 12 claims in other months; the month filter emptied this result` is the more important line: the empty case explains itself.", "`PASS {... '2026-03'} -> 4 rows, total 219.0` 表示工具正常工作。`PASS {... '1999-01'} -> employee E-1042 has 12 claims in other months; the month filter emptied this result` 这一行更重要：空结果自己说明了原因。"),
          t("`FAIL ... empty result without a diagnostic` means a model will read `count 0` and report zero spending as a fact. That is the module 6 failure story; do not ship the tool until it passes.", "`FAIL ... empty result without a diagnostic` 意味着模型会读到 `count 0`，并把“零支出”当作事实报告出去。这就是第 6 模块的失败案例；在它通过之前，不要上线这个工具。"),
          t("The parameter COMMENTs become the tool's argument descriptions. If the model passes '03/2026', the format in the COMMENT was not specific enough.", "参数的 COMMENT 会成为工具参数的说明。如果模型传入了 '03/2026'，说明 COMMENT 里对格式的描述还不够具体。"),
        ],
        trouble: [
          { s: t("`execute_function` fails in local mode", "`execute_function` 在 local 模式下失败"), c: t("Local execution does not run SQL functions.", "本地执行模式不运行 SQL 函数。"), f: t("Use the default (serverless) client, as the script does.", "像脚本那样使用默认的（serverless）客户端。") },
          { s: t("The agent gets PERMISSION_DENIED calling the tool", "智能体调用工具时报 PERMISSION_DENIED"), c: t("The app's service principal lacks EXECUTE on the function, or SELECT on the table it reads.", "App 的服务主体对该函数没有 EXECUTE 权限，或者对它所读取的表没有 SELECT 权限。"), f: t("Grant both, to the app principal, not to your user.", "把这两项权限都授予 App 的服务主体，而不是你自己的用户。") },
          { s: t("Totals differ from the local tool", "合计数与本地工具不一致"), c: t("Status or date logic differs (for example time zones on claim_date).", "状态或日期逻辑不同（例如 claim_date 的时区）。"), f: t("Compare on one employee and one month; the function must match the local query row for row.", "拿一个员工、一个月份来对比；函数结果必须与本地查询逐行一致。") },
        ],
        done: t("Both calls PASS and the function is visible in Catalog with its COMMENT.", "两次调用都 PASS，并且能在 Catalog 中看到该函数及其 COMMENT。"),
        unconfirmed: t("The `.value` attribute on the execution result and the `replace` behavior come from the unitycatalog-ai client; the script reads the value defensively.", "执行结果上的 `.value` 属性以及替换行为来自 unitycatalog-ai 客户端；脚本读取时做了防御处理。"),
      },
      {
        id: "prompts",
        title: t("Base prompt and skills as versioned prompts", "把基础提示词和技能做成带版本的提示词"),
        local: t("AGENT.md and skills/*/SKILL.md, matched per request and injected.", "AGENT.md 和 skills/*/SKILL.md，按请求匹配后注入。"),
        links: ["skills.write", "skills.match", "skills.inject", "self-evolving.rollback"],
        after: ["catalog"],
        why: t(
          "On the Mac a prompt change was a file edit and a restart, and rollback was git. In a deployed app a redeploy is slower and riskier than the change. A prompt registry gives each prompt versions and an alias: the agent loads `@production`, you register a new version, evaluate it, and move the alias. Rollback becomes moving the alias back, in seconds, with no deploy.",
          "在 Mac 上，改提示词就是改文件再重启，回滚靠 git。在已部署的 App 里，重新部署比改动本身更慢、风险更大。提示词注册表为每个提示词提供版本和别名：智能体加载 `@production`，你注册一个新版本、评估它、再移动别名。回滚就是把别名移回去，几秒钟完成，不需要部署。",
        ),
        what: t(
          "Reads AGENT.md and every skills/*/SKILL.md, converts {name} placeholders to the registry's {{name}} syntax, and registers each as agentlab.skills.<name>. Skill matching stays in harness.py, tested here.",
          "读取 AGENT.md 和每个 skills/*/SKILL.md，把 {name} 占位符转成注册表使用的 {{name}} 语法，并把每一个注册为 agentlab.skills.<name>。技能匹配仍在 harness.py 中完成，并在这里经过测试。",
        ),
        how: [
          t("`CREATE SCHEMA IF NOT EXISTS agentlab.skills`, then `python register_prompts.py /path/to/agent-server`.", "执行 `CREATE SCHEMA IF NOT EXISTS agentlab.skills`，然后运行 `python register_prompts.py /path/to/agent-server`。"),
          t("For each prompt, set alias `production` on version 1 with mlflow.genai.set_prompt_alias.", "对每个提示词，用 mlflow.genai.set_prompt_alias 在版本 1 上设置别名 `production`。"),
          t("Update the SKILLS trigger words in agent.py to match your skill folders.", "更新 agent.py 中 SKILLS 的触发词，使之与你的技能目录一致。"),
          t("From now on: new version, run step [[evals]], then move the alias. Never edit production in place.", "从现在起：新建版本，运行第 [[evals]] 步，再移动别名。绝不在 production 上就地修改。"),
        ],
        files: ["replicate/databricks/src/skills/register_prompts.py"],
        code: [{ lang: "python", text: `import mlflow
mlflow.genai.set_prompt_alias(name="agentlab.skills.agent_base", alias="production", version=1)
p = mlflow.genai.load_prompt(name_or_uri="prompts:/agentlab.skills.agent_base@production")
print(p.version, len(p.template))` }],
        interpret: [
          t("`agentlab.skills.skill_expense -> version 3` on a rerun means the registry kept the old versions; nothing was overwritten. That history is what makes rollback possible.", "重跑时出现 `agentlab.skills.skill_expense -> version 3`，说明注册表保留了旧版本，没有任何内容被覆盖。正是这段历史让回滚成为可能。"),
          t("If a loaded prompt shows literal `{{name}}` in an answer, the template has a variable the agent never fills. Either fill it with format() or remove the braces.", "如果答案里出现了字面上的 `{{name}}`，说明模板里有一个智能体从未填充的变量。要么用 format() 填上，要么去掉花括号。"),
        ],
        trouble: [
          { s: t("register_prompt fails: schema not found", "register_prompt 失败：找不到 schema"), c: t("agentlab.skills does not exist.", "agentlab.skills 不存在。"), f: t("Create the schema and grant CREATE FUNCTION or the prompt privileges your workspace requires to the registering user.", "创建该 schema，并给执行注册的用户授予 CREATE FUNCTION 或你工作区要求的提示词相关权限。") },
          { s: t("The agent answers with an old prompt after you moved the alias", "移动别名后，智能体仍在使用旧提示词"), c: t("The app cached the prompt at startup.", "App 在启动时缓存了提示词。"), f: t("Load per request (as agent.py does) or with a short time-based cache.", "按请求加载（agent.py 就是这样做的），或者使用很短的基于时间的缓存。") },
        ],
        done: t("Every local prompt exists in the registry with a production alias, and load_prompt returns it.", "每个本地提示词都已在注册表中，并带有 production 别名，load_prompt 能取回它。"),
      },
      {
        id: "memory",
        title: t("Memory in Lakebase, partitioned by the signed-in user", "把记忆放进 Lakebase，按登录用户分区"),
        local: t("memory_store.py, memory_pipeline.py, conversation_index.py and the recall tool.", "memory_store.py、memory_pipeline.py、conversation_index.py 以及回忆工具。"),
        links: ["memory.partition", "memory.facts", "memory.recall", "memory.pipeline", "memory.boundaries"],
        after: ["secrets", "choose"],
        why: t(
          "Memory is many small writes and reads by key, on every turn, which is what Postgres is for and what Delta is not. The partition is the safety property: every function takes the user, and the user comes from the request headers the app receives after sign-in, never from model output. A model that is tricked into naming another user still reads only its own partition.",
          "记忆就是每一轮都发生的大量按键的小读写，这正是 Postgres 擅长而 Delta 不擅长的。分区是安全属性：每个函数都接收用户参数，而用户来自 App 在登录后收到的请求头，绝不来自模型输出。即使模型被诱导说出另一个用户的名字，它读到的仍然只是自己的分区。",
        ),
        what: t(
          "common/pg.py opens a pool that mints a fresh OAuth database credential per connection. memory/store.py creates two tables, writes facts with an upsert, builds a short briefing, recalls past turns by vector similarity inside the partition with a floor, and runs extraction after the answer on a background thread.",
          "common/pg.py 建立一个连接池，每个连接都生成新的 OAuth 数据库凭证。memory/store.py 创建两张表，用 upsert 写入事实，生成简短的用户简报，在分区内按向量相似度回忆过去的对话（带相似度下限），并在回答之后用后台线程执行信息提取。",
        ),
        how: [
          t("Use the Lakebase project from step [[lakebase]], or create one if you chose AI Search.", "使用第 [[lakebase]] 步的 Lakebase 项目；如果你选的是 AI Search，就新建一个。"),
          t("Set ENDPOINT_NAME, PGHOST, PGDATABASE, PGUSER for a service principal, then `Memory(pool(), embed).init()` once.", "为服务主体设置 ENDPOINT_NAME、PGHOST、PGDATABASE、PGUSER，然后执行一次 `Memory(pool(), embed).init()`。"),
          t("In the app, read the user from the forwarded identity header and pass it as the partition.", "在 App 中，从转发的身份请求头读取用户，并把它作为分区传入。"),
          t("Test the boundary: write a fact as user A, then call recall and briefing as user B.", "测试边界：以用户 A 写入一条事实，再以用户 B 调用 recall 和 briefing。"),
        ],
        files: ["replicate/databricks/src/common/pg.py", "replicate/databricks/src/memory/store.py"],
        code: [{ lang: "python", text: `from common.pg import pool
from memory.store import Memory
from databricks_openai import DatabricksOpenAI

oa = DatabricksOpenAI()
embed = lambda s: oa.embeddings.create(model="databricks-qwen3-embedding-0-6b", input=[s]).data[0].embedding
m = Memory(pool(), embed)
m.init()
m.remember("user-a@example.com", "cost_center", "CC-77")
print(repr(m.briefing("user-a@example.com")))   # '- cost_center: CC-77'
print(repr(m.briefing("user-b@example.com")))   # ''   <- the boundary holds` }],
        interpret: [
          t("An empty briefing for user B is the test passing. Anything else is a data leak, and it is a stop-the-line bug.", "用户 B 的简报为空，说明测试通过。其他任何结果都是数据泄露，必须立刻停下来修复。"),
          t("recall returns similarities. Values just above the 0.25 floor are weak matches; if most recalls sit there, the model is being handed noise, so raise the floor rather than the count.", "recall 会返回相似度。刚过 0.25 下限的值是弱匹配；如果大多数回忆结果都落在这附近，说明模型拿到的是噪声，应该提高下限，而不是增加数量。"),
          t("`memory pipeline failed:` in the app logs with the answer still delivered is the design working: memory is never allowed to break a response.", "App 日志里出现 `memory pipeline failed:`，而回答照常送达，说明设计在起作用：记忆永远不允许破坏一次回答。"),
        ],
        trouble: [
          { s: t("`Lakebase is not configured`", "报 `Lakebase is not configured`"), c: t("ENDPOINT_NAME, PGHOST or PGUSER is empty.", "ENDPOINT_NAME、PGHOST 或 PGUSER 为空。"), f: t("Take them from the Lakebase console Connect dialog; PGUSER is the service principal's client ID.", "从 Lakebase 控制台的 Connect 对话框中获取；PGUSER 是服务主体的 client ID。") },
          { s: t("type \"vector\" does not exist", "报 type \"vector\" does not exist"), c: t("The extension is not installed in this database.", "该数据库中没有安装这个扩展。"), f: t("init() runs CREATE EXTENSION vector; the user needs permission to create extensions, or an admin runs it once.", "init() 会执行 CREATE EXTENSION vector；用户需要有创建扩展的权限，或者由管理员执行一次。") },
          { s: t("Connections fail after about an hour", "大约一小时后连接失败"), c: t("Credentials expire at 60 minutes.", "凭证在 60 分钟时过期。"), f: t("The pool recycles at 45 minutes; if you wrote your own connection code, do the same.", "连接池会在 45 分钟时回收连接；如果你自己写连接代码，也要这样做。") },
        ],
        done: t("Facts round-trip for one user, the second user sees nothing, and a forced pipeline error does not affect the answer.", "单个用户的事实能写入和读回，第二个用户什么也看不到，人为制造的管道错误不影响回答。"),
        unconfirmed: t("The exact forwarded identity header names the app receives were not read on a vendor page for this guide; print the request headers once in the app to find them.", "本指南没有在厂商页面上查到 App 收到的转发身份请求头的确切名称；在 App 中把请求头打印一次即可找到。"),
      },
      {
        id: "agent",
        title: t("Assemble the agent in the app template with the guard inside", "在应用模板中组装智能体，并把护栏放在里面"),
        local: t("agent_loop.py, graph.py, AGENT.md, answer_guard.py and the stream gate.", "agent_loop.py、graph.py、AGENT.md、answer_guard.py 以及流式闸门。"),
        links: ["harness.compose", "harness.budget", "harness.triage", "harness.stream", "guardrails.check", "guardrails.retry", "sdk.agents-sdk"],
        after: ["gateway", "parity", "tools", "prompts", "memory"],
        why: t(
          "The template gives you the server, the Responses API surface, streaming and tracing; module 14 showed what an SDK provides. What it does not give you is the part that made the local agent trustworthy: triage before the big model, a prompt composed in a fixed order, a turn budget, and a guard that stops any money figure the evidence does not contain. Those are 60 lines of portable code, so they come with you.",
          "模板为你提供了服务器、Responses API 接口、流式输出和追踪；第 14 模块讲过 SDK 提供了什么。它没有提供的，正是让本地智能体值得信赖的那部分：调用大模型前的分流、按固定顺序组装的提示词、轮次预算，以及拦下证据中不存在的金额数字的护栏。这些是 60 行可移植的代码，所以要随身带走。",
        ),
        what: t(
          "agent.py sets the Databricks client with the gateway, defines search_kb and query_expenses as function tools, and implements answer(): triage, skill match, compose, run with max_turns, then harness.guarded() which checks the draft, retries once with a corrective note, and returns the fallback text rather than an unsupported answer. With memory, a recall tool is added whose user is bound in code, not passed by the model.",
          "agent.py 配置经由网关的 Databricks 客户端，把 search_kb 和 query_expenses 定义为函数工具，并实现 answer()：分流、技能匹配、组装提示词、带 max_turns 运行，然后调用 harness.guarded()：检查草稿，带纠正提示重试一次，如果仍不通过，返回兜底文本而不是没有依据的答案。有记忆时会再加一个回忆工具，其用户在代码里绑定，而不是由模型传入。",
        ),
        how: [
          t("Clone the vendor app templates, enter agent-openai-agents-sdk, run `uv run quickstart`.", "克隆厂商的应用模板，进入 agent-openai-agents-sdk，运行 `uv run quickstart`。"),
          t("Copy this repository's replicate/databricks/src/ folder into the template, and add databricks-openai, unitycatalog-ai[databricks], psycopg[binary,pool], databricks-sql-connector, and databricks-ai-search (AI Search backend only) to its dependencies.", "把本仓库的 replicate/databricks/src/ 目录复制进模板，并把 databricks-openai、unitycatalog-ai[databricks]、psycopg[binary,pool]、databricks-sql-connector，以及（仅 AI Search 后端需要的）databricks-ai-search 加入它的依赖。"),
          t("In the template's invoke and stream handlers, call `answer(messages, user_id, memory)` and put its tools and evidence in the response's custom_outputs (the eval reads them). For streaming, buffer the draft, run the guard, then emit: the stream gate from module 7.", "在模板的 invoke 和 stream 处理函数中调用 `answer(messages, user_id, memory)`，并把它返回的 tools 和 evidence 放进响应的 custom_outputs（评估会读取它们）。流式输出时，先缓冲草稿、运行护栏，再发出：这就是第 7 模块的流式闸门。"),
          t("`uv run start-app`, open localhost:8000, ask a policy question, an expense question, and 'hi'.", "运行 `uv run start-app`，打开 localhost:8000，分别问一个政策问题、一个报销问题，以及说一声“hi”。"),
          t("Run `python replicate/databricks/check.py` before every deploy: the harness and guard tests run in seconds.", "每次部署前运行 `python replicate/databricks/check.py`：Harness 和护栏的测试几秒钟就能跑完。"),
        ],
        files: ["replicate/databricks/src/agent/agent.py", "replicate/databricks/src/agent/harness.py", "replicate/databricks/src/guard/answer_guard.py"],
        interpret: [
          t("'hi' must return route `chat` with no tool calls in the trace. If it calls search_kb, triage is not running first, and every greeting costs a big-model call plus a search.", "“hi”必须返回 route `chat`，追踪中没有任何工具调用。如果它调用了 search_kb，说明分流没有最先运行，每一句问候都要付出一次大模型调用加一次检索的代价。"),
          t("`guard: pass after retry` on an expense question means the first draft stated a figure the tools did not return, and the corrective note fixed it. A few of these are normal. Many mean the skill prompt invites arithmetic the model gets wrong.", "报销问题出现 `guard: pass after retry`，说明第一版草稿给出了工具没返回的数字，纠正提示把它修正了。偶尔出现属于正常。频繁出现说明技能提示词在诱导模型做它会算错的算术。"),
          t("`guard: fallback` is the system refusing to ship an unsupported number. It is a correct outcome, and every one is worth reading: it is either a tool gap or a prompt problem.", "`guard: fallback` 是系统拒绝发出没有依据的数字。这是正确的结果，而且每一条都值得细看：要么是工具有缺口，要么是提示词有问题。"),
          t("The MLflow trace shows every model call and tool span. Compare one trace with the local request log for the same question: the shape (rounds, tools) should match.", "MLflow 追踪会显示每一次模型调用和工具 span。把同一个问题的追踪与本地请求日志对比：结构（轮次、工具）应当一致。"),
        ],
        trouble: [
          { s: t("MaxTurnsExceeded", "报 MaxTurnsExceeded"), c: t("The model kept calling tools without finishing, usually because a tool keeps returning nothing useful.", "模型一直在调用工具而没有结束，通常是因为某个工具一直返回不了有用的信息。"), f: t("Read the trace: if the same tool repeats with the same arguments, fix the tool's diagnostic so the model can change course. Do not just raise MAX_TURNS.", "查看追踪：如果同一个工具以同样的参数反复调用，就修正该工具的诊断信息，让模型能调整方向。不要只是调大 MAX_TURNS。") },
          { s: t("Tools are never called", "工具从未被调用"), c: t("The endpoint does not support tool calling through chat completions, or the API mode is not set.", "该端点不支持通过 chat completions 进行工具调用，或者没有设置 API 模式。"), f: t("Keep set_default_openai_api(\"chat_completions\") and pick a chat model that supports tools; test with a one-tool agent.", "保留 set_default_openai_api(\"chat_completions\")，并选择支持工具调用的对话模型；用只有一个工具的智能体先测试。") },
          { s: t("The guard blocks correct answers that quote a policy threshold", "护栏拦下了引用政策阈值的正确回答"), c: t("The threshold came from search_kb output, which must count as evidence.", "阈值来自 search_kb 的输出，而它必须算作证据。"), f: t("agent.py adds every tool output to the evidence; check that search_kb results reach `tools` (tool_call_output_item).", "agent.py 会把每个工具的输出都加入证据；检查 search_kb 的结果是否进入了 `tools`（tool_call_output_item）。") },
        ],
        done: t("Locally: 'hi' takes the chat route, a policy question cites a passage, an expense question returns a figure that the guard passes, and the portable tests pass.", "在本地：“hi”走闲聊路线，政策问题引用了某个段落，报销问题返回的数字通过了护栏，可移植测试全部通过。"),
        unconfirmed: t("The template's handler names and file layout change between template versions; the guide does not reproduce them. `new_items` item type `tool_call_output_item` is from the OpenAI Agents SDK.", "模板中处理函数的名字和文件布局会随模板版本变化；本指南不复述它们。`new_items` 中的条目类型 `tool_call_output_item` 来自 OpenAI Agents SDK。"),
      },
    ],
  },
  {
    id: "ship",
    title: t("Ship and evaluate", "上线与评估"),
    goal: t(
      "Deploy the agent as an app, then evaluate the deployed app, not a notebook copy of it. The seal and the spread carry over unchanged: a sealed question set nobody can edit, several runs, and a change counts only if it is larger than the spread.",
      "把智能体部署为 App，然后评估已部署的 App，而不是它在 notebook 里的副本。封存和波动范围原样沿用：一个没人能修改的封存问题集，多次运行，只有大于波动范围的变化才算数。",
    ),
    steps: [
      {
        id: "deploy",
        title: t("Deploy the app with a bundle", "用 bundle 部署 App"),
        local: t("Install-Autostart and the supervised agent-server behind the Tailscale funnel.", "Install-Autostart，以及位于 Tailscale funnel 之后、受守护的 agent-server。"),
        links: ["ops.supervise", "api-gateway.expose", "ops.change"],
        after: ["agent"],
        why: t(
          "A bundle makes the deployment a file in git: the app, its resources and their permissions, and the jobs. Redeploying is one command, and dev and prod differ only by target. The app gets its own service principal, which replaces the long-lived key the funnel needed: callers sign in, and the app acts with grants you can read.",
          "bundle 把部署变成 git 里的一个文件：App、它的资源及其权限，以及各个 job。重新部署只需一条命令，开发和生产环境只是 target 不同。App 会获得自己的服务主体，取代 funnel 所需要的长期密钥：调用方登录，App 凭着你能看得到的授权来执行操作。",
        ),
        what: t(
          "databricks.yml declares variables and the dev and prod targets; resources/app.yml declares the agent app with its resources: the experiment (CAN_EDIT), every model endpoint the code calls (default, fast, embedding, each CAN_QUERY) and a SQL warehouse (CAN_USE). Deploy uploads the code and starts the app.",
          "databricks.yml 声明变量以及 dev 和 prod 两个 target；resources/app.yml 声明智能体 App，及其资源：实验（CAN_EDIT）、代码会调用的每一个模型端点（默认、快速、embedding，均为 CAN_QUERY）以及一个 SQL warehouse（CAN_USE）。部署会上传代码并启动 App。",
        ),
        how: [
          t("Put the template folder at replicate/databricks/agent_app (or change source_code_path). Compare app.yml with the template's own databricks.yml and keep the template's version where they differ.", "把模板目录放到 replicate/databricks/agent_app（或者修改 source_code_path）。把 app.yml 与模板自带的 databricks.yml 对比，两者不同的地方以模板为准。"),
          t("`databricks bundle validate -t dev`, then `databricks bundle deploy -t dev`, then `databricks bundle run agent_powerhouse -t dev`.", "依次执行 `databricks bundle validate -t dev`、`databricks bundle deploy -t dev`、`databricks bundle run agent_powerhouse -t dev`。"),
          t("Add the Lakebase database as an app resource (Apps UI), then grant the app's service principal: EXECUTE on the tools, USE SCHEMA and SELECT on kb, SELECT on kb_search in Postgres, READ on the secret scope if used.", "在 Apps 界面把 Lakebase 数据库添加为 App 资源，然后给 App 的服务主体授权：工具的 EXECUTE、kb 的 USE SCHEMA 和 SELECT、Postgres 中 kb_search 的 SELECT，如有使用则还需 secret scope 的 READ。"),
          t("Query it with an OAuth token. Personal access tokens are refused.", "用 OAuth 令牌调用它。个人访问令牌会被拒绝。"),
        ],
        files: ["replicate/databricks/databricks.yml", "replicate/databricks/resources/app.yml"],
        code: [{ lang: "bash", text: `APP_URL=$(databricks apps get agent-powerhouse -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["url"])')
curl -sS -X POST "$APP_URL/responses" \\
  -H "Authorization: Bearer $(databricks auth token -o json | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')" \\
  -H "Content-Type: application/json" \\
  -d '{"input": [{"role": "user", "content": "What is the nightly lodging cap?"}]}'` }],
        interpret: [
          t("`bundle validate` prints the resolved configuration. Read the app's resources there: a missing serving_endpoint resource means the app cannot call the model at runtime, even if your user can.", "`bundle validate` 会打印解析后的配置。在那里查看 App 的资源：缺少 serving_endpoint 资源，意味着 App 在运行时无法调用模型，哪怕你自己的用户可以。"),
          t("In dev mode resources are prefixed with your name and schedules are paused. That is intended: dev deploys never run nightly jobs against production data.", "在 dev 模式下，资源会带上你名字的前缀，调度也处于暂停状态。这是有意为之：开发部署永远不会针对生产数据运行夜间任务。"),
          t("The deployed answer to the lodging question should match the local one. If it differs, compare traces before changing anything: retrieval, tool, or model.", "已部署 App 对住宿上限问题的回答应当与本地一致。如果不同，先对比追踪再做任何改动：检索、工具，还是模型。"),
        ],
        trouble: [
          { s: t("401 or 403 from the app URL", "访问 App URL 返回 401 或 403"), c: t("A personal access token, or your user lacks CAN_USE on the app.", "用了个人访问令牌，或者你的用户对 App 没有 CAN_USE 权限。"), f: t("Use `databricks auth token`; grant CAN_USE on the app to the users or group.", "使用 `databricks auth token`；向用户或用户组授予 App 的 CAN_USE 权限。") },
          { s: t("App starts, then crashes on the first request", "App 启动后，在第一个请求时崩溃"), c: t("A dependency missing from the template's dependency file, or an environment variable not set in the app config.", "模板的依赖文件里缺少某个依赖，或者 App 配置中没有设置某个环境变量。"), f: t("Read the app logs in the Apps UI. Add packages to the template's dependency file and env entries (valueFrom for resources) to its app config.", "在 Apps 界面查看 App 日志。把缺的包加入模板的依赖文件，把环境变量（资源用 valueFrom）加入它的 App 配置。") },
          { s: t("403 on the small-talk route or on every search", "闲聊路线或每次检索都返回 403"), c: t("The fast model or the embedding endpoint is not an app resource, so the app's principal cannot query it.", "快速模型或 embedding 端点不是 App 的资源，所以 App 的服务主体无法调用它。"), f: t("Every endpoint the code calls must be listed in app.yml; redeploy after adding it.", "代码会调用的每一个端点都必须列在 app.yml 中；添加后重新部署。") },
          { s: t("The app is not listed among workspace agents", "App 没有出现在工作区的智能体列表里"), c: t("The name must start with `agent-`.", "名字必须以 `agent-` 开头。"), f: t("Rename the app in app.yml and redeploy; bind the existing app if the vendor's bind command applies.", "在 app.yml 中改名并重新部署；如果适用，用厂商的 bind 命令绑定现有 App。") },
        ],
        done: t("The deployed URL answers the lodging question with an OAuth token, and the app's service principal has exactly the grants listed above.", "已部署的 URL 能在 OAuth 令牌下回答住宿上限问题，App 的服务主体恰好拥有上面列出的那些授权。"),
        unconfirmed: t("The JSON field names `url` from `apps get` and `access_token` from `auth token -o json` are what the CLI prints today; check once and adjust the one-liners.", "`apps get` 输出的 `url` 字段和 `auth token -o json` 输出的 `access_token` 字段是 CLI 目前的输出；检查一次，必要时调整这两行命令。"),
      },
      {
        id: "evals",
        title: t("Seal the questions and evaluate the deployed agent, several times", "封存问题集，对已部署的智能体多次评估"),
        local: t("seal_evals.py, chat_eval.py, stream_eval.py, the frozen questions and the history files.", "seal_evals.py、chat_eval.py、stream_eval.py、冻结问题集以及历史文件。"),
        links: ["evaluation.frozen", "evaluation.seal", "evaluation.agent", "evaluation.noise", "evaluation.read"],
        after: ["deploy"],
        why: t(
          "Without a fixed exam, every improvement is a story. The frozen questions were written by a person before anything learned, and the seal makes sure nothing learns from them. Repetition is the other half: module 11 showed one configuration scoring 5 of 6 on one run and 2 of 6 on another. One run cannot tell a change from noise.",
          "没有固定的考题，每一次“改进”都只是一个故事。冻结问题集在任何学习发生之前由人写成，封存保证没有任何东西能从中学习。重复是另一半：第 11 模块展示过，同一配置在一次运行中得 6 分之 5，另一次只得 6 分之 2。只跑一次，无法区分变化和噪声。",
        ),
        what: t(
          "`build` converts the local frozen_questions.json to MLflow records (inputs, expectations), creates the dataset as a Unity Catalog table, and stores a digest in agentlab.evals.seal. `run` checks the digest, then runs mlflow.genai.evaluate N times against the deployed app with three code scorers, and prints mean and spread per scorer.",
          "`build` 把本地的 frozen_questions.json 转成 MLflow 记录（inputs、expectations），以 Unity Catalog 表的形式创建数据集，并把摘要存入 agentlab.evals.seal。`run` 先校验摘要，再针对已部署的 App 用三个代码 scorer 运行 mlflow.genai.evaluate N 次，并打印每个 scorer 的均值和波动范围。",
        ),
        how: [
          t("Once, as the eval owner: `python run_eval.py build frozen_questions.json`.", "以评估负责人身份执行一次：`python run_eval.py build frozen_questions.json`。"),
          t("Confirm builders have no MODIFY on agentlab.evals (step [[catalog]]).", "确认开发者对 agentlab.evals 没有 MODIFY 权限（第 [[catalog]] 步）。"),
          t("Check that the app returns tools and evidence in custom_outputs (step [[agent]]); predict() reads them from there. Create a separate MLflow experiment for eval runs and pass it as --experiment-id.", "检查 App 是否在 custom_outputs 中返回了 tools 和 evidence（第 [[agent]] 步）；predict() 从那里读取。为评估运行单独建一个 MLflow 实验，并通过 --experiment-id 传入。"),
          t("`python run_eval.py run --app-url $APP_URL --repeats 5` before and after every change.", "每次改动前后都运行 `python run_eval.py run --app-url $APP_URL --repeats 5`。"),
        ],
        files: ["replicate/databricks/src/evals/scorers.py", "replicate/databricks/src/evals/run_eval.py"],
        interpret: [
          t("`contains_required/mean 0.833 spread (0.667, 1.000) runs 5`: the agent answers about five of six right on average, and a single run could have shown anything from four to six. A change that moves the mean from 0.833 to 0.867 is inside that spread, so it is not evidence.", "`contains_required/mean 0.833 spread (0.667, 1.000) runs 5`：智能体平均答对约六分之五，而单次运行可能显示四到六题中的任何一个。如果某个改动把均值从 0.833 提到 0.867，仍在这个波动范围之内，所以不能算证据。"),
          t("`grounded_figures` below 1.0 on the deployed app means the guard let an unsupported figure through, or was bypassed. Find that question first; it outranks every other score.", "已部署 App 的 `grounded_figures` 低于 1.0，说明护栏放过了没有依据的数字，或者被绕过了。先找出这道题；它比其他任何分数都更重要。"),
          t("`called_needed_tool` low with `contains_required` high means answers come from the model's memory, right by luck. It will fail on the next policy change.", "`called_needed_tool` 很低而 `contains_required` 很高，说明答案来自模型的记忆，碰巧答对了。下一次政策变更时它就会出错。"),
          t("`SEAL BROKEN` stops the run. Do not reseal to get past it: find who changed the dataset and why, then create a new versioned set if the change was legitimate.", "出现 `SEAL BROKEN` 会终止运行。不要为了绕过它而重新封存：查清是谁、为什么改了数据集；如果改动合理，就新建一个带版本号的问题集。"),
        ],
        trouble: [
          { s: t("Scorers all fail with missing keys", "所有 scorer 都因缺少键而失败"), c: t("predict() returns a different shape from what the scorers read (answer, tools, evidence).", "predict() 返回的结构与 scorer 读取的结构（answer、tools、evidence）不一致。"), f: t("Print one predict() result and align the keys. The vendor page notes scorers must also handle a missing expectations field.", "打印一次 predict() 的结果，把键对齐。厂商页面提到，scorer 还必须能处理缺少 expectations 字段的情况。") },
          { s: t("Every run scores 0", "每次运行都得 0 分"), c: t("The app returned errors (401) that predict() turned into empty answers.", "App 返回了错误（401），而 predict() 把它们变成了空答案。"), f: t("raise_for_status() is in predict(); if you removed it, put it back. An eval must fail loudly when the target is down.", "predict() 中有 raise_for_status()；如果你删掉了，请加回来。目标不可用时，评估必须明确地报错。") },
        ],
        done: t("Five runs of the frozen set against the deployed app, with mean and spread recorded next to the local history.", "针对已部署 App 跑了五次冻结问题集，均值和波动范围已记录在本地历史数据旁边。"),
        unconfirmed: t("`mlflow.genai.datasets.get_dataset(uc_table_name=...)`, `to_df()` and the `/mean` metric key suffix are from MLflow 3's evaluation API; the create and merge calls are from the vendor tutorial.", "`mlflow.genai.datasets.get_dataset(uc_table_name=...)`、`to_df()` 以及指标键的 `/mean` 后缀来自 MLflow 3 的评估 API；create 和 merge 调用来自厂商教程。"),
      },
      {
        id: "jobs",
        title: t("Schedule ingest, edges, evals and the learner as jobs", "把 ingest、边、评估和学习器排成定时 job"),
        local: t("launchd timers, nightly/scheduler.py with its duty cycle and preemption.", "launchd 定时器，以及带占空比控制和抢占机制的 nightly/scheduler.py。"),
        links: ["ops.scheduler", "ops.nightly", "evaluation.schedule"],
        after: ["ingest", "edges", "evals"],
        why: t(
          "On the Mac, background work competed with the user for one GPU, so a scheduler had to yield. Serverless jobs run on their own compute, so the duty cycle disappears and only two rules remain: order (edges after ingest, learner after eval) and cost. A job file in the bundle is reviewed like code, which a launchd plist rarely was.",
          "在 Mac 上，后台任务和用户争用同一块 GPU，所以调度器必须让步。serverless job 在自己的计算资源上运行，占空比因此不复存在，只剩两条规则：顺序（边在 ingest 之后，学习器在评估之后）和成本。bundle 里的 job 文件会像代码一样被审查，而 launchd plist 很少如此。",
        ),
        what: t(
          "resources/jobs.yml defines three jobs on serverless environments: hourly ingest followed by two dependent tasks (graph edges, and the search refresh for your backend), the nightly eval at 02:30, and the learner at 04:00, created paused.",
          "resources/jobs.yml 在 serverless 环境上定义了三个 job：每小时运行的 ingest 及其后的两个依赖任务（图的边，以及针对所选后端的检索刷新），02:30 的夜间评估，以及 04:00 的学习器（创建时处于暂停状态）。",
        ),
        how: [
          t("Set the variables (retrieval, experiment_id, eval_experiment_id, app_url, warehouse_id) in the target or with --var.", "在 target 中或用 --var 设置变量（retrieval、experiment_id、eval_experiment_id、app_url、warehouse_id）。"),
          t("`databricks bundle deploy -t prod` once dev runs are clean.", "dev 环境运行无误后，执行 `databricks bundle deploy -t prod`。"),
          t("Trigger each job once by hand from the Jobs UI and read its output before trusting the schedule.", "在 Jobs 界面中手动触发每个 job 一次，阅读它的输出，然后再信任定时调度。"),
          t("Check the refresh_search task's output after each ingest: it is what makes new chunks searchable.", "每次 ingest 之后检查 refresh_search 任务的输出：正是它让新文本块变得可检索。"),
        ],
        files: ["replicate/databricks/resources/jobs.yml"],
        interpret: [
          t("A green run is not a correct run. Read the ingest task's `changed N` line: an hourly job that always says changed 0 is healthy only if nobody uploaded anything.", "运行成功（绿色）不等于运行正确。看 ingest 任务的 `changed N` 这一行：一个每小时都显示 changed 0 的 job，只有在确实没人上传文件时才算健康。"),
          t("The eval job's printed spread is the number to put in the morning summary, not only the mean.", "早上的汇总里应该写评估 job 打印出的波动范围，而不只是均值。"),
          t("A failed edges task with a successful ingest leaves old edges in place, which is safe; the reverse cannot happen because of depends_on.", "ingest 成功而 edges 任务失败，会保留旧的边，这是安全的；反过来的情况不会发生，因为有 depends_on。"),
        ],
        trouble: [
          { s: t("ModuleNotFoundError in a job task", "job 任务中报 ModuleNotFoundError"), c: t("A package missing from the environment's dependencies, or src/ not synced.", "环境依赖中缺少某个包，或者 src/ 没有同步。"), f: t("Add the package under environments.spec.dependencies. The bundle syncs the folder containing databricks.yml, so keep src/ beneath it.", "把包加到 environments.spec.dependencies 下。bundle 会同步 databricks.yml 所在的目录，所以要把 src/ 放在它下面。") },
          { s: t("Schedules never fire in dev", "在 dev 中调度从不触发"), c: t("Development mode pauses schedules.", "开发模式会暂停调度。"), f: t("Intended. Run by hand in dev, schedule in prod.", "这是有意为之。在 dev 中手动运行，在 prod 中定时运行。") },
          { s: t("environment_version rejected", "environment_version 被拒绝"), c: t("The vendor example shows '2'; newer versions exist and old ones retire.", "厂商示例里写的是 '2'；已有更新的版本，旧版本会被淘汰。"), f: t("Use the current serverless environment version listed in your workspace.", "使用你工作区中列出的当前 serverless 环境版本。") },
        ],
        done: t("Each job has one manual run you have read, and prod schedules are visible in the Jobs UI with the learner paused.", "每个 job 都有一次你读过输出的手动运行，prod 的调度在 Jobs 界面中可见，学习器处于暂停状态。"),
      },
    ],
  },
  {
    id: "operate",
    title: t("Learn and operate", "学习与运维"),
    goal: t(
      "The learning loop and the status screen come last because they read what everything else writes. They carry over with the same discipline as on the Mac: observe in report mode, prove before proposing, and let a person apply a change as a commit.",
      "学习循环和状态面板放在最后，因为它们读取的是其他所有部分写下的东西。它们沿用与 Mac 上相同的纪律：以报告模式观察，先证明再提议，由人把改动以提交的形式应用。",
    ),
    steps: [
      {
        id: "learner",
        title: t("Self-observation over traces, in report mode", "基于追踪的自我观察，采用报告模式"),
        local: t("nightly/self_observe.py, corroboration_audit.py, claim_verify.py, and the cursor table.", "nightly/self_observe.py、corroboration_audit.py、claim_verify.py，以及游标表。"),
        links: ["self-evolving.observe", "self-evolving.evidence", "self-evolving.report", "state.cursor", "self-evolving.preconditions"],
        after: ["jobs"],
        why: t(
          "The failures that matter return success codes: a tool that returned nothing and an agent that reported zero. The learner finds them mechanically and proves each one by re-running the call with one filter removed. It writes findings and changes nothing, because module 13 showed what an unsupervised learner does to its own eval.",
          "真正要紧的失败返回的都是成功状态码：工具什么也没返回，智能体就报告了零。学习器以机械的方式找出它们，并通过去掉一个过滤条件重新调用来证明每一条。它只写下发现，不做任何改动，因为第 13 模块已经展示过无人监督的学习器会对它自己的评估做什么。",
        ),
        what: t(
          "Reads MLflow traces newer than the cursor, inspects tool spans for query_expenses, re-runs empty calls with one optional argument dropped (never the employee id), counts turn-budget exhaustion, appends findings to agentlab.ops.findings, and only then moves the cursor.",
          "读取比游标更新的 MLflow 追踪，检查 query_expenses 的工具 span，对空结果的调用去掉一个可选参数（绝不去掉员工 id）后重跑，统计轮次预算耗尽的次数，把发现追加到 agentlab.ops.findings，然后才移动游标。",
        ),
        how: [
          t("Run the learner job by hand for a week while it is paused on schedule.", "在定时调度保持暂停期间，手动运行学习器 job 一周。"),
          t("Each morning read the findings query from step [[monitor]].", "每天早上查看第 [[monitor]] 步中的 findings 查询。"),
          t("For each finding, open a pull request that fixes the tool, the prompt or a skill; run step [[evals]] on the branch.", "对每条发现，提交一个修正工具、提示词或技能的 pull request；在该分支上运行第 [[evals]] 步。"),
          t("Unpause the schedule only when the findings have been useful for a week.", "只有当这些发现连续一周都有用时，才取消调度暂停。"),
        ],
        files: ["replicate/databricks/src/learner/nightly.py"],
        interpret: [
          t("`recoverable_empty query_expenses.relax_claim_month` with proof `... -> 0 rows; without claim_month -> 12 rows` means users ask for months that have no data and the agent reports nothing instead of saying which months exist. The fix belongs in the tool's diagnostic or the skill, not in the model.", "`recoverable_empty query_expenses.relax_claim_month`，证据为 `... -> 0 rows; without claim_month -> 12 rows`，意味着用户问的月份没有数据，而智能体什么也没说，也没指出哪些月份有数据。修正应该放在工具的诊断信息或技能里，而不是模型里。"),
          t("`budget_exhaustion` counts that rise after a deploy point at a prompt or tool change that made the model loop.", "部署后 `budget_exhaustion` 数量上升，指向某次提示词或工具改动让模型陷入了循环。"),
          t("`cursor 1730000000000 -> 1730086400000` moving forward each night is the job's heartbeat. A cursor that stops moving with traces still arriving means the job fails before the last line.", "游标每晚向前推进（例如 `cursor 1730000000000 -> 1730086400000`）是这个 job 的心跳。如果追踪还在持续产生而游标不再移动，说明 job 在最后一行之前就失败了。"),
        ],
        trouble: [
          { s: t("No traces found", "找不到任何追踪"), c: t("Wrong experiment id, or the app logs traces to a different experiment.", "实验 id 不对，或者 App 把追踪记录到了另一个实验。"), f: t("Use the experiment the app resource points to (app.yml).", "使用 App 资源所指向的那个实验（app.yml）。") },
          { s: t("Findings repeat every night for the same calls", "同样的调用每晚都重复出现在发现里"), c: t("The cursor was not saved, so old traces are re-read.", "游标没有保存，所以旧的追踪被重复读取。"), f: t("Check the cursors table has a new row per run; the INSERT must come after findings are written.", "检查游标表每次运行都有一行新记录；INSERT 必须在写入发现之后执行。") },
        ],
        done: t("A week of findings, each with a proof line, and at least one acted on through a reviewed pull request with an eval run.", "积累了一周的发现，每条都带有证据行，并且至少有一条已通过经过审查、附带评估运行的 pull request 得到处理。"),
        unconfirmed: t("`mlflow.search_traces(..., return_type=\"list\")`, `Trace.search_spans(span_type=SpanType.TOOL)` and the filter string on timestamp_ms are MLflow 3 tracing APIs; how the template names tool spans was not checked, so the script matches on the last dotted segment of the span name.", "`mlflow.search_traces(..., return_type=\"list\")`、`Trace.search_spans(span_type=SpanType.TOOL)` 以及基于 timestamp_ms 的过滤字符串都是 MLflow 3 的追踪 API；模板如何命名工具 span 未经核实，所以脚本按 span 名称中最后一个点号之后的部分来匹配。"),
      },
      {
        id: "monitor",
        title: t("One-screen status and cost", "一屏状态与成本"),
        local: t("Check-All-LLM-Status, pg_backup.sh with its restore test, and the SOP.", "Check-All-LLM-Status、带恢复测试的 pg_backup.sh，以及操作规程（SOP）。"),
        links: ["ops.status", "ops.logs", "ops.backup", "ops.inventory"],
        after: ["jobs"],
        why: t(
          "On the Mac, cost was electricity and the risk was a full disk. On Databricks cost is per token, per DBU and per app hour, and it grows quietly. The status screen answers four questions every morning: did the jobs run, is the knowledge fresh, is anything failing silently, and what did yesterday cost.",
          "在 Mac 上，成本是电费，风险是磁盘写满。在 Databricks 上，成本按 token、按 DBU、按 App 运行小时计算，而且会悄悄增长。状态面板每天早上回答四个问题：job 跑了吗？知识是新鲜的吗？有没有什么在悄悄失败？昨天花了多少钱？",
        ),
        what: t(
          "Five queries: spend by product from system.billing.usage, knowledge freshness from the ledger, chunks in service per collection, findings per night, and recent job runs from the Lakeflow system tables.",
          "五条查询：来自 system.billing.usage 的按产品花费、来自台账的知识新鲜度、每个集合在服务中的文本块数、每晚的发现数，以及来自 Lakeflow 系统表的近期 job 运行情况。",
        ),
        how: [
          t("Run each query once and adjust names: billing product values and system.lakeflow table names vary by account.", "每条查询运行一次并调整名称：计费产品的取值和 system.lakeflow 的表名因账号而异。"),
          t("Save them on one dashboard; add SQL alerts on queries 3, 4 and 5.", "把它们保存在同一个仪表盘上；为第 3、4、5 条查询添加 SQL 告警。"),
          t("Set a budget alert at the account level for model serving.", "在账号层面为模型服务设置预算告警。"),
          t("Backups: Delta keeps history (time travel) for the tables; Lakebase branches give point-in-time copies. Test a restore once, as module 15 requires.", "备份：Delta 为表保留历史（time travel）；Lakebase 的分支提供时间点副本。像第 15 模块要求的那样，做一次恢复测试。"),
        ],
        files: ["replicate/databricks/src/ops/monitor.sql"],
        code: [{ lang: "sql", text: `-- restore test for the chunk table: read yesterday's version, compare counts
SELECT count(*) FROM agentlab.kb.chunks TIMESTAMP AS OF date_sub(current_date(), 1);
DESCRIBE HISTORY agentlab.kb.chunks LIMIT 5;` }],
        interpret: [
          t("Spend that grows while query count is flat means tokens per request grew: a longer prompt, more retrieved text, or more tool rounds. Check the agent's prompt size before anything else.", "如果花费在增长而请求数持平，说明每个请求的 token 数增加了：提示词变长、检索的文本变多，或者工具轮次变多。先检查智能体的提示词大小。"),
          t("`in_service` dropping sharply for one collection after an ingest run is the retire step removing more than it should, usually a renamed folder. Restore with time travel, then fix the paths.", "某次 ingest 后某个集合的 `in_service` 急剧下降，说明停用步骤移除得太多了，通常是因为目录改了名。用 time travel 恢复，然后修正路径。"),
          t("No row for last night in the job query means it did not run at all; a FAILED row means it ran and stopped. They have different fixes: schedule and permissions versus code.", "job 查询里没有昨晚的记录，说明它根本没跑；有一条 FAILED 记录，说明它跑了但中途停止了。两者的修法不同：前者是调度和权限问题，后者是代码问题。"),
        ],
        trouble: [
          { s: t("PERMISSION_DENIED on system tables", "访问系统表时报 PERMISSION_DENIED"), c: t("System schemas must be enabled and granted by an account admin.", "系统 schema 需要账号管理员启用并授权。"), f: t("Ask for SELECT on system.billing and system.lakeflow for the dashboard's owner.", "为仪表盘所有者申请 system.billing 和 system.lakeflow 的 SELECT 权限。") },
          { s: t("Query 1 returns nothing", "第 1 条查询没有返回任何结果"), c: t("The product names in the IN list do not match your account's values.", "IN 列表中的产品名与你账号中的取值不匹配。"), f: t("Run the DISTINCT query in the file comment and replace the list.", "运行文件注释中的 DISTINCT 查询，替换这个列表。") },
        ],
        done: t("One dashboard answers the four morning questions, alerts exist on the last three queries, and one restore has been tested.", "一个仪表盘能回答早上的四个问题，后三条查询都配置了告警，并且做过一次恢复测试。"),
        unconfirmed: t("system.lakeflow.job_run_timeline and the billing_origin_product values are written from general knowledge of the system tables, not from a page read for this guide.", "system.lakeflow.job_run_timeline 以及 billing_origin_product 的取值来自对系统表的一般了解，并非出自本指南参考的页面。"),
      },
      {
        id: "frontend",
        title: t("Decide where the public tutor lives", "决定公开教程站放在哪里"),
        local: t("This site and the datamatter site on Vercel, calling the Mac through the funnel with a local-first chain.", "本站和 Vercel 上的 datamatter 站点，通过 funnel 以“本地优先”的链路调用 Mac。"),
        links: ["api-gateway.expose", "inference.contract", "api-gateway.keys"],
        after: ["gateway"],
        why: t(
          "A Databricks App requires a workspace sign-in. That is right for the agent, which reads company data, and wrong for a public tutor that anyone may use. So the public front end stays outside, and it reaches models through the gateway with its own service principal, its own rate limit, and no access to any data.",
          "Databricks App 需要登录工作区。这对读取公司数据的智能体来说是对的，但对任何人都可以使用的公开教程站来说就不对了。所以公开前端留在外部，它通过网关访问模型，使用自己的服务主体和自己的限流，不能访问任何数据。",
        ),
        what: t(
          "Keeps the site on Vercel and adds Databricks as one more link in the tutor's chain, using machine-to-machine OAuth: the function exchanges a client ID and secret for a token valid for an hour and calls the gateway's OpenAI-compatible endpoint.",
          "把站点留在 Vercel 上，并把 Databricks 作为教程站链路中的又一个环节，使用机器对机器 OAuth：函数用 client ID 和 secret 换取一个有效期一小时的令牌，再调用网关的 OpenAI 兼容端点。",
        ),
        how: [
          t("Create a service principal `tutor-public` with CAN_QUERY on one fast model endpoint only, and a strict gateway rate limit.", "创建一个服务主体 `tutor-public`，只给它一个快速模型端点的 CAN_QUERY 权限，并设置严格的网关限流。"),
          t("Store its client ID and secret as Vercel environment variables (never in the repo).", "把它的 client ID 和 secret 存为 Vercel 的环境变量（绝不放进仓库）。"),
          t("In api/tutor.py, mint a token with the snippet below, cache it for 50 minutes, and call the chat endpoint with it.", "在 api/tutor.py 中用下面的代码片段生成令牌，缓存 50 分钟，再用它调用对话端点。"),
        ],
        code: [{ lang: "python", file: "api/tutor.py (addition)", text: `import base64, json, os, time, urllib.request

_tok = {"v": None, "exp": 0}
def databricks_token():
    if _tok["v"] and time.time() < _tok["exp"]:
        return _tok["v"]
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    cred = base64.b64encode(f'{os.environ["DATABRICKS_CLIENT_ID"]}:{os.environ["DATABRICKS_CLIENT_SECRET"]}'.encode()).decode()
    req = urllib.request.Request(f"{host}/oidc/v1/token", data=b"grant_type=client_credentials&scope=all-apis",
                                 headers={"Authorization": f"Basic {cred}", "Content-Type": "application/x-www-form-urlencoded"})
    body = json.load(urllib.request.urlopen(req, timeout=10))
    _tok.update(v=body["access_token"], exp=time.time() + min(body.get("expires_in", 3600), 3000))
    return _tok["v"]

# then, as one more link in links():  base = f"{host}/serving-endpoints", key = databricks_token(),
# model = "databricks-qwen3-next-80b-a3b-instruct"` }],
        interpret: [
          t("The tutor's answer footer will read `answered by cloud · databricks-...` when this link answers. If it never does, the earlier links answered first, which is the intended order.", "当这个环节作答时，教程站回答底部会显示 `answered by cloud · databricks-...`。如果从来不显示，说明前面的环节先作答了，这正是预期的顺序。"),
          t("A 401 after about an hour means the token was cached longer than it lives. The snippet caps the cache at 50 minutes.", "大约一小时后出现 401，说明令牌缓存的时间超过了它的有效期。代码片段把缓存上限设为 50 分钟。"),
        ],
        trouble: [
          { s: t("400 invalid_client from the token endpoint", "令牌端点返回 400 invalid_client"), c: t("Wrong client secret, or the secret belongs to another workspace's principal.", "client secret 错了，或者这个 secret 属于另一个工作区的服务主体。"), f: t("Generate a new OAuth secret for the principal and update both Vercel variables.", "为该服务主体生成新的 OAuth secret，并更新两个 Vercel 变量。") },
          { s: t("403 when calling the model", "调用模型时返回 403"), c: t("The principal lacks CAN_QUERY on that endpoint.", "该服务主体对那个端点没有 CAN_QUERY 权限。"), f: t("Grant it on that one endpoint, nothing more.", "只授予它对那一个端点的权限，不要更多。") },
        ],
        done: t("The public tutor answers through the Databricks link when the local links are down, and the principal can reach nothing except that one endpoint.", "本地环节不可用时，公开教程站能通过 Databricks 环节作答，并且该服务主体除了那一个端点之外什么都访问不到。"),
        unconfirmed: t("The `/oidc/v1/token` client-credentials flow and the `/serving-endpoints` OpenAI base path are the platform's documented M2M and serving patterns, but neither page was read for this guide; the vendor's query page also shows an `/ai-gateway/mlflow/v1` base URL for gateway access.", "`/oidc/v1/token` 的 client-credentials 流程和 `/serving-endpoints` 这个 OpenAI 基础路径是平台文档中的 M2M 和模型服务用法，但本指南没有参考这两个页面；厂商的查询页面还给出了一个用于网关访问的 `/ai-gateway/mlflow/v1` 基础 URL。"),
      },
    ],
  },
];
