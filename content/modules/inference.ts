import { t, type Module } from "@/lib/types";

export const inference: Module = {
  id: "inference",
  n: 1,
  layer: 0,
  title: t("Inference engineering", "推理工程"),
  short: t(
    "Serve models on fixed hardware and know what each second costs.",
    "在固定硬件上部署模型，并弄清每一秒花在哪里。",
  ),
  what: t(
    "Inference engineering turns model weights into a dependable endpoint. You decide which models run, how they share memory, how long they stay loaded, how many requests run at once, and how much context each request may use.",
    "推理工程把模型权重变成一个可靠的服务端点。你要决定运行哪些模型、它们如何共享内存、空闲多久后卸载、同时处理多少请求，以及每个请求可以使用多少上下文。",
  ),
  why: t(
    "Every other layer calls this one. Retrieval calls it to embed. The harness calls it to plan and to answer. The evaluator calls it to judge. If one call takes 70 seconds because a model was evicted, no prompt change above it will fix that.",
    "其他每一层都要调用这一层。检索用它做向量化，Harness 用它做规划和回答，评估用它做裁判。如果因为模型被换出内存，一次调用要 70 秒，上层怎么改提示词都没用。",
  ),
  how: [
    t(
      "A serving engine loads weights into memory and exposes an HTTP API. The reference build uses Ollama, plus a second runtime (MLX) for one small fast model.",
      "推理引擎把权重加载进内存，并提供 HTTP API。参考系统使用 Ollama，另有一个运行时（MLX）专门服务一个小而快的模型。",
    ),
    t(
      "Memory is the binding constraint. The reference machine has about 78 GB usable for models. Two mid-size models fit together. The largest fits only alone.",
      "内存是硬约束。参考机器可用于模型的内存约 78 GB。两个中等模型可以同时驻留，最大的模型只能单独运行。",
    ),
    t(
      "A model stays resident for a keep-alive window. A request for a model that is not resident pays a cold load, and loading it may evict another.",
      "模型在 keep-alive 时间窗内保持驻留。请求一个未驻留的模型要付出冷加载的代价，而且加载它可能会把另一个模型挤出内存。",
    ),
    t(
      "After load, latency is close to output tokens divided by tokens per second. On the reference build the median was 26 seconds at 72 tokens per second, which matches a median answer of about 1,700 tokens.",
      "加载完成后，延迟约等于输出 token 数除以每秒 token 数。参考系统的中位延迟是 26 秒，速率 72 token/秒，正好对应约 1,700 token 的中位回答长度。",
    ),
  ],
  prereqs: [],
  inBuild: [
    { path: "ollama-env.sh", role: t("Serving settings: loaded-model cap, keep-alive, parallelism, context length.", "服务参数：驻留模型上限、keep-alive、并发数、上下文长度。") },
    { path: "apps/agent-server/model_router.py", role: t("Picks a model per request. Two mechanisms: tag swap and base-URL swap.", "为每个请求选模型。两种机制：换 tag 和换 base URL。") },
    { path: "apps/agent-server/model_catalog.json", role: t("The lineup: which model serves default, fast, and vision work.", "模型阵容：哪个模型负责默认、快速、视觉任务。") },
    { path: "apps/agent-server/bench_latency.py", role: t("Measures time to first token and tokens per second from real requests.", "从真实请求测量首 token 时间和每秒 token 数。") },
  ],
  flow: {
    caption: t("What happens to one request at the engine", "一个请求在引擎里经历了什么"),
    stages: [
      { label: t("Request arrives", "请求到达"), detail: t("OpenAI-style JSON with a model name, messages, and max tokens.", "OpenAI 格式的 JSON，包含模型名、消息和最大 token 数。"), kind: "input" },
      { label: t("Is the model resident?", "模型在内存里吗？"), detail: t("If yes, go to prompt evaluation. If no, the engine must load it and may evict another.", "在，就直接处理提示词。不在，引擎必须先加载，可能要换出别的模型。"), kind: "check" },
      { label: t("Cold load", "冷加载"), detail: t("Tens of seconds for a 20 to 60 GB model. The largest avoidable cost.", "20 到 60 GB 的模型需要几十秒。这是最大的可避免开销。"), kind: "store" },
      { label: t("Prompt evaluation", "处理提示词"), detail: t("Cost grows with prompt size. Tool schemas and system prompts count on every turn.", "开销随提示词长度增长。工具 schema 和系统提示词每一轮都要计入。"), kind: "model" },
      { label: t("Generation", "生成"), detail: t("Output tokens at a steady rate. Time is tokens divided by rate.", "以稳定速率输出 token。时间等于 token 数除以速率。"), kind: "model" },
      { label: t("Stream out", "流式输出"), detail: t("Tokens leave as they are produced, so the first one arrives early.", "token 一边生成一边发出，所以第一个 token 很早就到。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "budget",
      title: t("Write the memory budget before you choose models", "先写内存预算，再选模型"),
      why: t(
        "The budget decides the lineup. A lineup chosen first often cannot be resident together, and you find out in production as reload delays.",
        "预算决定阵容。先选模型的话，常常发现它们无法同时驻留，而且是在生产环境里通过加载延迟才发现。",
      ),
      do: [
        t("Find usable model memory: unified memory minus the OS and your services on Apple silicon, or VRAM per card on a GPU server.", "算出可用于模型的内存：Apple 芯片是统一内存减去系统和服务占用；GPU 服务器是每张卡的显存。"),
        t("For each candidate, write its resident size: weights at your quantization plus headroom for context.", "为每个候选模型写下驻留大小：所选量化精度下的权重，加上上下文的余量。"),
        t("Run the lab with your own numbers. Read which pairs fit and what each cold load costs.", "把你自己的数字填进 lab 运行。看哪些组合能同时驻留，以及每个模型冷加载要多久。"),
        t("Decide which models must be warm together. That pair is your default path.", "决定哪些模型必须同时保持热状态。这一对就是你的默认路径。"),
      ],
      lab: { file: "labs/m01_inference/budget.py", region: "budget" },
      run: "python3 -m labs.m01_inference.budget",
      output: "m01.budget",
      verify: t("For any two models you can say whether they fit together and what a swap costs in seconds.", "对任意两个模型，你都能说出它们能否共存，以及切换一次要多少秒。"),
      produces: t("A budget table: sizes, pairs that fit, cold-load cost.", "一张预算表：大小、可共存的组合、冷加载耗时。"),
    },
    {
      id: "engine",
      title: t("Install the engine and put weights on a dedicated volume", "安装引擎，把权重放到专用卷上"),
      why: t(
        "It follows the budget because you now know which models to pull. Weights are large and reproducible, so they live apart from the boot disk and from backups.",
        "它排在预算之后，因为现在才知道该下载哪些模型。权重很大且可以重新下载，所以要和系统盘、备份分开存放。",
      ),
      do: [
        t("Install the engine with your package manager.", "用包管理器安装引擎。"),
        t("Set the model directory to the data volume before the first pull.", "第一次拉取模型之前，把模型目录指向数据卷。"),
        t("Pull the workhorse model and the embedding model from your budget.", "按预算拉取主力模型和 embedding 模型。"),
      ],
      code: {
        lang: "bash",
        text: `brew install ollama                      # Linux: curl -fsSL https://ollama.com/install.sh | sh
export AI_DATA=/Volumes/DATA             # your data volume
export OLLAMA_MODELS="$AI_DATA/models/ollama"
ollama serve &
ollama pull <workhorse-model>
ollama pull nomic-embed-text
ollama list`,
      },
      verify: t("`ollama list` shows both models and the files sit under your data volume.", "`ollama list` 列出两个模型，文件位于数据卷下。"),
      needs: [{ step: "inference.budget", what: t("which models to pull", "要拉取哪些模型") }],
      produces: t("A running engine with models on the data volume.", "一个运行中的引擎，模型存放在数据卷上。"),
      notExecuted: true,
    },
    {
      id: "params",
      title: t("Set the serving parameters on purpose", "有意识地设定服务参数"),
      why: t(
        "Defaults assume one user and one model. An agent makes many calls per question, so defaults cause evictions and queueing that look like a slow model.",
        "默认值假设只有一个用户、一个模型。智能体每回答一个问题要调用很多次，默认值会导致模型被换出和排队，看起来像模型慢。",
      ),
      do: [
        t("Cap loaded models at what the budget allows.", "把驻留模型上限设为预算允许的数量。"),
        t("Set keep-alive longer than the normal gap between requests.", "把 keep-alive 设得比请求之间的正常间隔更长。"),
        t("Set parallel slots to the concurrency you expect. Each slot reserves context memory.", "按预期并发设定并行槽位。每个槽位都会预留上下文内存。"),
        t("Set context length explicitly, send one request, and read the engine log to confirm the real prompt size.", "明确设定上下文长度，发一个请求，然后读引擎日志确认真实的提示词大小。"),
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
      verify: t("The engine log line for your request reports the prompt size you expect.", "引擎日志里该请求的提示词大小与你的预期一致。"),
      needs: [
        { step: "inference.budget", what: t("how many models may be resident", "允许同时驻留几个模型") },
        { step: "inference.engine", what: t("the engine to configure", "要配置的引擎") },
      ],
      produces: t("An environment file that every start script sources.", "一个环境变量文件，所有启动脚本都引用它。"),
      notExecuted: true,
    },
    {
      id: "contract",
      title: t("Call the endpoint the way every later layer will", "用后续各层都会用的方式调用端点"),
      why: t(
        "The OpenAI-compatible chat endpoint is the contract for the whole stack. Fix it now and you can swap engines, machines, or providers later by changing a URL.",
        "OpenAI 兼容的 chat 接口是整个系统的契约。现在把它定下来，以后换引擎、换机器、换供应商都只需要改一个 URL。",
      ),
      do: [
        t("Call the endpoint with curl before adding any library.", "在引入任何库之前，先用 curl 调用端点。"),
        t("Confirm the response has `choices` and a `usage` block.", "确认响应里有 `choices` 和 `usage` 字段。"),
        t("Export `LAB_BASE_URL` and `LAB_MODEL`. Every lab from here on uses your real model when these are set.", "导出 `LAB_BASE_URL` 和 `LAB_MODEL`。设置之后，后面所有 lab 都会使用你的真实模型。"),
      ],
      code: {
        lang: "bash",
        text: `curl -s http://127.0.0.1:11434/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "<workhorse-model>",
       "messages": [{"role": "user", "content": "Reply with the word ready."}],
       "max_tokens": 16}' | python3 -m json.tool

export LAB_BASE_URL=http://127.0.0.1:11434/v1
export LAB_MODEL=<workhorse-model>`,
      },
      verify: t("You get a JSON completion. Unset the two variables and the labs fall back to the fake model.", "你得到一个 JSON 回复。取消这两个变量后，lab 会退回到假模型。"),
      needs: [{ step: "inference.engine", what: t("a running engine", "运行中的引擎") }],
      produces: t("A verified base URL and model name. This is what every later module calls.", "一个验证过的 base URL 和模型名。后面每个模块都调用它。"),
      notExecuted: true,
    },
    {
      id: "client",
      title: t("Write one client function and use it everywhere", "写一个客户端函数，全系统共用"),
      why: t(
        "It comes right after the contract because it is the contract in code. One function means one place to change the URL, the timeout, or the provider.",
        "它紧跟在契约之后，因为它就是契约的代码形式。只有一个函数，改 URL、超时或供应商时就只需改一处。",
      ),
      do: [
        t("Read the function below. It returns the same response shape from a real endpoint or from the fake model.", "阅读下面的函数。无论调用真实端点还是假模型，它返回的响应结构都相同。"),
        t("Note what the fake model is: a deterministic test double. It proves plumbing and nothing about quality.", "注意假模型是什么：一个确定性的测试替身。它只能证明管道通了，证明不了质量。"),
      ],
      lab: { file: "labs/common/llm.py", region: "chat" },
      verify: t("You can explain what changes when `LAB_BASE_URL` is set, and what does not.", "你能解释设置 `LAB_BASE_URL` 后什么变了、什么没变。"),
      needs: [{ step: "inference.contract", what: t("the request and response shape", "请求和响应的格式") }],
      produces: t("`chat()` and `embed()`: the only model calls in the stack.", "`chat()` 和 `embed()`：全系统唯一的模型调用入口。"),
    },
    {
      id: "measure",
      title: t("Measure time to first token and tokens per second", "测量首 token 时间和每秒 token 数"),
      why: t(
        "Measure before tuning. These two numbers explain almost every latency complaint, and each has a different fix.",
        "先测量再优化。这两个数字能解释几乎所有延迟问题，而且各自的解法不同。",
      ),
      do: [
        t("Run the bench twice in a row against your endpoint.", "对你的端点连续运行两次基准测试。"),
        t("Compare the first call with the second. A large gap in time to first token is a cold load.", "对比第一次和第二次。首 token 时间差距大，就是冷加载。"),
        t("Check that total time is close to first-token time plus tokens divided by rate.", "检查总时间是否接近 首 token 时间 + token 数 ÷ 速率。"),
      ],
      lab: { file: "labs/m01_inference/bench.py", region: "bench" },
      run: "python3 -m labs.m01_inference.bench",
      output: "m01.bench",
      verify: t("You have a tok/s figure and a warm first-token time for each model in the lineup.", "阵容里每个模型都有了 token/秒 和热状态下的首 token 时间。"),
      needs: [{ step: "inference.contract", what: t("the endpoint to measure", "要测量的端点") }],
      produces: t("Per-model rate and first-token numbers. Round budgets and timeouts are set from these.", "每个模型的速率和首 token 数据。轮次预算和超时都据此设定。"),
    },
    {
      id: "second-runtime",
      title: t("Add a second runtime only where it earns its place", "只在值得的地方增加第二个运行时"),
      why: t(
        "A small fast model handles cheap jobs such as triage, question writing, and judging. It must not compete with the workhorse for a resident slot, which is why it comes after the budget and the measurements.",
        "小而快的模型处理分流、出题、裁判这类便宜的任务。它不能和主力模型抢驻留名额，所以要在预算和测量之后再加。",
      ),
      do: [
        t("Start the small model in its own process on its own port.", "在独立进程、独立端口上启动小模型。"),
        t("Note the difference: this runtime serves one model per process, so you select it by URL and not by model name.", "注意区别：这个运行时一个进程只服务一个模型，所以靠 URL 来选它，而不是靠模型名。"),
      ],
      code: { lang: "bash", text: `# Apple silicon. One process, one model, its own port.
mlx_lm.server --model mlx-community/<small-model>-4bit --port 8082
# NVIDIA: vllm serve <model> --port 8082` },
      verify: t("The curl from the contract step works against the second port.", "契约那一步的 curl 命令在第二个端口上也能用。"),
      needs: [
        { step: "inference.budget", what: t("memory left for a small model", "留给小模型的内存") },
        { step: "inference.measure", what: t("proof the workhorse is too slow for cheap jobs", "主力模型做便宜任务太慢的证据") },
      ],
      produces: t("A second base URL for fast, cheap calls.", "第二个 base URL，用于快速、便宜的调用。"),
      notExecuted: true,
    },
    {
      id: "router",
      title: t("Route by task type, and fail safe", "按任务类型路由，并且失败时不出错"),
      why: t(
        "Routing comes after the endpoints exist and are measured. A router over unmeasured models sends work to the wrong place with confidence.",
        "路由要等端点都存在并测量过之后再做。对没测过的模型做路由，只会自信地把任务送错地方。",
      ),
      do: [
        t("Classify each request: default, fast, or vision.", "给每个请求分类：默认、快速、视觉。"),
        t("Map the class to a catalog entry. An entry has either a model tag or a base URL.", "把类别映射到目录条目。条目要么是模型 tag，要么是 base URL。"),
        t("On anything unknown, missing, or failing, return nothing so the request runs as it would have.", "遇到未知、缺失或出错的情况，返回空值，让请求按原样执行。"),
      ],
      lab: { file: "labs/m01_inference/router.py", region: "router" },
      run: "python3 -m labs.m01_inference.router",
      output: "m01.router",
      verify: t("With an empty catalog the router returns None and a request still succeeds.", "目录为空时路由返回 None，请求依然成功。"),
      needs: [
        { step: "inference.measure", what: t("which model is fast enough for which task", "哪个模型对哪类任务足够快") },
        { step: "inference.second-runtime", what: t("the base URL of the fast model", "快速模型的 base URL") },
      ],
      produces: t("`resolve_for_request()`: called by the gateway before forwarding.", "`resolve_for_request()`：网关转发前调用它。"),
    },
    {
      id: "latency",
      title: t("Cut latency where it is actually spent", "在真正耗时的地方降低延迟"),
      why: t(
        "This needs logs from real requests, so it comes after measurement. Tuning earlier usually targets model speed, which is rarely the problem.",
        "这一步需要真实请求的日志，所以排在测量之后。过早优化往往盯着模型速度，而那很少是问题所在。",
      ),
      do: [
        t("Set a default max-tokens value and ask for shorter answers in the system prompt. Output volume dominates.", "设一个默认的 max_tokens，并在系统提示词里要求简短回答。输出量是主要因素。"),
        t("Stream responses and reuse one pooled HTTP client.", "使用流式响应，并复用一个 HTTP 连接池。"),
        t("Keep prompts small. Tool schemas, the system prompt, and memory are charged on every turn.", "保持提示词精简。工具 schema、系统提示词和记忆每一轮都要计费。"),
        t("List every model your request path can load, including the embedder. Remove avoidable loads.", "列出请求路径上可能加载的所有模型，包括 embedding 模型。去掉可以避免的加载。"),
      ],
      verify: t("Median latency in your own request log moves, and the engine log shows fewer cold loads.", "你自己的请求日志里中位延迟下降，引擎日志里冷加载次数减少。"),
      needs: [{ step: "inference.measure", what: t("the baseline to beat", "要超越的基线") }],
      produces: t("Default output cap and keep-alive values used by the harness.", "Harness 使用的默认输出上限和 keep-alive 值。"),
      notExecuted: true,
    },
    {
      id: "private",
      title: t("Keep the engine private", "让引擎保持私有"),
      why: t(
        "The engine has no authentication. Anything outside your machine must go through the gateway, which is the next module.",
        "引擎本身没有身份验证。机器外部的任何访问都必须经过网关，也就是下一个模块。",
      ),
      do: [
        t("Bind the engine to localhost or a private network interface.", "把引擎绑定到 localhost 或私有网络接口。"),
        t("From another device on a different network, confirm the engine port does not answer.", "从另一个网络的设备上确认引擎端口没有响应。"),
      ],
      verify: t("The engine answers on 127.0.0.1 and nowhere else.", "引擎只在 127.0.0.1 上响应。"),
      needs: [{ step: "inference.contract", what: t("the port to protect", "要保护的端口") }],
      produces: t("A rule: the only public door is the gateway.", "一条规则：唯一对外的门是网关。"),
      notExecuted: true,
    },
  ],
  together: [
    { with: "api-gateway", how: t("The gateway is the only thing allowed to forward outside traffic to the engine.", "只有网关可以把外部流量转发给引擎。") },
    { with: "rag-graph", how: t("Retrieval uses the embedding model. Loading it can evict a chat model, so retrieval design affects inference cost.", "检索使用 embedding 模型。加载它可能挤掉聊天模型，所以检索设计会影响推理成本。") },
    { with: "harness", how: t("Each tool round is another model call. Round budgets and prompt size are inference decisions made in the harness.", "每一轮工具调用都是一次模型调用。轮次预算和提示词大小是在 Harness 里做出的推理决策。") },
    { with: "evaluation", how: t("Judges and question writers are model calls. A small second runtime lets evals run without evicting the serving model.", "裁判和出题也是模型调用。小的第二运行时让评估运行时不会挤掉服务模型。") },
  ],
  failures: [
    {
      when: "2026-08",
      title: t("A context setting that was present but not in effect", "配置写了，但没有生效"),
      what: t("A context cap was configured for a coding client. Requests still sent far larger prompts and timed out after 15 minutes.", "给编程客户端配置了上下文上限，但请求仍然发送大得多的提示词，15 分钟后超时。"),
      fix: t("Read the engine log for the real prompt size on each request before touching anything else.", "先读引擎日志里每个请求的真实提示词大小，再动别的。"),
      lesson: t("A configured value is a claim. The log line is the evidence.", "配置值只是声明，日志才是证据。"),
    },
    {
      when: "2026-09",
      title: t("The embedder evicted the chat model", "embedding 模型挤掉了聊天模型"),
      what: t("With a cap of two resident models, a knowledge search loaded the embedding model and pushed the chat model out. The next answer paid a 35 to 70 second reload.", "驻留上限为两个模型时，一次知识检索加载了 embedding 模型，把聊天模型挤了出去。下一次回答要等 35 到 70 秒重新加载。"),
      fix: t("Route definition questions to a full-text lookup that loads no model.", "把定义类问题路由到不加载任何模型的全文检索。"),
      lesson: t("Count every model your request path can load, including the small ones.", "把请求路径上可能加载的每个模型都算进去，小模型也算。"),
    },
    {
      when: "2026-07",
      title: t("Latency blamed on model speed", "把延迟归咎于模型速度"),
      what: t("Median latency was 26 seconds and p90 was 89 seconds. The generation rate was a healthy 72 tokens per second.", "中位延迟 26 秒，p90 为 89 秒。而生成速率是正常的 72 token/秒。"),
      fix: t("Cap default output tokens, stream, and extend keep-alive.", "限制默认输出 token 数，使用流式，延长 keep-alive。"),
      lesson: t("Latency is tokens divided by rate. Check the numerator first.", "延迟等于 token 数除以速率。先检查分子。"),
    },
  ],
  portability: {
    databricks: t(
      "Hosted model endpoints replace the engine, and Unity Gateway (formerly AI Gateway) gives one API across models. Your memory budget becomes a throughput and cost budget. The endpoint is OpenAI-compatible, so the contract step carries over.",
      "托管的模型端点取代引擎，Unity Gateway（原 AI Gateway）用一套 API 访问各种模型。内存预算变成吞吐量和成本预算。端点兼容 OpenAI，所以契约那一步原样适用。",
    ),
    watsonx: t(
      "watsonx.ai hosts foundation models behind an inference API, with on-demand deployments for dedicated capacity. Model choice is a catalog decision. You still measure rate and first-token time per model.",
      "watsonx.ai 通过推理 API 托管基础模型，并可按需部署专用容量。选模型变成在目录里做选择。你仍然要逐个模型测量速率和首 token 时间。",
    ),
    codex: t(
      "Codex is a client of an inference endpoint. It uses hosted models by default and can be pointed at another provider in its config, including a local OpenAI-compatible server.",
      "Codex 是推理端点的客户端。默认使用托管模型，也可以在配置里指向其他供应商，包括本地的 OpenAI 兼容服务。",
    ),
    cursor: t(
      "Cursor consumes inference. It can override the OpenAI base URL to reach your own endpoint for some features. Serving decisions are made wherever that endpoint runs.",
      "Cursor 是推理的使用方。部分功能可以覆盖 OpenAI base URL 来访问你自己的端点。服务层面的决策在端点所在的地方做。",
    ),
    claude: t(
      "Claude Code and the Agent SDK call a hosted model, or a compatible gateway you configure. Context budgets still apply and are charged on every turn.",
      "Claude Code 和 Agent SDK 调用托管模型，或你配置的兼容网关。上下文预算依然存在，而且每一轮都计费。",
    ),
    other: t(
      "On an NVIDIA machine use vLLM or llama.cpp in place of the Mac runtimes. The budget is VRAM per card. Use systemd in place of launchd. Every step from the contract onward is identical.",
      "在 NVIDIA 机器上用 vLLM 或 llama.cpp 代替 Mac 上的运行时。预算是每张卡的显存。用 systemd 代替 launchd。从契约那一步开始，其余完全相同。",
    ),
  },
  checks: [
    {
      q: t("Why does the memory budget come before model selection?", "为什么内存预算要排在选模型之前？"),
      a: t(
        "Residency is what makes responses fast, and residency is limited by memory. A lineup chosen without the budget can require a model swap on a common path, and each swap costs tens of seconds to minutes.",
        "模型驻留才能让响应快，而驻留受内存限制。不看预算就选阵容，可能在常用路径上就需要切换模型，每次切换要几十秒到几分钟。",
      ),
    },
    {
      q: t("A request is slow. What do you look at first, and why?", "一个请求很慢。你先看什么？为什么？"),
      a: t(
        "The engine log for that request: whether a model was loaded, the real prompt size, and the output token count. Those three explain almost all latency, and each has a different fix.",
        "该请求的引擎日志：是否加载了模型、真实提示词大小、输出 token 数。这三项能解释几乎所有延迟，而且各自的解法不同。",
      ),
    },
    {
      q: t("Why are there two routing mechanisms?", "为什么有两种路由机制？"),
      a: t(
        "The main engine serves many models on one port and selects by the model field. The second runtime serves one model per process and has no model selection, so reaching it means calling a different base URL.",
        "主引擎在一个端口上服务多个模型，靠 model 字段选择。第二个运行时一个进程只服务一个模型，没有模型选择，所以要访问它只能换 base URL。",
      ),
    },
    {
      q: t("You want to build retrieval before this module. What do you stub?", "你想在这个模块之前先做检索。需要用什么替代？"),
      a: t(
        "The embedding call. Any function that returns a fixed-length vector for a string lets you build and test ingestion and search plumbing. The labs ship one. You replace it with the real embedder later.",
        "替代 embedding 调用。任何能把字符串变成定长向量的函数，都足以让你搭建并测试入库和检索的管道。lab 里自带一个。之后再换成真正的 embedding 模型。",
      ),
    },
  ],
  terms: [
    { term: t("Resident", "驻留"), def: t("Loaded in memory and ready to generate without a load delay.", "已加载在内存中，无需等待加载即可生成。") },
    { term: t("Keep-alive", "Keep-alive"), def: t("How long an idle model stays resident before the engine unloads it.", "空闲模型在被引擎卸载前保持驻留的时长。") },
    { term: t("TTFT", "TTFT（首 token 时间）"), def: t("Time to first token. What the user feels as responsiveness.", "从请求到第一个 token 的时间。用户感受到的响应速度。") },
    { term: t("Quantization", "量化"), def: t("Storing weights at lower precision to cut memory, with some quality cost.", "用更低精度存储权重以节省内存，会损失一些质量。") },
  ],
};
