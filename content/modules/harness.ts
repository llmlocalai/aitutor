import type { Module } from "@/lib/types";

export const harness: Module = {
  id: "harness",
  title: "Harness engineering",
  short: "The loop around the model: prompt assembly, tool execution, budgets, checks, logs.",
  layer: 3,
  depth: "deep",
  what:
    "The harness is the program that runs the model. It assembles the prompt, offers tools, executes the tool calls the model asks for, feeds results back, decides when to stop, checks the answer, and records what happened.",
  why:
    "A model call is stateless and cannot act. Everything that makes an agent behave reliably lives in the harness: which tools exist, how many rounds are allowed, what gets truncated, what is checked before the user sees it. Two systems with the same model and different harnesses behave like different products.",
  how: [
    "The harness exposes the same chat-completions contract it consumes. Callers cannot tell whether they are talking to a bare model or to the agent.",
    "A planner node calls the model. If the model answers, the run ends. If it requests tool calls, each call becomes a node and all of them run concurrently.",
    "Tool nodes append their results to the conversation and route back to the planner. Several tool nodes naming the same successor collapse into one planner run.",
    "A wave budget bounds the cycle. When the budget runs out, one final turn without tools answers from the evidence already gathered.",
    "Before the answer leaves, a deterministic guard compares it with the evidence from this request. A failed draft gets one corrective retry.",
  ],
  prereqs: [
    {
      id: "api-gateway",
      why: "The harness sits behind the gateway contract. Keys carry scopes, and the harness reads the scope to decide whether a caller gets tools at all.",
      stub: "A hard-coded flag: tools allowed, one anonymous caller.",
    },
    {
      id: "inference",
      why: "The planner is a model call. Round budgets, output caps, and prompt size limits are set from measured inference numbers.",
      stub: "A fake model function that returns a scripted tool call on the first turn and text on the second.",
    },
    {
      id: "state",
      why: "The loop is a state machine. Concurrent tool results have to merge into one conversation without overwriting each other, so the merge rules are defined before the loop that relies on them.",
      stub: "A plain dict and sequential tool execution.",
    },
    {
      id: "tools-mcp",
      why: "A loop with no tools is a chat proxy. You need at least one registered tool with a schema to exercise the tool path.",
      stub: "One local function such as a clock or calculator.",
    },
  ],
  inBuild: [
    { path: "apps/agent-server/main.py", role: "HTTP surface: chat completions, models, feedback, health." },
    { path: "apps/agent-server/graph.py", role: "A 110-line wave executor: fan-out, fan-in, merge rules, wave budget, trace." },
    { path: "apps/agent-server/agent_loop.py", role: "The planner and tool graph, prompt composition, streaming, logging." },
    { path: "apps/agent-server/AGENT.md", role: "The base system prompt." },
    { path: "apps/agent-server/tools/registry.py", role: "One registry for hand-written and MCP tools." },
    { path: "apps/agent-server/hooks/", role: "Pre-tool and post-tool hooks." },
    { path: "apps/agent-server/answer_guard.py", role: "Checks figures, counts, and names in the answer against tool results." },
  ],
  flow: {
    caption: "One request through the harness",
    stages: [
      { label: "Authenticate", detail: "Key, scope, rate limit, quota. Scope decides whether tools are offered.", kind: "check" },
      { label: "Triage", detail: "Cheap gates first: regex, then embedding similarity. Some questions skip tools.", kind: "check" },
      { label: "Compose prompt", detail: "Base instructions, at most one matched skill, the caller's memory section.", kind: "input" },
      { label: "Planner", detail: "Model call with tool schemas. Returns an answer or a set of tool calls.", kind: "model" },
      { label: "Tool wave", detail: "All requested calls run at once. Hooks run before and after each. Results are capped.", kind: "tool" },
      { label: "Guard", detail: "The draft is checked against this request's evidence. One corrective retry on failure.", kind: "check" },
      { label: "Respond", detail: "Streamed or complete, in the same format the caller sent.", kind: "output" },
      { label: "Record", detail: "Logs and memory writes happen after the response and never block it.", kind: "store" },
    ],
    loop: { from: 4, to: 3, label: "back to planner, up to 6 rounds" },
  },
  steps: [
    {
      title: "Fix the public contract first",
      why: "The contract is what callers depend on. If it stays constant, you can rebuild everything behind it without breaking a client.",
      body: [
        "Accept and return the OpenAI chat-completions format. Existing SDKs, editors, and UIs then work unchanged.",
        "Keep one internal entry point. The reference build kept the same function signature when the loop was rewritten as a graph, so the HTTP layer needed no change.",
      ],
      code: {
        lang: "python",
        text: `# The whole public surface of the loop.
async def run(payload: dict, engine_url: str, allow_tools: bool, key_id: str):
    """-> (openai_response_dict, prompt_tokens, completion_tokens, model_calls)"""`,
      },
      verify: "An unmodified OpenAI client pointed at your server gets a valid completion.",
    },
    {
      title: "Build the flat loop and bound it",
      why: "The flat loop is the smallest thing that is an agent. Get it correct and bounded before adding concurrency, because every later feature is a refinement of it.",
      body: [
        "Call the model with tool schemas. If it returns tool calls, run them, append the results as tool messages, and call again.",
        "Stop when the model answers in plain text or when a round limit is reached. Six rounds is the reference default.",
      ],
      code: {
        lang: "python",
        text: `async def flat_loop(messages, tools, max_rounds=6):
    for _ in range(max_rounds):
        reply = await chat(messages, tools=tools)
        msg = reply["choices"][0]["message"]
        messages.append(msg)
        calls = msg.get("tool_calls") or []
        if not calls:
            return msg["content"]
        for call in calls:
            result = await call_tool(call["function"]["name"],
                                     json.loads(call["function"]["arguments"]))
            messages.append({"role": "tool",
                             "tool_call_id": call["id"],
                             "content": json.dumps(result)[:8000]})
    return None  # budget exhausted, handled in a later step`,
      },
      verify: "A question that needs one tool call produces two model calls and one tool message.",
    },
    {
      title: "Generalize to a wave graph",
      why: "This follows the flat loop because it is the same behavior with two additions: tool calls in one turn run concurrently, and their results merge safely. You need the sequential version as the reference for correctness.",
      body: [
        "A node is an async function from state to a pair: state updates and the next nodes. A wave is every node scheduled at the same time.",
        "Run a wave with gather. Merge every update. Then build the next wave as a dict keyed by node name. Two tool nodes that both name the planner produce one planner entry, which is fan-in by construction.",
        "Accumulator keys extend or sum. All other keys overwrite. That rule is what lets concurrent nodes contribute without clobbering each other.",
      ],
      code: {
        lang: "python",
        file: "graph.py (core)",
        text: `_EXTEND_KEYS = {"messages_append", "trace_notes"}
_SUM_KEYS = {"usage_prompt_tokens", "usage_completion_tokens", "model_calls"}

def merge_state(state: dict, update: dict) -> None:
    for key, value in update.items():
        if key in _EXTEND_KEYS:
            target = key.removesuffix("_append")
            state.setdefault(target, []).extend(value)
        elif key in _SUM_KEYS:
            state[key] = state.get(key, 0) + value
        else:
            state[key] = value

async def run_graph(entry_name, entry_fn, initial_state, max_waves=6):
    state = dict(initial_state)
    wave = {entry_name: entry_fn}
    trace = []
    for wave_idx in range(1, max_waves + 1):
        if not wave:
            break
        trace.append({"wave": wave_idx, "nodes": list(wave)})
        results = await asyncio.gather(*[fn(state) for fn in wave.values()])
        for update, _ in results:           # merge everything first
            if update:
                merge_state(state, update)
        next_wave = {}
        for _, edges in results:            # then route
            next_wave.update(edges)         # same key twice = fan-in
        wave = next_wave
    else:
        state["_budget_exhausted"] = True
    state["_trace"] = trace
    return state`,
      },
      verify: "Three tool calls requested in one turn show as one wave with three nodes in the trace, followed by one planner node.",
    },
    {
      title: "Put every tool behind one registry and cap results",
      why: "The planner should not know where a tool lives. A single registry also gives you one place to enforce size limits, which protects the context budget from the inference module.",
      body: [
        "Register hand-written functions and MCP tools in the same table: name, schema, callable.",
        "Cap each result (8,000 characters on the reference build) and cap the total per request (40,000). Tell the model when a result was truncated.",
        "Log every call with arguments, duration, and result size.",
      ],
      verify: "A tool that returns a megabyte of text reaches the model as a bounded string with a truncation note.",
    },
    {
      title: "Compose the system prompt from parts",
      why: "Composition comes after tools because the prompt has to describe when to use them. It comes before guards because guards reference which skill was loaded.",
      body: [
        "Start with a short base prompt. Add at most one matched skill. Add a memory section for the caller.",
        "Keep the base short. It is charged on every turn. On the reference build a rule is added only after it has been broken once.",
      ],
      code: {
        lang: "python",
        text: `def compose_system_prompt(messages, partition_key):
    parts = [read_agent_md()]
    skill = match_skill(last_user_text(messages))   # zero or one
    if skill:
        parts.append(skill.body)
    memory = compose_memory_section(partition_key)
    if memory:
        parts.append(memory)
    return "\\n\\n".join(parts)`,
      },
      verify: "The skill-match log shows most requests matching no skill. That is the expected case.",
    },
    {
      title: "Put cheap deterministic gates in front of expensive ones",
      why: "Triage runs before the planner, so it has to exist before you tune the planner. It also removes whole classes of slow requests.",
      body: [
        "Some questions are about the agent itself and need no tools. Detect them with a regex first, then with embedding similarity to a few canonical examples, and only then let the model decide.",
        "Log each triage decision with the reason, so a wrong route can be traced.",
      ],
      verify: "Asking the agent what it can do returns quickly with zero tool calls in the log.",
    },
    {
      title: "Handle budget exhaustion as a designed outcome",
      why: "It depends on the wave budget from step 3. Without it, hitting the limit returns an error after the user has waited the longest.",
      body: [
        "When rounds run out, make one final model call with tools removed and an instruction to answer from the evidence gathered so far.",
        "Count how often this happens. A question shape that regularly exhausts the budget needs a purpose-built batch tool.",
      ],
      verify: "With the budget set to 1, a multi-step question still returns a grounded partial answer.",
    },
    {
      title: "Add hooks around tool execution",
      why: "Hooks need the registry and the loop to exist. They are where policy is enforced in code, which is stronger than asking the model to behave.",
      body: [
        "A pre-tool hook can block a call. The reference build restricts file writes to one folder.",
        "A post-tool hook can trigger follow-up work, such as re-indexing after a write.",
      ],
      code: {
        lang: "python",
        text: `def write_path_guard(name: str, args: dict) -> str | None:
    """Return a reason to block, or None to allow."""
    if name in WRITE_TOOLS:
        p = Path(args.get("path", "")).resolve()
        if not p.is_relative_to(ALLOWED_ROOT):
            return f"writes are limited to {ALLOWED_ROOT.name}/"
    return None`,
      },
      verify: "A write outside the allowed folder is refused and the refusal appears in the tool log.",
    },
    {
      title: "Check the answer against the evidence",
      why: "The guard is last in the run because it needs the complete evidence set and the draft. It is built after logging exists, since each rule was written from a logged failure.",
      body: [
        "Extract precise figures, counts, and named entities from the draft. Look for each in the tool results of this request.",
        "A figure is grounded if it equals an evidence number at some unit scale, or is the sum or difference of two grounded figures.",
        "If the draft fails, send one corrective message naming what was unsupported and let the model retry. If the retry fails, return a plain statement of what was found, without the unsupported figures.",
        "For streaming, hold tokens until the check passes.",
      ],
      verify: "Force a wrong figure into a draft in a test. The guard rejects it and names the figure.",
    },
    {
      title: "Stream, and record after responding",
      why: "Streaming changes how the loop yields output, so add it once the loop and guard are stable. Recording goes after the response so memory and logging never add latency.",
      body: [
        "Emit server-sent events in the standard chunk format. Accumulate tool-call deltas until a call is complete, then execute it.",
        "Write the exchange to memory as a fire-and-forget task with its own error handling.",
        "Hold a busy marker for the whole stream so background jobs pause until the answer finishes.",
      ],
      verify: "First token arrives within a few seconds on a warm model, and a memory-store failure does not change the response.",
    },
  ],
  together: [
    { with: "skills", how: "The harness matches one skill per request and injects its body. Skills change behavior without changing harness code." },
    { with: "memory", how: "Memory is read during prompt composition and written after the response." },
    { with: "guardrails", how: "Hooks act on tool calls. The answer guard acts on the final draft. Both are called by the loop." },
    { with: "evaluation", how: "Every request, tool call, skill match, and triage decision is logged as JSON lines. Evals and self-observation read those logs." },
    { with: "multi-agent", how: "The same wave executor runs sub-agents as nodes. A sub-agent is a planner with its own tools and budget." },
  ],
  failures: [
    {
      when: "2026-10",
      title: "Right query, right rows, wrong answer",
      what: "The agent ran correct queries, received correct rows, then answered with a table about an unrelated subject and invented totals. Nothing compared the answer with the tool results.",
      fix: "A deterministic guard that requires precise figures in the answer to appear in the evidence.",
      lesson: "Correct retrieval does not guarantee a grounded answer. Check the last step.",
    },
    {
      when: "2026-10",
      title: "An answer with no tool call passed unchecked",
      what: "A follow-up question was answered with three invented totals and no query. The guard only ran when tools had been called.",
      fix: "On data turns, check tool-free answers against the conversation so far.",
      lesson: "Decide what the default is when a check has nothing to compare against.",
    },
    {
      when: "2026-10",
      title: "A guard that blocked a requested example",
      what: "A user asked for a made-up numeric example. The guard rejected the invented amounts and the user got an apology.",
      fix: "Detect explicit requests for examples and skip the figure check on that turn.",
      lesson: "Every guard needs a list of legitimate cases it must let through, with tests.",
    },
    {
      when: "2026-09",
      title: "Sixteen thousand log lines from one probe",
      what: "The health endpoint required a key. The watchdog sent none, so 58 percent of the server log was 401 responses, and the supervisor could not tell healthy from sick.",
      fix: "An unauthenticated liveness response with no configuration detail. Details still require a key.",
      lesson: "Separate liveness from detail, and keep noise out of logs that other jobs read.",
    },
  ],
  portability: {
    databricks:
      "Write the loop as an MLflow ResponsesAgent or with a framework such as LangGraph, log it to Unity Catalog, and deploy it to Model Serving. Tracing replaces your JSON-lines logs. Agent Bricks offers managed agents when you do not need a custom loop.",
    watsonx:
      "watsonx Orchestrate is the harness. You declare agents, tools, and collaborators with the Agent Development Kit, and the platform runs the loop. Custom loop logic goes into tools or a LangGraph agent you import.",
    codex:
      "Codex is a finished harness for coding work. You shape it with AGENTS.md, skills, MCP servers, and approval and sandbox settings. To build your own loop, use the OpenAI Agents SDK, which supplies the planner loop, handoffs, guardrails, and sessions.",
    cursor:
      "Cursor is a finished harness inside an editor. Rules, AGENTS.md, MCP, hooks, and subagents are your control points. You cannot change its loop, so policy belongs in hooks and tools.",
    claude:
      "Claude Code is a harness with the same parts: a project instruction file, skills, hooks, MCP tools, subagents. The Agent SDK exposes that loop as a library so you can run it in your own service.",
    other:
      "The reference loop is plain Python with an HTTP client. Copy the two files and change the engine URL. Nothing in it is specific to the machine.",
  },
  checks: [
    {
      q: "Why build the flat loop before the wave graph?",
      a: "The graph is the flat loop plus concurrency and safe merging. The flat loop is the correctness reference and is easy to test. If you start with the graph you debug orchestration and agent behavior at the same time.",
    },
    {
      q: "How does the executor avoid running the planner three times after three tool calls?",
      a: "The next wave is a dict keyed by node name. Each tool node names the planner as its successor, and writing the same key three times leaves one entry.",
    },
    {
      q: "Why does the harness depend on the state module?",
      a: "Concurrent tool nodes each produce updates. The merge rules decide which keys accumulate and which overwrite. Those rules have to be fixed before nodes run in parallel, or results are silently lost.",
    },
    {
      q: "Where would you enforce a rule that the agent may never write outside one folder, and why there?",
      a: "In a pre-tool hook. It runs in code on every call regardless of what the model was told, and it produces a logged refusal.",
    },
    {
      q: "You are moving this agent to a managed platform that owns the loop. What do you still own?",
      a: "Tool definitions and their result limits, the instructions and skills, the checks on the final answer, the evaluation sets, and the logs or traces you review. The loop itself is the most replaceable part.",
    },
  ],
  terms: [
    { term: "Wave", def: "The set of nodes that run concurrently in one step of the executor." },
    { term: "Fan-in", def: "Several nodes converging on one successor, which then runs once." },
    { term: "Triage", def: "A cheap decision made before the planner about how to handle a request." },
    { term: "Hook", def: "Code that runs before or after a tool call and can block or extend it." },
  ],
};
