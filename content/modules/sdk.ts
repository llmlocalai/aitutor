import { t, type Module } from "@/lib/types";

export const sdk: Module = {
  id: "sdk",
  n: 14,
  layer: 6,
  title: t("SDKs and frameworks", "SDK 与框架"),
  short: t(
    "What agent SDKs give you, mapped onto parts you have already built by hand.",
    "智能体 SDK 提供了什么，对照你已经亲手搭建过的各个部件来理解。",
  ),
  what: t(
    "An agent SDK packages the harness: the tool loop, state handling, streaming, tracing, and often handoffs and guardrails. This module runs the same agent on three loops: the hand-built one, LangGraph, and the OpenAI Agents SDK, with a Claude Agent SDK port alongside.",
    "智能体 SDK 把 Harness 打包好了：工具循环、状态处理、流式输出、追踪，通常还有交接和护栏。本模块让同一个智能体在三种循环上运行：手写的循环、LangGraph 和 OpenAI Agents SDK，另附一个 Claude Agent SDK 的移植版本。",
  ),
  why: t(
    "If you can name the part an SDK feature replaces, you can adopt or leave any framework without rewriting your system. Having built each part once makes every SDK's documentation readable.",
    "如果你能说出某个 SDK 功能替代的是哪个部件，你就可以采用或放弃任何框架，而不用重写系统。每个部件都亲手做过一遍之后，任何 SDK 的文档都读得懂。",
  ),
  how: [
    t("Every SDK has a tool loop with a round limit. That replaces the planner and tool nodes.", "每个 SDK 都有带轮次上限的工具循环。它替代的是规划节点和工具节点。"),
    t("Graph frameworks make state explicit with reducers. That is merge_state.", "图框架用 reducer 把状态显式化。那就是 merge_state。"),
    t("Tools are Python functions with type hints and a docstring, or an MCP server.", "工具是带类型注解和 docstring 的 Python 函数，或者一个 MCP 服务。"),
    t("Tracing replaces JSON-lines logs. Check where traces are sent.", "追踪（tracing）替代 JSON Lines 日志。要确认 trace 被发送到了哪里。"),
    t("Your tools, skills, evals, and answer checks stay outside the framework.", "你的工具、技能、评估和回答检查都留在框架之外。"),
  ],
  prereqs: [
    {
      id: "harness",
      why: t("You evaluate an SDK by comparing it with a loop you understand. Without that, every framework's defaults look like requirements.", "评估一个 SDK，靠的是把它和你理解的循环做比较。没有这个基础，任何框架的默认值看起来都像是必须如此。"),
      stub: t("Follow one framework's quickstart first, then return to the harness module to see what it hid.", "先照着某个框架的快速入门做一遍，再回到 Harness 模块看它隐藏了什么。"),
    },
    {
      id: "tools-mcp",
      why: t("Tools are what you carry between SDKs. Having them behind one registry and one MCP server makes the comparison a few lines per SDK.", "工具是你在各个 SDK 之间带着走的东西。把它们放在一个注册表和一个 MCP 服务后面，每个 SDK 的对比就只需要几行代码。"),
      stub: t("One inline function tool.", "一个内联的函数工具。"),
    },
    {
      id: "api-gateway",
      why: t("SDKs need an endpoint. The gateway gives every SDK the same OpenAI-compatible base URL, so the model is held constant while the loop changes.", "SDK 需要一个端点。网关为每个 SDK 提供同一个 OpenAI 兼容的 base URL，这样在更换循环时模型保持不变。"),
      stub: t("Point the SDK at a hosted provider.", "让 SDK 直接连托管的供应商。"),
    },
  ],
  inBuild: [
    { path: "apps/agent-server/", role: t("The hand-built reference for every part an SDK provides.", "SDK 所提供的每个部件的手写参照实现。") },
    { path: "apps/claude-code-gateway/", role: t("Lets a coding agent's loop run against local models.", "让编程智能体的循环可以对接本地模型。") },
    { path: "study-notes/08_Extending_The_Harness_Agent.md", role: t("How to add capabilities without breaking the contract.", "如何在不破坏契约的前提下增加能力。") },
  ],
  flow: {
    caption: t("The same parts, under three names", "同样的部件，三套名称"),
    stages: [
      { label: t("Endpoint", "端点"), detail: t("Hand-built: chat(). LangGraph: ChatOpenAI(base_url). Agents SDK: OpenAIChatCompletionsModel.", "手写：chat()。LangGraph：ChatOpenAI(base_url)。Agents SDK：OpenAIChatCompletionsModel。"), kind: "model" },
      { label: t("Tools", "工具"), detail: t("Hand-built: Registry. LangGraph: functions passed in a list. Agents SDK: @function_tool.", "手写：Registry。LangGraph：以列表传入的函数。Agents SDK：@function_tool。"), kind: "tool" },
      { label: t("Loop", "循环"), detail: t("Hand-built: Agent.run(). LangGraph: create_react_agent. Agents SDK: Runner.", "手写：Agent.run()。LangGraph：create_react_agent。Agents SDK：Runner。"), kind: "check" },
      { label: t("Round budget", "轮次预算"), detail: t("Hand-built: max_rounds. LangGraph: recursion_limit. Agents SDK: max_turns.", "手写：max_rounds。LangGraph：recursion_limit。Agents SDK：max_turns。"), kind: "check" },
      { label: t("Record", "记录"), detail: t("Hand-built: JSON lines. SDKs: traces.", "手写：JSON Lines。SDK：trace。"), kind: "store" },
    ],
  },
  steps: [
    {
      id: "map",
      title: t("Map SDK features to parts you built", "把 SDK 的功能对应到你搭建过的部件"),
      why: t("Read before you install. The map tells you which defaults to check and what to keep outside.", "先读再装。这张对照表告诉你该检查哪些默认值，以及哪些东西要留在框架之外。"),
      do: [
        t("For the SDK you are considering, find its name for: the loop, the round limit, tool definition, state merging, guard or hook points, tracing.", "针对你考虑使用的 SDK，找出它对下列概念的叫法：循环、轮次上限、工具定义、状态合并、护栏或钩子接入点、追踪。"),
        t("For each, write what it does at the limit. Does it raise, return, or answer from evidence?", "对每一项，写下它在达到上限时的行为：抛异常、直接返回，还是根据已有证据作答？"),
        t("Find where traces go by default.", "查明 trace 默认发送到哪里。"),
      ],
      verify: t("You have a table with one row per harness part and the SDK's name for it.", "你有了一张表：每个 Harness 部件一行，旁边是 SDK 对它的叫法。"),
      needs: [{ step: "harness.run", what: t("the list of parts to map", "要对应的部件清单") }],
      produces: t("A mapping table for one SDK.", "一张针对某个 SDK 的对照表。"),
    },
    {
      id: "endpoint",
      title: t("Give every SDK the same endpoint", "给每个 SDK 同一个端点"),
      why: t("Hold the model constant so differences come from the loop. The gateway from module 2 serves that purpose unchanged.", "让模型保持不变，这样差异就只来自循环。第 2 模块的网关无需改动就能承担这个角色。"),
      do: [
        t("Start the gateway on a local port and issue a key with chat and tools scopes.", "在本地端口启动网关，并签发一个带 chat 和 tools 权限的密钥。"),
        t("With `LAB_BASE_URL` unset it answers with the fake model. Set it and the same SDK code reaches your real model.", "不设置 `LAB_BASE_URL` 时它用假模型回答。设置之后，同样的 SDK 代码就会连到你的真实模型。"),
      ],
      lab: { file: "labs/m14_sdk/serve_fake.py" },
      verify: t("`start()` returns a base URL ending in /v1 and a key.", "`start()` 返回一个以 /v1 结尾的 base URL 和一个密钥。"),
      needs: [
        { step: "api-gateway.handler", what: t("serve()", "serve()") },
        { step: "api-gateway.keys", what: t("a key with the tools scope", "带 tools 权限的密钥") },
      ],
      produces: t("A base URL and key that any OpenAI-compatible SDK accepts.", "任何 OpenAI 兼容 SDK 都能接受的 base URL 和密钥。"),
    },
    {
      id: "langgraph",
      title: t("Port the agent to LangGraph", "把智能体移植到 LangGraph"),
      why: t("First port, because a graph framework is closest to the wave executor you wrote.", "第一个移植对象选它，因为图框架和你写的波次执行器最接近。"),
      do: [
        t("`pip install langgraph langchain-openai`.", "`pip install langgraph langchain-openai`。"),
        t("Wrap each registry tool in a plain function with a docstring.", "把注册表里的每个工具包装成带 docstring 的普通函数。"),
        t("Create the model with your base URL and key. Create the agent with the tools and the same base prompt.", "用你的 base URL 和密钥创建模型。用这些工具和同样的基础提示词创建智能体。"),
        t("Set `recursion_limit`. That is the round budget.", "设置 `recursion_limit`。它就是轮次预算。"),
      ],
      lab: { file: "labs/m14_sdk/langgraph_agent.py", region: "langgraph" },
      verify: t("The message types read human, ai, tool, ai: the same shape as planner, tool, planner.", "消息类型依次是 human、ai、tool、ai：与“规划、工具、规划”的结构相同。"),
      needs: [
        { step: "sdk.endpoint", what: t("base URL and key", "base URL 和密钥") },
        { step: "tools-mcp.tools", what: t("build_registry()", "build_registry()") },
        { step: "sdk.map", what: t("which settings to look for", "需要关注哪些设置") },
      ],
      produces: t("`langgraph_agent.make()` and `ask()`.", "`langgraph_agent.make()` 和 `ask()`。"),
    },
    {
      id: "agents-sdk",
      title: t("Port the agent to the OpenAI Agents SDK", "把智能体移植到 OpenAI Agents SDK"),
      why: t("Second port, to see the same parts under different names. Two ports show what is common to SDKs and what is one vendor's choice.", "第二个移植对象，用来看同样的部件换了名字是什么样子。做两次移植，才能看出哪些是各 SDK 的共性，哪些是某家厂商自己的选择。"),
      do: [
        t("`pip install openai-agents`.", "`pip install openai-agents`。"),
        t("Decorate each tool with `@function_tool`.", "用 `@function_tool` 装饰每个工具。"),
        t("Create a chat-completions model with a client that points at your base URL.", "创建一个 chat-completions 模型，其客户端指向你的 base URL。"),
        t("Disable tracing, or decide knowingly to send traces to the vendor. It is on by default.", "关闭 tracing，或者在知情的前提下决定把 trace 发给厂商。它默认是开启的。"),
        t("Pass `max_turns` when running.", "运行时传入 `max_turns`。"),
      ],
      lab: { file: "labs/m14_sdk/openai_agents_agent.py", region: "agents-sdk" },
      verify: t("The run items read tool call, tool output, message.", "运行条目依次是：工具调用、工具输出、消息。"),
      needs: [
        { step: "sdk.endpoint", what: t("base URL and key", "base URL 和密钥") },
        { step: "tools-mcp.tools", what: t("build_registry()", "build_registry()") },
      ],
      produces: t("`openai_agents_agent.make()` and `ask()`.", "`openai_agents_agent.make()` 和 `ask()`。"),
    },
    {
      id: "compare",
      title: t("Run all three and compare", "三个都跑一遍并比较"),
      why: t("Now there are three loops over the same tools and endpoint. Compare what each did.", "现在同样的工具和端点上有了三个循环。比较它们各自做了什么。"),
      do: [
        t("Run the demo. It asks one question through each loop.", "运行 demo。它把同一个问题分别交给每个循环。"),
        t("Compare the sequence each reports.", "比较各自报告的执行序列。"),
        t("Then run each through your agent eval. The eval scores answers and does not care which loop produced them.", "然后让每个都通过你的智能体评估。评估只给回答打分，不关心是哪个循环产生的。"),
      ],
      run: "python3 -m labs.m14_sdk.demo",
      output: "m14.demo",
      verify: t("All three call `search_policy` once and then answer.", "三者都调用了一次 `search_policy`，然后作答。"),
      needs: [
        { step: "sdk.langgraph", what: t("the LangGraph port", "LangGraph 移植版") },
        { step: "sdk.agents-sdk", what: t("the Agents SDK port", "Agents SDK 移植版") },
        { step: "harness.run", what: t("the hand-built loop as reference", "作为参照的手写循环") },
      ],
      produces: t("Evidence that the loop is the replaceable part.", "证明循环是可以替换的那部分。"),
    },
    {
      id: "claude",
      title: t("Port to the Claude Agent SDK through MCP", "通过 MCP 移植到 Claude Agent SDK"),
      why: t("This port reuses the MCP server from module 6 with no wrapper functions, which shows the second way tools travel. It was not executed in the lab run.", "这个移植直接复用第 6 模块的 MCP 服务，不需要包装函数，展示了工具迁移的第二种方式。它没有在 lab 运行中实际执行。"),
      do: [
        t("`pip install claude-agent-sdk` and set an API key.", "`pip install claude-agent-sdk` 并设置 API 密钥。"),
        t("In the options, list the MCP server by command and arguments.", "在选项里用命令和参数列出 MCP 服务。"),
        t("Allow the two tools by their MCP names, and set `max_turns`.", "按 MCP 名称允许这两个工具，并设置 `max_turns`。"),
        t("Iterate the messages from `query()` and collect the text.", "遍历 `query()` 返回的消息并收集文本。"),
      ],
      lab: { file: "labs/m14_sdk/claude_agent_sdk_agent.py", region: "claude-sdk" },
      verify: t("Run it yourself with a key. Imports and option names were checked against the installed package. Behavior was not.", "请带上密钥自己运行。导入语句和选项名已对照安装的包核对过，但运行行为没有验证。"),
      needs: [{ step: "tools-mcp.mcp-server", what: t("the MCP server module", "MCP 服务模块") }],
      produces: t("A port that shares tools through the protocol.", "一个通过协议共享工具的移植版本。"),
      notExecuted: true,
    },
    {
      id: "outside",
      title: t("Decide what stays outside any SDK", "决定哪些东西留在任何 SDK 之外"),
      why: t("Last, because the ports show it. What you did not have to rewrite is what you own.", "放在最后，因为移植过程已经说明了答案。那些不需要重写的东西，就是真正属于你的。"),
      do: [
        t("List what the three versions share unchanged: the registry and tools, the base prompt, the eval sets, the guard.", "列出三个版本原样共用的东西：注册表和工具、基础提示词、评估集、护栏。"),
        t("Keep those in their own modules with no SDK import.", "把它们放在各自的模块里，不导入任何 SDK。"),
        t("Treat the loop file as the adapter you would rewrite when switching.", "把循环文件当作切换时需要重写的适配层。"),
      ],
      verify: t("None of your tool, skill, eval, or guard files imports an agent SDK.", "你的工具、技能、评估和护栏文件都没有导入任何智能体 SDK。"),
      needs: [{ step: "sdk.compare", what: t("the three versions side by side", "并排的三个版本") }],
      produces: t("A boundary: your assets on one side, the loop on the other.", "一条边界：一边是你的资产，另一边是循环。"),
    },
  ],
  together: [
    { with: "harness", how: t("An SDK replaces the loop. The plug points you built map to its hooks and guardrails.", "SDK 替代的是循环。你搭建的各个接入点对应它的钩子和护栏。") },
    { with: "tools-mcp", how: t("The registry functions and the MCP server are the two ways tools enter an SDK.", "注册表函数和 MCP 服务是工具进入 SDK 的两种途径。") },
    { with: "evaluation", how: t("The agent eval scores any loop. Use it to compare SDKs on your questions.", "智能体评估可以给任何循环打分。用它在你自己的问题上比较各个 SDK。") },
    { with: "api-gateway", how: t("One base URL keeps the model constant across SDKs.", "同一个 base URL 让各 SDK 之间的模型保持一致。") },
  ],
  failures: [
    {
      when: "lab",
      title: t("Library APIs had moved", "库的 API 已经变了"),
      what: t("The MCP SDK installed for the lab was a major version newer than the one the code was written for, and the import failed.", "为 lab 安装的 MCP SDK 比代码所针对的版本高了一个大版本，导入失败。"),
      fix: t("Run every port in the test suite, and import by what exists.", "把每个移植版本都纳入测试，并按实际存在的名称导入。"),
      lesson: t("SDK names change faster than concepts. Learn the concept, verify the name.", "SDK 里的名称变得比概念快。学的是概念，名称要去核实。"),
    },
    {
      when: "lab",
      title: t("Tracing that uploads by default", "默认会上传的追踪数据"),
      what: t("One SDK sends traces to its vendor unless told otherwise.", "有一个 SDK 除非另行设置，否则会把 trace 发送给它的厂商。"),
      fix: t("Disable it, or configure an exporter you control.", "关闭它，或配置一个你自己掌控的导出目标。"),
      lesson: t("Check where every framework sends data before you give it yours.", "把数据交给任何框架之前，先查清它会把数据发到哪里。"),
    },
  ],
  portability: {
    databricks: t(
      "MLflow ResponsesAgent wraps an agent written with any framework. The app templates use the OpenAI Agents SDK, and deployment, tracing, and evaluation are added around it.",
      "MLflow ResponsesAgent 可以封装用任意框架编写的智能体。官方应用模板使用 OpenAI Agents SDK，平台在其外围提供部署、追踪和评估。",
    ),
    watsonx: t("The Orchestrate ADK defines agents and tools in files and a CLI. It also imports agents built with LangGraph and similar frameworks.", "Orchestrate ADK 用文件和命令行来定义智能体和工具。它也可以导入用 LangGraph 等框架构建的智能体。"),
    codex: t("The OpenAI Agents SDK provides the loop, handoffs, guardrails, sessions, and tracing. Codex itself can be run headless and scripted.", "OpenAI Agents SDK 提供循环、交接、护栏、会话和追踪。Codex 本身可以无界面运行并通过脚本调用。"),
    cursor: t("Cursor provides a command-line agent and background agents. For your own service use a general SDK.", "Cursor 提供命令行智能体和后台智能体。要构建自己的服务，请使用通用 SDK。"),
    claude: t("The Claude Agent SDK exposes the coding agent's loop, tools, hooks, subagents, and MCP support as a library in Python and TypeScript.", "Claude Agent SDK 把编程智能体的循环、工具、钩子、子智能体和 MCP 支持，以 Python 和 TypeScript 库的形式提供出来。"),
    other: t("Any SDK that speaks the OpenAI-compatible API can target a local engine by base URL.", "任何支持 OpenAI 兼容 API 的 SDK，都可以通过 base URL 指向本地引擎。"),
  },
  checks: [
    {
      q: t("A framework advertises reducers for state channels. What is that in the hand-built version?", "某个框架宣传它为状态通道提供 reducer。在手写版本里那是什么？"),
      a: t("merge_state. Keys that extend or sum are reducers. Keys that overwrite are plain channels.", "merge_state。做追加或求和的键就是 reducer。直接覆盖的键就是普通通道。"),
    },
    {
      q: t("What should stay outside any SDK?", "哪些东西应该留在任何 SDK 之外？"),
      a: t("Tools behind a registry and MCP, skill files, eval sets and scripts, and answer checks. Those hold your domain knowledge and should not be rewritten when the loop changes.", "注册表和 MCP 后面的工具、技能文件、评估集和脚本、回答检查。它们承载的是你的领域知识，循环换了也不应该重写。"),
    },
    {
      q: t("Why give every SDK the same base URL when comparing them?", "比较各个 SDK 时，为什么要给它们同一个 base URL？"),
      a: t("It holds the model constant. Any difference in behavior then comes from the loop: its prompts, its limits, its handling of tool results.", "这样模型保持不变。行为上的任何差异就都来自循环本身：它的提示词、它的上限、它对工具结果的处理方式。"),
    },
    {
      q: t("Name three settings to check in any SDK before using it.", "说出使用任何 SDK 之前都要检查的三项设置。"),
      a: t("The round limit and what happens when it is hit, where traces are sent, and how tool errors are returned to the model.", "轮次上限及其触发后的行为、trace 发送到哪里、工具错误如何返回给模型。"),
    },
  ],
  terms: [
    { term: t("Reducer", "Reducer"), def: t("A function that merges a node's update into shared state.", "把某个节点的更新合并进共享状态的函数。") },
    { term: t("Handoff", "交接（Handoff）"), def: t("One agent passing the conversation to another.", "一个智能体把对话转交给另一个智能体。") },
    { term: t("Trace", "Trace"), def: t("A structured record of the model calls and tool calls in one run.", "对一次运行中模型调用和工具调用的结构化记录。") },
  ],
};
