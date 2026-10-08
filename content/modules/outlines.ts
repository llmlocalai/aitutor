import type { Module } from "@/lib/types";

export const outlines: Module[] = [
  {
    id: "knowledge",
    title: "Knowledge management",
    short: "Collect, validate, name, tier, and retire documents before any index sees them.",
    layer: 0,
    depth: "outline",
    what:
      "Knowledge management is the pipeline and the rules that decide what enters the knowledge bank: where documents come from, how they are validated and named, which are authoritative, and when a document is retired.",
    why:
      "Retrieval ranks whatever it is given. The reference build's own guide calls this work 90 percent librarianship and 10 percent technology. Folder taxonomy, file names, and pruning duplicates moved quality more than any algorithm change.",
    how: [
      "New files land in an inbox. A validation step checks type by content, rejects error pages saved as documents, and files each item into a collection folder.",
      "A ledger records every file with its content hash, collection, processing stage, and status. Re-ingestion skips unchanged files. Retired files stay in the ledger with a reason.",
      "A rules file assigns each source an authority tier by path. Primary rules outrank guidance, which outranks commentary.",
      "Scheduled collectors pull feeds through a relevance filter so off-topic reports do not enter the queue.",
      "A second tier of curated wiki pages, drafted by a model and approved by a person, captures judgment that no source document contains.",
    ],
    prereqs: [],
    inBuild: [
      { path: "KNOWLEDGE_MANAGEMENT_GUIDE.md", role: "The three-tier plan: vector search, curated wiki, graph." },
      { path: "knowledge-bank/_inbox/", role: "Drop zone for new files." },
      { path: "knowledge-bank/source_authority.json", role: "Path rules for authority tiers." },
      { path: "apps/llm-wiki/llm_wiki.py", role: "Drafts one page per concept for human review." },
      { path: "COLLECTION-PLAN.md", role: "What is collected, from where, on what schedule." },
    ],
    portability: {
      databricks: "Land raw files in a Unity Catalog volume. Use a Lakeflow pipeline for validation and chunk tables. The ledger is a Delta table, and tiers are a column.",
      watsonx: "Store documents in watsonx.data or object storage and register them as knowledge sources. Keep the ledger and tier rules as your own tables.",
      codex: "Not provided. Keep the bank as a repo or bucket with the same ledger and let agents reach it through a search tool.",
      cursor: "Not provided. Same approach: your pipeline, your ledger, exposed through a tool.",
      claude: "Not provided by the coding agent. Project knowledge features hold small document sets. A large bank still needs this pipeline.",
      other: "Folders, a hash ledger, and a rules file work on any filesystem.",
    },
    checks: [
      {
        q: "Why keep retired files in the ledger?",
        a: "So the system can explain why a passage no longer appears, and so a re-download of the same file is recognized and skipped.",
      },
      {
        q: "A 56 GB folder of CSV files sits in the document bank. Should it be chunked and embedded?",
        a: "No. Tabular records are an analysis corpus. Load them into a query engine and expose query tools. Chunking rows into passages produces confident nonsense.",
      },
    ],
  },
  {
    id: "state",
    title: "State and storage",
    short: "Where facts live between calls, who may write them, and how concurrent writers stay safe.",
    layer: 1,
    depth: "outline",
    what:
      "State is everything that outlives one model call: the conversation so far, run state inside a request, conversation history across requests, the knowledge store, cursors that mark how far a background job has read, and locks.",
    why:
      "A model call has no memory. Each kind of state has a different lifetime and a different owner, and mixing them causes the worst bugs. The reference build's single-writer stores failed when a nightly job and a daily job wrote at once, and one file was corrupted.",
    how: [
      "Run state is a dict passed through the executor. Merge rules say which keys accumulate and which overwrite.",
      "Conversation state is the message list, stored per thread so a later request can recall it.",
      "Durable knowledge lives in Postgres. Multi-version concurrency means readers never block writers.",
      "Schemas separate ownership. Dropping one schema deletes everything the agent taught itself and leaves ingested documents untouched.",
      "Background jobs keep cursors so they resume where they stopped and never process a log line twice.",
    ],
    prereqs: [],
    inBuild: [
      { path: "apps/agent-server/graph.py", role: "merge_state: the rules for run state." },
      { path: "apps/agent-server/pgstore.py", role: "Connection handling and schema setup for Postgres." },
      { path: "apps/agent-server/pgschema.sql", role: "Schemas by owner: learned knowledge, file ledger, chunk indexes." },
      { path: "apps/agent-server/conversation_store.py", role: "Threads and messages across requests." },
    ],
    portability: {
      databricks: "Delta tables for durable state. Lakebase for Postgres-style transactional state such as threads and checkpoints. Run state lives in your agent code.",
      watsonx: "Orchestrate manages thread state for its agents. Durable domain state goes in watsonx.data or a database you connect.",
      codex: "Session history is managed by the tool and can be resumed. Durable project state is files in the repo.",
      cursor: "Chat history is managed by the editor. Durable state is files, plus whatever your MCP servers store.",
      claude: "Sessions can be resumed. The SDK exposes session ids. Durable state is files and your own stores.",
      other: "Postgres in a container gives the same guarantees. SQLite is fine for one writer.",
    },
    checks: [
      {
        q: "Name three kinds of state and their lifetimes.",
        a: "Run state lasts one request. Conversation state lasts a thread. Knowledge and memory last until retired. Mixing them leads to leaks across users or loss across requests.",
      },
      {
        q: "Why did the reference build leave single-file stores?",
        a: "They allow one writer at a time. Two scheduled jobs collided, one database was corrupted, and a vector segment became unreadable. Postgres gives concurrent access and crash recovery.",
      },
    ],
  },
  {
    id: "api-gateway",
    title: "API and gateway",
    short: "One contract for every caller, with keys, scopes, limits, and a single public door.",
    layer: 1,
    depth: "outline",
    what:
      "The API is the contract callers use: the OpenAI-compatible chat, embeddings, and models endpoints. The gateway is the process in front that authenticates each caller and decides what that caller may do.",
    why:
      "The model engine has no authentication. Every outside caller needs an identity that can be limited and revoked without affecting the others. A stable contract also lets you swap what is behind it.",
    how: [
      "Keys are stored hashed. Each key has an app name, scopes such as chat and tools, a rate limit, and a quota.",
      "The gateway validates the key, checks scope and limits, then forwards. The engine stays on localhost.",
      "Public access goes through an encrypted tunnel to the gateway port only. No router port is forwarded.",
      "A translation gateway maps one provider's API shape to another, which lets a coding client built for a hosted API talk to local models.",
      "Health has two levels. An unauthenticated probe answers only whether the process is serving. Details require a key.",
    ],
    prereqs: [
      {
        id: "inference",
        why: "A gateway forwards to an engine. Its timeouts and limits are set from measured load times and generation rates.",
        stub: "An echo handler that returns a fixed completion.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/auth.py", role: "Key validation, scopes, rate limits, quotas." },
      { path: "apps/agent-server/keys_admin.py", role: "Issue, list, and revoke keys." },
      { path: "apps/agent-server/main.py", role: "The endpoints." },
      { path: "apps/claude-code-gateway/", role: "Translation proxy so a coding client can use local models." },
    ],
    portability: {
      databricks: "Model Serving endpoints are the API. AI Gateway adds rate limits, usage tracking, guardrails, and routing across providers. Identity is the workspace's tokens and service principals.",
      watsonx: "watsonx.ai exposes inference endpoints behind IAM keys. A model gateway routes to third-party providers. Orchestrate exposes agent endpoints.",
      codex: "Codex is a client. It needs a provider base URL and key. If you point it at your gateway, issue it its own key.",
      cursor: "A client. Give it a key of its own and a base URL override where supported.",
      claude: "A client. A base URL setting can route it through your gateway. Issue a separate key per machine.",
      other: "A small FastAPI app or an off-the-shelf LLM proxy does the same job on any host.",
    },
    checks: [
      {
        q: "Why one key per app?",
        a: "So you can limit and revoke one integration without touching the others, and so logs attribute every request.",
      },
      {
        q: "Why is liveness unauthenticated while details are not?",
        a: "A supervisor has to tell healthy from sick without holding a key. Details reveal configuration, so they stay behind one.",
      },
    ],
  },
  {
    id: "tools-mcp",
    title: "Tools and MCP",
    short: "Give the model typed actions, and serve them over a protocol any harness can call.",
    layer: 2,
    depth: "outline",
    what:
      "A tool is a function with a name, a description, and a JSON schema for its arguments. The Model Context Protocol is a standard way to serve tools from a separate process so any compatible client can list and call them.",
    why:
      "Tools are how an agent reads data and acts. Serving them over MCP means the chat agent, a coding agent, and an editor share one implementation. Tool design also decides how often the model picks the wrong instrument.",
    how: [
      "Write each tool as a narrow function that returns structured data and, when empty, a diagnostic naming the filter that emptied the result.",
      "Describe when to use it in the schema description. Keep the number of tools small. Twelve tools without routing made the reference agent slower and more confidently wrong.",
      "Register tools in one table. The harness calls by name and does not care whether a tool is local or remote.",
      "Wrap the same functions in an MCP server process. Clients start it from a config entry with a command and environment.",
      "Measure schema cost. Tool schemas are sent on every turn. The reference server has a flag that prints its token cost.",
    ],
    prereqs: [
      {
        id: "api-gateway",
        why: "Tool calling rides on the chat contract: tool schemas go in the request and tool calls come back in the response. Key scope decides who gets tools.",
        stub: "Call tool functions directly from a test script.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/tools/registry.py", role: "Schemas and the call_tool dispatcher." },
      { path: "apps/agent-server/mcp_client.py", role: "Connects to external MCP servers and registers their tools." },
      { path: "apps/mcp-servers/brainbank/server.py", role: "Serves the knowledge and data tools to any MCP client." },
      { path: ".mcp.json", role: "Client config: command, arguments, environment, timeout." },
    ],
    portability: {
      databricks: "Unity Catalog functions are governed tools. Managed MCP servers expose Vector Search, Genie, and functions. You can also host a custom MCP server as a Databricks App.",
      watsonx: "Orchestrate tools are Python functions, OpenAPI specs, or MCP servers imported with the ADK. A tool written as an MCP server here can be registered there.",
      codex: "Add MCP servers in the config file. Tools then appear to the agent. This is the direct route for reusing your own tools.",
      cursor: "Add servers to the project MCP config. Same server, no code change.",
      claude: "Add servers to the project MCP file. The reference build shares one server between its chat agent and its coding agent this way.",
      other: "An MCP server is a process speaking JSON-RPC over stdio or HTTP. It runs anywhere Python or Node runs.",
    },
    checks: [
      {
        q: "A tool returns an empty list. What should the agent be allowed to conclude?",
        a: "Only that this filter matched nothing. It may report what it searched. It may not explain why the data cannot exist. The tool's diagnostic should name the filter to relax.",
      },
      {
        q: "Why serve tools over MCP when the harness could import them?",
        a: "One implementation then serves every harness. Moving to another platform means registering the server, with no rewrite.",
      },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    short: "Instruction files loaded on demand, so routing knowledge costs nothing until it is needed.",
    layer: 4,
    depth: "outline",
    what:
      "A skill is a Markdown file with a one-line description and a body of instructions for one class of task. The harness matches a request to at most one skill and injects the body into the prompt.",
    why:
      "A base prompt that holds every rule is expensive on every turn and gets ignored. Skills keep the base short and load detail only when relevant. They also carry routing: which tool to use for which question.",
    how: [
      "Each file has frontmatter with a description, then the body.",
      "Matching started as keyword overlap with the description and later added routing exemplars: real requests each skill should handle, plus a list that should match none.",
      "Only one skill is loaded per request. Most requests match none.",
      "The same files are linked into the coding agent's skills folder, so one edit changes both surfaces.",
      "A separate gold set scores routing. When a request is misrouted, an exemplar is added.",
    ],
    prereqs: [
      {
        id: "harness",
        why: "A skill is text injected during prompt composition. Without the composition step there is nowhere to load it.",
        stub: "Paste the skill body into the system prompt by hand.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/skills/loader.py", role: "Parse, match, and return at most one skill." },
      { path: "apps/agent-server/skills/routing.json", role: "Routing exemplars per skill." },
      { path: "apps/agent-server/skills/*.md", role: "The skills." },
      { path: ".claude/skills/", role: "Links to the same files for the coding agent." },
    ],
    portability: {
      databricks: "No native skill format. Store skill files in a volume and load them in your agent code, or register prompts in the prompt registry.",
      watsonx: "Agent instructions and per-agent guidelines play this role. Narrow agents as collaborators are the platform's way to scope instructions.",
      codex: "Skills are supported as folders with a SKILL.md. The reference skill bodies can be moved with small edits.",
      cursor: "Rules files scoped by path or description, plus skills. The description line does the same matching job.",
      claude: "Native. A folder per skill with a SKILL.md whose description decides when it loads.",
      other: "Markdown files and a 100-line loader. Fully portable.",
    },
    checks: [
      {
        q: "Why at most one skill per request?",
        a: "A skill is a narrow instruction set. Stacking several dilutes each and raises prompt cost on every turn.",
      },
      {
        q: "What is the difference between a skill and a tool?",
        a: "A tool does something and returns data. A skill tells the model how to approach a class of task, including which tools to use and in what order.",
      },
    ],
  },
  {
    id: "memory",
    title: "Memory",
    short: "What the agent keeps about a user and about its own past work, and how it gets back into the prompt.",
    layer: 4,
    depth: "outline",
    what:
      "Memory is durable information written during or after conversations and read back in later ones. It includes per-user facts, summaries of past threads, and rules the agent learned from its own mistakes.",
    why:
      "Without memory every conversation starts cold. With careless memory the agent leaks one user's context into another's, or carries forward a wrong belief forever.",
    how: [
      "Each caller has a partition key. All reads and writes are scoped to it.",
      "After a response, a background task extracts what is worth keeping and writes it. A failure there never affects the response.",
      "At prompt composition, a short memory section is built for the partition and added to the system prompt.",
      "A recall tool searches past conversations on demand, so history does not have to sit in every prompt.",
      "Memory is tested: a memory eval asks questions whose answers were stated in earlier threads.",
    ],
    prereqs: [
      {
        id: "harness",
        why: "Memory is read at prompt composition and written after the response. Both are harness stages.",
        stub: "A JSON file per user, read at start and appended at end.",
      },
      {
        id: "state",
        why: "Memory is durable state with concurrent writers: live chats and background jobs. It needs the storage guarantees from the state module.",
        stub: "A single-writer file store, for one user only.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/memory_store.py", role: "Per-partition reads and writes." },
      { path: "apps/agent-server/memory_pipeline.py", role: "Post-response extraction, run in the background." },
      { path: "apps/agent-server/tools/conversation_recall.py", role: "Search past threads on demand." },
      { path: "evals/memory/", role: "Memory eval sets." },
    ],
    portability: {
      databricks: "Use Lakebase or Delta tables keyed by user, read in your agent code. Long-term memory patterns ship with the agent framework and LangGraph stores.",
      watsonx: "Orchestrate keeps conversation context. Long-term memory is a store you connect and read through a tool.",
      codex: "Persistent instructions live in AGENTS.md. Memories are files the agent is told to read and update.",
      cursor: "Rules and memory features hold persistent preferences. Project facts belong in repo files.",
      claude: "A project instruction file plus memory files and tools. The pattern is the same: write after, read at start, scope by project.",
      other: "A table with a partition column and a summarizer. Portable.",
    },
    checks: [
      {
        q: "Why is the memory write fire-and-forget?",
        a: "The user is waiting on the answer, not on bookkeeping. A slow or failed write should cost nothing in latency or correctness.",
      },
      {
        q: "What stops one user's memory from reaching another?",
        a: "A partition key applied in the store on every read and write. A prompt instruction alone would not be a boundary.",
      },
    ],
  },
  {
    id: "guardrails",
    title: "Guardrails and verification",
    short: "Deterministic checks on tool calls and on answers, each one written from a real failure.",
    layer: 4,
    depth: "outline",
    what:
      "Guardrails are code that inspects what the agent is about to do or say. Hooks check tool calls. An answer guard checks the final draft against the evidence gathered in this request.",
    why:
      "Models produce fluent text whether or not it is supported. The reference agent once ran the right queries, got the right rows, and answered with an invented table. Only a check outside the model catches that.",
    how: [
      "Extract checkable items from the draft: dollar figures, counts, organization names.",
      "Collect evidence: tool results from this request, plus what the user and earlier answers already said.",
      "An item is grounded when it appears in the evidence at some unit scale, or is the sum or difference of two grounded items.",
      "The first draft is judged strictly. A failed draft gets one corrective message. The retry is judged by majority. If it still fails, a fallback states what was found.",
      "Each rule has an enforce, observe, or off setting, and a test for the legitimate cases it must allow.",
    ],
    prereqs: [
      {
        id: "harness",
        why: "The guard is a stage in the loop: after the draft, before the response. Hooks wrap tool execution. Both need the loop.",
        stub: "Run the guard offline over logged answers.",
      },
      {
        id: "tools-mcp",
        why: "The guard compares the answer with tool results. Tools must return structured values the guard can parse.",
        stub: "A fixed evidence string.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/answer_guard.py", role: "Figure, count, and name checks. Corrective and fallback messages. Stream gate." },
      { path: "apps/agent-server/test_answer_guard.py", role: "Regression tests, one per rule." },
      { path: "apps/agent-server/hooks/write_path_guard.py", role: "Blocks writes outside an allowed folder." },
      { path: "apps/agent-server/nightly/claim_verify.py", role: "Two-vote check of stored claims against their source." },
    ],
    portability: {
      databricks: "AI Gateway guardrails cover safety and PII at the endpoint. Groundedness checks like this one are custom code in your agent, or scorers run on traces.",
      watsonx: "watsonx.governance provides guardrails and monitors. Domain checks go in a tool or a post-processing step you write.",
      codex: "Sandbox and approval modes limit actions. Hooks and your own test commands act as checks on changes.",
      cursor: "Hooks can block or modify agent actions. Rules can require checks before completion.",
      claude: "Hooks run before and after tool use and can block. Permission modes limit actions. Output checks are code you add in hooks or in the SDK loop.",
      other: "The guard is a pure Python module that takes an answer and evidence. Portable as is.",
    },
    checks: [
      {
        q: "Why judge the first draft strictly and the retry by majority?",
        a: "A strict first pass catches a single wrong figure among right ones. A lenient retry keeps one stubborn figure from turning a usable answer into a refusal.",
      },
      {
        q: "Why does every guard rule need an observe mode?",
        a: "So you can measure how often it would fire on real traffic, and what it would wrongly block, before it changes any answer.",
      },
    ],
  },
  {
    id: "multi-agent",
    title: "Multi-agent patterns",
    short: "Several model roles with separate context, tools, and budgets, coordinated by code.",
    layer: 5,
    depth: "outline",
    what:
      "A multi-agent system splits work across model calls that each have their own instructions, tools, and context. Coordination is done by an orchestrator: fan-out to workers, independent judges, or handoffs between specialists.",
    why:
      "One context window cannot hold everything, and one role cannot check itself. Separate roles give isolation of context and independence of judgment. They also multiply cost and failure modes, so each split needs a measured reason.",
    how: [
      "Orchestrator and workers: the planner fans out sub-tasks as nodes, each with a narrow tool set, then merges the results.",
      "Independent judges: two separate votes on whether a claim is supported by its source. A claim leaves service only when both fail it.",
      "Maker and checker: one model writes, a different and stronger model checks against the source.",
      "Role by dimension: specialist prompts selected by the kind of question, sharing one tool registry.",
      "Scheduling is part of the design. Background agents pause while a live request holds the busy marker.",
    ],
    prereqs: [
      {
        id: "harness",
        why: "A sub-agent is a harness loop run as a node. You need one working loop before you can run several.",
        stub: "Two sequential model calls with different system prompts.",
      },
      {
        id: "skills",
        why: "Roles are defined by scoped instructions. Skills are the mechanism for scoping them.",
        stub: "Hard-coded role prompts.",
      },
      {
        id: "evaluation",
        why: "Every added agent adds cost and latency. Only an eval can show that a split improved results.",
        stub: "Manual comparison on five questions. Enough to learn the pattern, not enough to justify it.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/graph.py", role: "The executor that runs concurrent nodes." },
      { path: "apps/agent-server/nightly/claim_verify.py", role: "Two-vote judging." },
      { path: "apps/agent-server/skills/spending-orchestration.md", role: "Instructions for decomposing a multi-part data question." },
      { path: "ROLE-DIMENSION-ARCHITECTURE-v2.md", role: "Design for specialist roles by question dimension." },
    ],
    portability: {
      databricks: "Multi-agent supervisors are available as a managed pattern, and LangGraph or the OpenAI Agents SDK run inside a deployed agent. Each sub-agent can be its own serving endpoint or a function.",
      watsonx: "Orchestrate agents list collaborators and route work among them. This is the platform's core pattern.",
      codex: "Subagents run tasks in separate contexts. The Agents SDK supports handoffs between agents.",
      cursor: "Subagents and background agents run tasks in parallel with their own context.",
      claude: "Subagents have their own context window and tool set, defined in files. The SDK can spawn them from code.",
      other: "The wave executor is plain Python. Sub-agents are functions.",
    },
    checks: [
      {
        q: "Give one good reason and one bad reason to add a second agent.",
        a: "Good: you need an independent check, or a sub-task's context would crowd out the main one. Bad: the architecture diagram looks more capable. Without an eval showing a gain, it is only more cost.",
      },
      {
        q: "Why two votes for claim verification?",
        a: "A single judge's error would remove true claims. Requiring both to fail trades some missed bad claims for far fewer wrongly removed good ones.",
      },
    ],
  },
  {
    id: "self-evolving",
    title: "Self-evolving agents",
    short: "A scheduled loop that studies sources and its own logs, promotes what is corroborated, and is graded on sealed tests.",
    layer: 5,
    depth: "outline",
    what:
      "A self-evolving agent improves between conversations. On the reference build a nightly learner reads documents and logs, writes candidate claims, verifies and corroborates them, and promotes the survivors into what the agent can recall.",
    why:
      "Most improvement comes from noticing the same failure repeatedly and encoding the fix. Automating that is powerful and dangerous. The loop changes no model weights. It changes stored knowledge, routing exemplars, and rules, and all of it reaches an answer only through a tool call.",
    how: [
      "Staged study: define terms, outline a document, extract claims, link them. Each stage has a queue ordered by authority.",
      "Promotion gate: a claim becomes serveable only with enough independent support. Copies of one passage count once.",
      "Verification: a two-vote check compares served claims with their sources. Failures leave service as unsupported.",
      "Self-observation: the loop mines logs for failures that returned success codes, such as an empty result that a relaxed filter would fill.",
      "Corroboration for self-observations is keyed on the day. Failing twice in one session earns nothing. The same failure on three separate days earns trust.",
      "Everything is graded on sealed sets the loop cannot read or write.",
    ],
    prereqs: [
      {
        id: "evaluation",
        why: "A loop optimizes what it can measure. Sealed evals have to exist before the loop runs, or it grades itself.",
        stub: "None that is safe. You can run the loop in report-only mode without evals, and you should not let it apply changes.",
      },
      {
        id: "memory",
        why: "Learned claims and rules are a form of memory. They use the same store, status fields, and recall path.",
        stub: "Append findings to a Markdown file for human review.",
      },
      {
        id: "guardrails",
        why: "Promotion gates and claim verification are guard logic applied to stored knowledge.",
        stub: "Human approval of every promotion.",
      },
      {
        id: "rag-graph",
        why: "The learner reads indexed chunks and writes claims that point back to passages.",
        stub: "Feed it plain text files.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/nightly/scheduler.py", role: "Duty cycle and preemption for background work." },
      { path: "apps/agent-server/nightly/self_observe.py", role: "Finds confident wrong answers in the logs." },
      { path: "apps/agent-server/nightly/conversation_learn.py", role: "Learns from real conversations, ignoring eval threads." },
      { path: "apps/agent-server/nightly/corroboration_audit.py", role: "Checks that support is independent." },
      { path: "SELF-EVOLUTION-LESSONS.md", role: "What went wrong and what was changed." },
    ],
    portability: {
      databricks: "Lakeflow Jobs schedule the loop. Traces and labeled feedback are the raw material. Evaluation datasets grow from production traces, and judges can be aligned with human labels.",
      watsonx: "Schedule jobs outside Orchestrate and write results to a governed store. Monitors in watsonx.governance provide the drift signals.",
      codex: "A scheduled headless run can review logs and propose changes to AGENTS.md or skills as a pull request for review.",
      cursor: "Background agents can do the same review and open a pull request.",
      claude: "A scheduled headless session can read logs and propose skill or instruction edits. Keep a human merge step.",
      other: "A scheduler such as launchd, systemd timers, or cron, plus the same scripts.",
    },
    checks: [
      {
        q: "What does the learner change, and what does it never change?",
        a: "It changes rows in the knowledge store, routing exemplars, and rule files. It never changes model weights. Learned knowledge reaches an answer only when a tool returns it.",
      },
      {
        q: "Why is corroboration counted by independent document and by day?",
        a: "Ten copies of one paragraph are one source. Two failures in one session are one event. Counting them as many would let repetition pass for evidence.",
      },
    ],
  },
  {
    id: "sdk",
    title: "SDKs and frameworks",
    short: "What agent SDKs give you, mapped onto parts you have already built by hand.",
    layer: 5,
    depth: "outline",
    what:
      "An agent SDK packages the harness: the tool loop, state handling, streaming, tracing, and often handoffs and guardrails. Frameworks differ in how much of the loop they own and how much you can replace.",
    why:
      "If you can name the part an SDK feature replaces, you can adopt or leave any framework without rewriting your system. The reference build is hand-written, which makes it a clear map for reading any SDK's documentation.",
    how: [
      "Tool loop: every SDK has one. Compare its round limit, parallel tool handling, and what it does when the limit is hit.",
      "State: graph frameworks make state and merge rules explicit with reducers. That is merge_state under another name.",
      "Tools: most accept Python functions with type hints and MCP servers.",
      "Guardrails and hooks: input and output checks, and callbacks around tool calls.",
      "Tracing: spans per model call and tool call. It replaces JSON-lines logs.",
      "Keep your tools, skills, evals, and guard logic outside the framework so they survive a switch.",
    ],
    prereqs: [
      {
        id: "harness",
        why: "You evaluate an SDK by comparing it with a loop you understand. Without that, every framework's defaults look like requirements.",
        stub: "Follow a framework quickstart first, then return to the harness module to see what it hid.",
      },
      {
        id: "tools-mcp",
        why: "Tools are the part you carry between SDKs. Having them as MCP servers makes the comparison a configuration change.",
        stub: "One inline function tool.",
      },
    ],
    inBuild: [
      { path: "apps/agent-server/", role: "The hand-built reference for every part an SDK provides." },
      { path: "study-notes/03_Agent_Harness_Deep_Dive.md", role: "Notes on the harness design." },
      { path: "study-notes/08_Extending_The_Harness_Agent.md", role: "How to add capabilities without breaking the contract." },
    ],
    portability: {
      databricks: "The agent framework accepts agents written with MLflow's agent interfaces, LangGraph, or the OpenAI Agents SDK, and adds deployment, tracing, and evaluation around them.",
      watsonx: "The Orchestrate ADK defines agents and tools in files and a CLI. It also imports agents built with LangGraph and similar frameworks.",
      codex: "The OpenAI Agents SDK provides the loop, handoffs, guardrails, sessions, and tracing. Codex itself can be run headless and scripted.",
      cursor: "Cursor provides a command-line agent and background agents. For your own service use a general SDK.",
      claude: "The Claude Agent SDK exposes the coding agent's loop, tools, hooks, subagents, and MCP support as a library in Python and TypeScript.",
      other: "Any SDK that speaks the OpenAI-compatible API can target a local engine by base URL.",
    },
    checks: [
      {
        q: "A framework advertises reducers for state channels. What is that in the reference build?",
        a: "merge_state. Keys that extend or sum are reducers. Keys that overwrite are plain channels.",
      },
      {
        q: "What should stay outside any SDK?",
        a: "Tools behind MCP, skill files, eval sets and scripts, and answer checks. Those hold your domain knowledge and should not be rewritten when the loop changes.",
      },
    ],
  },
  {
    id: "ops",
    title: "Operations and deployment",
    short: "Supervision, scheduling, logs, backups, and recovery, so the system runs when nobody is watching.",
    layer: 5,
    depth: "outline",
    what:
      "Operations covers how services start and restart, how background work is scheduled around live traffic, how logs are kept readable, how data is backed up and restored, and how changes are rolled out and rolled back.",
    why:
      "An agent that works in a terminal session and dies on reboot is a demo. Most of the reference build's lost time came from operational causes: a stripped service environment, a noisy probe, single-writer stores, backups on the same volume they protected.",
    how: [
      "Every long-running service is under the OS supervisor with keep-alive and absolute paths. Each service uses its own virtual environment.",
      "A watchdog probes liveness. A status command reports every service, port, and model in one screen.",
      "A scheduler gives background work a duty cycle and preempts it when a user request arrives.",
      "Logs rotate on a schedule. Structured request and tool logs are separate from server logs.",
      "Backups copy what cannot be reproduced: databases, keys, prompts, skills, scripts. Weights and source documents are re-downloadable. One copy goes off the machine, encrypted, and restores are tested.",
      "Before editing a file, a dated copy is saved beside it. Each change is one commit whose message states what was learned.",
    ],
    prereqs: [
      {
        id: "inference",
        why: "The engine is the first service to supervise, and its memory limits decide what can run at the same time.",
        stub: "Start services by hand in terminal tabs.",
      },
      {
        id: "harness",
        why: "The agent server is the main service. Its health endpoint and busy marker are what the supervisor and scheduler read.",
        stub: "Supervise the engine alone.",
      },
      {
        id: "evaluation",
        why: "Scheduled evals and the daily report are how you learn that a deploy made things worse.",
        stub: "A manual smoke test after each change.",
      },
    ],
    inBuild: [
      { path: "Install-Autostart.command", role: "Installs supervised services." },
      { path: "Check-All-LLM-Status.command", role: "One-screen status of every service and model." },
      { path: "apps/agent-server/nightly/scheduler.py", role: "Duty cycle and preemption." },
      { path: "apps/ops/pg_backup.sh", role: "Database backup, with a restore test beside it." },
      { path: "SOP-LLM-OPERATIONS.md", role: "Operating procedures." },
    ],
    portability: {
      databricks: "Serving endpoints, Jobs, and Apps are supervised by the platform. You own versions, permissions, cost alerts, and promotion between workspaces with asset bundles.",
      watsonx: "The platform runs the services. You own environments, deployment spaces, and promotion between them.",
      codex: "Operations here means CI: headless runs, sandbox settings, and secrets handling for the agent.",
      cursor: "Same: team rules in the repo, background agent settings, and secrets.",
      claude: "Headless runs in CI, managed settings, and permission policies. For a service built on the SDK, operate it like any other service.",
      other: "systemd units and timers in place of launchd. The backup and status scripts are shell and Python.",
    },
    checks: [
      {
        q: "Which files do you back up, and which do you not?",
        a: "Back up what cannot be reproduced: databases, keys, prompts, skills, eval sets, scripts. Skip model weights and source documents that can be downloaded again.",
      },
      {
        q: "A service runs fine by hand and fails under the supervisor. What is the usual cause?",
        a: "Environment. The supervisor starts with a minimal PATH and no shell profile, so a binary or virtual environment is not found. Use absolute paths in the service definition.",
      },
    ],
  },
];
