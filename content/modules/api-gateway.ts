import { t, type Module } from "@/lib/types";

export const apiGateway: Module = {
  id: "api-gateway",
  n: 2,
  layer: 1,
  title: t("API and gateway", "API 与网关"),
  short: t(
    "One contract for every caller, with keys, scopes, limits, and a single public door.",
    "所有调用方共用一套接口契约，配上密钥、权限范围、限额，以及唯一的对外入口。",
  ),
  what: t(
    "The API is the contract callers use: the OpenAI-compatible chat endpoint. The gateway is the process in front of the engine that authenticates each caller and decides what that caller may do.",
    "API 是调用方使用的契约，即 OpenAI 兼容的 chat 接口。网关是挡在引擎前面的进程，负责验证每个调用方的身份，并决定它能做什么。",
  ),
  why: t(
    "The engine has no authentication. Every outside caller needs an identity that can be limited and revoked without affecting the others. A stable contract also lets you replace everything behind it.",
    "引擎没有身份验证。每个外部调用方都需要一个身份，可以单独限流、单独吊销，而不影响其他调用方。稳定的契约也让你可以替换它背后的一切。",
  ),
  how: [
    t("Keys are stored as hashes. Each key has an app name, scopes, a per-minute rate, and a daily quota.", "密钥以哈希形式存储。每个密钥对应一个应用名、权限范围、每分钟速率和每日配额。"),
    t("The gateway validates the key, checks scope and limits, then forwards. The engine stays on localhost.", "网关验证密钥、检查权限和限额，然后转发。引擎只监听 localhost。"),
    t("Scope decides capability. A key without the tools scope has tool definitions removed from its requests.", "权限范围决定能力。没有 tools 权限的密钥，请求里的工具定义会被去掉。"),
    t("Health has two levels: an unauthenticated liveness answer, and detail that needs a key.", "健康检查分两级：无需认证的存活应答，以及需要密钥才能看的详情。"),
  ],
  prereqs: [
    {
      id: "inference",
      why: t("A gateway forwards to an engine. Its timeouts and limits are set from measured load times and generation rates.", "网关要把请求转发给引擎。它的超时和限额根据测得的加载时间和生成速率来设定。"),
      stub: t("The fake model. The lab gateway uses it whenever LAB_BASE_URL is unset.", "假模型。未设置 LAB_BASE_URL 时，lab 网关就用它。"),
    },
  ],
  inBuild: [
    { path: "apps/agent-server/auth.py", role: t("Key validation, scopes, rate limits, quotas.", "密钥验证、权限范围、限流、配额。") },
    { path: "apps/agent-server/keys_admin.py", role: t("Issue, list, and revoke keys.", "签发、列出、吊销密钥。") },
    { path: "apps/agent-server/main.py", role: t("The HTTP endpoints.", "HTTP 接口。") },
    { path: "apps/claude-code-gateway/", role: t("Translation proxy so a coding client can use local models.", "协议转换代理，让编程客户端可以使用本地模型。") },
  ],
  flow: {
    caption: t("One request through the gateway", "一个请求如何通过网关"),
    stages: [
      { label: t("Bearer token arrives", "收到 Bearer 令牌"), detail: t("The caller sends its secret in the Authorization header.", "调用方在 Authorization 头里发送密钥。"), kind: "input" },
      { label: t("Hash and look up", "哈希并查找"), detail: t("The secret is hashed and matched against stored hashes. The plain secret is never stored.", "对密钥做哈希，与存储的哈希比对。明文密钥从不保存。"), kind: "check" },
      { label: t("Scope", "权限范围"), detail: t("Does this key have the scope the endpoint needs?", "该密钥是否具备此接口所需的权限？"), kind: "check" },
      { label: t("Rate and quota", "速率与配额"), detail: t("Count this key's recent calls. Refuse with 429 when over.", "统计该密钥近期的调用次数。超限则返回 429。"), kind: "check" },
      { label: t("Shape the request", "调整请求"), detail: t("Remove tools for keys without the tools scope. Apply the model router.", "对没有 tools 权限的密钥去掉工具定义。应用模型路由。"), kind: "tool" },
      { label: t("Forward", "转发"), detail: t("Send to the engine on localhost and return its response unchanged.", "发给 localhost 上的引擎，并原样返回响应。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "surface",
      title: t("Decide the public surface", "确定对外接口"),
      why: t("The surface is what callers depend on. Fix it first, because every later change behind it is free and every change to it breaks someone.", "对外接口是调用方依赖的东西。要先把它定下来，因为之后改它背后的东西没有代价，而改接口本身一定会影响到别人。"),
      do: [
        t("Expose exactly two paths: `POST /v1/chat/completions` and `GET /health`.", "只暴露两个路径：`POST /v1/chat/completions` 和 `GET /health`。"),
        t("Accept and return the OpenAI chat format unchanged, so existing SDKs and editors work.", "原样接受和返回 OpenAI chat 格式，这样现有的 SDK 和编辑器都能直接用。"),
        t("Write down what a key carries: app name, scopes, rate, quota.", "写下每个密钥附带的信息：应用名、权限范围、速率、配额。"),
      ],
      verify: t("You can list every path, and for each one say which scope it needs.", "你能列出每个路径，并说出它需要哪种权限。"),
      needs: [{ step: "inference.contract", what: t("the request and response format to preserve", "需要保持不变的请求和响应格式") }],
      produces: t("A written contract: two paths, one format, four key attributes.", "一份书面契约：两个路径、一种格式、四个密钥属性。"),
    },
    {
      id: "keys",
      title: t("Build the key store", "建立密钥库"),
      why: t("Identity comes before the handler, because the handler's first act is to ask who is calling.", "身份在处理函数之前，因为处理函数做的第一件事就是问“谁在调用”。"),
      do: [
        t("Create a table with a hash column and no column for the plain secret.", "建一张表，只有哈希列，不存明文密钥。"),
        t("`issue()` returns the secret once. `authenticate()` hashes what it receives and compares.", "`issue()` 只返回一次密钥。`authenticate()` 对收到的密钥做哈希再比对。"),
        t("Record each accepted call so rate and quota can be counted.", "记录每次通过的调用，用来统计速率和配额。"),
        t("Raise an error that carries the HTTP status: 401 unknown, 403 wrong scope, 429 over limit.", "抛出带 HTTP 状态码的错误：401 未知密钥，403 权限不符，429 超限。"),
      ],
      lab: { file: "labs/m02_gateway/keys.py", region: "keys" },
      verify: t("Open the database file. No secret appears in it.", "打开数据库文件，里面看不到任何明文密钥。"),
      needs: [{ step: "api-gateway.surface", what: t("the four key attributes", "四个密钥属性") }],
      produces: t("`KeyStore` with issue, revoke, and authenticate.", "`KeyStore`：签发、吊销、验证。"),
    },
    {
      id: "handler",
      title: t("Write the gateway handler", "编写网关处理函数"),
      why: t("It needs the key store to exist and the engine contract to forward to. It is the first piece that joins two modules.", "它需要密钥库已经存在，也需要引擎的契约作为转发目标。这是第一个把两个模块连起来的部件。"),
      do: [
        t("On POST: authenticate with scope `chat`, strip `tools` if the key lacks scope `tools`, forward, return.", "POST 时：用 `chat` 权限验证；如果密钥没有 `tools` 权限就去掉 `tools`；转发；返回。"),
        t("On GET /health with no key: answer liveness only.", "无密钥访问 GET /health 时：只回答是否存活。"),
        t("On GET /health with a key: add detail.", "带密钥访问 GET /health 时：附加详情。"),
        t("Keep the upstream call behind one function so the engine can be swapped.", "把上游调用收在一个函数后面，方便更换引擎。"),
      ],
      lab: { file: "labs/m02_gateway/gateway.py", region: "gateway" },
      verify: t("The handler has no code path that reaches the engine without `authenticate` succeeding.", "处理函数里不存在绕过 `authenticate` 就能到达引擎的代码路径。"),
      needs: [
        { step: "api-gateway.keys", what: t("authenticate()", "authenticate()") },
        { step: "inference.client", what: t("chat() as the upstream", "作为上游的 chat()") },
      ],
      produces: t("`serve()`: a running gateway and its base URL.", "`serve()`：一个运行中的网关及其 base URL。"),
    },
    {
      id: "prove",
      title: t("Prove each rule with a request", "用请求逐条验证规则"),
      why: t("A gateway is a list of refusals. Each one is tested before anything is built on top.", "网关本质上是一组拒绝规则。在其上构建任何东西之前，要逐条测试。"),
      do: [
        t("Run the demo. It issues two keys with different scopes and makes eight calls.", "运行 demo。它签发两个不同权限的密钥，并发出八次调用。"),
        t("Match each output line to the rule that produced it.", "把每行输出对应到产生它的规则。"),
      ],
      run: "python3 -m labs.m02_gateway.demo",
      output: "m02.demo",
      verify: t("You see 200, 401, 429, and 401 after revoke, and line 4 shows tools removed for the website key.", "你能看到 200、401、429，以及吊销后的 401；第 4 行显示网站密钥的工具被去掉了。"),
      needs: [{ step: "api-gateway.handler", what: t("the running gateway", "运行中的网关") }],
      produces: t("Evidence that authentication, scope, rate, and revoke each work alone.", "身份验证、权限、限流、吊销各自独立生效的证据。"),
    },
    {
      id: "issue",
      title: t("Issue one key per application", "每个应用签发一个密钥"),
      why: t("Now that the rules hold, give every caller its own identity. Doing this before building callers means none of them ever shares a key.", "规则都成立之后，给每个调用方一个独立身份。在开发调用方之前就这么做，就不会出现共用密钥的情况。"),
      do: [
        t("Issue a key for each caller you have: the website, a coding agent, an eval job.", "为现有的每个调用方签发密钥：网站、编程智能体、评估任务。"),
        t("Give the public website `chat` only, a low rate, and a quota.", "公开网站只给 `chat` 权限、较低的速率和一个配额。"),
        t("Store each secret in that caller's own secret store. Never in a repository.", "把每个密钥存到对应调用方自己的密钥存储里。绝不放进代码仓库。"),
      ],
      code: { lang: "python", text: `from pathlib import Path
from labs.m02_gateway.keys import KeyStore

keys = KeyStore(Path("keys.db"))
print(keys.issue("website", scopes="chat", rate_per_min=6, daily_quota=400))
print(keys.issue("coding-agent", scopes="chat,tools", rate_per_min=60))
# later: keys.revoke("website")   # the other callers are unaffected` },
      verify: t("Revoking one application's key leaves the others working.", "吊销一个应用的密钥后，其他应用照常工作。"),
      needs: [{ step: "api-gateway.prove", what: t("confidence that scopes and revoke work", "对权限和吊销机制的信心") }],
      produces: t("One key per caller. The harness reads the scope to decide who gets tools.", "每个调用方一个密钥。Harness 读取权限范围来决定谁能用工具。"),
    },
    {
      id: "route",
      title: t("Apply the model router in the gateway", "在网关里应用模型路由"),
      why: t("The gateway is the one place every request passes, so model choice belongs here and callers stay unaware of it.", "网关是所有请求的必经之路，所以选模型的逻辑放在这里，调用方不需要知道。"),
      do: [
        t("Before forwarding, call the router from the inference module.", "转发之前，调用推理模块里的路由函数。"),
        t("If it returns a model tag, set `model`. If it returns a base URL, forward there. If it returns nothing, change nothing.", "返回模型 tag 就设置 `model`；返回 base URL 就转发到那里；返回空就什么都不改。"),
      ],
      lab: { file: "labs/m02_gateway/route.py", region: "route" },
      run: "python3 -m labs.m02_gateway.route",
      output: "m02.route",
      verify: t("A text request goes to the default model, an image to the vision model, a short request to the fast runtime, and a request that names its model is forwarded untouched.", "文本请求发往默认模型，图片请求发往视觉模型，短请求发往快速运行时，指定了模型的请求原样转发。"),
      needs: [
        { step: "inference.router", what: t("resolve_for_request()", "resolve_for_request()") },
        { step: "api-gateway.handler", what: t("the upstream function to wrap", "要包装的上游函数") },
      ],
      produces: t("Callers send no model name and still reach the right model.", "调用方不写模型名，也能到达正确的模型。"),
    },
    {
      id: "expose",
      title: t("Open one public door", "只开一个对外入口"),
      why: t("Exposure is last. Only a gateway that already refuses correctly should be reachable from outside.", "对外暴露放在最后。只有已经能正确拒绝请求的网关，才应该从外部可达。"),
      do: [
        t("Run the gateway on localhost.", "让网关运行在 localhost 上。"),
        t("Publish only the gateway port through an encrypted tunnel. Forward no router port.", "只通过加密隧道发布网关端口。不要在路由器上做端口转发。"),
        t("From outside, confirm the gateway answers and the engine port does not.", "从外部确认网关有响应，而引擎端口没有。"),
      ],
      code: { lang: "bash", text: `# One option: Tailscale Funnel. Check the flags with: tailscale funnel --help
tailscale funnel --bg 8000

# From a phone on mobile data:
curl https://<your-funnel-host>/health          # {"status":"ok","authenticated":false}
curl https://<your-funnel-host>:11434/          # must fail` },
      codeNote: t("Tunnel commands change between versions. Confirm the flags on your machine.", "隧道命令在不同版本间会变化。请在你的机器上确认参数。"),
      verify: t("The public URL returns liveness without a key and 401 on chat without a key.", "公网 URL 不带密钥返回存活状态；不带密钥访问 chat 返回 401。"),
      needs: [
        { step: "api-gateway.issue", what: t("keys for the outside callers", "给外部调用方的密钥") },
        { step: "inference.private", what: t("an engine that is not reachable directly", "一个无法被直接访问的引擎") },
      ],
      produces: t("A public base URL that other machines and hosted apps can call.", "一个公网 base URL，供其他机器和托管应用调用。"),
      notExecuted: true,
    },
  ],
  together: [
    { with: "inference", how: t("The gateway forwards to the engine and applies the model router.", "网关把请求转发给引擎，并应用模型路由。") },
    { with: "harness", how: t("The harness sits behind the same contract and reads key scope to decide whether to offer tools.", "Harness 位于同一契约之后，并读取密钥权限来决定是否提供工具。") },
    { with: "ops", how: t("The watchdog probes the unauthenticated health path. Keys and quotas are backed up.", "看门狗探测无需认证的健康检查路径。密钥和配额要备份。") },
    { with: "sdk", how: t("Any SDK that speaks the OpenAI format can use the gateway as its base URL.", "任何支持 OpenAI 格式的 SDK 都可以把网关当作 base URL。") },
  ],
  failures: [
    {
      when: "2026-09",
      title: t("Sixteen thousand log lines from one probe", "一个探针产生了一万六千行日志"),
      what: t("The health endpoint required a key. The watchdog sent none, so 58 percent of the server log was 401 responses and the supervisor could not tell healthy from sick.", "健康检查接口要求密钥，而看门狗没有带。结果服务日志的 58% 都是 401，监管进程也分不清服务是否健康。"),
      fix: t("Answer liveness without a key and with no configuration detail. Keep detail behind a key.", "无密钥时只回答是否存活，不带任何配置细节。详情仍需密钥。"),
      lesson: t("Separate liveness from detail, and keep noise out of logs that other jobs read.", "把存活检查和详情分开，别让噪音进入其他任务要读的日志。"),
    },
    {
      when: "2026-08",
      title: t("A 401 that was a typo", "一个由笔误造成的 401"),
      what: t("A client sent two spaces after the word Bearer. The gateway rejected it and the outage was blamed on the gateway.", "客户端在 Bearer 后面多打了一个空格。网关拒绝了请求，故障却被归咎于网关。"),
      fix: t("Trim the token, and log the reason for every refusal.", "去掉令牌首尾空白，并记录每次拒绝的原因。"),
      lesson: t("A refusal without a logged reason costs an afternoon.", "不记录原因的拒绝，会浪费一个下午。"),
    },
  ],
  portability: {
    databricks: t(
      "Unity Gateway (formerly AI Gateway) governs access to models, MCP servers, and skills, with guardrails, rate limits, and usage tracking. Identity comes from workspace OAuth and service principals. Deployed agents are queried with an OAuth token.",
      "Unity Gateway（原 AI Gateway）统一管控对模型、MCP 服务和技能的访问，提供护栏、限流和用量追踪。身份来自工作区 OAuth 和服务主体。调用已部署的智能体需要 OAuth 令牌。",
    ),
    watsonx: t(
      "watsonx.ai exposes inference endpoints behind IAM keys. A model gateway routes to third-party providers. Orchestrate exposes agent endpoints.",
      "watsonx.ai 的推理端点由 IAM 密钥保护。模型网关可路由到第三方供应商。Orchestrate 提供智能体端点。",
    ),
    codex: t("Codex is a client. It needs a provider base URL and key. If you point it at your gateway, issue it its own key.", "Codex 是客户端，需要供应商的 base URL 和密钥。如果让它连你的网关，就给它单独签发一个密钥。"),
    cursor: t("A client. Give it a key of its own and a base URL override where supported.", "也是客户端。给它单独的密钥，并在支持的地方覆盖 base URL。"),
    claude: t("A client. A base URL setting can route it through your gateway. Issue a separate key per machine.", "也是客户端。通过 base URL 设置可以让它走你的网关。每台机器签发一个独立密钥。"),
    other: t("A small web app or an off-the-shelf LLM proxy does the same job on any host. The lab gateway is standard library only.", "任何主机上，一个小型 Web 应用或现成的 LLM 代理都能完成同样的工作。lab 网关只用了标准库。"),
  },
  checks: [
    {
      q: t("Why one key per application?", "为什么每个应用一个密钥？"),
      a: t("So you can limit and revoke one integration without touching the others, and so logs attribute every request.", "这样可以单独限制和吊销某一个集成而不影响其他，而且日志能把每个请求归到具体的调用方。"),
    },
    {
      q: t("Why is liveness unauthenticated while detail is not?", "为什么存活检查不需要认证，而详情需要？"),
      a: t("A supervisor has to tell healthy from sick without holding a key. Detail reveals configuration, so it stays behind one.", "监管进程不持有密钥，也必须能分辨服务是否健康。详情会暴露配置，所以要放在密钥之后。"),
    },
    {
      q: t("Why does the gateway strip tools instead of rejecting the request?", "为什么网关是去掉工具，而不是直接拒绝请求？"),
      a: t("The caller still gets a useful chat answer, and capability is decided in one place by the key. A public key can never reach a tool, whatever the client sends.", "调用方仍然能得到有用的聊天回答，而能力由密钥在一个地方统一决定。无论客户端发什么，公开密钥都碰不到工具。"),
    },
    {
      q: t("In what order did you build this module, and why that order?", "这个模块你是按什么顺序搭建的？为什么？"),
      a: t("Surface, keys, handler, proof, issue, routing, exposure. Each step uses the one before, and the public door opens only after every refusal has been tested.", "接口、密钥、处理函数、验证、签发、路由、对外暴露。每一步都依赖上一步，而且只有在每条拒绝规则都测试过之后才对外开放。"),
    },
  ],
  terms: [
    { term: t("Scope", "权限范围（Scope）"), def: t("A named capability attached to a key, such as chat or tools.", "附在密钥上的一项具名能力，例如 chat 或 tools。") },
    { term: t("Quota", "配额"), def: t("A cap on total calls over a longer period, here one day.", "较长周期内的调用总量上限，这里是一天。") },
    { term: t("Liveness", "存活检查"), def: t("The answer to one question: is this process serving?", "只回答一个问题：这个进程在提供服务吗？") },
  ],
};
