import { t, type PlatformGuide } from "@/lib/types";

/**
 * Platform walkthroughs. None of these were executed by the author: there was no
 * account on any of these platforms. Commands and names come from the vendor pages
 * listed under `sources`, read in October 2026. Where a detail could not be confirmed
 * on a vendor page, the step says so.
 */
export const guides: PlatformGuide[] = [
  {
    id: "databricks",
    name: "Databricks",
    kind: t("Managed data and AI platform", "托管的数据与 AI 平台"),
    summary: t(
      "The platform runs models, the index, and the deployed agent. You write the agent code, the tools, and the evaluation, and you keep them in a repository deployed with a bundle.",
      "平台负责运行模型、索引和已部署的智能体。你编写智能体代码、工具和评估，把它们放在代码仓库里，用 bundle 部署。",
    ),
    owns: {
      you: t("Agent code, tool functions, instructions, gold sets, scorers, the publish pipeline for documents.", "智能体代码、工具函数、指令、标准集、scorer、文档的发布流程。"),
      platform: t("Model endpoints, Unity Gateway, AI Search indexes, Agent Runtime and Apps, MLflow tracing, Jobs, permissions.", "模型端点、Unity Gateway、AI Search 索引、Agent Runtime 与 Apps、MLflow tracing、Jobs、权限。"),
    },
    steps: [
      {
        module: "inference",
        title: t("Reach models through Unity Gateway", "通过 Unity Gateway 访问模型"),
        do: [
          t("Pick a hosted model endpoint in the workspace.", "在工作区里选一个托管的模型端点。"),
          t("Route calls through Unity Gateway so one client reaches every model.", "让调用经过 Unity Gateway，这样一个客户端就能访问所有模型。"),
          t("Measure tokens per second and first-token time for the endpoint, exactly as in module 1.", "测量该端点的每秒 token 数和首 token 时间，做法与第 1 模块完全相同。"),
        ],
        code: { lang: "python", text: `from agents import set_default_openai_client
from databricks_openai import AsyncDatabricksOpenAI

set_default_openai_client(AsyncDatabricksOpenAI(use_ai_gateway=True))` },
        verify: t("A chat call returns a completion and appears in gateway usage.", "一次 chat 调用返回了结果，并出现在网关的用量记录里。"),
      },
      {
        module: "knowledge",
        title: t("Land documents and keep the ledger as a table", "落地文档，并把台账做成一张表"),
        do: [
          t("Upload raw files to a Unity Catalog volume, using the same folder taxonomy.", "把原始文件上传到 Unity Catalog volume，沿用同样的目录分类。"),
          t("Run the validation and chunking code from labs 3 and 5 in a job. Write chunks to a Delta table with columns id, source, text, context, tier.", "在一个 job 里运行 lab 3 和 lab 5 的校验与切块代码。把文本块写入 Delta 表，列包括 id、source、text、context、tier。"),
          t("Keep the ledger as a second Delta table.", "把台账做成第二张 Delta 表。"),
        ],
        verify: t("The chunk table has one row per chunk and a primary key column.", "文本块表每个块一行，并有主键列。"),
      },
      {
        module: "rag-graph",
        title: t("Create an AI Search index over the chunk table", "在文本块表上创建 AI Search 索引"),
        do: [
          t("Create an endpoint, then a Delta Sync index with a managed embedding model.", "先创建 endpoint，再创建使用托管 embedding 模型的 Delta Sync 索引。"),
          t("Query it. The vendor page shows `query_type=\"FULL_TEXT\"`. It mentions hybrid search and does not show the hybrid value, so confirm that on the query page.", "对它执行查询。厂商文档给出的示例是 `query_type=\"FULL_TEXT\"`。文档提到了混合检索，但没有给出对应的取值，请到查询相关页面确认。"),
          t("Apply the tier bonus and dedup from lab 5 to the returned rows in your tool code.", "在你的工具代码里，对返回的数据行应用 lab 5 的等级加分和去重。"),
        ],
        code: { lang: "python", text: `from databricks.ai_search.client import AISearchClient

client = AISearchClient()
client.create_endpoint(name="policy_endpoint", endpoint_type="STANDARD")

index = client.create_delta_sync_index(
    endpoint_name="policy_endpoint",
    source_table_name="main.agent.policy_chunks",
    index_name="main.agent.policy_chunks_index",
    pipeline_type="TRIGGERED",
    primary_key="id",
    embedding_source_column="text",
    embedding_model_endpoint_name="databricks-qwen3-embedding-0-6b",
)

results = index.similarity_search(query_text="lodging cap", columns=["id", "text"], num_results=10,
                                  query_type="FULL_TEXT")` },
        verify: t("The gold set from lab 11 scores at least as well against this index as against the lab index.", "lab 11 的标准集在这个索引上的得分不低于在 lab 索引上的得分。"),
      },
      {
        module: "harness",
        title: t("Author the agent from the app template", "基于应用模板编写智能体"),
        do: [
          t("Clone the vendor's app templates and open the OpenAI Agents SDK template.", "克隆厂商的应用模板仓库，打开 OpenAI Agents SDK 那个模板。"),
          t("Define tools with the decorator and create the agent with your instructions.", "用装饰器定义工具，并用你的指令创建智能体。"),
          t("Run it locally before deploying.", "部署之前先在本地运行。"),
        ],
        code: { lang: "bash", text: `git clone https://github.com/databricks/app-templates.git
cd app-templates/agent-openai-agents-sdk
uv run quickstart
uv run start-app            # then open http://localhost:8000` },
        verify: t("The local app answers a question using your tool.", "本地应用使用你的工具回答了一个问题。"),
      },
      {
        module: "tools-mcp",
        title: t("Add tools and grant their permissions", "添加工具并授予权限"),
        do: [
          t("Local function tools need no resource grant.", "本地函数工具不需要授予资源权限。"),
          t("Add MCP servers in agent code and grant their permissions in `databricks.yml`.", "在智能体代码中添加 MCP 服务，并在 `databricks.yml` 里授予相应权限。"),
          t("Keep the diagnostic-on-empty rule from lab 6 in every tool you write.", "你写的每个工具都要保留 lab 6 里“空结果必须带诊断信息”的规则。"),
        ],
        verify: t("A call with a filter that matches nothing returns a diagnostic.", "使用匹配不到任何数据的过滤条件调用时，返回了诊断信息。"),
      },
      {
        module: "ops",
        title: t("Deploy with a bundle", "用 bundle 部署"),
        do: [
          t("Validate, deploy, then run the app.", "先校验，再部署，然后运行应用。"),
          t("Name the app with the prefix `agent-` so it appears in the workspace agents list.", "应用名以 `agent-` 开头，这样它才会出现在工作区的智能体列表里。"),
          t("Query it with an OAuth token. Personal access tokens are not accepted for this.", "用 OAuth 令牌调用它。这里不接受个人访问令牌。"),
        ],
        code: { lang: "bash", text: `databricks bundle validate
databricks bundle deploy
databricks bundle run agent_openai_agents_sdk

# query: POST https://<app-url>/responses  with  Authorization: Bearer $(databricks auth token ...)` },
        verify: t("The deployed URL answers the same question the local app did.", "已部署的 URL 能回答本地应用回答过的同一个问题。"),
      },
      {
        module: "evaluation",
        title: t("Evaluate with MLflow scorers and a Unity Catalog dataset", "用 MLflow scorer 和 Unity Catalog 数据集做评估"),
        do: [
          t("Create an evaluation dataset as a Unity Catalog table and merge records into it.", "以 Unity Catalog 表的形式创建评估数据集，并把记录合并进去。"),
          t("Run `mlflow.genai.evaluate` with your predict function and a list of scorers.", "用你的 predict 函数和一组 scorer 运行 `mlflow.genai.evaluate`。"),
          t("Restrict write permission on the dataset table. That is the seal.", "限制该数据集表的写权限。这就是封存。"),
          t("Repeat runs and report the spread, as in lab 11.", "像 lab 11 那样多次运行并报告波动范围。"),
        ],
        code: { lang: "python", text: `import mlflow
from mlflow.genai.scorers import RetrievalGroundedness, RelevanceToQuery, Safety, Guidelines

eval_dataset = mlflow.genai.datasets.create_dataset(uc_table_name="main.agent.frozen_questions")
# eval_dataset = eval_dataset.merge_records(traces_or_records)

results = mlflow.genai.evaluate(
    data=eval_dataset,
    predict_fn=ask_agent,
    scorers=[RetrievalGroundedness(), RelevanceToQuery(), Safety()],
)` },
        verify: t("An evaluation run appears in MLflow with one row per question and a score per scorer.", "MLflow 里出现一次评估运行，每个问题一行，每个 scorer 一个分数。"),
      },
      {
        module: "self-evolving",
        title: t("Schedule the learning loop as a job", "把学习循环排成定时任务"),
        do: [
          t("Run the observe, evidence, and gate code from lab 13 as a scheduled job over the trace tables.", "把 lab 13 的观察、证据和关卡代码作为定时任务，在 trace 表上运行。"),
          t("Keep it in report mode until you have read a week of reports.", "在你看完一周的报告之前，让它保持报告模式。"),
          t("Apply a change as a commit to the repository, deployed by the bundle.", "把改动以提交的形式应用到仓库，再由 bundle 部署。"),
        ],
        verify: t("Every applied rule is a commit with an evaluation run linked to it.", "每条已应用的规则都对应一次提交，并关联了一次评估运行。"),
      },
    ],
    sources: [
      { title: "Author an agent (Databricks docs)", url: "https://docs.databricks.com/aws/en/generative-ai/agent-framework/author-agent" },
      { title: "Create and query an AI Search index", url: "https://docs.databricks.com/aws/en/generative-ai/create-query-vector-search" },
      { title: "Agent Bricks overview", url: "https://docs.databricks.com/aws/en/generative-ai/agent-bricks/" },
      { title: "Tutorial: evaluate and improve an agent", url: "https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/evaluate-app" },
    ],
  },
  {
    id: "watsonx",
    name: "IBM watsonx Orchestrate",
    kind: t("Managed agent platform", "托管的智能体平台"),
    summary: t(
      "Orchestrate is the harness. You declare agents in YAML, write tools in Python, and import both with a command-line tool. The platform runs the loop.",
      "Orchestrate 本身就是 Harness。你用 YAML 声明智能体，用 Python 编写工具，再用命令行工具把两者导入。循环由平台运行。",
    ),
    owns: {
      you: t("Tool code, agent YAML and instructions, knowledge sources, test cases.", "工具代码、智能体 YAML 和指令、知识来源、测试用例。"),
      platform: t("The agent loop, model access, thread state, the chat UI, deployment across environments.", "智能体循环、模型访问、会话状态、聊天界面、跨环境部署。"),
    },
    steps: [
      {
        module: "api-gateway",
        title: t("Install the kit and connect an environment", "安装开发套件并连接环境"),
        do: [
          t("Install the Agent Development Kit.", "安装 Agent Development Kit。"),
          t("Add your service instance as an environment and activate it.", "把你的服务实例添加为一个环境并激活。"),
        ],
        code: { lang: "bash", text: `pip install --upgrade ibm-watsonx-orchestrate
orchestrate env add -n my-env -u <service-instance-url>
orchestrate env activate my-env` },
        verify: t("`orchestrate tools list` runs without an authentication error.", "`orchestrate tools list` 运行时没有认证错误。"),
      },
      {
        module: "tools-mcp",
        title: t("Write a Python tool and import it", "编写一个 Python 工具并导入"),
        do: [
          t("Decorate a function with the kit's tool decorator. The docstring describes it to the model.", "用套件提供的 tool 装饰器装饰函数。docstring 向模型描述这个工具。"),
          t("Return a diagnostic when the result is empty, as in lab 6.", "结果为空时返回诊断信息，做法同 lab 6。"),
          t("Import the file with its requirements.", "连同依赖文件一起导入。"),
        ],
        code: { lang: "python", file: "expenses_tool.py", text: `from ibm_watsonx_orchestrate.agent_builder.tools import tool


@tool()
def query_expenses(category: str = "", city: str = "", month: str = "") -> dict:
    """Total and list expense records. Filters are optional: category, city, month (YYYY-MM)."""
    ...

# orchestrate tools import -k python -f expenses_tool.py -r requirements.txt` },
        verify: t("The tool appears in `orchestrate tools list`.", "该工具出现在 `orchestrate tools list` 的输出里。"),
      },
      {
        module: "tools-mcp",
        title: t("Or register the MCP server from lab 6 as a toolkit", "或者把 lab 6 的 MCP 服务注册为工具包"),
        do: [
          t("Add a toolkit of kind mcp with the command that starts your server.", "添加一个 mcp 类型的工具包，并给出启动你的服务的命令。"),
          t("Expose all tools or name the ones to expose.", "暴露全部工具，或指定要暴露哪些。"),
        ],
        code: { lang: "bash", text: `orchestrate toolkits add \\
  --kind mcp \\
  --name policy_desk \\
  --description "Policy search and expense queries" \\
  --package_root ./mcp_server \\
  --command "python server.py" \\
  --tools "*"` },
        verify: t("Both tools from the server are listed.", "该服务的两个工具都被列出。"),
      },
      {
        module: "rag-graph",
        title: t("Create a knowledge base", "创建知识库"),
        do: [
          t("A knowledge base takes uploaded files or a connected vector store such as Milvus, Elasticsearch, or AstraDB.", "知识库可以使用上传的文件，或接入 Milvus、Elasticsearch、AstraDB 这类向量库。"),
          t("Validate and curate documents first, with the intake from lab 3. The platform indexes what you give it.", "先用 lab 3 的入库流程校验和整理文档。你给什么，平台就索引什么。"),
          t("The import command was not on the pages read. Follow the knowledge base page under sources.", "所查阅的页面上没有给出导入命令。请按“来源”里的知识库页面操作。"),
        ],
        verify: t("A question whose answer is only in your documents is answered with a citation.", "一个答案只存在于你的文档中的问题，得到了带引用的回答。"),
      },
      {
        module: "harness",
        title: t("Declare the agent in YAML and import it", "用 YAML 声明智能体并导入"),
        do: [
          t("Write name, model, description, and instructions. List tools, collaborators, and knowledge bases by name.", "写明名称、模型、描述和指令。按名称列出工具、协作者和知识库。"),
          t("Put the instructions from your base prompt and skills here.", "把基础提示词和技能里的指令写在这里。"),
          t("Import the file, then test in the Agent Builder chat.", "导入文件，然后在 Agent Builder 的聊天界面里测试。"),
          t("The field names were confirmed on the vendor page. The values shown for spec_version, kind, and style are from general knowledge. Confirm them there.", "字段名已在厂商页面上确认。示例中 spec_version、kind 和 style 的取值来自一般性了解，请到该页面核实。"),
        ],
        code: { lang: "yaml", file: "policy-desk.yaml", text: `spec_version: v1
kind: native
name: policy_desk
llm: <model id from your environment>
style: default
description: Answers travel policy and expense questions.
instructions: >
  Use a tool before stating any rule, limit or amount.
  Report only what a tool returned. If a tool returns nothing, say what you searched.
tools:
  - query_expenses
knowledge_base:
  - travel_policy
collaborators: []

# orchestrate agents import -f policy-desk.yaml` },
        verify: t("The agent answers the Boston lodging question from lab 7 with the figure from your tool.", "智能体用你的工具返回的数字回答了 lab 7 里关于波士顿住宿的问题。"),
      },
      {
        module: "multi-agent",
        title: t("Split work with collaborators", "用协作者拆分工作"),
        do: [
          t("Create one narrow agent per role, each with its own tools.", "为每个角色创建一个专职智能体，各自拥有自己的工具。"),
          t("List them under `collaborators` in a supervising agent.", "在一个主管智能体的 `collaborators` 下列出它们。"),
          t("Justify the split with a measurement, as in lab 12.", "像 lab 12 那样，用测量结果来证明拆分是合理的。"),
        ],
        verify: t("A compound question is answered with parts from both collaborators.", "一个复合问题的回答包含了来自两个协作者的内容。"),
      },
      {
        module: "evaluation",
        title: t("Evaluate with the kit's framework and your own gold sets", "用套件的评估框架和你自己的标准集做评估"),
        do: [
          t("The kit includes an evaluation framework that compares simulated interactions with reference data.", "套件内置评估框架，把模拟的交互与参考数据进行比较。"),
          t("Keep your frozen questions from lab 11 as the reference data, outside the agent's reach.", "把 lab 11 的冻结问题作为参考数据，放在智能体接触不到的地方。"),
          t("The exact command was not on the pages read. Follow the evaluation page under sources.", "所查阅的页面上没有给出具体命令。请按“来源”里的评估页面操作。"),
        ],
        verify: t("You have a score for the agent before and after a change to its instructions.", "你有了智能体在修改指令前后的得分。"),
      },
    ],
    sources: [
      { title: "Getting started with the ADK", url: "https://developer.watson-orchestrate.ibm.com/getting_started/installing" },
      { title: "Authoring Python-based tools", url: "https://developer.watson-orchestrate.ibm.com/tools/create_tool" },
      { title: "Importing local MCP toolkits", url: "https://developer.watson-orchestrate.ibm.com/tools/toolkits/local_mcp_toolkits" },
      { title: "Authoring native agents", url: "https://developer.watson-orchestrate.ibm.com/agents/build_agent" },
      { title: "Creating knowledge bases", url: "https://developer.watson-orchestrate.ibm.com/knowledge_base/build_kb" },
      { title: "Evaluating agents and tools", url: "https://developer.watson-orchestrate.ibm.com/evaluate/evaluate" },
    ],
  },
  {
    id: "codex",
    name: "Codex",
    kind: t("Coding agent", "编程智能体"),
    summary: t(
      "Codex is a finished harness for work in a repository. You do not write its loop. You configure its model, instructions, tools, and limits, and you can run it without a terminal session as a step in a pipeline.",
      "Codex 是面向代码仓库工作的现成 Harness。它的循环不用你写。你配置的是模型、指令、工具和限制，还可以让它脱离终端会话，作为流水线中的一个步骤运行。",
    ),
    owns: {
      you: t("AGENTS.md, skills, MCP servers, the eval scripts it runs, the approval and sandbox settings.", "AGENTS.md、技能、MCP 服务、它要运行的评估脚本、审批和沙箱设置。"),
      platform: t("The loop, context management, the sandbox, session history.", "循环、上下文管理、沙箱、会话历史。"),
    },
    steps: [
      {
        module: "inference",
        title: t("Find the config file and choose the model provider", "找到配置文件并选择模型供应商"),
        do: [
          t("User settings live in `~/.codex/config.toml`. A trusted project may add `.codex/config.toml`.", "用户级设置在 `~/.codex/config.toml`。受信任的项目可以另加 `.codex/config.toml`。"),
          t("A provider is a table with a base URL and the name of the environment variable holding its key.", "供应商是一张表，包含 base URL 和存放其密钥的环境变量名。"),
          t("Provider settings in a project-level file are ignored. Set them in the user file.", "项目级文件里的供应商设置会被忽略。要在用户级文件里设置。"),
        ],
        code: { lang: "toml", file: "~/.codex/config.toml", text: `model_provider = "local"

[model_providers.local]
base_url = "http://127.0.0.1:8000/v1"     # your gateway from module 2
env_key = "LOCAL_GATEWAY_KEY"` },
        verify: t("A prompt is answered and your gateway log shows the request.", "一条提示得到了回答，并且你的网关日志里出现了这次请求。"),
      },
      {
        module: "harness",
        title: t("Write AGENTS.md", "编写 AGENTS.md"),
        do: [
          t("Put standing instructions in `AGENTS.md` at the repository root.", "把长期有效的指令放在仓库根目录的 `AGENTS.md` 里。"),
          t("Keep it short. Add a rule only after it has been broken once.", "保持简短。某条规则被违反过一次之后，才把它加进去。"),
        ],
        verify: t("A new session follows a rule that appears only in the file.", "新的会话遵守了一条只出现在该文件里的规则。"),
      },
      {
        module: "tools-mcp",
        title: t("Register the MCP server from lab 6", "注册 lab 6 的 MCP 服务"),
        do: [
          t("Add a table per server with the launcher command and arguments.", "为每个服务添加一张表，写明启动命令和参数。"),
          t("Raise the per-tool timeout if a tool can run longer than the default 60 seconds.", "如果某个工具的运行时间可能超过默认的 60 秒，就调高单个工具的超时时间。"),
        ],
        code: { lang: "toml", file: "~/.codex/config.toml", text: `[mcp_servers.policy-desk]
command = "/abs/path/to/venv/bin/python3"
args = ["-m", "labs.m06_tools.mcp_server"]
tool_timeout_sec = 120

[mcp_servers.policy-desk.env]
PYTHONPATH = "/abs/path/to/aitutor"` },
        verify: t("The agent can call `search_policy`.", "智能体可以调用 `search_policy`。"),
      },
      {
        module: "skills",
        title: t("Add skills", "添加技能"),
        do: [
          t("Skills are supported. Reuse the skill bodies from lab 8.", "Codex 支持技能。复用 lab 8 里的技能正文。"),
          t("The folder location and frontmatter were not on the page read. Follow the vendor's skills page.", "所查阅的页面上没有给出目录位置和 frontmatter 格式。请参照厂商的技能文档。"),
        ],
        verify: t("The agent loads the skill for a matching request.", "遇到匹配的请求时，智能体加载了该技能。"),
      },
      {
        module: "guardrails",
        title: t("Set approvals, permissions, and hooks", "设置审批、权限和钩子"),
        do: [
          t("`approval_policy` takes `on-request` or `never`, or a granular table.", "`approval_policy` 取值为 `on-request`、`never`，或一张细粒度配置表。"),
          t("Built-in permission profiles are read-only, workspace, and full access. Start with the narrowest that lets the task finish.", "内置的权限档位有只读、工作区和完全访问。从能完成任务的最窄档位开始。"),
          t("Lifecycle hooks can be enabled and are loaded from a hooks file. Use one to run your checks before a change is accepted.", "可以启用生命周期钩子，它们从一个 hooks 文件加载。用钩子在接受改动之前运行你的检查。"),
        ],
        verify: t("A write outside the workspace is refused.", "对工作区之外的写入被拒绝。"),
      },
      {
        module: "evaluation",
        title: t("Run it without a terminal as an eval gate", "脱离终端运行，把评估作为关卡"),
        do: [
          t("Run Codex non-interactively in a pipeline with a fixed prompt.", "在流水线里用固定的提示以非交互方式运行 Codex。"),
          t("Have the pipeline run your retrieval and agent evals afterward and fail on a drop.", "之后让流水线运行你的检索评估和智能体评估，得分下降就判定失败。"),
          t("Keep gold files outside the paths the agent may write.", "把标准集文件放在智能体可写路径之外。"),
          t("The `exec` subcommand is from general knowledge and was not on the page read. Confirm it with `codex --help`.", "`exec` 子命令来自一般性了解，所查阅的页面上没有出现。请用 `codex --help` 确认。"),
        ],
        code: { lang: "bash", text: `codex exec "Run python3 -m labs.run_all --check and summarize any failure."
python3 -m labs.run_all --check` },
        verify: t("The pipeline fails when an eval score drops.", "评估得分下降时，流水线失败。"),
      },
      {
        module: "sdk",
        title: t("For your own service, use the Agents SDK", "要做自己的服务，就用 Agents SDK"),
        do: [
          t("Codex is for work in a repository. For an agent you host, the loop is the OpenAI Agents SDK.", "Codex 面向的是仓库内的工作。要托管自己的智能体，循环用的是 OpenAI Agents SDK。"),
          t("Lab 14 has that port, running against your gateway.", "lab 14 里有这个移植版本，对接的是你的网关。"),
        ],
        verify: t("`python3 -m labs.m14_sdk.demo` prints the Agents SDK line.", "`python3 -m labs.m14_sdk.demo` 输出了 Agents SDK 那一行。"),
      },
    ],
    sources: [
      { title: "Codex configuration reference", url: "https://learn.chatgpt.com/docs/config-file/config-reference" },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: t("Editor with an agent", "带智能体的编辑器"),
    summary: t(
      "Cursor is a finished harness inside an editor. You cannot change its loop. You control it through rules, an instructions file, MCP servers, and hooks.",
      "Cursor 是嵌在编辑器里的现成 Harness。它的循环无法修改。你通过规则、指令文件、MCP 服务和钩子来控制它。",
    ),
    owns: {
      you: t("Rules, AGENTS.md, MCP servers, hook scripts, the eval scripts in your repository.", "规则、AGENTS.md、MCP 服务、钩子脚本、仓库里的评估脚本。"),
      platform: t("The loop, code indexing, context selection, model routing.", "循环、代码索引、上下文选择、模型路由。"),
    },
    steps: [
      {
        module: "skills",
        title: t("Write project rules", "编写项目规则"),
        do: [
          t("Rules live in `.cursor/rules` as `.mdc` files. A plain `.md` file there is ignored.", "规则以 `.mdc` 文件的形式放在 `.cursor/rules` 下。放在那里的普通 `.md` 文件会被忽略。"),
          t("Frontmatter has three fields: `description`, `globs`, `alwaysApply`.", "frontmatter 有三个字段：`description`、`globs`、`alwaysApply`。"),
          t("With only a description, the agent pulls the rule in when relevant. That is the skill pattern from module 8.", "只写 description 时，智能体会在相关时自行引入该规则。这就是第 8 模块的技能模式。"),
        ],
        code: { lang: "markdown", file: ".cursor/rules/expense-investigation.mdc", text: `---
description: Questions about what was actually spent, by whom, where or when
alwaysApply: false
---
Call query_expenses before stating any amount. Name the filters you used.
When the result is empty, read the diagnostic and relax the filter it names.
Never explain why spending could not exist.` },
        verify: t("The rule is applied for a spending question and absent for a greeting.", "遇到支出类问题时规则被应用，遇到问候语时没有。"),
      },
      {
        module: "harness",
        title: t("Add AGENTS.md for standing instructions", "添加 AGENTS.md 存放长期指令"),
        do: [
          t("AGENTS.md is supported in the project root and in subdirectories.", "项目根目录和子目录里的 AGENTS.md 都受支持。"),
          t("Nested files apply to their directory and combine with parent files. The more specific one takes precedence.", "嵌套的文件对所在目录生效，并与上级文件合并。更具体的那个优先。"),
        ],
        verify: t("An instruction in a subdirectory file applies only to work in that directory.", "子目录文件里的指令只对该目录下的工作生效。"),
      },
      {
        module: "tools-mcp",
        title: t("Register the MCP server", "注册 MCP 服务"),
        do: [
          t("Add the server to the project MCP config with a command and arguments.", "在项目的 MCP 配置里添加该服务，写明命令和参数。"),
          t("The file location `.cursor/mcp.json` is from general knowledge and was not on the pages read. Confirm it on the vendor's MCP page.", "`.cursor/mcp.json` 这个文件位置来自一般性了解，所查阅的页面上没有出现。请到厂商的 MCP 文档确认。"),
        ],
        code: { lang: "json", file: ".cursor/mcp.json", text: `{
  "mcpServers": {
    "policy-desk": {
      "command": "/abs/path/to/venv/bin/python3",
      "args": ["-m", "labs.m06_tools.mcp_server"]
    }
  }
}` },
        verify: t("The two tools are listed in the editor's tool settings.", "编辑器的工具设置里列出了这两个工具。"),
      },
      {
        module: "guardrails",
        title: t("Enforce policy with hooks", "用钩子强制执行策略"),
        do: [
          t("Project hooks live in `.cursor/hooks.json`. User hooks live in `~/.cursor/hooks.json`.", "项目级钩子在 `.cursor/hooks.json`，用户级钩子在 `~/.cursor/hooks.json`。"),
          t("The `hooks` object maps an event name to a list of definitions, each with a `command`.", "`hooks` 对象把事件名映射到一组定义，每个定义都有一个 `command`。"),
          t("A hook script reads JSON on stdin. Exit code 2 blocks the action. Other non-zero codes fail open unless `failClosed` is set.", "钩子脚本从 stdin 读取 JSON。退出码 2 会阻止操作。其他非零退出码默认放行，除非设置了 `failClosed`。"),
        ],
        code: { lang: "json", file: ".cursor/hooks.json", text: `{
  "version": 1,
  "hooks": {
    "beforeMCPExecution": [
      { "command": "./.cursor/hooks/check-tool.sh", "failClosed": true }
    ],
    "beforeShellExecution": [
      { "command": "./.cursor/hooks/check-shell.sh" }
    ]
  }
}` },
        verify: t("A blocked action shows as denied and the agent continues without it.", "被阻止的操作显示为已拒绝，智能体在没有它的情况下继续工作。"),
      },
      {
        module: "evaluation",
        title: t("Keep evals as scripts and require them", "把评估做成脚本，并要求必须通过"),
        do: [
          t("Evals are files in your repository. The labs run with one command.", "评估就是仓库里的文件。lab 用一条命令就能跑完。"),
          t("Use a `stop` or `afterFileEdit` hook to run the retrieval eval when ranking code changes.", "用 `stop` 或 `afterFileEdit` 钩子，在排序代码发生变化时运行检索评估。"),
        ],
        verify: t("Editing the search code triggers the eval.", "编辑检索代码会触发评估。"),
      },
      {
        module: "multi-agent",
        title: t("Subagents and skills", "子智能体与技能"),
        do: [
          t("The vendor documentation has pages for subagents and skills. They were not read for this guide.", "厂商文档里有子智能体和技能的页面。本指南没有查阅它们。"),
          t("Apply the test from module 12 before adding one: name the need and the measurement.", "增加之前先做第 12 模块的检验：说出具体需求和测量方式。"),
        ],
        verify: t("You can state why the subagent exists.", "你能说出这个子智能体为什么存在。"),
      },
    ],
    sources: [
      { title: "Cursor rules", url: "https://cursor.com/docs/context/rules" },
      { title: "Cursor hooks", url: "https://cursor.com/docs/hooks" },
    ],
  },
  {
    id: "claude",
    name: "Claude Code / Agent SDK",
    kind: t("Coding agent and SDK", "编程智能体与 SDK"),
    summary: t(
      "Claude Code is a harness with the same parts you built: a project instruction file, skills, hooks, MCP tools, subagents. The Agent SDK exposes that loop as a library. The reference build uses it with its own MCP server and skills.",
      "Claude Code 这个 Harness 的部件和你亲手搭建的一样：项目指令文件、技能、钩子、MCP 工具、子智能体。Agent SDK 把这个循环以库的形式提供出来。参考系统就把它和自己的 MCP 服务、技能配合使用。",
    ),
    owns: {
      you: t("CLAUDE.md, skills, hook scripts, MCP servers, subagent definitions, eval scripts.", "CLAUDE.md、技能、钩子脚本、MCP 服务、子智能体定义、评估脚本。"),
      platform: t("The loop, context management, permission prompts, session history.", "循环、上下文管理、权限提示、会话历史。"),
    },
    steps: [
      {
        module: "harness",
        title: t("Write the project instruction file", "编写项目指令文件"),
        do: [
          t("Put standing instructions in `CLAUDE.md` at the project root.", "把长期有效的指令放在项目根目录的 `CLAUDE.md` 里。"),
          t("Keep it short. It is charged against context on every turn. The reference build adds a rule only after it has been broken once.", "保持简短。它每一轮都要占用上下文。参考系统的做法是：某条规则被违反过一次之后才加进去。"),
        ],
        verify: t("A new session follows a rule that appears only in that file.", "新的会话遵守了一条只出现在该文件里的规则。"),
      },
      {
        module: "tools-mcp",
        title: t("Register the MCP server", "注册 MCP 服务"),
        do: [
          t("Add the server to `.mcp.json` in the project root with an absolute interpreter path.", "在项目根目录的 `.mcp.json` 里添加该服务，解释器使用绝对路径。"),
          t("Approve the server when the session starts.", "会话启动时批准该服务。"),
        ],
        code: { lang: "json", file: ".mcp.json", text: `{
  "mcpServers": {
    "policy-desk": {
      "command": "/abs/path/to/venv/bin/python3",
      "args": ["-m", "labs.m06_tools.mcp_server"]
    }
  }
}` },
        verify: t("The session lists `search_policy` and `query_expenses`.", "会话列出了 `search_policy` 和 `query_expenses`。"),
      },
      {
        module: "skills",
        title: t("Share skills", "共享技能"),
        do: [
          t("Create `.claude/skills/<name>/SKILL.md`. The description decides when it loads.", "创建 `.claude/skills/<name>/SKILL.md`。其中的描述决定它何时加载。"),
          t("Link the files from lab 8 so one edit changes both agents.", "链接 lab 8 的文件，这样改一处两个智能体同时生效。"),
        ],
        code: { lang: "bash", text: `mkdir -p .claude/skills/expense-investigation
ln -s "$PWD/labs/m08_skills/skills/expense-investigation.md" .claude/skills/expense-investigation/SKILL.md` },
        verify: t("The skill appears in the session's skill list.", "该技能出现在会话的技能列表里。"),
      },
      {
        module: "guardrails",
        title: t("Block tool calls with a PreToolUse hook", "用 PreToolUse 钩子阻止工具调用"),
        do: [
          t("Hooks are configured in `.claude/settings.json` for the project, or `~/.claude/settings.json` for all projects.", "钩子在项目的 `.claude/settings.json` 里配置，或在对所有项目生效的 `~/.claude/settings.json` 里配置。"),
          t("A hook group has a `matcher` and a list of handlers of type `command`.", "一组钩子包含一个 `matcher` 和若干 `command` 类型的处理程序。"),
          t("To block: exit with code 2, or print the deny decision as JSON and exit 0.", "要阻止调用：以退出码 2 退出，或以 JSON 输出拒绝决定并以 0 退出。"),
          t("A hook that times out does not block. Do not rely on a stalled hook as a gate.", "超时的钩子不会阻止调用。不要指望一个卡住的钩子能起到关卡作用。"),
        ],
        code: { lang: "json", file: ".claude/settings.json", text: `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "\${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh" }
        ]
      }
    ]
  }
}

// block-rm.sh prints this and exits 0 to deny:
// {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
//   "permissionDecisionReason": "Destructive command blocked by hook"}}` },
        verify: t("The blocked command does not run and the reason is shown.", "被阻止的命令没有执行，并显示了原因。"),
      },
      {
        module: "inference",
        title: t("Optional: run it against local models", "可选：让它对接本地模型"),
        do: [
          t("The reference build runs a translation proxy that accepts the vendor's API shape and forwards to local models.", "参考系统运行了一个协议转换代理，接受该厂商的 API 格式并转发给本地模型。"),
          t("Point the client at the proxy with its base URL setting, and give the proxy its own key.", "通过 base URL 设置让客户端指向这个代理，并给代理单独的密钥。"),
          t("Check the real prompt size in the engine log. A context setting that is present may not be in effect.", "在引擎日志里检查真实的提示词大小。写了的上下文设置未必生效。"),
        ],
        verify: t("The engine log shows the request and a prompt size within your limit.", "引擎日志显示了这次请求，且提示词大小在你的限制之内。"),
      },
      {
        module: "sdk",
        title: t("Use the Agent SDK for your own service", "用 Agent SDK 构建自己的服务"),
        do: [
          t("Lab 14 has a port that lists the MCP server in the options and sets `max_turns`.", "lab 14 里有一个移植版本，在选项中列出 MCP 服务并设置了 `max_turns`。"),
          t("It was not executed in the lab run. Run it with your own key.", "它没有在 lab 运行中执行过。请用你自己的密钥运行。"),
        ],
        code: { lang: "bash", text: `pip install claude-agent-sdk
export ANTHROPIC_API_KEY=...
python3 -m labs.m14_sdk.claude_agent_sdk_agent` },
        verify: t("The answer states the cap and the amount from the tools.", "回答中给出了工具返回的上限和金额。"),
      },
    ],
    sources: [
      { title: "Claude Code hooks reference", url: "https://code.claude.com/docs/en/hooks" },
    ],
  },
  {
    id: "other",
    name: "Another machine",
    kind: t("Self-hosted", "自托管"),
    summary: t(
      "The labs are plain Python. On a second machine you clone the repository, point two environment variables at a model endpoint, and use the operating system's own supervisor.",
      "lab 都是纯 Python。在第二台机器上，你只需克隆仓库、把两个环境变量指向模型端点，并使用操作系统自带的进程守护。",
    ),
    owns: {
      you: t("Everything.", "全部。"),
      platform: t("Nothing. The operating system supervises processes.", "没有。进程由操作系统守护。"),
    },
    steps: [
      {
        module: "inference",
        title: t("Run the labs offline first", "先离线运行 lab"),
        do: [
          t("Clone the repository and run every lab against the fake model.", "克隆仓库，用假模型运行所有 lab。"),
          t("This proves the Python environment before any model is involved.", "这一步在涉及任何模型之前，先验证 Python 环境没问题。"),
        ],
        code: { lang: "bash", text: `git clone <your repository url> aitutor && cd aitutor
python3 -m labs.run_all --check` },
        verify: t("Every line reads ok. Optional labs may be skipped if their package is missing.", "每一行都显示 ok。缺少依赖包的可选 lab 可能被跳过。"),
      },
      {
        module: "inference",
        title: t("Serve a model and point the labs at it", "部署一个模型并让 lab 指向它"),
        do: [
          t("On NVIDIA hardware use vLLM or llama.cpp. On Apple silicon use Ollama or MLX. Any OpenAI-compatible server works.", "NVIDIA 硬件用 vLLM 或 llama.cpp。Apple 芯片用 Ollama 或 MLX。任何 OpenAI 兼容的服务都可以。"),
          t("Write the memory budget for this machine first. The numbers differ.", "先为这台机器写好内存预算。数字会不一样。"),
          t("Export the two variables and re-run a lab.", "导出两个环境变量，然后重新运行一个 lab。"),
        ],
        code: { lang: "bash", text: `export LAB_BASE_URL=http://127.0.0.1:8000/v1
export LAB_MODEL=<model name on this server>
python3 -m labs.m07_harness.demo` },
        verify: t("The answer now comes from the real model and still cites tool results.", "回答现在来自真实模型，并且仍然引用了工具结果。"),
      },
      {
        module: "state",
        title: t("Start Postgres when you outgrow the lab database", "当 lab 数据库不够用时，启动 Postgres"),
        do: [
          t("Run Postgres with the vector extension in a container, bound to localhost.", "在容器里运行带向量扩展的 Postgres，并绑定到 localhost。"),
          t("Create one schema per owner prefix.", "按归属前缀各建一个 schema。"),
        ],
        code: { lang: "bash", text: `docker run -d --name agentdb -e POSTGRES_PASSWORD=change-me -p 127.0.0.1:5432:5432 pgvector/pgvector:pg17
psql -h 127.0.0.1 -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE SCHEMA kb; CREATE SCHEMA brain; CREATE SCHEMA mem;"` },
        verify: t("The concurrent-writer test from module 4 passes.", "第 4 模块的并发写入测试通过。"),
      },
      {
        module: "ops",
        title: t("Supervise with systemd", "用 systemd 守护进程"),
        do: [
          t("Copy the unit file from the labs, replace the placeholders, enable it.", "复制 lab 里的 unit 文件，替换占位符，然后启用。"),
          t("Use absolute paths. Kill the process and confirm it returns.", "使用绝对路径。杀掉进程，确认它会自动恢复。"),
        ],
        code: { lang: "bash", text: `sudo cp labs/m15_ops/units/agent-server.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now agent-server
systemctl status agent-server` },
        verify: t("The service is active after a reboot.", "重启机器后服务处于 active 状态。"),
      },
      {
        module: "ops",
        title: t("Schedule the nightly window and send backups elsewhere", "安排夜间时间窗，并把备份送到别处"),
        do: [
          t("Install the timer. In the window run backup, the retrieval eval, and the learning loop in report mode.", "安装 timer。在时间窗内运行备份、检索评估和报告模式的学习循环。"),
          t("Copy one encrypted backup to a different machine or bucket.", "把一份加密备份复制到另一台机器或存储桶。"),
        ],
        verify: t("A morning report exists and the restore test passed.", "早上的报告已生成，并且恢复测试通过。"),
      },
    ],
    sources: [],
  },
];
