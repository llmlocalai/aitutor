import { t, type Module } from "@/lib/types";

export const toolsMcp: Module = {
  id: "tools-mcp",
  n: 6,
  layer: 3,
  title: t("Tools and MCP", "工具与 MCP"),
  short: t(
    "Give the model typed actions, and serve them over a protocol any harness can call.",
    "给模型提供带类型的动作，并通过任何 Harness 都能调用的协议对外提供。",
  ),
  what: t(
    "A tool is a function with a name, a description, and a JSON schema for its arguments. The Model Context Protocol (MCP) is a standard way to serve tools from a separate process so any compatible client can list and call them.",
    "工具是一个带有名称、描述和参数 JSON schema 的函数。模型上下文协议（MCP）是一种标准方式，让工具由独立进程提供，任何兼容的客户端都能列出并调用它们。",
  ),
  why: t(
    "Tools are how an agent reads data and acts. Serving them over MCP means the chat agent, a coding agent, and a managed platform share one implementation. Tool design also decides how often the model picks the wrong instrument.",
    "工具是智能体读取数据和执行操作的途径。通过 MCP 提供工具，聊天智能体、编程智能体和托管平台就能共用一套实现。工具的设计也决定了模型选错工具的频率。",
  ),
  how: [
    t("Each tool is a narrow function that returns structured data and never raises.", "每个工具是一个职责单一的函数，返回结构化数据，并且从不抛异常。"),
    t("An empty result carries a diagnostic naming the filter that emptied it.", "空结果会附带诊断信息，指出是哪个过滤条件导致为空。"),
    t("A registry holds name, schema, and callable. The loop calls by name.", "注册表保存名称、schema 和可调用对象。循环按名称调用。"),
    t("The same functions are wrapped by an MCP server so other clients can use them.", "同一批函数再由 MCP 服务封装，供其他客户端使用。"),
  ],
  prereqs: [
    {
      id: "api-gateway",
      why: t("Tool calling rides on the chat contract: schemas go in the request and tool calls come back in the response. Key scope decides who gets tools.", "工具调用建立在 chat 契约之上：schema 随请求发出，工具调用随响应返回。密钥的权限范围决定谁能用工具。"),
      stub: t("Call the tool functions directly from a script. No model is needed to build and test a tool.", "直接在脚本里调用工具函数。搭建和测试工具不需要模型。"),
    },
    {
      id: "rag-graph",
      why: t("The first tool wraps search. Its result shape and diagnostic come from the retrieval module.", "第一个工具封装的就是检索。它的结果结构和诊断信息来自检索模块。"),
      stub: t("A tool that reads a small CSV file. The lab includes one.", "一个读取小型 CSV 文件的工具。lab 里自带一个。"),
    },
  ],
  inBuild: [
    { path: "apps/agent-server/tools/registry.py", role: t("Schemas and the call_tool dispatcher.", "schema 和 call_tool 分发器。") },
    { path: "apps/agent-server/mcp_client.py", role: t("Connects to external MCP servers and registers their tools.", "连接外部 MCP 服务并注册它们的工具。") },
    { path: "apps/mcp-servers/brainbank/server.py", role: t("Serves the knowledge and data tools to any MCP client.", "向任何 MCP 客户端提供知识和数据工具。") },
    { path: ".mcp.json", role: t("Client config: command, arguments, environment, timeout.", "客户端配置：命令、参数、环境变量、超时。") },
  ],
  flow: {
    caption: t("One tool call, from the model's request to the tool message", "一次工具调用：从模型的请求到工具消息"),
    stages: [
      { label: t("Model emits a tool call", "模型发出工具调用"), detail: t("A name and a JSON string of arguments.", "一个名称和一段 JSON 字符串形式的参数。"), kind: "model" },
      { label: t("Look up by name", "按名称查找"), detail: t("Unknown names return an error object listing known tools.", "未知的名称会返回一个错误对象，并列出已有的工具。"), kind: "check" },
      { label: t("Run", "执行"), detail: t("Local function or MCP server. The caller cannot tell which.", "本地函数或 MCP 服务。调用方分辨不出是哪种。"), kind: "tool" },
      { label: t("Catch everything", "捕获所有异常"), detail: t("Exceptions become data the model can read.", "异常被转成模型可以读懂的数据。"), kind: "check" },
      { label: t("Cap and note", "截断并注明"), detail: t("Long results are cut, with a note saying so.", "过长的结果会被截断，并注明已截断。"), kind: "check" },
      { label: t("Log", "记录日志"), detail: t("Tool, arguments, duration, empty or error.", "工具名、参数、耗时、是否为空或出错。"), kind: "store" },
      { label: t("Tool message", "工具消息"), detail: t("A role=tool message goes back into the conversation.", "一条 role=tool 的消息被放回对话。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "design",
      title: t("Decide the tool list on paper", "先在纸上确定工具清单"),
      why: t("Every tool's schema is sent on every turn, and every extra tool is another way to answer with the wrong instrument. Decide the list before writing any of them.", "每个工具的 schema 每一轮都要发送，每多一个工具就多一种用错工具的可能。动手写之前先把清单定下来。"),
      do: [
        t("Write the questions your agent must answer. Group them by the kind of data that answers them.", "写下智能体必须回答的问题，按回答它们所需的数据类型分组。"),
        t("One tool per group. The lab has two: documents and expense records.", "每组一个工具。lab 里有两个：文档和报销记录。"),
        t("For each tool write one sentence that says when to use it. That sentence becomes the description.", "为每个工具写一句话，说明何时使用它。这句话就是工具描述。"),
      ],
      verify: t("For any question on your list, exactly one tool is the obvious choice.", "对清单上的任何问题，都恰好有一个工具是显而易见的选择。"),
      produces: t("A tool list: name, when to use, arguments.", "一份工具清单：名称、使用时机、参数。"),
    },
    {
      id: "registry",
      title: t("Build the registry", "搭建注册表"),
      why: t("The registry comes before the tools so every tool is born with a schema, a log record, and a size cap. Adding those later to tools that already exist is how some get missed.", "注册表先于工具，这样每个工具从一开始就有 schema、日志记录和大小上限。等工具都写好了再补，总会有漏掉的。"),
      do: [
        t("A decorator builds the JSON schema from the function signature.", "用一个装饰器根据函数签名生成 JSON schema。"),
        t("`call()` never raises. Unknown tool, bad arguments, and exceptions all return an error object.", "`call()` 从不抛异常。未知工具、参数错误和运行异常都返回错误对象。"),
        t("`call_as_text()` produces the string for the tool message and cuts it at a limit with a note.", "`call_as_text()` 生成工具消息的字符串，超出上限时截断并注明。"),
        t("Every call appends a record: tool, arguments, milliseconds, empty, error.", "每次调用追加一条记录：工具、参数、毫秒数、是否为空、错误。"),
      ],
      lab: { file: "labs/m06_tools/registry.py", region: "registry" },
      verify: t("Calling a tool that does not exist returns an error with the list of known tools.", "调用不存在的工具时，返回带有已知工具列表的错误。"),
      needs: [{ step: "tools-mcp.design", what: t("what a tool needs: name, description, arguments", "一个工具需要的东西：名称、描述、参数") }],
      produces: t("`Registry`: schemas(), call(), call_as_text(), log.", "`Registry`：schemas()、call()、call_as_text()、log。"),
    },
    {
      id: "tools",
      title: t("Write the tools, with diagnostics for empty results", "编写工具，并为空结果提供诊断"),
      why: t("Tools are written against the registry and wrap the modules below: search from retrieval, and a data source. The diagnostic is written now because the harness and the learner both depend on it.", "工具基于注册表编写，封装的是下层模块：来自检索模块的 search，以及一个数据源。诊断信息现在就要写，因为 Harness 和学习任务都依赖它。"),
      do: [
        t("`search_policy` calls search and returns source, tier, section, text.", "`search_policy` 调用 search，返回来源、等级、章节、正文。"),
        t("`query_expenses` filters rows and returns rows, count, total.", "`query_expenses` 过滤数据行，返回行、数量、合计。"),
        t("When no rows match, test each filter: would dropping it alone return rows? Name that filter and list the values that exist.", "没有匹配的行时，逐个测试过滤条件：只去掉它是否就有结果？指出这个条件，并列出实际存在的取值。"),
      ],
      lab: { file: "labs/m06_tools/tools.py", region: "tools" },
      run: "python3 -m labs.m06_tools.demo",
      output: "m06.demo",
      pick: ["2 ", "3 ", "4 "],
      verify: t("Line 4 names `month` as the filter that emptied the result and lists the months that exist.", "第 4 行指出是 `month` 这个条件导致结果为空，并列出实际存在的月份。"),
      needs: [
        { step: "tools-mcp.registry", what: t("the decorator and call path", "装饰器和调用路径") },
        { step: "rag-graph.diagnose", what: t("search() and its result shape", "search() 及其结果结构") },
      ],
      produces: t("`build_registry()`: two tools the agent can call.", "`build_registry()`：智能体可调用的两个工具。"),
    },
    {
      id: "limits",
      title: t("Check errors, caps, and cost", "检查错误处理、截断和开销"),
      why: t("These are the properties the loop will rely on without checking. Verify them here, where a failure is one line of output and not a broken conversation.", "这些是循环会直接依赖而不再检查的特性。在这里验证，出问题只是一行输出；到了循环里，就是一次失败的对话。"),
      do: [
        t("Read lines 5 and 6: an unknown tool and a bad argument both return data.", "看第 5、6 行：未知工具和错误参数都返回数据。"),
        t("Read line 1: the schema cost in tokens. This is charged on every turn.", "看第 1 行：schema 的 token 开销。这个开销每一轮都要付。"),
        t("Read line 8: the call log already separates ok, empty, and error.", "看第 8 行：调用日志已经区分了 ok、empty 和 error。"),
      ],
      output: "m06.demo",
      pick: ["1 ", "5 ", "6 ", "7 ", "8 "],
      verify: t("No call in the demo raised, and you know the per-turn schema cost.", "demo 中没有任何调用抛异常，并且你知道了每轮的 schema 开销。"),
      needs: [{ step: "tools-mcp.tools", what: t("tools to exercise", "可供测试的工具") }],
      produces: t("A measured schema cost and a call log format. Self-observation reads this log.", "一个实测的 schema 开销和一种调用日志格式。自我观察任务会读这份日志。"),
    },
    {
      id: "mcp-server",
      title: t("Serve the same tools over MCP", "通过 MCP 提供同一批工具"),
      why: t("It follows the local tools because it wraps them. One implementation then serves every harness, which is what makes the rest of this curriculum portable.", "它排在本地工具之后，因为它是对本地工具的封装。这样一套实现就能服务所有 Harness，这也是整套课程可以移植的基础。"),
      do: [
        t("Install the SDK: `pip install mcp`.", "安装 SDK：`pip install mcp`。"),
        t("Create a server object and register each tool with a decorator. The docstring is the description.", "创建服务对象，用装饰器注册每个工具。docstring 就是工具描述。"),
        t("Each MCP tool calls the registry, so caps and logging still apply.", "每个 MCP 工具都调用注册表，所以截断和日志依然生效。"),
        t("Note the import. SDK version 2 renamed the server class. The lab imports whichever exists.", "注意导入语句。SDK 第 2 版给服务类改了名。lab 会导入实际存在的那个。"),
      ],
      lab: { file: "labs/m06_tools/mcp_server.py", region: "mcp" },
      verify: t("`python3 -m labs.m06_tools.mcp_server` starts and waits for input without an error.", "`python3 -m labs.m06_tools.mcp_server` 能启动并等待输入，不报错。"),
      needs: [{ step: "tools-mcp.tools", what: t("the registry to wrap", "要封装的注册表") }],
      produces: t("An MCP server any client can start from a command.", "一个任何客户端都能通过命令启动的 MCP 服务。"),
    },
    {
      id: "mcp-client",
      title: t("Call the server the way a client does", "像客户端那样调用服务"),
      why: t("Test the protocol path before handing the server to a client you do not control.", "在把服务交给你无法控制的客户端之前，先测试协议这条路径。"),
      do: [
        t("Start the server as a subprocess over stdio.", "通过 stdio 以子进程方式启动服务。"),
        t("Initialize, list tools, call one, parse the result.", "初始化、列出工具、调用一个、解析结果。"),
      ],
      lab: { file: "labs/m06_tools/mcp_check.py", region: "client" },
      run: "python3 -m labs.m06_tools.mcp_check",
      output: "m06.mcp",
      verify: t("Both tool names are listed and the call returns one row totaling 219.0.", "两个工具名都被列出，调用返回一行，合计 219.0。"),
      needs: [{ step: "tools-mcp.mcp-server", what: t("the server module to launch", "要启动的服务模块") }],
      produces: t("Proof the tools work over the protocol.", "工具可以通过协议正常工作的证据。"),
    },
    {
      id: "register",
      title: t("Register the server in each client", "在各个客户端里注册这个服务"),
      why: t("Last, because each client needs only a config entry pointing at a server that is already tested.", "放在最后，因为每个客户端只需要一条指向已测试服务的配置。"),
      do: [
        t("Add an entry with a command, arguments, and working directory.", "添加一条配置，包含命令、参数和工作目录。"),
        t("Use an absolute path to the Python interpreter. Clients start servers with a minimal environment.", "Python 解释器要用绝对路径。客户端启动服务时环境变量很少。"),
        t("In the client, list tools and confirm both appear.", "在客户端里列出工具，确认两个都出现。"),
      ],
      code: { lang: "json", file: ".mcp.json (Claude Code; Cursor uses the same shape in .cursor/mcp.json)", text: `{
  "mcpServers": {
    "policy-desk": {
      "command": "/abs/path/to/venv/bin/python3",
      "args": ["-m", "labs.m06_tools.mcp_server"],
      "cwd": "/abs/path/to/aitutor"
    }
  }
}` },
      codeNote: t("Codex uses a TOML file with an `[mcp_servers.policy-desk]` table holding the same command and args. Check each client's current documentation for the file location.", "Codex 使用 TOML 文件，在 `[mcp_servers.policy-desk]` 表里写同样的 command 和 args。配置文件的位置请查各客户端当前的文档。"),
      verify: t("The client shows `search_policy` and `query_expenses` as available tools.", "客户端显示 `search_policy` 和 `query_expenses` 为可用工具。"),
      needs: [{ step: "tools-mcp.mcp-client", what: t("a server known to work", "一个确认可用的服务") }],
      produces: t("The same tools available in a coding agent or editor.", "同一批工具在编程智能体或编辑器里可用。"),
      notExecuted: true,
    },
  ],
  together: [
    { with: "harness", how: t("The loop passes schemas to the model and calls tools through the registry.", "循环把 schema 传给模型，并通过注册表调用工具。") },
    { with: "guardrails", how: t("Tool results are the evidence the answer is checked against. Hooks run before each call.", "工具结果是检查回答所依据的证据。钩子在每次调用前运行。") },
    { with: "self-evolving", how: t("The call log marks empty results. The learner re-runs them with one filter removed.", "调用日志会标记空结果。学习任务会去掉一个过滤条件后重新执行。") },
    { with: "sdk", how: t("Every SDK accepts these same functions or the MCP server.", "每个 SDK 都能直接使用这些函数或这个 MCP 服务。") },
  ],
  failures: [
    {
      when: "2026-09",
      title: t("A confident explanation of data that existed", "对明明存在的数据给出了自信的“不存在”解释"),
      what: t("Asked about a purchase category, the agent got an empty result and explained at length why such purchases are not tracked. The data was there. The fiscal year filter was off by one.", "被问到某类采购时，智能体得到空结果，于是长篇解释为什么这类采购没有被记录。其实数据是有的，只是财年过滤条件差了一年。"),
      fix: t("Tools return a diagnostic naming the filter that emptied the result. The instructions forbid explaining absence.", "工具返回诊断信息，指出是哪个过滤条件导致为空。指令中禁止解释“为什么不存在”。"),
      lesson: t("An empty result means the filter matched nothing. It says nothing about the world.", "空结果只说明过滤条件没匹配到任何东西，并不说明现实中不存在。"),
    },
    {
      when: "2026-08",
      title: t("Twelve tools made the agent slower and more wrong", "十二个工具让智能体更慢、错得更多"),
      what: t("More tools meant more schema tokens on every turn and more ways to pick the wrong one.", "工具越多，每轮的 schema token 越多，选错工具的方式也越多。"),
      fix: t("Fewer tools, plus skills that say which tool answers which kind of question.", "减少工具数量，再用技能说明哪类问题用哪个工具。"),
      lesson: t("Tools add capability only when routing keeps up.", "只有路由跟得上，工具才能真正增加能力。"),
    },
    {
      when: "lab",
      title: t("The MCP SDK renamed its server class", "MCP SDK 给服务类改了名"),
      what: t("The lab was written against version 1 of the SDK. The installed version was 2, and the import failed.", "lab 是按 SDK 第 1 版写的，而安装的是第 2 版，导入失败。"),
      fix: t("Import whichever class exists, and run the client check in the test suite.", "导入实际存在的那个类，并把客户端检查纳入测试。"),
      lesson: t("Code you did not run is a guess, including code written from memory of a library.", "没跑过的代码只是猜测，凭记忆写的库调用也一样。"),
    },
  ],
  portability: {
    databricks: t(
      "Unity Catalog functions are governed tools, and MCP servers are added in agent code with permissions granted in the bundle file. Unity Gateway governs access to MCP servers. A custom MCP server can be hosted as a Databricks App.",
      "Unity Catalog 函数是受管控的工具；MCP 服务在智能体代码中添加，权限在 bundle 文件里授予。Unity Gateway 管控对 MCP 服务的访问。自定义 MCP 服务可以作为 Databricks App 托管。",
    ),
    watsonx: t("Orchestrate tools are Python functions, OpenAPI specs, or MCP servers imported with the ADK. The MCP server from this module can be registered there.", "Orchestrate 的工具可以是 Python 函数、OpenAPI 规范，或通过 ADK 导入的 MCP 服务。本模块的 MCP 服务可以在那里注册。"),
    codex: t("Add MCP servers in the config file. Tools then appear to the agent. This is the direct route for reusing your own tools.", "在配置文件里添加 MCP 服务，工具就会出现在智能体中。这是复用你自己工具的最直接方式。"),
    cursor: t("Add servers to the project MCP config. Same server, no code change.", "在项目的 MCP 配置里添加服务。同一个服务，无需改代码。"),
    claude: t("Add servers to the project MCP file. The reference build shares one server between its chat agent and its coding agent this way.", "在项目的 MCP 文件里添加服务。参考系统就是这样让聊天智能体和编程智能体共用一个服务。"),
    other: t("An MCP server is a process speaking JSON-RPC over stdio or HTTP. It runs anywhere Python or Node runs.", "MCP 服务是一个通过 stdio 或 HTTP 使用 JSON-RPC 通信的进程。有 Python 或 Node 的地方就能运行。"),
  },
  checks: [
    {
      q: t("A tool returns an empty list. What may the agent conclude?", "工具返回了空列表。智能体可以得出什么结论？"),
      a: t("Only that this filter matched nothing. It may report what it searched. It may not explain why the data cannot exist. The diagnostic names the filter to relax.", "只能得出“这个过滤条件没有匹配到任何东西”。它可以说明自己查了什么，但不可以解释数据为什么不存在。诊断信息会指出该放宽哪个条件。"),
    },
    {
      q: t("Why does the registry come before the tools?", "为什么注册表先于工具？"),
      a: t("So every tool gets a schema, error handling, a size cap, and a log record from the start. Those are the properties the loop relies on.", "这样每个工具从一开始就有 schema、错误处理、大小上限和日志记录。循环依赖的正是这些特性。"),
    },
    {
      q: t("Why serve tools over MCP when the harness could import them?", "Harness 明明可以直接导入工具，为什么还要通过 MCP 提供？"),
      a: t("One implementation then serves every harness. Moving to another platform means registering the server, with no rewrite.", "这样一套实现就能服务所有 Harness。迁移到其他平台只需要注册服务，不用重写。"),
    },
    {
      q: t("Why must a tool never raise?", "为什么工具绝不能抛异常？"),
      a: t("An exception ends the request. An error object goes back to the model, which can correct its arguments and try again within the round budget.", "异常会终止整个请求。而错误对象会返回给模型，模型可以修正参数，在轮次预算内重试。"),
    },
  ],
  terms: [
    { term: t("Schema", "Schema"), def: t("The JSON description of a tool's arguments that is sent to the model.", "发送给模型的、描述工具参数的 JSON。") },
    { term: t("Diagnostic", "诊断信息"), def: t("A field in an empty result that names what emptied it.", "空结果里的一个字段，说明是什么导致结果为空。") },
    { term: t("MCP", "MCP"), def: t("Model Context Protocol. A standard for serving tools from a separate process.", "模型上下文协议。由独立进程提供工具的一种标准。") },
  ],
};
