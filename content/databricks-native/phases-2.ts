import { t } from "@/lib/types";
import type { Phase } from "@/content/databricks/types";

const K = "native/databricks/";

/** Phases 4 to 6: knowledge and tools, the agent and the human, quality. */
export const phases2: Phase[] = [
  {
    id: "tools",
    title: t("Knowledge and tools", "知识与工具"),
    goal: t(
      "The agent gets three ways to read, each governed by Unity Catalog: policy text through AI Search, numbers through Genie and the metric view, and exception facts through Unity Catalog functions. All three are reached through managed MCP endpoints, so the agent's code holds no SQL and no credentials, and every call runs under the same permissions as a person's query. Models are reached through the Unity Gateway, which is where rate limits, guardrails and usage logging live.",
      "智能体有三种读取方式，每种都受 Unity Catalog 治理：通过 AI Search 读政策文本，通过 Genie 和指标视图读数字，通过 Unity Catalog 函数读异常事实。三者都通过托管 MCP 端点访问，所以智能体代码里没有 SQL 也没有凭证，每次调用都与人的查询处于同样的权限之下。模型通过 Unity Gateway 访问，限流、护栏和用量日志都在那里。",
    ),
    steps: [
      {
        id: "policy",
        title: t("Index the payment policy in AI Search", "在 AI Search 中为付款政策建立索引"),
        local: t("ai.policy_chunks (heading path kept with each chunk) and the Delta Sync index ai.policy_index.", "ai.policy_chunks（每个文本块都保留标题路径）和 Delta Sync 索引 ai.policy_index。"),
        links: ["rag-graph.chunk", "rag-graph.dense", "rag-graph.lexical", "rag-graph.fuse"],
        after: ["governance"],
        components: ["policydocs", "search"],
        why: t(
          "A payment decision is defensible only if it cites the rule that permits it. Policy text changes rarely, is read constantly, and must be found by meaning (\"can we pay a small overcharge\") and by exact token (\"section 4.2\"). A managed index with hybrid search does both, follows the Delta table automatically, and is permissioned like a table. Chunking keeps the heading path with every chunk, the module 5 lesson: a paragraph cut out of its section loses what it is about.",
          "只有引用了允许它的那条规则，付款决定才站得住脚。政策文本很少变化，却经常被读取，而且既要能按意思找到（“小额多收能不能付”），也要能按精确词找到（“第 4.2 节”）。支持混合检索的托管索引两者都能做到，它会自动跟随 Delta 表，并且像表一样受权限控制。切块时为每个文本块保留标题路径，这是第 5 模块的教训：从所在章节中切出来的段落，会丢失它在讲什么。",
        ),
        what: t(
          "`build` parses every policy PDF with ai_parse_document, turns its elements into chunks with a heading path, and writes ai.policy_chunks with change data feed. `index` creates the endpoint and a TRIGGERED Delta Sync index with managed embeddings on context plus text. `sync` runs after each build. `query` shows the top five hybrid results.",
          "`build` 用 ai_parse_document 解析每个政策 PDF，把其中的元素切成带标题路径的文本块，写入开启了 change data feed 的 ai.policy_chunks。`index` 创建 endpoint 以及基于上下文加文本、使用托管 embedding 的 TRIGGERED 模式 Delta Sync 索引。`sync` 在每次 build 之后运行。`query` 显示混合检索的前五条结果。",
        ),
        how: [
          t("Upload the policy PDFs to /Volumes/<catalog>/landing/policy. Only approved, current versions: the index will cite whatever is there.", "把政策 PDF 上传到 /Volumes/<catalog>/landing/policy。只放已批准的当前版本：索引会引用那里的任何东西。"),
          t("`python policy_index.py build --catalog fin_dev`, then `index`, then wait for the index to be ready, then `query ... \"price variance tolerance\"`.", "依次执行 `python policy_index.py build --catalog fin_dev`、`index`，等索引就绪后，再执行 `query ... \"price variance tolerance\"`。"),
          t("Write ten policy questions with the chunk a person says answers each; check hit@3 with the parity method from the replication page.", "写十个政策问题，并由人标出每个问题的答案所在的文本块；用复刻页面上的一致性方法检查 hit@3。"),
          t("The weekly policy_refresh job (resources/jobs.yml) rebuilds and syncs.", "每周运行的 policy_refresh job（resources/jobs.yml）会重建并同步。"),
        ],
        files: [K + "src/knowledge/policy_index.py"],
        interpret: [
          t("`policy chunks: 180 from 6 documents` is the shape to expect for a policy set. Very few chunks per document means headings were not detected (scanned PDFs); very many means a table of contents was chunked.", "`policy chunks: 180 from 6 documents` 是一套政策文档应有的规模。每份文档的块很少，说明没识别出标题（扫描版 PDF）；块非常多，说明目录页也被切块了。"),
          t("In query results, the context column should read like a breadcrumb (`Payment Policy > 4.2 Price variance`). If it is empty, the agent's citations will be unreadable to a reviewer.", "在查询结果中，context 列应该读起来像一条导航路径（`Payment Policy > 4.2 Price variance`）。如果是空的，智能体的引用对审核人员来说就无法阅读。"),
        ],
        trouble: [
          { s: t("Index creation fails: change data feed required", "创建索引失败：需要 change data feed"), c: t("The overwrite in build recreated the table without the property.", "build 中的覆盖写入重建了表，但没带这个属性。"), f: t("build sets the property after each write; if you changed it, keep the ALTER TABLE line.", "build 在每次写入后都会设置该属性；如果你改过代码，要保留 ALTER TABLE 那一行。") },
          { s: t("Old policy text keeps being cited", "旧的政策文本还在被引用"), c: t("A superseded PDF is still in the volume.", "被取代的 PDF 还留在 volume 里。"), f: t("Policy retirement is a publishing step: move the old file out, rebuild, sync. The index cites only what is present.", "政策下线是一个发布步骤：把旧文件移出去，重建，同步。索引只引用现有的内容。") },
        ],
        done: t("Hybrid queries return the right policy chunk in the top three for at least nine of ten hand-written questions.", "对十个人工编写的问题，至少有九个的正确政策文本块出现在混合检索的前三条结果中。"),
        scale: [
          t("Thousands of documents: still a standard endpoint. Hundreds of millions of vectors (for example all contracts): a storage-optimized endpoint, which supports Triggered sync only and costs less per vector.", "几千份文档：仍用 STANDARD 端点。数亿个向量（比如全部合同）：用 storage-optimized 端点，它只支持 Triggered 同步，但每个向量的成本更低。"),
          t("Many workflows share one policy index, filtered by a document-type column; do not build one index per agent.", "多个工作流共享一个政策索引，用文档类型列过滤；不要每个智能体各建一个索引。"),
        ],
        challenge: [
          { q: t("Why not paste the whole policy into the prompt?", "为什么不把整份政策直接贴进提示词？"), a: t("It is paid on every call, it dilutes attention, and it cannot cite a chunk id a reviewer can open. Retrieval makes the citation a pointer, which is what makes the proposal reviewable.", "那样每次调用都要付费，会分散注意力，而且无法引用审核人员能打开的文本块 id。检索让引用成为一个指针，正是这一点让提议变得可以审核。") },
        ],
      },
      {
        id: "genie",
        title: t("A Genie space over gold, benchmarked like code", "在 gold 上建 Genie space，并像代码一样做基准测试"),
        local: t("A Genie space on the metric view and gold tables, with instructions, sample SQL, and a benchmark that runs in CI.", "基于指标视图和 gold 表的 Genie space，带有说明、示例 SQL，以及在 CI 中运行的基准测试。"),
        links: ["tools-mcp.mcp-server", "evaluation.gold"],
        after: ["semantics"],
        components: ["genie", "metric"],
        why: t(
          "The agent sometimes needs numbers nobody wrote a function for (\"how many duplicate suspects did this vendor have this year\"). Genie turns a question into SQL over governed tables, under the asker's permissions. It is also what reviewers and managers will use directly. But Genie's quality depends on comments, instructions and sample queries, and those change, so it is benchmarked: questions with SQL an analyst agrees is correct, compared by result, not by SQL text.",
          "智能体有时需要一些没人为之写过函数的数字（“这个供应商今年有多少条重复嫌疑”）。Genie 把问题转换为针对受治理表的 SQL，并以提问者的权限执行。审核人员和经理也会直接使用它。但 Genie 的质量取决于注释、说明和示例查询，而这些会变，所以要做基准测试：问题配上分析师认可的正确 SQL，按结果比较，而不是按 SQL 文本比较。",
        ),
        what: t(
          "benchmark.py asks each question through the Genie Conversation API, runs Genie's SQL and the reference SQL on the same warehouse, and compares result sets ignoring row order and number formatting. It exits non-zero below 90% accuracy, so the quality job fails when Genie regresses.",
          "benchmark.py 通过 Genie Conversation API 提出每个问题，在同一个 warehouse 上分别运行 Genie 生成的 SQL 和参考 SQL，并在忽略行顺序和数字格式的前提下比较结果集。准确率低于 90% 时以非零状态退出，这样 Genie 退化时质量检查 job 就会失败。",
        ),
        how: [
          t("Create the space in the UI on gold.exception_metrics, gold.open_exceptions and silver.vendors. Add instructions (what an exception is, which currency rule applies) and three sample queries.", "在界面中基于 gold.exception_metrics、gold.open_exceptions 和 silver.vendors 创建 space。加上说明（什么是异常、适用哪条币种规则）和三个示例查询。"),
          t("Write 20 benchmark questions with a finance analyst. Four examples are in genie_benchmarks.json.", "与一位财务分析师一起写 20 个基准问题。genie_benchmarks.json 里有四个示例。"),
          t("Set genie_space_id in the bundle variables, and run the benchmark before any agent uses the space.", "在 bundle 变量中设置 genie_space_id，并在任何智能体使用这个 space 之前运行基准测试。"),
          t("The agent reaches the space through the managed MCP endpoint `/api/2.0/mcp/genie/<space_id>`.", "智能体通过托管 MCP 端点 `/api/2.0/mcp/genie/<space_id>` 访问这个 space。"),
        ],
        files: [K + "src/genie/benchmark.py", K + "src/genie/genie_benchmarks.json"],
        interpret: [
          t("`FAIL 6.2s  Which five vendors have the most open exceptions?` with Genie's SQL printed: compare it with the reference. Usually a missing instruction (ties, or which status counts as open), fixed in the space, not in the benchmark.", "出现 `FAIL 6.2s  Which five vendors have the most open exceptions?` 并打印出 Genie 的 SQL 时：把它与参考 SQL 对比。通常是缺了某条说明（并列怎么处理，哪种状态算未结），要在 space 里修，而不是改基准。"),
          t("Seconds per question matter for the agent's latency budget. A Genie call of 6 to 10 seconds is one third of a 30-second p95; prefer a UC function for questions the agent asks on every triage.", "每个问题耗时多少，关系到智能体的延迟预算。一次 6 到 10 秒的 Genie 调用就占了 30 秒 p95 的三分之一；对于智能体每次分诊都会问的问题，优先用 UC 函数。"),
        ],
        trouble: [
          { s: t("Genie answers in text with no SQL", "Genie 只用文字回答，没有 SQL"), c: t("The question was ambiguous or outside the space's tables.", "问题有歧义，或者超出了 space 中的表。"), f: t("ask() returns None and the benchmark counts it as a failure. Rephrase the benchmark only if a person would also find it ambiguous.", "ask() 返回 None，基准测试会把它算作失败。只有当人也觉得有歧义时，才改写基准问题。") },
          { s: t("Results match but the benchmark fails", "结果一样，但基准测试判为失败"), c: t("Column order differs.", "列的顺序不同。"), f: t("same_result ignores row order and formatting but not column order; select columns in the same order in the reference SQL.", "same_result 会忽略行顺序和格式，但不忽略列顺序；在参考 SQL 中按同样的顺序选择列。") },
        ],
        done: t("At least 18 of 20 benchmark questions pass, and the benchmark runs nightly in the quality job.", "20 个基准问题中至少 18 个通过，并且基准测试每晚在质量检查 job 中运行。"),
        unconfirmed: t("The attachment shape read by ask() (attachments[].query.query) follows the Conversation API as used in community examples; check one response object before relying on it.", "ask() 读取的附件结构（attachments[].query.query）参照的是社区示例中的 Conversation API 用法；依赖它之前请先检查一个响应对象。"),
        scale: [
          t("One space per subject area, not one per agent. Ten agents can share the finance space; each benchmark question protects all of them.", "每个主题领域一个 space，而不是每个智能体一个。十个智能体可以共享财务这个 space；每个基准问题都同时保护着它们。"),
        ],
        challenge: [
          { q: t("Text-to-SQL is risky. Why give it to an agent that proposes payments?", "Text-to-SQL 有风险，为什么交给一个会提议付款的智能体？"), a: t("It reads under Unity Catalog permissions and never writes, and the agent's figures are checked against the evidence before a proposal is queued. Genie is for context; the decision facts come from get_exception, a fixed function.", "它在 Unity Catalog 权限下只读、从不写入，而且智能体给出的数字在提议进入队列之前都要对照证据检查。Genie 用来提供背景；决策所依据的事实来自 get_exception 这个固定函数。") },
        ],
      },
      {
        id: "uctools",
        title: t("Read tools as Unity Catalog functions", "把读取工具做成 Unity Catalog 函数"),
        local: t("tools.get_exception and tools.vendor_history, returning JSON with a diagnostic when nothing matches.", "tools.get_exception 和 tools.vendor_history，返回 JSON；匹配不到时附带诊断信息。"),
        links: ["tools-mcp.tools", "tools-mcp.limits", "tools-mcp.registry"],
        after: ["quality", "classify"],
        components: ["tools"],
        why: t(
          "The facts a decision rests on must come from a fixed, reviewed query, not from a model writing SQL. A Unity Catalog SQL function is that query, permissioned like a table: the row filter applies inside it (the agent's principal is in fin-agents, which the policy covers), so the agent cannot see an exception outside its scope even if it asks for one by id. The COMMENT is the tool description the model reads, and the empty case returns found=false with a reason, the module 6 rule that stops a model reporting a zero as a fact.",
          "决策所依据的事实，必须来自一个固定的、经过审查的查询，而不是模型自己写的 SQL。Unity Catalog SQL 函数就是这样的查询，并且像表一样受权限控制：行过滤在函数内部同样生效，所以即使智能体按 id 去要，也看不到其范围之外的异常。COMMENT 就是模型读到的工具说明；空结果会返回 found=false 及原因，这是第 6 模块的规则，防止模型把零当作事实报告。",
        ),
        what: t(
          "get_exception returns every fact for one exception as JSON: amounts, variance, the document check and the spend category. vendor_history returns twelve months of exceptions by type and total variance. Both are granted to reviewers and reached by the agent through the managed MCP endpoint for the tools schema.",
          "get_exception 以 JSON 返回一个异常的全部事实：金额、差异、文档核对结果和支出类别。vendor_history 返回过去十二个月按类型统计的异常数和总差异。两者都授权给审核人员，智能体通过 tools schema 的托管 MCP 端点访问它们。",
        ),
        how: [
          t("Run functions.sql per environment (replace fin_dev).", "在每个环境运行 functions.sql（替换 fin_dev）。"),
          t("Run the two test SELECTs at the end: a real id returns found=true, a fake one returns found=false with a diagnostic.", "运行文件末尾的两条测试 SELECT：真实 id 返回 found=true，伪造的 id 返回 found=false 并附诊断信息。"),
          t("Grant EXECUTE on the tools schema and SELECT on gold and ai to the agent app's service principal after it exists (step [[cicd]] creates it).", "在智能体 App 的服务主体创建之后（第 [[cicd]] 步会创建它），向它授予 tools schema 的 EXECUTE，以及 gold 和 ai 的 SELECT。"),
        ],
        files: [K + "src/tools/functions.sql"],
        interpret: [
          t("Run get_exception as two reviewers from different units with the same id. One gets the facts, the other gets found=false. That is the row filter working inside the tool.", "以来自不同单元的两位审核人员身份，用同一个 id 调用 get_exception。一个拿到事实，另一个得到 found=false。这就是行过滤在工具内部起作用。"),
          t("A diagnostic that says \"outside your business units\" leaks nothing: it does not say whether the id exists.", "诊断信息说“不在你的业务单元范围内”并不会泄露任何东西：它没有透露这个 id 是否存在。"),
        ],
        trouble: [
          { s: t("The model calls get_exception with an invoice id", "模型用发票号调用 get_exception"), c: t("The parameter COMMENT does not say which id it wants.", "参数的 COMMENT 没有说明它需要的是哪种 id。"), f: t("Say \"the exception_id from gold.open_exceptions, a 64-character hash\" in the COMMENT; the diagnostic then tells the model what went wrong.", "在 COMMENT 中写明“gold.open_exceptions 中的 exception_id，一个 64 位哈希”；这样诊断信息就能告诉模型哪里出错了。") },
          { s: t("The function returns an error instead of found=false", "函数报错，而不是返回 found=false"), c: t("A scalar subquery returned more than one row.", "某个标量子查询返回了多于一行。"), f: t("Keep LIMIT 1 and the max_by aggregation on categories; one invoice can have several category rows from re-extracts.", "保留 LIMIT 1 以及对类别的 max_by 聚合；由于重新抽取，一张发票可能有多条类别记录。") },
        ],
        done: t("Both functions return valid JSON for real and fake ids, under each reviewer's scope.", "两个函数对真实和伪造的 id 都返回有效 JSON，并且遵循每位审核人员的范围。"),
        unconfirmed: t("The vendor page lists function URLs per function (/api/2.0/mcp/functions/<catalog>/<schema>/<function>), marks these workspace MCP endpoints as legacy, and recommends the Unity Gateway MCP path for new connections. The schema-level URL in spend_agent.py is an assumption: if it is refused, list one URL per function or use the Unity Gateway path.", "厂商页面按函数列出 URL（/api/2.0/mcp/functions/<catalog>/<schema>/<function>），把这些工作区 MCP 端点标为旧版，并建议新连接使用 Unity Gateway MCP 路径。spend_agent.py 中的 schema 级 URL 是一个假设：如果被拒绝，就为每个函数各列一个 URL，或改用 Unity Gateway 路径。"),
        scale: [
          t("Tools are shared assets. A second agent that needs exception facts calls the same function; changes go through the same review, and every caller benefits.", "工具是共享资产。第二个需要异常事实的智能体调用同一个函数；修改走同样的审查流程，所有调用方都受益。"),
        ],
        challenge: [
          { q: t("Why is there no write tool?", "为什么没有写入工具？"), a: t("Because a model holding a write tool is one prompt injection away from writing. The agent returns a structured proposal; code checks it and writes it to the queue. The write path has no model in it.", "因为持有写入工具的模型，离被提示词注入后执行写入只有一步之遥。智能体返回一个结构化提议；由代码检查后写入队列。写入路径上没有模型。") },
        ],
      },
      {
        id: "gateway",
        title: t("Models through the Unity Gateway: limits, guardrails, logs", "通过 Unity Gateway 访问模型：限流、护栏、日志"),
        local: t("The agent's model endpoint behind the gateway, with a per-principal rate limit, guardrail policies, usage tracking and an inference table.", "智能体的模型端点位于网关之后，带有按主体的限流、护栏策略、用量追踪和推理表。"),
        links: ["api-gateway.route", "inference.router", "inference.measure"],
        after: ["identity"],
        components: ["gateway"],
        why: t(
          "Every model call in the workflow should pass one point where it is counted, limited and logged. Without it, a loop in the batch job spends a month's budget overnight and nobody can say which workload did it. The gateway also lets you change the model behind a stable name, which is how a model upgrade becomes a reviewed, evaluated change instead of a surprise.",
          "工作流中的每一次模型调用，都应该经过一个可以计数、限流和记录的点。没有它，批处理 job 里的一个循环就能在一夜之间花掉一个月的预算，而且没人说得清是哪个工作负载干的。网关还允许你在一个稳定的名字背后更换模型，这样模型升级就成为一次经过审查和评估的变更，而不是意外。",
        ),
        what: t(
          "Configured in the Unity Gateway UI for the endpoint the agent uses: a rate limit for the agent's service principal and a lower one for people, guardrail policies, usage tracking, and an inference table in the ops schema. The agent's client uses the gateway (`use_ai_gateway=True`).",
          "在 Unity Gateway 界面中为智能体使用的端点进行配置：为智能体的服务主体设一个限流，为个人设一个更低的限流，加上护栏策略、用量追踪，以及 ops schema 中的推理表。智能体的客户端通过网关调用（`use_ai_gateway=True`）。",
        ),
        how: [
          t("Pick the model by measurement: run the replication page's bench script against two or three candidate endpoints, at a busy hour.", "通过测量来选模型：在繁忙时段，用复刻页面上的基准脚本测试两到三个候选端点。"),
          t("Set the rate limit from the load test (step [[scale]]): the knee's throughput, not a round number.", "根据负载测试（第 [[scale]] 步）设定限流：取拐点处的吞吐量，而不是一个整数。"),
          t("Enable the inference table and usage tracking; send one request and wait a few minutes before checking.", "开启推理表和用量追踪；发送一个请求，等几分钟再检查。"),
          t("Pin the model name in the bundle variable agent_model. A change is a merge request that runs the eval gate.", "在 bundle 变量 agent_model 中固定模型名称。任何更改都是一个会触发评估门槛的合并请求。"),
        ],
        code: [{ lang: "python", file: "gateway probe", text: `from databricks_openai import DatabricksOpenAI
c = DatabricksOpenAI()
r = c.chat.completions.create(model="databricks-claude-sonnet-5-5",
                              messages=[{"role": "user", "content": "Reply with the word ok."}], max_tokens=5)
print(r.choices[0].message.content, r.usage)      # appears in gateway usage and the inference table` }],
        interpret: [
          t("429 from the gateway with low traffic means a limit was set too low for batch work: the batch principal and people need different limits.", "流量不高却收到网关的 429，说明为批处理工作设的限额太低：批处理主体和个人需要不同的限额。"),
          t("The inference table is your request log. Its row count per day should match the triage count times the agent's average model calls per triage; a jump in the ratio is a loop.", "推理表就是你的请求日志。它每天的行数应该等于分诊次数乘以每次分诊的平均模型调用次数；这个比值突然跳升，说明出现了循环。"),
        ],
        trouble: [
          { s: t("Model endpoint retired", "模型端点被下线"), c: t("Pay-per-token models have retirement dates on the supported-models page.", "按 token 计费的模型在支持模型页面上有下线日期。"), f: t("Check the page monthly; upgrade through a merge request with the eval gate, before the date.", "每月查看一次该页面；在下线日期之前，通过带评估门槛的合并请求完成升级。") },
          { s: t("No rows in the inference table", "推理表中没有数据"), c: t("The client is not using the gateway, or rows are delayed.", "客户端没有走网关，或者数据有延迟。"), f: t("Keep use_ai_gateway=True in the agent's client; wait several minutes before concluding.", "在智能体的客户端中保持 use_ai_gateway=True；等几分钟再下结论。") },
        ],
        done: t("A probe call appears in gateway usage and the inference table, and the batch principal has its own limit.", "一次探测调用出现在网关用量和推理表中，批处理主体有了自己的限额。"),
        unconfirmed: t("Rate-limit fields, guardrail policy configuration and the inference table schema are set in the UI and were not shown on the gateway page read for this guide.", "限流字段、护栏策略配置和推理表结构都在界面中设置，本指南阅读的网关页面没有展示这些。"),
        scale: [
          t("Pay-per-token is shared capacity: fine for a pilot, variable under load. For a production SLO, provisioned throughput gives reserved capacity for one model; size it from the load test.", "按 token 计费使用的是共享容量：适合试点，负载下表现会波动。若要满足生产 SLO，预置吞吐量会为一个模型保留容量；根据负载测试确定规模。"),
          t("AI Functions in the pipeline should use Databricks-hosted pay-per-token endpoints (the vendor recommends them for batch), not the provisioned endpoint the interactive agent depends on.", "pipeline 中的 AI Functions 应使用 Databricks 托管的按 token 计费端点（厂商推荐它们用于批处理），而不是交互式智能体所依赖的预置端点。"),
        ],
        challenge: [
          { q: t("Why one model and not a router across five?", "为什么只用一个模型，而不是在五个模型之间路由？"), a: t("Every model added is another eval to run and another behaviour to explain. Add a second model only when the eval shows a cheaper one matches on a class of exceptions; then route that class, and measure it.", "每增加一个模型，就多一套要运行的评估、多一种要解释的行为。只有当评估表明某个更便宜的模型在某类异常上表现相当时，才增加第二个模型；然后只路由那一类，并对它进行衡量。") },
        ],
      },
    ],
  },
  {
    id: "agent",
    title: t("The agent and the human in the loop", "智能体与人在回路"),
    goal: t(
      "The agent reads through governed tools and proposes one structured resolution. Code, not the model, decides whether the proposal is admissible and writes it to a review queue. A person decides in a Databricks App that sees data as that person. This split is what makes the workflow auditable: every payment-affecting step has a named human, a rule, or a test behind it.",
      "智能体通过受治理的工具读取信息，并提出一个结构化的处置建议。决定提议是否可接受并把它写入审核队列的是代码，而不是模型。最终由人在一个以其本人身份查看数据的 Databricks App 中作出决定。正是这种分工让工作流可以审计：每个会影响付款的步骤背后，都有一个具名的人、一条规则或一项测试。",
    ),
    steps: [
      {
        id: "agent",
        title: t("Build the agent: tools via MCP, structured output, code-side checks", "构建智能体：通过 MCP 使用工具、结构化输出、代码侧检查"),
        local: t("spend_agent.triage(): MCP tools, a Resolution output type, policy.review() with one retry, and a write to the queue.", "spend_agent.triage()：MCP 工具、Resolution 输出类型、带一次重试的 policy.review()，以及写入队列。"),
        links: ["harness.compose", "harness.budget", "guardrails.check", "guardrails.retry", "sdk.agents-sdk"],
        after: ["policy", "genie", "uctools", "gateway"],
        components: ["agent", "tools", "search", "genie"],
        why: t(
          "The model is good at reading evidence and writing a rationale; it is not a control. So the design gives it read tools only, asks for one structured answer, and puts the controls in code: the action must be allowed for the exception type, payment-affecting actions must cite policy, every figure in the rationale must be in the evidence, and low confidence must escalate. A failing proposal gets the reasons and one retry, then becomes an escalation with the reasons attached. That is the local answer guard, applied to a decision.",
          "模型擅长阅读证据和撰写理由，但它不是控制措施。所以这个设计只给它读取工具，要求它给出一个结构化答案，并把控制放在代码里：动作必须是该异常类型允许的，影响付款的动作必须引用政策，理由中的每个数字都必须出现在证据里，置信度低就必须升级处理。不合格的提议会收到原因并获得一次重试机会，然后变成一条附有原因的升级处理。这就是本地的答案护栏，应用到了决策上。",
        ),
        what: t(
          "policy.py holds the rules (ALLOWED actions per type, NEEDS_POLICY, the confidence floor, figure grounding) and review(), which returns reasons. spend_agent.py first loads the exception's facts itself by calling get_exception from code and checking the id, because those facts route the proposal (business unit, amount, the two-person rule) and must not come from whichever tool output the model produced. It then connects to three managed MCP servers (UC functions, the policy index, Genie), runs the OpenAI Agents SDK with output_type=Resolution and a turn budget, reviews the result, retries once, and writes to the Lakebase queue in one transaction that supersedes any live proposal for the same exception. dry_run returns the result without writing, for evaluation.",
          "policy.py 存放规则（每种类型允许的动作 ALLOWED、NEEDS_POLICY、置信度下限、数字有据检查）以及返回原因列表的 review()。spend_agent.py 首先由代码自己调用 get_exception 加载该异常的事实并核对 id，因为这些事实决定提议的路由（业务单元、金额、双人复核规则），不能来自模型碰巧产出的某个工具输出。然后它连接三个托管 MCP 服务（UC 函数、政策索引、Genie），以 output_type=Resolution 和轮次预算运行 OpenAI Agents SDK，审查结果、重试一次，然后在一个事务中写入 Lakebase 队列，同时取代同一异常的任何在途提议。dry_run 会返回结果而不写入，用于评估。",
        ),
        how: [
          t("Vendor the app template once: `bash setup/03_vendor_agent_template.sh <commit-sha>`. Edit its invoke and stream handlers to call triage() and return the dict as custom_outputs.", "一次性引入应用模板：`bash setup/03_vendor_agent_template.sh <commit-sha>`。修改它的 invoke 和 stream 处理函数，调用 triage() 并把返回的字典作为 custom_outputs 返回。"),
          t("Register the instructions as a prompt `<catalog>.ai.spend_agent_instructions` with alias production (the fallback text is in the file).", "把指令注册为提示词 `<catalog>.ai.spend_agent_instructions`，并设置别名 production（备用文本就在文件里）。"),
          t("Run it locally against dev (`uv run start-app` in agent/) on ten exceptions of each type, and read every trace.", "在本地针对 dev 运行它（在 agent/ 中执行 `uv run start-app`），每种类型各跑十个异常，并阅读每一条追踪。"),
          t("Run `python3 -m pytest native/databricks/tests`: the policy rules are tested without a workspace.", "运行 `python3 -m pytest native/databricks/tests`：政策规则无需工作区即可测试。"),
        ],
        files: [K + "src/agent/policy.py", K + "src/agent/spend_agent.py", K + "setup/03_vendor_agent_template.sh"],
        interpret: [
          t("`status: queued, attempts: 1` is the normal case. `attempts: 2` means the first proposal broke a rule and the reasons fixed it; a high rate of second attempts is a prompt problem worth fixing for latency and cost.", "`status: queued, attempts: 1` 是正常情况。`attempts: 2` 说明第一次提议违反了某条规则，而反馈的原因让它修正了；第二次尝试的比例很高，说明提示词有问题，值得为了延迟和成本去修。"),
          t("`status: escalated` with reasons such as `figures not in the evidence: 312.40` is the control working. Read these first each week: each is either a missing tool output or a model habit.", "带有 `figures not in the evidence: 312.40` 之类原因的 `status: escalated`，说明控制在起作用。每周先看这些：每一条要么是缺了某个工具输出，要么是模型的某种习惯。"),
          t("In the trace, the tool calls should be get_exception, vendor_history, a policy search, and at most one Genie question. More rounds than that is the turn budget being spent on wandering.", "在追踪中，工具调用应该是 get_exception、vendor_history、一次政策检索，以及最多一次 Genie 提问。超出这些的轮次，就是轮次预算被浪费在了漫无目的的探索上。"),
        ],
        trouble: [
          { s: t("output_type parsing fails", "output_type 解析失败"), c: t("The chosen endpoint does not reliably produce structured output through chat completions.", "所选端点无法通过 chat completions 稳定地产生结构化输出。"), f: t("Pick a model that supports structured output, or parse JSON from text with a schema check; the review step still applies.", "选择支持结构化输出的模型，或者从文本中解析 JSON 并做 schema 检查；审查步骤依然适用。") },
          { s: t("MCP calls return 403", "MCP 调用返回 403"), c: t("The app's service principal lacks EXECUTE on the tools, SELECT on the index, or access to the Genie space.", "App 的服务主体缺少工具的 EXECUTE、索引的 SELECT，或 Genie space 的访问权限。"), f: t("Grant each to the app principal (not to your user), then redeploy.", "把这些权限逐一授予 App 的服务主体（而不是你自己的用户），然后重新部署。") },
          { s: t("Two proposals for one exception", "一个异常出现了两条提议"), c: t("Two triage runs raced.", "两次分诊运行发生了竞争。"), f: t("The partial unique index on live proposals rejects the second insert; the orchestrator also runs with max_concurrent_runs: 1.", "在途提议上的部分唯一索引会拒绝第二次插入；编排 job 也设置了 max_concurrent_runs: 1。") },
        ],
        done: t("Forty dev exceptions (ten per type) produce admissible proposals or explained escalations, and every trace shows the expected tool sequence.", "四十个开发环境中的异常（每种类型十个）产生了可接受的提议或有说明的升级处理，每条追踪都显示了预期的工具调用顺序。"),
        unconfirmed: t("MCPServerStreamableHttp with Databricks OAuth headers is the OpenAI Agents SDK's generic MCP client; the template or the Agent Bricks CLI may generate equivalent wiring, which you should prefer. The model name is from the supported-models list.", "带 Databricks OAuth 请求头的 MCPServerStreamableHttp 是 OpenAI Agents SDK 的通用 MCP 客户端；模板或 Agent Bricks CLI 可能会生成等效的连接代码，应优先使用它们。模型名称取自支持模型列表。"),
        scale: [
          t("Each triage is independent, so the agent scales horizontally: more app compute, more concurrent requests, until the model's throughput is the limit. The load test in step [[scale]] finds which limit you hit first.", "每次分诊相互独立，所以智能体可以横向扩展：更多 App 计算资源、更多并发请求，直到模型吞吐量成为瓶颈。第 [[scale]] 步的负载测试会找出你最先碰到的是哪个限制。"),
          t("New exception types: add to ALLOWED, add eval cases, then to the pipeline. Never in the reverse order.", "新增异常类型：先加到 ALLOWED，再加评估用例，最后加到 pipeline。顺序绝不能反过来。"),
        ],
        challenge: [
          { q: t("Why not a multi-agent supervisor with a policy agent, a data agent and a decision agent?", "为什么不用一个主管智能体，下面分政策智能体、数据智能体和决策智能体？"), a: t("Module 12's measurement: more agents meant more model calls for the same answer. One agent with three tools is cheaper, faster and has one trace to read. Split only when a measured failure points at a boundary.", "第 12 模块的测量结果是：智能体越多，得到同样答案所需的模型调用就越多。一个智能体加三个工具更便宜、更快，也只需读一条追踪。只有当测量到的失败明确指向某条边界时才拆分。") },
          { q: t("What if the model is prompt-injected by text in an invoice PDF?", "如果发票 PDF 里的文字对模型进行了提示词注入怎么办？"), a: t("It can only change the proposal, which then fails the code checks or reaches a person who sees the evidence. It cannot pay, write, or call a write tool, because none exists. Treat document text as data: the reviewer UI escapes it.", "它只能改变提议，而这份提议要么过不了代码检查，要么会交到一个能看到证据的人手里。它无法付款、无法写入，也无法调用写入工具，因为根本没有这种工具。把文档文本当作数据处理：审核界面会对其进行转义。") },
        ],
      },
      {
        id: "review",
        title: t("The review queue and the reviewer app", "审核队列与审核 App"),
        local: t("Lakebase tables proposals and decisions, a Databricks App with user authorization, and an export of decisions to Delta.", "Lakebase 中的 proposals 和 decisions 两张表、启用用户授权的 Databricks App，以及把决定导出到 Delta 的任务。"),
        links: ["memory.boundaries", "guardrails.review", "state.writers"],
        after: ["agent", "governance"],
        components: ["queue", "reviewer"],
        why: t(
          "The human decision is the control an auditor will test, so it must be impossible to bypass from the browser: the reviewer sees only their units, cannot approve twice, large amounts need a second person, and a rejection must say what the right action was. That last rule is also the learning loop: a rejection without the correct action is not a label, and the next eval set can then only learn from the agent's successes. The queue is Postgres because a queue is many small concurrent updates with row locks.",
          "人的决定是审计人员会测试的控制措施，所以必须做到无法从浏览器绕过：审核人员只能看到自己的单元，不能重复批准，大额需要第二个人，拒绝时必须说明正确的动作是什么。最后这条规则同时也是学习循环：没有给出正确动作的拒绝不能成为标签，这样下一个评估集就只能从智能体的成功案例中学习。队列放在 Postgres 中，因为队列就是大量带行锁的小规模并发更新。",
        ),
        what: t(
          "review_queue.sql creates proposals (one live per exception, by partial unique index) and append-only decisions (a rejection requires correct_action), and puts the payment control in the database: a trigger refuses any proposal inserted already decided, any approval without recorded approvals, any large approval without two different approvers, and any change to amount, action or unit; column-level grants let the agent and the app change status only. The trigger runs as its owner (SECURITY DEFINER) with search_path fixed and pg_temp last, every table it reads is schema-qualified, and TEMPORARY is revoked from PUBLIC, so no caller can shadow decisions with a temporary table full of fake approvals. tests/test_review_queue_pg.py runs that file on a real Postgres and attacks it. The app reads as the user with the forwarded token: only members of fin-reviewers who are not auditors may decide, and their units come from reviewer_scope. decide() repeats the rules for clear error messages, under a row lock, and refuses cross-site posts. export_decisions.py copies decisions to Delta, with a label only once a decision is final, and re-reads every unlabelled first approval until its second decision arrives.",
          "review_queue.sql 创建 proposals 表（通过部分唯一索引保证每个异常只有一条在途提议）和只追加的 decisions 表（拒绝时必须填写 correct_action），并把付款控制放进数据库：一个触发器会拒绝任何以已决定状态插入的提议、任何没有已记录批准的批准、任何没有两位不同批准人的大额批准，以及对金额、动作或单元的任何修改；列级授权只允许智能体和 App 修改状态。触发器以其所有者身份运行（SECURITY DEFINER），search_path 固定且 pg_temp 排在最后，它读取的每张表都带 schema 限定，并且对 PUBLIC 撤销了 TEMPORARY，所以任何调用者都无法用一张装满假批准的临时表来冒充 decisions。tests/test_review_queue_pg.py 在真实的 Postgres 上运行这个文件并对它发起攻击测试。App 用转发的令牌以用户身份读取：只有属于 fin-reviewers 且不是审计人员的人才能做决定，其负责的单元来自 reviewer_scope。decide() 在行锁下重复这些规则以给出清晰的错误信息，并拒绝跨站提交。export_decisions.py 把决定复制到 Delta，只有决定最终确定后才写入标签，并持续重读每一条尚无标签的首次批准，直到第二个决定到来。",
        ),
        how: [
          t("Create a Lakebase project, run review_queue.sql as an admin role, and grant the app and agent principals as the file shows.", "创建一个 Lakebase 项目，以管理员角色运行 review_queue.sql，并按文件所示给 App 和智能体的服务主体授权。"),
          t("Deploy the app with the bundle, add the Lakebase database resource, and enable user authorization with the `sql` scope.", "用 bundle 部署 App，添加 Lakebase 数据库资源，并启用带 `sql` 范围的用户授权。"),
          t("Test as three people: a reviewer of unit A, a reviewer of unit B, and the same reviewer twice on an amount above the threshold.", "以三种身份测试：单元 A 的审核人员、单元 B 的审核人员，以及同一位审核人员对超过阈值的金额连续操作两次。"),
          t("Schedule export_decisions after each batch (the orchestrator job does).", "在每批处理之后安排 export_decisions（编排 job 已经这样做了）。"),
        ],
        files: [K + "src/review/review_queue.sql", K + "tests/test_review_queue_pg.py", K + "app/review_logic.py", K + "app/app.py", K + "app/app.yaml", K + "src/review/export_decisions.py", K + "resources/apps.yml"],
        interpret: [
          t("Reviewer B seeing an empty queue while A sees ten items is the design working: B's UC query returned no units for A's rows.", "审核人员 B 看到空队列而 A 看到十条，说明设计在起作用：B 的 UC 查询没有返回 A 那些行所属的单元。"),
          t("`403 you already approved this proposal` on the second click is the two-person rule. If it does not appear, check that the first approval left the proposal in needs_second.", "第二次点击时出现 `403 you already approved this proposal`，就是双人复核规则在起作用。如果没出现，检查第一次批准后提议是否处于 needs_second 状态。"),
          t("In ops.decisions_history, the action column is the label the next eval set uses. Rejections with a correct action are the most valuable rows in the whole system.", "在 ops.decisions_history 中，action 列就是下一个评估集要用的标签。带有正确动作的拒绝，是整个系统中最有价值的数据行。"),
        ],
        trouble: [
          { s: t("401: user authorization is not enabled", "401：未启用用户授权"), c: t("The app has no user scopes, so no x-forwarded-access-token header.", "App 没有配置用户范围，所以没有 x-forwarded-access-token 请求头。"), f: t("Add the `sql` scope under User authorization, then restart the app.", "在 User authorization 下添加 `sql` 范围，然后重启 App。") },
          { s: t("The reviewer sees all units", "审核人员看到了所有单元"), c: t("The units query ran as the app's principal instead of the user's token.", "单元查询是以 App 的服务主体身份运行的，而不是用户的令牌。"), f: t("my_units() must use access_token=the forwarded token. Never fall back to the app identity when the header is missing; the code returns 401.", "my_units() 必须使用 access_token=转发的令牌。缺少请求头时绝不能退回到 App 身份；代码会返回 401。") },
          { s: t("An auditor can approve", "审计人员可以批准"), c: t("Auditors see every unit by policy, and the app took units from what the user can see.", "按策略，审计人员能看到所有单元，而 App 是根据用户能看到的内容来确定单元的。"), f: t("Seeing is not deciding: the app requires fin-reviewers and not fin-auditors, and reads units from reviewer_scope.", "能看到不等于能决定：App 要求属于 fin-reviewers 且不属于 fin-auditors，并从 reviewer_scope 读取单元。") },
          { s: t("Every decision fails: cross-site request refused", "每个决定都失败：cross-site request refused"), c: t("Behind the Apps proxy the Host header can be an internal address, so it never equals the browser's Origin.", "在 Apps 代理之后，Host 请求头可能是内部地址，因此永远不等于浏览器的 Origin。"), f: t("same_origin() also accepts X-Forwarded-Host and the APP_HOSTS variable. Set APP_HOSTS to the app's public host name if neither header carries it; never remove the check.", "same_origin() 也接受 X-Forwarded-Host 和 APP_HOSTS 变量。如果两个请求头都不带公网主机名，就把 APP_HOSTS 设为 App 的公网主机名；绝不要删除这项检查。") },
          { s: t("Decisions table can be updated", "decisions 表可以被更新"), c: t("The app role owns the table.", "App 角色拥有这张表。"), f: t("Recreate it as an admin role and grant the app SELECT and INSERT only, as review_queue.sql does.", "以管理员角色重建它，并像 review_queue.sql 那样只授予 App SELECT 和 INSERT 权限。") },
        ],
        done: t("The three-person test behaves as described, decisions cannot be edited, and decisions_history fills after each batch.", "三人测试的表现与描述一致，决定无法被编辑，每批处理后 decisions_history 都会写入数据。"),
        unconfirmed: t("The Lakebase app resource block and the genie_space and sql_warehouse resource shapes in apps.yml follow the documented resource types; the exact YAML keys should be checked against the Apps resources page. Header names other than x-forwarded-access-token were not read for this guide, so the app asks the API who the user is.", "apps.yml 中 Lakebase App 资源块以及 genie_space 和 sql_warehouse 的资源结构遵循文档中的资源类型；确切的 YAML 键需要对照 Apps 资源页面核对。本指南没有查阅除 x-forwarded-access-token 之外的请求头名称，所以 App 是通过 API 询问用户身份的。"),
        scale: [
          t("Hundreds of reviewers: the queue query is indexed on (business_unit, status, created_at); Lakebase autoscaling handles the connection load. The app itself scales by compute size.", "数百位审核人员：队列查询在 (business_unit, status, created_at) 上有索引；Lakebase 自动扩缩容负责处理连接负载。App 本身通过计算规格扩展。"),
          t("Reviewer throughput becomes the real limit long before compute does. Measure decisions per reviewer-hour; that number, not model latency, sets how many exceptions a day the workflow clears.", "早在计算资源成为瓶颈之前，审核人员的处理速度就会成为真正的限制。测量每位审核人员每小时的决定数；决定工作流每天能处理多少异常的是这个数字，而不是模型延迟。"),
        ],
        challenge: [
          { q: t("Why a custom app and not the Agent Bricks review UI or a dashboard?", "为什么要自己做 App，而不用 Agent Bricks 的审核界面或仪表盘？"), a: t("The decision needs rules a generic UI does not have: units from Unity Catalog, the two-person rule, a required correction on reject, an append-only log. Those are payment controls. Use the MLflow labeling tools for SME feedback on traces (step [[monitor]]), which is a different job.", "这个决定需要通用界面没有的规则：来自 Unity Catalog 的单元范围、双人复核、拒绝时必须给出纠正、只追加的日志。这些都是付款控制措施。MLflow 的标注工具用于专家对追踪的反馈（第 [[monitor]] 步），那是另一项工作。") },
        ],
      },
    ],
  },
  {
    id: "quality",
    title: t("Quality: the release gate and production monitoring", "质量：发布门槛与生产监控"),
    goal: t(
      "Two loops, measured differently. Before release, a sealed evaluation set of past human decisions decides whether a change ships. After release, scorers on sampled live traces and the reviewers' own decisions say whether it still works. Both feed the contract's numbers, and neither is a demo.",
      "两个循环，用不同的方式衡量。发布之前，由过往人工决定组成的封存评估集决定一项改动能否上线。发布之后，对抽样的线上追踪运行的 scorer，加上审核人员自己的决定，告诉你它是否依然有效。两者都对应契约中的数字，没有一个是演示。",
    ),
    steps: [
      {
        id: "evalset",
        title: t("The evaluation set and the release gate", "评估集与发布门槛"),
        local: t("evals.triage_v<N> from past decisions, four scorers, and gate.py comparing against the contract and the last release.", "由过往决定构成的 evals.triage_v<N>、四个 scorer，以及将结果与契约和上一版本对比的 gate.py。"),
        links: ["evaluation.frozen", "evaluation.seal", "evaluation.noise", "evaluation.agent", "evaluation.read"],
        after: ["review"],
        components: ["evals"],
        why: t(
          "The only honest exam for this agent is what people actually decided on real exceptions. Two traps: leakage (an exception used as a prompt example must not be in the exam) and time (the exam is the most recent full quarter, so the agent is tested on the future relative to its prompt). The gate then blocks a release if any contract threshold fails, if there is a single unsafe error (proposing payment where a person did not), or if a metric regressed by more than its measured run-to-run spread. A change smaller than the spread is not a change.",
          "对这个智能体来说，唯一诚实的考试是人们对真实异常实际做出的决定。有两个陷阱：泄漏（被用作提示词示例的异常不能出现在考题中）和时间（考题取最近一个完整季度，这样相对于提示词，智能体是在“未来”的数据上接受测试）。然后，门槛会在以下情况下阻止发布：任何契约门槛未达标；出现哪怕一个不安全错误（在人没有付款的情况下提议付款）；或者某个指标的退步超过了测得的运行间波动范围。小于波动范围的变化不算变化。",
        ),
        what: t(
          "run_eval.py build creates a versioned table from decisions_history with the final decision per exception, excluding prompt examples. run runs every case through the deployed agent in dry-run mode several times, summarizes each run (accuracy, unsafe errors, grounded figures, policy cited, first-try admissible, p95 latency, cost), logs an MLflow evaluation, and writes the summaries. gate.py takes the worst value across runs and checks it against the contract, the baseline and the spread.",
          "run_eval.py build 从 decisions_history 中按每个异常取最终决定，排除提示词示例，创建一个带版本号的表。run 以 dry-run 模式让已部署的智能体把每个用例跑上几遍，汇总每次运行的结果（准确率、不安全错误、有据数字、政策引用、首次即可接受率、p95 延迟、成本），记录一次 MLflow 评估，并写出汇总。gate.py 取多次运行中最差的值，对照契约、基线和波动范围进行检查。",
        ),
        how: [
          t("Seed the first set from the manual process: last quarter's resolved exceptions, with the action the AP team took. At least 200 cases, spread across types.", "第一个评估集用人工流程的数据来建立：上个季度已解决的异常，以及应付账款团队当时采取的动作。至少 200 个用例，覆盖各种类型。"),
          t("`python run_eval.py build --catalog fin_stg --version 1`, then restrict MODIFY on evals to the eval owner.", "执行 `python run_eval.py build --catalog fin_stg --version 1`，然后把 evals 上的 MODIFY 权限只留给评估负责人。"),
          t("`run --repeats 3` against staging; then `python gate.py --current current.json --contract ../../contract.yml`.", "针对预发环境执行 `run --repeats 3`；然后执行 `python gate.py --current current.json --contract ../../contract.yml`。"),
          t("CI runs both on every merge to main (step [[cicd]]). A new eval version each quarter; never edit a sealed one.", "CI 在每次合并到 main 时都会运行这两步（第 [[cicd]] 步）。每个季度一个新的评估版本；绝不修改已封存的版本。"),
        ],
        files: [K + "src/evals/scorers.py", K + "src/evals/run_eval.py", K + "src/evals/gate.py"],
        interpret: [
          t("`unsafe_errors: 1` blocks the release whatever the accuracy. Open that case first: it is the one an auditor will ask about.", "`unsafe_errors: 1` 会阻止发布，无论准确率多高。先打开那个用例：审计人员会问的就是它。"),
          t("`action_accuracy regressed 0.92 -> 0.88 (allowed spread 0.03)` is a real regression; `0.92 -> 0.90` with the same spread is noise and passes. Report the spread with every number you show a stakeholder.", "`action_accuracy regressed 0.92 -> 0.88 (allowed spread 0.03)` 是真正的退步；同样的波动范围下 `0.92 -> 0.90` 只是噪声，可以通过。向干系人展示任何数字时，都要同时报告波动范围。"),
          t("Accuracy against people is capped by how often people agree with each other. Measure that once (two reviewers on the same 100 cases); an agent at the human agreement rate is as good as the label allows.", "以人为参照的准确率，上限取决于人与人之间的一致程度。测量一次（两位审核人员处理同样的 100 个用例）；智能体达到人与人的一致率时，就已经是标签所能允许的最好水平了。"),
        ],
        trouble: [
          { s: t("Fewer than 200 cases", "用例少于 200 个"), c: t("Not enough resolved exceptions yet, or rejections lack correct actions.", "已解决的异常还不够多，或者拒绝记录缺少正确动作。"), f: t("Backfill from the manual process history. The gate refuses to pass on a small set by design.", "从人工流程的历史数据回填。门槛在设计上就拒绝在小样本上通过。") },
          { s: t("Eval runs write to the queue", "评估运行写入了队列"), c: t("The handler ignores custom_inputs.dry_run.", "处理函数忽略了 custom_inputs.dry_run。"), f: t("Pass dry_run from custom_inputs to triage(); an eval must never create work for reviewers.", "把 custom_inputs 中的 dry_run 传给 triage()；评估绝不能给审核人员制造工作。") },
        ],
        done: t("The gate passes on staging with at least 200 cases and zero unsafe errors, and the first baseline is stored.", "门槛在预发环境上通过，用例至少 200 个，不安全错误为零，并且存储了第一个基线。"),
        unconfirmed: t("custom_inputs and custom_outputs in the request and response follow the agent Responses API conventions; check the vendored template for the exact field names.", "请求和响应中的 custom_inputs 与 custom_outputs 遵循智能体 Responses API 的惯例；请在引入的模板中核对确切的字段名。"),
        scale: [
          t("Each eval run costs the agent's cost per exception times cases times repeats. At 400 cases and 3 repeats that is 1,200 triages: put the number in the budget. Nightly runs can use a stratified 100-case sample; releases use the full set.", "每次评估运行的成本 = 每个异常的智能体成本 × 用例数 × 重复次数。400 个用例重复 3 次就是 1,200 次分诊：把这个数字列入预算。夜间运行可以使用 100 个用例的分层样本；发布时使用完整评估集。"),
        ],
        challenge: [
          { q: t("Why not use an LLM judge for correctness?", "为什么不用 LLM 评审来判断正确性？"), a: t("Because there is ground truth: what a person decided. Judges are for things without ground truth, such as whether a rationale is clear, and module 12 showed judges must be calibrated against people before they are trusted.", "因为这里有标准答案：人做出的决定。评审模型适用于没有标准答案的东西，比如理由是否清楚；而第 12 模块已经说明，评审模型在被信任之前必须先与人工对齐校准。") },
        ],
      },
      {
        id: "monitor",
        title: t("Production monitoring and SME feedback", "生产监控与专家反馈"),
        local: t("Scorers on sampled live traces, and the reviewers' decisions as a continuous label stream.", "在抽样线上追踪上运行的 scorer，以及作为持续标签流的审核人员决定。"),
        links: ["self-evolving.observe", "ops.logs", "evaluation.schedule"],
        after: ["evalset"],
        components: ["monitor"],
        why: t(
          "The eval set measures last quarter. Monitoring measures today: new vendors, new policy wording, a model update behind the same endpoint name. Two signals, both cheap: scorers on a sample of live traces (safety on all of them, rule adherence on 20%), and the reviewers' approval rate by week, which is a free, continuous accuracy measurement with a person behind every label.",
          "评估集衡量的是上个季度。监控衡量的是今天：新的供应商、新的政策措辞、同一个端点名背后的模型更新。两种信号，都很便宜：对线上追踪抽样运行 scorer（safety 覆盖全部，规则遵守情况覆盖 20%），以及按周统计的审核人员批准率，这是一种免费、持续的准确率测量，每个标签背后都有一个人。",
        ),
        what: t(
          "register_monitors.py registers the built-in Safety scorer at 100% sampling and a Guidelines scorer with the three triage rules at a configurable rate, against the agent's trace experiment. Results appear on the traces in the experiment and feed a monitoring dashboard.",
          "register_monitors.py 在智能体的追踪实验上注册内置的 Safety scorer（100% 抽样），以及一个包含三条分诊规则、抽样率可配置的 Guidelines scorer。结果显示在实验中的追踪上，并汇入监控仪表盘。",
        ),
        how: [
          t("`python register_monitors.py --experiment-id <id> --sample-rate 0.2` once per environment.", "每个环境执行一次 `python register_monitors.py --experiment-id <id> --sample-rate 0.2`。"),
          t("Add query 3 of the observability file (approval rate by week) to the same dashboard.", "把可观测性文件中的第 3 条查询（按周批准率）加到同一个仪表盘上。"),
          t("For traces a scorer flags, use MLflow labeling sessions to ask an AP expert for a verdict; good cases become eval cases in the next quarter's set.", "对于被 scorer 标记的追踪，使用 MLflow 标注会话请应付账款专家给出判断；好的用例会成为下个季度评估集中的用例。"),
        ],
        files: [K + "src/monitoring/register_monitors.py"],
        interpret: [
          t("A drop in the weekly approval rate with no deploy is drift: look at which exception type and which vendors. A drop right after a deploy is a regression the gate missed: add those cases to the next eval set.", "没有部署却出现每周批准率下降，就是漂移：看看是哪种异常类型、哪些供应商。部署后马上下降，则是门槛没拦住的退步：把这些用例加进下一个评估集。"),
          t("Guideline failures on 20% of traces estimate the rate on all traces; with 500 triages a day, 100 scored is enough to see a change of a few percent within a week.", "对 20% 追踪的 guideline 失败率，可以用来估计全部追踪上的比例；每天 500 次分诊时，评分 100 次就足以在一周内看出几个百分点的变化。"),
        ],
        trouble: [
          { s: t("No feedback on traces", "追踪上没有反馈"), c: t("The scorer was registered against a different experiment than the app writes to.", "scorer 注册的实验与 App 写入的不是同一个。"), f: t("Use the experiment in resources/apps.yml (the app's experiment resource).", "使用 resources/apps.yml 中的实验（App 的 experiment 资源）。") },
          { s: t("Monitoring cost grows with traffic", "监控成本随流量增长"), c: t("LLM-based scorers are model calls.", "基于 LLM 的 scorer 也是模型调用。"), f: t("Keep code-based checks at 100% (they are in the agent already) and lower the sample rate of LLM-based scorers.", "让基于代码的检查保持 100%（它们已经在智能体里了），并降低基于 LLM 的 scorer 的抽样率。") },
        ],
        done: t("Monitors run on live traces in staging and production, and the dashboard shows scorer results and weekly approval rate side by side.", "监控在预发和生产环境的线上追踪上运行，仪表盘并排显示 scorer 结果和每周批准率。"),
        unconfirmed: t("The Guidelines scorer's register and start methods are assumed to work like the documented Safety example; custom code scorers' registration for monitoring was not shown on the page read.", "这里假定 Guidelines scorer 的 register 和 start 方法与文档中 Safety 的示例用法相同；本指南阅读的页面没有展示自定义代码 scorer 如何注册到监控中。"),
        scale: [
          t("Monitoring cost is sample rate times traffic times scorer cost. Set the rate from the precision you need, not from habit: a weekly decision needs a few hundred scored traces, not all of them.", "监控成本 = 抽样率 × 流量 × scorer 成本。根据你需要的精度来设定抽样率，而不是凭习惯：每周做一次决定，只需要几百条评分过的追踪，而不是全部。"),
        ],
        challenge: [
          { q: t("If reviewers check everything, why monitor at all?", "既然审核人员会检查所有内容，为什么还要监控？"), a: t("Because reviewers get tired and approve what looks plausible. A rising approval rate can mean a better agent or a rubber stamp. Scorers that do not get tired, and a periodic second-reviewer sample, tell those apart.", "因为审核人员会疲劳，会批准看起来说得通的东西。批准率上升，可能意味着智能体变好了，也可能意味着审核成了橡皮图章。不会疲劳的 scorer，加上定期的第二审核人抽样，能区分这两种情况。") },
        ],
      },
    ],
  },
];
