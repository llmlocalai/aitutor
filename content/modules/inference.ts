import type { Module } from "@/lib/types";

export const inference: Module = {
  id: "inference",
  title: "Inference engineering",
  short: "Serve models on fixed hardware and know what each second costs.",
  layer: 0,
  depth: "deep",
  what:
    "Inference engineering is the work of turning model weights into a dependable endpoint. You choose which models run, how they share memory, how long they stay loaded, how many requests run at once, and how much context each request may use.",
  why:
    "Every other layer calls this one. Retrieval calls it to embed. The harness calls it to plan and to answer. The evaluator calls it to judge. If a single call takes 70 seconds because a model was evicted, no prompt change above it will fix that. You set the speed limit of the whole system here.",
  how: [
    "A serving engine loads weights into memory and exposes an HTTP API. On the reference machine the engine is Ollama, with a second runtime (MLX) for one small fast model.",
    "Memory is the binding constraint. The reference machine has 96 GB of unified memory and about 78 GB usable for models. Two mid-size models fit together. The largest model fits only alone.",
    "The engine keeps a model resident for a keep-alive window. A request for a model that is not resident pays a cold load. Loading a third model evicts one of the two that were resident.",
    "Latency after load is mostly output tokens divided by tokens per second. On the reference build, measured p50 latency was 26 seconds at 72 tokens per second, which matches a median answer of about 1,700 tokens almost exactly.",
  ],
  prereqs: [],
  inBuild: [
    { path: "ollama-env.sh", role: "Serving settings: loaded-model cap, keep-alive, parallelism, context length." },
    { path: "apps/agent-server/model_router.py", role: "Picks a model per request by task type. Two mechanisms: tag swap and base-URL swap." },
    { path: "apps/agent-server/model_catalog.json", role: "The lineup: which model serves default, fast, and vision work." },
    { path: "apps/agent-server/bench_latency.py", role: "Measures time to first token and tokens per second from real requests." },
    { path: "apps/mlx/", role: "Second runtime. One process serves exactly one model." },
  ],
  flow: {
    caption: "What happens to one request at the engine",
    stages: [
      { label: "Request arrives", detail: "OpenAI-style JSON with a model name, messages, and max tokens.", kind: "input" },
      { label: "Is the model resident?", detail: "If yes, skip to prompt evaluation. If no, the engine must load it and may evict another.", kind: "check" },
      { label: "Cold load", detail: "Tens of seconds for a 20 to 60 GB model. This is the largest avoidable cost.", kind: "store" },
      { label: "Prompt evaluation", detail: "Cost grows with prompt size. Tool schemas and system prompts count on every turn.", kind: "model" },
      { label: "Generation", detail: "Output tokens at a steady rate. Time is tokens divided by rate.", kind: "model" },
      { label: "Stream out", detail: "Tokens leave as they are produced, so the user sees the first one early.", kind: "output" },
    ],
  },
  steps: [
    {
      title: "Write the memory budget before you choose models",
      why: "The budget decides the lineup. Choosing models first leads to a lineup that cannot be resident together, and you find out in production as reload delays.",
      body: [
        "List usable model memory. On Apple silicon that is unified memory minus what the OS and your services need. On a GPU server it is VRAM per card.",
        "For each candidate model record the weight size at your chosen quantization, then add headroom for context. Longer context and more parallel slots both raise memory use.",
        "Decide which models must be warm at the same time. On the reference machine the workhorse (22 GB) and the vision model (29 GB) stay warm together. The 61 GB reasoner evicts both, so it is reserved for hard problems where a multi-minute swap is acceptable.",
      ],
      code: {
        lang: "text",
        file: "budget.txt",
        text: `usable model memory        ~78 GB
workhorse   35B MoE  q4     22 GB   default, ~72 tok/s
vision      27B      q8     29 GB   image input only
reasoner    120B     q4     61 GB   runs alone
embedder    0.3 GB          loads on demand, can evict a chat model
rule: workhorse + vision fit together (51 GB). Anything + reasoner does not.`,
      },
      verify: "You can state, for any two models, whether they fit together and what a swap costs in seconds.",
    },
    {
      title: "Install the engine and put weights on a dedicated volume",
      why: "Weights are large and reproducible. Keeping them off the boot disk makes the whole stack one portable folder and keeps backups small.",
      body: [
        "Install the engine with your package manager. Point its model directory at the data volume before the first pull.",
        "Run the engine under the OS supervisor so it restarts after a crash or reboot. That is covered in the operations module, and you can start it by hand until then.",
      ],
      code: {
        lang: "bash",
        text: `brew install ollama
export OLLAMA_MODELS="$AI_DATA/models/ollama"
ollama serve &
ollama pull <workhorse-model>
ollama pull nomic-embed-text
ollama list`,
      },
      verify: "`ollama list` shows the models and the files sit under your data volume.",
    },
    {
      title: "Set the serving parameters on purpose",
      why: "Defaults assume one user and one model. An agent makes many calls per question, so the defaults produce evictions and queueing that look like a slow model.",
      body: [
        "Cap loaded models at what your budget allows. Set keep-alive long enough that normal gaps between requests do not unload the model.",
        "Set parallel slots to the concurrency you expect. Each slot reserves context memory.",
        "Set context length explicitly. Then confirm it took effect by reading the engine log, because a setting that is present is not proof that it is in effect.",
      ],
      code: {
        lang: "bash",
        file: "ollama-env.sh",
        text: `export OLLAMA_MAX_LOADED_MODELS=2   # at most 2 models resident
export OLLAMA_KEEP_ALIVE=30m        # unload after 30 idle minutes
export OLLAMA_NUM_PARALLEL=4        # concurrent requests per model
export OLLAMA_CONTEXT_LENGTH=49152  # tokens of context per slot
export OLLAMA_FLASH_ATTENTION=1     # less memory for long contexts`,
      },
      verify: "Send a request, then read the engine log. The reported prompt size is the ground truth for how much context you really sent.",
    },
    {
      title: "Call the endpoint the way every later layer will",
      why: "The OpenAI-compatible chat endpoint is the contract. If you standardize on it now, you can swap engines, machines, or cloud providers later by changing a base URL.",
      body: [
        "Test with plain curl before you add any library. You want to know the engine works independent of your code.",
        "Record tokens per second and time to first token for each model. These two numbers explain most latency complaints later.",
      ],
      code: {
        lang: "bash",
        text: `curl -s http://localhost:11434/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "<workhorse-model>",
    "messages": [{"role": "user", "content": "Reply with the word ready."}],
    "max_tokens": 16
  }' | python3 -m json.tool`,
      },
      verify: "You get a JSON completion with a usage block. Divide completion tokens by elapsed seconds to get your rate.",
    },
    {
      title: "Add a second runtime only where it earns its place",
      why: "A small fast model is useful for cheap jobs such as triage, question writing, and judging. It should not compete with the workhorse for the two resident slots.",
      body: [
        "The reference build serves a 9B model through MLX on its own port. That runtime serves exactly one model per process, chosen at startup.",
        "This creates two routing mechanisms. Models in the main engine are selected by the model field (tag swap). The MLX model is selected by calling a different base URL.",
      ],
      code: {
        lang: "bash",
        text: `# one process, one model, its own port
mlx_lm.server --model mlx-community/<small-model>-4bit --port 8082`,
      },
      verify: "The same curl works against the second port with no model field needed.",
    },
    {
      title: "Route by task type, and fail safe",
      why: "Routing comes after the endpoints exist and are measured. A router that guesses about models you have not benchmarked sends work to the wrong place with confidence.",
      body: [
        "Classify the request: default, fast, or vision. Map each class to a catalog entry.",
        "If anything is missing or unknown, return nothing and let the existing behavior run. The router should never be the reason a request fails.",
      ],
      code: {
        lang: "python",
        file: "model_router.py (shape)",
        text: `def resolve_for_request(payload: dict) -> dict | None:
    if payload.get("model"):            # caller was explicit: do nothing
        return None
    task = detect_task(payload)         # "default" | "fast" | "vision"
    entry = CATALOG.get(task)
    if not entry:
        return None                     # unknown task: do nothing
    if entry.get("base_url"):           # separate runtime: swap the URL
        return {"base_url": entry["base_url"]}
    if entry.get("tag"):                # same engine: swap the tag
        return {"model": entry["tag"]}
    return None                         # incomplete entry: do nothing`,
      },
      verify: "Delete the catalog file and send a request. It should still succeed on the default model.",
    },
    {
      title: "Cut latency where it is actually spent",
      why: "Do this after you have logs from real requests. Tuning before measuring usually targets model speed, which is rarely the problem.",
      body: [
        "Output volume dominates. Set a default max-tokens value and ask for shorter answers in the system prompt.",
        "Stream responses so the first token arrives early. Reuse one pooled HTTP client across requests.",
        "Keep prompts small. Tool schemas, system prompts, and memory are charged on every turn.",
        "Avoid evictions. A retrieval call that loads the embedder can push out the chat model. Prefer the cheap path that loads no model when a definition will do.",
      ],
      verify: "Median latency in your own request log moves, and the log shows fewer cold loads.",
    },
    {
      title: "Keep the engine private",
      why: "The engine has no authentication. Anything that needs outside access goes through the gateway module, which adds keys, scopes, and limits.",
      body: [
        "Bind the engine to localhost or a private network. Expose only a proxy that authenticates callers.",
      ],
      verify: "From a device outside your private network, the engine port does not answer.",
    },
  ],
  together: [
    { with: "api-gateway", how: "The gateway is the only thing allowed to forward outside traffic to the engine." },
    { with: "rag-graph", how: "Retrieval uses the embedding model. Loading it can evict a chat model, so retrieval design affects inference cost." },
    { with: "harness", how: "Each tool round is another model call. Round budgets and prompt size are inference decisions made in the harness." },
    { with: "evaluation", how: "Judges and question writers are model calls too. A small second runtime lets evals run without evicting the serving model." },
  ],
  failures: [
    {
      when: "2026-08",
      title: "A context setting that was present but not in effect",
      what: "A context cap was configured for a coding client. Requests still sent far larger prompts and timed out after 15 minutes.",
      fix: "Read the engine log for the real prompt size on each request before touching anything else.",
      lesson: "A configured value is a claim. The log line is the evidence.",
    },
    {
      when: "2026-09",
      title: "The embedder evicted the chat model",
      what: "With a cap of two resident models, a knowledge search loaded the embedding model and pushed the chat model out. The next answer paid a 35 to 70 second reload.",
      fix: "Route definition questions to a full-text lookup that loads no model. Use vector search when a passage and citation are needed.",
      lesson: "Count every model your request path can load, including the small ones.",
    },
    {
      when: "2026-07",
      title: "Latency blamed on model speed",
      what: "Median latency was 26 seconds and p90 was 89 seconds. The generation rate was a healthy 72 tokens per second.",
      fix: "Cap default output tokens, stream, and extend keep-alive.",
      lesson: "Latency is tokens divided by rate. Check the numerator first.",
    },
  ],
  portability: {
    databricks:
      "Model Serving replaces the engine. Foundation Model APIs give pay-per-token endpoints, and provisioned throughput reserves capacity. Your memory budget becomes a throughput and cost budget. The endpoint is OpenAI-compatible, so the contract from step 4 carries over.",
    watsonx:
      "watsonx.ai hosts foundation models behind an inference API, with on-demand deployments for dedicated capacity. Model choice is a catalog decision. You still measure tokens per second and time to first token per model.",
    codex:
      "Codex is a client of an inference endpoint. It uses hosted models by default and can be pointed at another provider in its config, including a local OpenAI-compatible server. The serving work stays on whatever machine hosts the model.",
    cursor:
      "Cursor consumes inference. It can override the OpenAI base URL to reach your own endpoint for some features. Serving decisions are made wherever that endpoint runs.",
    claude:
      "Claude Code and the Agent SDK call a hosted model, or a compatible gateway you configure. On the reference build a translation gateway lets the coding client talk to local models. Context budgets still apply and are charged on every turn.",
    other:
      "On an NVIDIA machine use vLLM or llama.cpp in place of the Mac runtimes. The budget is VRAM per card. Use systemd in place of launchd. Everything from step 3 onward is identical.",
  },
  checks: [
    {
      q: "Why does the memory budget come before model selection?",
      a: "Because residency is what makes responses fast, and residency is limited by memory. A lineup chosen without the budget can require a model swap on a common path, and each swap costs tens of seconds to minutes.",
    },
    {
      q: "A request is slow. What do you look at first, and why?",
      a: "The engine log for that request: whether a model was loaded, the real prompt size, and the output token count. Those three explain almost all latency, and each has a different fix.",
    },
    {
      q: "Why are there two routing mechanisms on the reference build?",
      a: "The main engine serves many models on one port and selects by the model field. The second runtime serves one model per process and has no model selection, so reaching it means calling a different base URL.",
    },
    {
      q: "You could build retrieval before this module. What would you stub?",
      a: "The embedding call. Any function that returns a fixed-length vector for a string lets you build and test ingestion and search plumbing. You replace it with the real embedder later.",
    },
  ],
  terms: [
    { term: "Resident", def: "Loaded in memory and ready to generate without a load delay." },
    { term: "Keep-alive", def: "How long an idle model stays resident before the engine unloads it." },
    { term: "TTFT", def: "Time to first token. What the user feels as responsiveness." },
    { term: "Quantization", def: "Storing weights at lower precision to cut memory, with some quality cost." },
  ],
};
