import { t } from "@/lib/types";
import type { HPhase } from "./types";

const K = "harness/";

/** Phases 1 and 2: frame the agent, then build the skeleton (layout, prompt, tools, loop). */
export const phases1: HPhase[] = [
  {
    id: "frame",
    title: t("Frame the agent", "框定智能体"),
    goal: t(
      "Decide what the agent is for and what the model can actually do, before writing a prompt. Most harness problems blamed on the model start here: no written job, so every file grows on its own; or an interface mismatch (a dropped reasoning field, a truncated prompt, a tool format the server does not parse) that looks like the model being weak.",
      "在写提示词之前，先确定智能体的用途，以及模型实际能做什么。大多数被归咎于模型的框架问题都始于这里：没有书面的职责定义，于是每个文件各自膨胀；或者接口不匹配（推理字段丢失、提示词被截断、服务器无法解析的工具格式），看起来却像是模型能力不足。",
    ),
    steps: [
      {
        id: "contract",
        title: t("Write the harness contract", "写下智能体框架契约"),
        local: t("contract.yml: the job, the surface, the autonomy level, a tier for every tool, budgets and release thresholds.", "contract.yml：职责、使用场景、自主等级、每个工具的权限级别、预算和发布门槛。"),
        links: ["evaluation.frozen", "self-evolving.preconditions"],
        after: [],
        why: t(
          "A harness is everything around the model: the prompt, tools, skills, memory, the loop, the gates and the evals. Without a written job each of those grows on its own, and nobody can say whether a change made the agent better. The contract fixes five things: what the agent is for and not for; the surface (chat, CLI or background), because that decides when it may ask; the autonomy level; a tier for every tool (allow, ask, deny) that code enforces; and the numbers a release must reach. Every later file points back here, and the gate, the runner and the release gate read their numbers from it.",
          "智能体框架是模型周围的一切：提示词、工具、技能、记忆、循环、闸门和评估。没有书面职责，这些部分就会各自膨胀，也没人能说清某次改动是否让智能体变好了。契约固定五件事：智能体用来做什么、不做什么；使用场景（聊天、命令行或后台），因为它决定了何时可以提问；自主等级；每个工具的权限级别（allow、ask、deny），由代码强制执行；以及发布必须达到的数字。之后的每个文件都会回指这里，闸门、评估运行器和发布闸门都从这里读取数值。",
        ),
        what: t(
          "contract.yml for the example agent, an expense desk assistant at autonomy level 2: five tools with tiers (three allow, flag_expense ask, send_email deny), the untrusted fields, budgets (12 model calls, 20 tool calls, 6,000 prompt tokens), success metrics (task pass rate at least 0.85, safety 1.0, grounded figures 1.0, 95th-percentile steps at most 8) and 3 repeats per case for a release.",
          "示例智能体的 contract.yml：一个自主等级为 2 的报销服务台助手。五个工具及其级别（三个 allow，flag_expense 为 ask，send_email 为 deny）、不可信字段、预算（12 次模型调用、20 次工具调用、6,000 个提示词 token）、成功指标（任务通过率至少 0.85、安全 1.0、有据数字 1.0、第 95 百分位步数最多 8），以及发布时每个用例重复 3 次。",
        ),
        how: [
          t("Copy harness/ into your repository and rename the agent. Replace the job paragraph with the one decision your agent makes, written so a business owner would sign it.", "把 harness/ 复制到你的仓库并重命名智能体。把职责段落改成你的智能体要做的那一个决策，写到业务负责人愿意签字的程度。"),
          t("List every tool you plan and give each a tier. When unsure, choose ask. A tool with no tier is denied by the gate in step [[gate]].", "列出计划中的每个工具，并为每个工具指定级别。拿不准时选 ask。没有级别的工具会被第 [[gate]] 步的闸门拒绝。"),
          t("Pick the surface. chat: a person is present. cli: a developer is present and edits are reversible. background: nobody is watching, so only an irreversible fork stops the work.", "选择使用场景。chat：有人在场。cli：开发者在场，且改动可撤销。background：无人值守，所以只有不可逆的分岔才会让工作停下。"),
          t("Set budgets from the job, not from the model: how many lookups would a careful person need? Double that.", "根据职责而非模型来设定预算：一个细心的人需要查多少次？把这个数翻倍。"),
          t("Write the success metrics before any prompt. Safety is a separate number with a minimum of 1.0.", "在写任何提示词之前先写成功指标。安全是一个单独的数字，最低值为 1.0。"),
        ],
        files: [K + "contract.yml"],
        interpret: [
          t("A contract you cannot fill in is a finding. If nobody can name the decision or the owner, the agent is not ready to build.", "填不出来的契约本身就是一个发现。如果没人说得出这个决策或负责人，这个智能体就还不能开始做。"),
          t("If more than a third of the tools are ask, the agent mostly prepares approvals. Consider level 1 (recommend only) first and measure how often its recommendations are accepted.", "如果超过三分之一的工具是 ask，这个智能体主要是在准备审批。可以先考虑第 1 级（只给建议），并衡量它的建议有多少被采纳。"),
        ],
        trouble: [
          { s: t("Stakeholders want full autonomy from day one", "相关方想从第一天就完全自主"), c: t("Autonomy is being set before any evidence exists.", "自主等级是在任何证据出现之前就被设定的。"), f: t("Ship at level 2 and raise one tool's tier at a time, when its eval record and production record support it. Each raise is a reviewed contract change.", "先以第 2 级上线，在评估记录和生产记录都支持时，每次只提升一个工具的级别。每次提升都是一次需要审查的契约变更。") },
          { s: t("The tool list keeps growing", "工具清单不断变长"), c: t("Scope is being added through tools.", "范围正在通过工具悄悄扩大。"), f: t("A new tool needs a tier and at least one case in evals/cases.json before it merges. AGENTS.md (step [[project]]) states this rule for coding agents too.", "新工具在合并前必须有级别，并在 evals/cases.json 中至少有一个用例。AGENTS.md（第 [[project]] 步）也为编码智能体写明了这条规则。") },
        ],
        done: t("contract.yml names the job, the owner, the surface, a tier for every tool, the budgets and the metrics, and python3 harness/check.py passes.", "contract.yml 写明了职责、负责人、使用场景、每个工具的级别、预算和指标，并且 python3 harness/check.py 通过。"),
        scale: [
          t("More agents: one contract per agent, never one shared. A shared contract hides which agent owns which risk.", "智能体增多时：每个智能体一份契约，绝不共用。共用的契约会掩盖哪个智能体承担哪种风险。"),
          t("More teams: keep contract.yml under code review with the business owner as a required reviewer.", "团队增多时：把 contract.yml 纳入代码审查，并把业务负责人设为必需审查人。"),
        ],
        challenge: [
          { q: t("Why write success metrics before the prompt?", "为什么要在写提示词之前写成功指标？"), a: t("Because afterwards the metrics get chosen to fit what the prompt already does. The thresholds are also what turns \"it seems better\" into a release decision in step [[release]].", "因为之后写的指标往往会去迁就提示词已有的表现。这些门槛也是第 [[release]] 步中把“看起来更好了”变成发布决定的依据。") },
          { q: t("Why tiers in a file instead of rules in the prompt?", "为什么把级别写在文件里，而不是写成提示词里的规则？"), a: t("A prompt rule can be argued away by a clever input; the gate in step [[gate]] reads this file and cannot be. The prompt repeats the rule so that the model behaves well, not so that the system is safe.", "提示词里的规则可能被巧妙的输入说服而失效；第 [[gate]] 步的闸门读取这个文件，不会被说服。提示词重复这条规则，是为了让模型表现得好，而不是为了让系统安全。") },
        ],
        models: {
          generic: t("The contract is the same for every model. What changes per model is the budget: a small local model may need more steps (no parallel calls, more retries), so measure with the probe in step [[model]] before you fix max_steps.", "契约对每个模型都一样。随模型变化的是预算：小型本地模型可能需要更多步数（不能并行调用、重试更多），所以在确定 max_steps 之前，先用第 [[model]] 步的探测工具量一下。"),
          claude: t("Anthropic's own harnesses separate behavior by surface: the headless Claude Code variant in the corpus drops the ask-the-user tools because no person is present. Set the surface honestly; it decides which ask rules apply.", "Anthropic 自己的框架按使用场景区分行为：语料中无界面的 Claude Code 版本去掉了向用户提问的工具，因为没有人在场。如实设定使用场景，它决定了哪些提问规则适用。"),
          gpt: t("The Codex prompts in the corpus map request types to authority (answer, diagnose, change, monitor) and say that \"do not stop\" asks for persistence without widening what is authorized. Put that distinction in the tiers, not in wording.", "语料中的 Codex 提示词把请求类型映射到授权范围（回答、诊断、修改、监控），并说明“不要停”只要求坚持完成，并不扩大授权范围。把这个区别写进级别里，而不是靠措辞。"),
          qwen: t("On local hardware a step takes seconds: 12 steps at 20 seconds is 4 minutes per task. Size max_steps with the latency the probe measures, and keep the eval suite small enough to run overnight.", "在本地硬件上，每一步要花好几秒：12 步、每步 20 秒，就是每个任务 4 分钟。根据探测工具测得的延迟来设定 max_steps，并让评估集小到可以一夜跑完。"),
          llama: t("Local steps are slow: measure step latency on your machine first, then set budgets the user can live with.", "本地每一步都很慢：先在你的机器上测出每步延迟，再设定用户能接受的预算。"),
        },
      },
      {
        id: "model",
        title: t("Choose the model and probe the endpoint", "选择模型并探测接口"),
        local: t("probe/probe.py results for your endpoint, and the family entry in families.yml you start from.", "针对你的接口运行 probe/probe.py 的结果，以及作为起点的 families.yml 中的模型系列条目。"),
        links: ["inference.contract", "inference.measure"],
        after: ["contract"],
        why: t(
          "Most harness failures blamed on the model are interface failures: tool calls in a format the server does not parse, reasoning fields dropped between turns, a system prompt silently cut by a small context window. Each family has its own rules for these, and several changed in 2026: forcing a tool call now returns an error on Claude Opus and Sonnet 5.5, DeepSeek returns 400 when reasoning_content is not sent back with tools, Qwen 3.6 dropped the /think switches, and Ollama's default context depends on memory and can be 4,096 tokens. Probe first, then design.",
          "大多数被归咎于模型的框架问题，其实是接口问题：服务器无法解析的工具调用格式、轮次之间丢失的推理字段、被小上下文窗口悄悄截断的系统提示词。每个模型系列在这些方面都有自己的规则，而且 2026 年有好几处变了：在 Claude Opus 和 Sonnet 5.5 上强制工具调用现在会报错；带工具时如果不回传 reasoning_content，DeepSeek 会返回 400；Qwen 3.6 去掉了 /think 开关；Ollama 的默认上下文取决于内存，可能只有 4,096 个 token。先探测，再设计。",
        ),
        what: t(
          "probe.py runs six read-only probes against any OpenAI-compatible endpoint: a plain answer, a native tool call with valid JSON, parallel calls, a tool-result round trip, which extra fields the assistant message carries (the loop must send them back), and whether a code word at the start of a 2k, 6k and 12k-token prompt survives. families.yml holds the per-family defaults: section markup, rule style, date placement, skill loading, token budget, replay fields, sampling values and effort levels.",
          "probe.py 对任何兼容 OpenAI 的接口运行六项只读探测：普通回答、带合法 JSON 的原生工具调用、并行调用、工具结果的往返、助手消息携带了哪些额外字段（循环必须原样回传），以及放在 2k、6k 和 12k token 提示词开头的暗号是否还能被记住。families.yml 保存各模型系列的默认值：节标记方式、规则风格、日期位置、技能加载方式、token 预算、需回传的字段、采样参数和推理强度档位。",
        ),
        how: [
          t("Pick two candidate models: the one you want and a cheaper fallback. Results are per model, so plan to run everything twice.", "选两个候选模型：你想用的那个和一个更便宜的备选。结果因模型而异，所以要做好每样都跑两遍的准备。"),
          t("Run the probe against each: python3 harness/probe/probe.py --base-url <url> --model <name>. For a hosted key, export it and pass --api-key-env NAME; never type a key on the command line.", "对每个模型运行探测：python3 harness/probe/probe.py --base-url <url> --model <name>。如果是托管服务的密钥，先导出为环境变量，再传 --api-key-env NAME；绝不要在命令行里直接输入密钥。"),
          t("Read the advice lines and copy the facts into that family's entry in families.yml: replay fields, whether parallel calls work, the largest context size that kept the code word.", "阅读建议行，把事实抄进 families.yml 中对应的系列条目：需回传的字段、是否支持并行调用、仍能记住暗号的最大上下文长度。"),
          t("On Ollama, set the context length before anything else (OLLAMA_CONTEXT_LENGTH=64000 ollama serve, or num_ctx), confirm it with ollama ps, and rerun the probe.", "在 Ollama 上，先设定上下文长度（OLLAMA_CONTEXT_LENGTH=64000 ollama serve，或 num_ctx），用 ollama ps 确认，然后重新运行探测。"),
          t("Note the vendor setting that controls reasoning for the family (effort, thinking level, enable_thinking), from the model guide on this page.", "从本页的模型指南中记下该系列控制推理的厂商参数（effort、thinking level、enable_thinking）。"),
        ],
        files: [K + "probe/probe.py", K + "template/prompts/families.yml"],
        interpret: [
          t("\"Code word lost at 6000, 12000\" means the server cut the start of the prompt, which is where your rules live. Nothing else in this guide matters until that passes.", "“Code word lost at 6000, 12000” 表示服务器截掉了提示词的开头，而你的规则就在那里。在这一项通过之前，本指南的其他内容都无从谈起。"),
          t("extra_fields such as reasoning_content or reasoning means the loop must send that field back unchanged. runtime/loop.py does, because it appends the raw message it received.", "如果 extra_fields 中出现 reasoning_content 或 reasoning，说明循环必须原样回传这个字段。runtime/loop.py 会这样做，因为它追加的是收到的原始消息。"),
          t("calls_in_first_message 1 on the two-city probe means no parallel calls: expect more steps, and keep tools independent of call order.", "双城市探测中 calls_in_first_message 为 1，说明不支持并行调用：要预期更多步数，并让工具不依赖调用顺序。"),
        ],
        trouble: [
          { s: t("tool_call fails, but the model describes a call in text", "tool_call 失败，但模型用文字描述了一次调用"), c: t("The chat template for this model build has no tool support, or the server has no matching tool parser.", "这个模型版本的聊天模板不支持工具，或服务器没有对应的工具解析器。"), f: t("Use a model tag whose template supports tools (ollama show --modelfile prints it) or a server with the right parser (vLLM --tool-call-parser). Do not describe a text tool format in the prompt; the linter flags it.", "换用模板支持工具的模型标签（ollama show --modelfile 可以打印模板），或使用带正确解析器的服务器（vLLM --tool-call-parser）。不要在提示词中描述文本形式的工具格式，检查器会标记它。") },
          { s: t("400 errors on the second turn", "第二轮出现 400 错误"), c: t("A reasoning field or thinking signature was dropped or edited when the history was sent back.", "回传历史时，推理字段或思考签名被丢弃或修改了。"), f: t("Send the raw assistant message back unchanged. Never rebuild it from parsed parts.", "原样回传助手的原始消息。绝不要用解析出的片段重新拼装。") },
          { s: t("The probe passes but every answer is slow", "探测通过了，但每次回答都很慢"), c: t("Thinking at maximum effort on every call, including simple routing steps.", "每次调用都以最高推理强度思考，包括简单的路由步骤。"), f: t("Lower the effort or thinking level, and raise it only where the evals in step [[experiment]] show it helps.", "降低推理强度或思考档位，只在第 [[experiment]] 步的评估表明有帮助的地方再调高。") },
        ],
        done: t("The probe passes chat and tool_call for the chosen model, the replay fields and context limit are written in families.yml, and the code word survives at the largest prompt size you plan to use.", "所选模型的 chat 和 tool_call 探测通过，需回传字段和上下文上限已写入 families.yml，并且在你计划使用的最大提示词长度下暗号依然能被记住。"),
        unconfirmed: t("Ollama's FAQ gives a 4,096-token default while its context-length page says the default depends on VRAM. The probe measures what your server actually does, which is the number that counts.", "Ollama 的 FAQ 写的默认值是 4,096 个 token，而它的上下文长度页面说默认值取决于显存。探测工具测的是你的服务器实际怎么做，这才是真正算数的数字。"),
        scale: [
          t("More models: run the probe in CI for every model you route to, and fail the build when a model's replay fields or context limit change after an upgrade.", "模型增多时：在 CI 中对你路由到的每个模型运行探测，模型升级后如果需回传字段或上下文上限发生变化，就让构建失败。"),
          t("Routing: a cheap model for lookups and a strong one for decisions is a harness choice (step [[scale]]). Probe both.", "路由：查询用便宜模型、决策用强模型，这是框架层面的选择（第 [[scale]] 步）。两个都要探测。"),
        ],
        challenge: [
          { q: t("Why not take the best model on the benchmarks and skip the probe?", "为什么不直接选基准测试最好的模型，跳过探测？"), a: t("Benchmarks run through the vendor's own harness. Yours has different tools, a different template and a different server. The probe takes minutes and finds the failures that otherwise look like a weak model.", "基准测试是在厂商自己的框架里跑的。你的框架有不同的工具、不同的模板和不同的服务器。探测只需几分钟，却能找出那些看起来像是模型太弱的问题。") },
        ],
        models: {
          generic: t("The probe and the eval runner work with any OpenAI-compatible server: Ollama, vLLM, llama.cpp, LM Studio, and hosted APIs that accept that format.", "探测工具和评估运行器适用于任何兼容 OpenAI 的服务器：Ollama、vLLM、llama.cpp、LM Studio，以及接受该格式的托管 API。"),
          claude: t("Use adaptive thinking with an effort level; budget_tokens returns 400 on 4.7 and later. tool_choice any or tool returns 400 on Opus 5.5, Sonnet 5.5 and Fable 5.1, so do not force tool calls. Thinking blocks and their signatures go back unchanged with tool results. A 1M-token window is the default on the 5.5 generation.", "使用带 effort 档位的自适应思考；在 4.7 及之后的版本上，budget_tokens 会返回 400。在 Opus 5.5、Sonnet 5.5 和 Fable 5.1 上，tool_choice 设为 any 或 tool 会返回 400，所以不要强制工具调用。思考块及其签名要随工具结果原样回传。5.5 代默认 1M token 上下文窗口。"),
          gpt: t("Tool calling on GPT-6 needs the Responses API (Chat Completions supports tools only for Sol and Luna at reasoning effort none). Pass reasoning items back with tool outputs, remove temperature and top_p when reasoning is not none, and keep fewer than 20 tools per turn.", "GPT-6 的工具调用需要 Responses API（Chat Completions 只在推理强度为 none 时支持 Sol 和 Luna 的工具调用）。随工具输出回传推理项；推理不为 none 时去掉 temperature 和 top_p；每轮保持少于 20 个工具。"),
          gemini: t("thinking_level replaces thinking_budget, and sending both is a 400. Gemini 3.5 Flash's default dropped from high to medium, so retest. Keep temperature at the default. Each function response must match its call's id and name, or the reply comes back empty with finish reason STOP.", "thinking_level 取代了 thinking_budget，两者同时发送会返回 400。Gemini 3.5 Flash 的默认档位从 high 降到了 medium，需要重新测试。temperature 保持默认。每个函数响应都必须与对应调用的 id 和名称一致，否则回复为空且结束原因为 STOP。"),
          grok: t("Reasoning cannot be turned off; effort runs from low to xhigh, default high. Presence and frequency penalties and stop return errors on reasoning models. Parallel calls are on by default, and a request may carry up to 350 tools.", "推理无法关闭；推理强度从 low 到 xhigh，默认 high。在推理模型上，presence 和 frequency 惩罚以及 stop 参数会报错。并行调用默认开启，一次请求最多可带 350 个工具。"),
          qwen: t("Thinking is on by default; turn it off per request with chat_template_kwargs enable_thinking false. Qwen 3.6 uses the qwen3_coder tool parser on vLLM and SGLang, Qwen 3 the hermes parser. Never use greedy decoding in thinking mode; send the sampling values in families.yml. Keep at least 128K of context if you preserve thinking.", "思考默认开启；可以在单次请求中用 chat_template_kwargs enable_thinking false 关闭。Qwen 3.6 在 vLLM 和 SGLang 上使用 qwen3_coder 工具解析器，Qwen 3 使用 hermes 解析器。思考模式下绝不要用贪心解码；发送 families.yml 中的采样参数。如果保留思考内容，上下文至少保留 128K。"),
          deepseek: t("Thinking is on by default at high effort. With tools present, every earlier reasoning_content must be sent back, or the API returns 400. Temperature has no effect in thinking mode.", "思考默认开启，强度为 high。带工具时，之前每一轮的 reasoning_content 都必须回传，否则 API 返回 400。思考模式下 temperature 不起作用。"),
          kimi: t("K3 always thinks (effort low, high or max; default max) and fixes temperature and top_p, so omit them. Use max_completion_tokens, not max_tokens. Return the complete assistant message unchanged.", "K3 始终思考（推理强度 low、high 或 max，默认 max），并固定了 temperature 和 top_p，所以不要传这两个参数。使用 max_completion_tokens 而不是 max_tokens。原样回传完整的助手消息。"),
          glm: t("Thinking is on by default on GLM 4.7 and 5.x and cannot be turned off on 5.3. Return reasoning_content with tool results; preserved thinking is off on the standard API unless clear_thinking is false.", "GLM 4.7 和 5.x 默认开启思考，5.3 上无法关闭。随工具结果回传 reasoning_content；在标准 API 上，除非 clear_thinking 设为 false，否则不会保留之前的思考内容。"),
          mistral: t("reasoning_effort is high or none on Small, Medium 3.5 and Large 4; the Magistral reasoning models are deprecated. Replay the full assistant message, because stripping its ThinkChunks degrades quality.", "Small、Medium 3.5 和 Large 4 的 reasoning_effort 可设为 high 或 none；Magistral 推理模型已弃用。回传完整的助手消息，因为去掉其中的 ThinkChunk 会降低质量。"),
          llama: t("Llama 4's template names the tool role ipython and forbids mixing text and calls in one reply. Through Ollama or vLLM the OpenAI format hides this, but the probe still tells you whether calls parse.", "Llama 4 的模板把工具角色命名为 ipython，并禁止在同一条回复中混合文字和调用。通过 Ollama 或 vLLM 使用时，OpenAI 格式会掩盖这一点，但探测仍然会告诉你调用能否被解析。"),
        },
      },
    ],
  },
  {
    id: "skeleton",
    title: t("Build the skeleton", "搭建骨架"),
    goal: t(
      "Lay the harness out as files, write the system prompt once and render it per model, write the tools, and write the loop. These four steps produce a working agent that can be linted and tested before a single eval runs.",
      "把框架拆成文件，系统提示词只写一份、按模型渲染，编写工具，编写循环。这四步产出一个可以运行的智能体，在跑任何评估之前就能被检查和测试。",
    ),
    steps: [
      {
        id: "layout",
        title: t("Lay the harness out as files", "把框架拆成文件"),
        local: t("A repository tree: contract, prompts, tools, skills, agents, memory, runtime, lint, evals, ops.", "一棵仓库目录树：契约、提示词、工具、技能、子智能体、记忆、运行时、检查器、评估、运维。"),
        links: ["skills.write", "harness.compose"],
        after: ["contract"],
        why: t(
          "The corpus is clearest on this point: mature harnesses ship as file systems, not as one prompt. Meta's Muse agent is a home directory with runtime files, a cron job, a memory bank and 85 skill folders. Claude Code has a system prompt, tool descriptions, 44 skills, subagent files, hooks and commands. Codex stacks a base prompt, developer blocks, AGENTS.md and lazily loaded tools. Files can be reviewed, versioned, linted and evaluated one at a time; a single large prompt can only be argued about.",
          "语料在这一点上最为清楚：成熟的框架以文件系统的形式交付，而不是一段提示词。Meta 的 Muse 智能体是一个主目录，里面有运行时文件、一个定时任务、一个记忆库和 85 个技能文件夹。Claude Code 有系统提示词、工具说明、44 个技能、子智能体文件、钩子和命令。Codex 叠加了基础提示词、开发者消息块、AGENTS.md 和按需加载的工具。文件可以逐个审查、版本化、检查和评估；一大段提示词只能拿来争论。",
        ),
        what: t(
          "The kit's tree, described in README.md, where each folder has one job and one step that explains it. The placement rule the corpus implies: always-on behavior in the core prompt; facts about this session in an injected environment block; how to use one tool in that tool's description; long, occasional procedures in skills; anything that must happen every time in code (the gate, loop budgets, hooks); work whose raw output should stay out of the main context in subagents.",
          "工具包的目录树，在 README.md 中有说明，每个文件夹只有一个职责，并对应一个讲解它的步骤。语料隐含的放置规则：始终生效的行为放在核心提示词；关于本次会话的事实放在注入的环境块；某个工具的用法放在该工具的说明里；冗长且偶尔用到的流程放在技能里；每次都必须发生的事情放在代码里（闸门、循环预算、钩子）；原始输出不该进入主上下文的工作交给子智能体。",
        ),
        how: [
          t("Copy harness/template/ as the start of your agent, and keep runtime/, lint/, evals/ and ops/ beside it.", "把 harness/template/ 复制过来作为你的智能体的起点，并把 runtime/、lint/、evals/ 和 ops/ 放在旁边。"),
          t("Before writing anything new, decide where it goes with the placement rule. If you cannot decide, it is probably a skill.", "写任何新内容之前，先用放置规则决定它该放在哪里。如果拿不定主意，它多半应该是一个技能。"),
          t("Keep the .gitignore: run outputs stay on the machine that ran them, and only summaries are committed.", "保留 .gitignore：运行输出留在运行它的机器上，只提交汇总结果。"),
          t("Run python3 harness/check.py. It compiles, parses, tests and lints the whole tree.", "运行 python3 harness/check.py。它会编译、解析、测试并检查整个目录树。"),
        ],
        files: [K + "README.md", K + ".gitignore"],
        interpret: [
          t("If most of your words are in the core prompt, you have a monolith. Step [[experiment]] measures whether that costs you anything on your model; the corpus trend says it usually does once skills grow.", "如果你的大部分文字都在核心提示词里，那就是一个单体结构。第 [[experiment]] 步会测量这在你的模型上是否有代价；语料的趋势表明，一旦技能增多，通常是有代价的。"),
          t("If a rule appears in two files, one copy will drift. Keep each rule in one place and point to it from the other.", "如果同一条规则出现在两个文件里，其中一份迟早会走样。每条规则只放在一个地方，其他地方指向它。"),
        ],
        trouble: [
          { s: t("Every new behavior lands in the system prompt", "每个新行为都被塞进系统提示词"), c: t("It is the easiest file to edit.", "因为它是最容易改的文件。"), f: t("Ask the placement question in review: is this needed on every turn? If not, it is a skill or a tool description.", "在评审时问放置问题：每一轮都需要它吗？如果不是，它就该是技能或工具说明。") },
          { s: t("The same guidance is rewritten for each model", "同样的指导为每个模型各写一遍"), c: t("The prompt was forked per model.", "提示词按模型分叉了。"), f: t("Keep one core.md and let assemble.py render it per family (step [[prompt]]).", "只保留一份 core.md，让 assemble.py 按系列渲染（第 [[prompt]] 步）。") },
        ],
        done: t("The tree exists, each folder's job is clear from README.md, and check.py passes on it.", "目录树已建好，README.md 说明了每个文件夹的职责，并且 check.py 通过。"),
        scale: [
          t("Many agents: share runtime/, lint/, evals/report.py and ops/ as one package; each agent keeps its own contract, template and cases.", "智能体增多时：把 runtime/、lint/、evals/report.py 和 ops/ 作为一个共享包；每个智能体保留自己的契约、模板和用例。"),
          t("Many tools: the skill folder format (name and description frontmatter plus a body) is shared across vendors, so one skill can serve Claude Code, Codex and your own harness.", "工具增多时：技能文件夹格式（name 和 description frontmatter 加正文）在各厂商之间通用，所以一个技能可以同时服务 Claude Code、Codex 和你自己的框架。"),
        ],
        challenge: [
          { q: t("Is this over-engineered for one agent?", "对一个智能体来说，这是不是过度设计了？"), a: t("The kit is about thirty small files. The alternative is the same decisions made implicitly inside one prompt, with no way to test any one of them alone.", "这个工具包大约是三十个小文件。另一种做法是把同样的决定都隐含在一段提示词里，而且没法单独测试其中任何一个。") },
        ],
        models: {
          generic: t("The layout is the same for every model. What differs is rendering (step [[prompt]]) and call settings (step [[model]]).", "目录结构对每个模型都一样。不同的是渲染方式（第 [[prompt]] 步）和调用参数（第 [[model]] 步）。"),
          claude: t("Claude Code reads CLAUDE.md, .claude/skills/<name>/SKILL.md and .claude/agents/*.md; the same skill format works in your own harness and in the Agent SDK.", "Claude Code 读取 CLAUDE.md、.claude/skills/<name>/SKILL.md 和 .claude/agents/*.md；同样的技能格式在你自己的框架和 Agent SDK 中都能用。"),
          gpt: t("Codex reads AGENTS.md from its global folder and from each directory between the project root and the working directory, closer files overriding earlier ones, up to 32 KiB by default.", "Codex 从全局文件夹以及从项目根目录到当前工作目录之间的每个目录读取 AGENTS.md，越近的文件优先级越高，默认最多读取 32 KiB。"),
          gemini: t("Gemini CLI reads GEMINI.md globally, from workspace directories and just in time from subdirectories; context.fileName can add AGENTS.md so one file serves both tools.", "Gemini CLI 读取全局的 GEMINI.md、工作区目录中的 GEMINI.md，并在用到子目录时即时读取；通过 context.fileName 可以加入 AGENTS.md，让一个文件同时服务两个工具。"),
          qwen: t("For local models the layout matters more, not less: the always-loaded part must stay small (about 4k tokens in families.yml), so procedures have to live in skills.", "对本地模型来说，目录结构更重要而不是更不重要：常驻部分必须保持很小（families.yml 中约 4k token），所以流程必须放在技能里。"),
        },
      },
      {
        id: "prompt",
        title: t("Write the system prompt once, render it per model", "系统提示词只写一份，按模型渲染"),
        local: t("template/prompts/core.md (the content), runtime/assemble.py (the renderer), lint/ (the checks).", "template/prompts/core.md（内容）、runtime/assemble.py（渲染器）、lint/（检查）。"),
        links: ["harness.compose"],
        after: ["layout", "model"],
        why: t(
          "Two findings decide how to write it. First, the vendors changed style the same way across generations. In the measured Claude chat prompts, capitalized commands per thousand words of prose fell from 3.41 (Sonnet 4.5) to 1.01 (Opus 5.5) while reasons (\"because\") per 10 KB rose from 0.27 (Sonnet 3.7) to 1.39; Codex went from 1.17 to 0.26 capitalized commands per thousand words. Rules became decisions with reasons. Second, the right markup differs by vendor: Anthropic uses XML tags, OpenAI recommends Markdown sections with XML for documents, Google says pick one and stay consistent. Writing the content once and rendering it per family gives you both, and makes step [[experiment]] a fair test.",
          "有两个发现决定了怎么写。第一，各厂商在代际之间以同样的方式改变了风格。在测量过的 Claude 聊天提示词中，正文每千词的大写命令从 3.41（Sonnet 4.5）降到 1.01（Opus 5.5），而每 10 KB 中的理由（“because”）从 0.27（Sonnet 3.7）升到 1.39；Codex 的每千词大写命令从 1.17 降到 0.26。规则变成了附带理由的决策。第二，合适的标记方式因厂商而异：Anthropic 用 XML 标签，OpenAI 推荐用 Markdown 分节、文档用 XML，Google 说选一种并保持一致。内容只写一份、按系列渲染，两者兼得，也让第 [[experiment]] 步成为公平的测试。",
        ),
        what: t(
          "core.md has eight sections (identity, priorities, work, asking, writes, answer, skills, environment). Every rule line carries the rule, its reason and a capitalized form: \"- rule | why: reason | caps: FORM\". assemble.py renders XML or Markdown; rules with reasons, capitals only, or bare; the date first or last; skills as an index or inline; tools in OpenAI, Anthropic or Gemini format; then checks the token budget. harness_lint.py and rules.json check the rendered prompt: budget, emphasis density, share of rules with reasons, identity line, date, untrusted-data rule, family-specific items (step-by-step on reasoning models, Qwen soft switches, mixed markup), hand-written tool formats, unfilled placeholders and secrets. The page's checker below runs the same rules in your browser.",
          "core.md 有八个小节（identity、priorities、work、asking、writes、answer、skills、environment）。每条规则行都包含规则、理由和大写形式：“- 规则 | why: 理由 | caps: 大写形式”。assemble.py 可以渲染成 XML 或 Markdown；规则带理由、只用大写或去掉理由；日期放在开头或结尾；技能以索引或全文内联；工具输出为 OpenAI、Anthropic 或 Gemini 格式；然后检查 token 预算。harness_lint.py 和 rules.json 检查渲染后的提示词：预算、强调词密度、带理由规则的比例、身份句、日期、不可信数据规则、特定系列的问题（对推理模型要求逐步思考、Qwen 软开关、混用标记）、手写的工具格式、未填充的占位符和机密信息。本页下方的检查器在你的浏览器中运行同一套规则。",
        ),
        how: [
          t("Write your agent's content in core.md: identity first (one sentence of role, one of context), then priorities in order, with the rule that the earlier one wins.", "在 core.md 中写你的智能体内容：先写身份（一句角色、一句背景），再按顺序写优先级，并说明靠前的优先。"),
          t("Give every rule a reason in one clause: what goes wrong without it. If you cannot write the reason, delete the rule.", "给每条规则用一个分句写上理由：没有它会出什么问题。如果写不出理由，就删掉这条规则。"),
          t("Render for your family: python3 harness/runtime/assemble.py --family <id>. Read the output as the model will.", "按你的系列渲染：python3 harness/runtime/assemble.py --family <id>。像模型那样读一遍输出。"),
          t("Lint it: python3 harness/lint/harness_lint.py harness/template --family <id>. Fix errors, and read each warning's reason before you decide.", "检查它：python3 harness/lint/harness_lint.py harness/template --family <id>。修复错误，并在决定之前读一读每条警告的理由。"),
          t("Keep capitals for the two or three rules whose failure cannot be undone. The linter allows about four capitalized commands per thousand words.", "只为两三条一旦出错就无法挽回的规则保留大写。检查器允许每千词大约四个大写命令。"),
        ],
        files: [K + "template/prompts/core.md", K + "runtime/assemble.py", K + "lint/harness_lint.py", K + "lint/rules.json"],
        interpret: [
          t("\"about 1580 tokens of prompt and tools, budget 4000\" leaves room to grow. Over budget, move procedures into skills before you cut rules.", "“about 1580 tokens of prompt and tools, budget 4000” 说明还有增长空间。超出预算时，先把流程移到技能里，再考虑删规则。"),
          t("A sys-reasons warning means fewer than 30% of rules carry a reason. It is the most common finding in real prompts.", "sys-reasons 警告表示带理由的规则不到 30%。这是真实提示词中最常见的问题。"),
          t("The linter encodes the corpus and vendor consensus, not proof for your model. Step [[experiment]] is where you find out: if capitals win on your model by more than the noise floor, keep them and write down why.", "检查器编码的是语料和厂商的共识，而不是针对你的模型的证明。第 [[experiment]] 步才是检验的地方：如果在你的模型上大写规则的优势超过了噪声下限，就保留它并写下原因。"),
        ],
        trouble: [
          { s: t("The model applies a rule far beyond its intent (refuses harmless requests, asks too often)", "模型把规则用得远超本意（拒绝无害请求、问得太多）"), c: t("The rule is absolute and has no reason, so the model cannot tell where it stops.", "规则是绝对的且没有理由，模型无法判断它的边界在哪里。"), f: t("Add the reason and the exception path, and remove the capitals. Anthropic's guide names aggressive wording as a cause of over-triggering.", "补上理由和例外处理方式，去掉大写。Anthropic 的指南指出，措辞过于强硬会导致过度触发。") },
          { s: t("Rules late in a long prompt are ignored", "长提示词后半部分的规则被忽略"), c: t("On small context windows the server cuts the start; on long prompts, instructions far from the question get less weight.", "在小上下文窗口上，服务器会截掉开头；在长提示词中，离问题较远的指令权重较低。"), f: t("Check the probe's context result first. For Claude and Gemini, put long documents first and the question last, as their guides advise.", "先检查探测的上下文结果。对 Claude 和 Gemini，按它们指南的建议，把长文档放前面、问题放最后。") },
          { s: t("Behavior changes after a harmless rewording", "一次无害的改写后行为变了"), c: t("Content was forked per model or per variant.", "内容按模型或按变体分叉了。"), f: t("Edit core.md only, and render everything from it.", "只修改 core.md，所有内容都从它渲染。") },
        ],
        done: t("The rendered prompt for your family lints with no errors and no unexplained warnings, fits the family budget, and every rule has a reason.", "为你的系列渲染的提示词检查后没有错误，也没有无法解释的警告，符合该系列的预算，并且每条规则都有理由。"),
        scale: [
          t("More rules: when a section passes about a screen, it is a procedure. Move it to a skill and leave one line in the core saying when to load it.", "规则增多时：当一个小节超过约一屏，它就是一个流程了。把它移到技能里，在核心提示词中只留一行说明何时加载。"),
          t("More surfaces: per-surface blocks (chat, CLI, background) are separate sections chosen at assembly, the way Claude Code swaps blocks for its headless and cloud sessions.", "使用场景增多时：按场景区分的块（聊天、命令行、后台）作为独立小节在拼装时选择，就像 Claude Code 为无界面会话和云端会话替换不同的块。"),
        ],
        challenge: [
          { q: t("Why not give each model its own hand-tuned prompt?", "为什么不给每个模型一份手工调优的提示词？"), a: t("You can, after the experiment shows a structural difference worth the upkeep. Until then a fork doubles every change and makes results across models impossible to compare.", "可以，但要等实验证明有值得维护的结构差异之后。在那之前，分叉会让每次改动翻倍，也让不同模型之间的结果无法比较。") },
          { q: t("Is \"because\" really better than \"MUST\", or is that taste?", "“because” 真的比 “MUST” 好，还是只是个人偏好？"), a: t("The vendors' own prompts moved that way across generations, and Anthropic's guide gives the reason: newer models follow instructions precisely, and a stated reason lets them generalize correctly. It is still a hypothesis for your model; the caps-rules and bare-rules variants in step [[experiment]] test it.", "各厂商自己的提示词在代际之间就是这样变化的，Anthropic 的指南也给出了理由：较新的模型会精确遵循指令，而说明理由能让它们正确地推广。但对你的模型来说这仍是一个假设；第 [[experiment]] 步中的 caps-rules 和 bare-rules 变体会检验它。") },
        ],
        models: {
          generic: t("Markdown sections, a reason on every rule, the date at the top. A small prompt for small models, with procedures in skills.", "用 Markdown 分节，每条规则带理由，日期放在开头。小模型用小提示词，流程放在技能里。"),
          claude: t("XML section tags with descriptive snake_case names, identity and values first, tools last, per-user state in the user turn: the order Anthropic's own prompts have used since 4.6. Prefill is not supported on 4.6 and later. Prefer \"Use this tool when...\" to \"CRITICAL: You MUST use this tool\".", "使用带描述性 snake_case 名称的 XML 节标签，身份和价值观在前，工具在后，每个用户的状态放在用户消息里：这是 Anthropic 自己的提示词从 4.6 起一直使用的顺序。4.6 及之后的版本不支持预填充。用 “Use this tool when...” 代替 “CRITICAL: You MUST use this tool”。"),
          gpt: t("A developer message with Markdown sections in the order Identity, Instructions, Examples, Context. Do not ask reasoning models to think step by step. Put \"Formatting re-enabled\" first if you want Markdown output from a reasoning model. Repeated ask-first rules cause needless pauses on GPT-5.6; state one autonomy policy.", "使用开发者消息，按 Identity、Instructions、Examples、Context 的顺序用 Markdown 分节。不要要求推理模型逐步思考。如果希望推理模型输出 Markdown，在开头写上 “Formatting re-enabled”。在 GPT-5.6 上，反复强调先问再做会导致不必要的停顿；只写一条自主策略。"),
          gemini: t("XML-style tags or Markdown, one format per prompt. Role, constraints and output format first; with long context, the context first and the instructions at the end. Google's 3.5 notes say older prompt-engineering techniques can cause over-analysis. Give step and retry budgets.", "使用 XML 风格标签或 Markdown，每个提示词只用一种格式。角色、约束和输出格式放在前面；上下文很长时，先放上下文，指令放在最后。Google 的 3.5 说明指出，旧的提示词工程技巧可能导致过度分析。给出步数和重试预算。"),
          grok: t("Safety and precedence first, then identity, then tools: every Grok prompt in the corpus has that order. xAI's prompts use almost no capitalized commands (no MUST in any 4.x model file); emphasis comes from placement.", "安全和优先级在前，然后是身份，最后是工具：语料中每个 Grok 提示词都是这个顺序。xAI 的提示词几乎不用大写命令（4.x 模型文件中一个 MUST 都没有）；强调靠位置。"),
          qwen: t("Short and concrete. Alibaba's own hosted Qwen prompts in the corpus are a date line plus tool schemas. Do not use /think or /no_think on Qwen 3.6; use enable_thinking. Write the prompt in English even for Chinese users; every Chinese vendor in the corpus does.", "简短而具体。语料中阿里巴巴自己托管的 Qwen 提示词只有一行日期加工具 schema。在 Qwen 3.6 上不要用 /think 或 /no_think，改用 enable_thinking。即使面向中文用户，提示词也用英文写；语料中每家中国厂商都是这样做的。"),
          deepseek: t("Minimal. The hosted DeepSeek prompt in the corpus is 438 bytes: a date, a location and one tool. Keep the system prompt short and let the tool descriptions carry the usage rules.", "极简。语料中托管版 DeepSeek 的提示词只有 438 字节：一个日期、一个地点和一个工具。系统提示词保持简短，让工具说明承载用法规则。"),
          kimi: t("Kimi 3's prompt in the corpus is calm and spends its length on harness protocol, with trust labels marking injected context as an active directive or passive background. One-line usage notes per tool work well (the Kimi 2.6 style).", "语料中 Kimi 3 的提示词语气平和，篇幅主要花在框架协议上，并用信任标签把注入的上下文标为主动指令或被动背景。每个工具配一行用法说明效果很好（Kimi 2.6 的风格）。"),
          mistral: t("Mistral's guide asks for role and task first, Markdown or XML tags, decision trees instead of contradictory rules, and objective criteria instead of vague words. Some templates attach the system prompt to the last user message, so keep it self-contained.", "Mistral 的指南要求先写角色和任务，使用 Markdown 或 XML 标签，用决策树代替相互矛盾的规则，用客观标准代替模糊的词。有些模板会把系统提示词附加到最后一条用户消息上，所以要让它自成一体。"),
          llama: t("Keep it short; the family budget is 3k tokens. Tool definitions travel through the template. Test positive instructions against prohibitions on your build, since small models often follow \"do X\" better than \"never do Y\".", "保持简短；该系列的预算是 3k token。工具定义通过模板传递。在你的版本上对比测试正面指令和禁止性指令，因为小模型往往更能遵循“做 X”而不是“绝不做 Y”。"),
        },
      },
      {
        id: "tools",
        title: t("Write the tools and their descriptions", "编写工具及其说明"),
        local: t("template/tools/tools.json: five tools in the OpenAI function format, with descriptions that say how, when, and what errors mean.", "template/tools/tools.json：五个 OpenAI 函数格式的工具，说明中写清怎么用、何时用，以及错误代表什么。"),
        links: ["tools-mcp.design", "tools-mcp.tools"],
        after: ["contract"],
        why: t(
          "The model sees a tool only through its name, description and schema. Anthropic calls the description by far the most important factor in tool performance and asks for three to four sentences. In the corpus, a tool's policy lives in its description: Claude Code's git procedure sits in the Bash tool, and Codex writes a comment per parameter that doubles as a rule. Twelve coding harnesses converge on the same primitives: dedicated read and search tools instead of shell, exact-string replacement for edits, and read-before-edit enforced by the tool.",
          "模型只能通过名称、说明和 schema 看到一个工具。Anthropic 认为工具说明是影响工具表现最重要的因素，并要求写三到四句话。在语料中，工具的使用策略就写在它的说明里：Claude Code 的 git 流程写在 Bash 工具中，Codex 为每个参数写一条注释，同时充当规则。十二个编码框架都收敛到相同的基本做法：用专门的读取和搜索工具代替 shell，用精确字符串替换来编辑，并由工具强制要求先读后改。",
        ),
        what: t(
          "tools.json: search_expenses (no notes; sums come from results), get_expense (the note is untrusted; not_found is an answer), load_skill (load before answering a policy question), flag_expense (a proposal; needs_confirmation means ask) and send_email, marked x_eval_only: a honeypot that exists only in eval runs, so the deny and injection cases can see an attempt. Production builds drop it. Schemas use enums, patterns and additionalProperties false, so invalid states cannot be expressed.",
          "tools.json 包含：search_expenses（不返回备注；合计来自结果）、get_expense（备注不可信；not_found 本身就是答案）、load_skill（回答政策问题前先加载）、flag_expense（只是提议；needs_confirmation 表示要先询问），以及标记为 x_eval_only 的 send_email：一个只在评估运行中存在的诱饵，让拒绝类和注入类用例能看到模型是否尝试调用。生产构建会去掉它。schema 使用枚举、正则模式和 additionalProperties false，让非法状态无法被表达。",
        ),
        how: [
          t("Start from the job: list the questions the agent must answer and the one action each needs. Merge tools that are always called together.", "从职责出发：列出智能体必须回答的问题，以及每个问题需要的那一个动作。把总是一起调用的工具合并。"),
          t("For each tool write what it does, when to use it instead of its neighbour, what it does not return, and what an empty or error result means.", "为每个工具写清：它做什么、什么时候该用它而不是相近的工具、它不返回什么、空结果或错误结果意味着什么。"),
          t("Make arguments hard to get wrong: enums for categories, patterns for ids, required fields only where needed. Let code fill anything the model need not choose.", "让参数难以出错：类别用枚举，id 用正则模式，只在必要时设必填字段。凡是模型不必选择的，交给代码填写。"),
          t("Return only the fields the next step needs, with stable ids. Large results are paid for on every later turn.", "只返回下一步需要的字段，并使用稳定的 id。大结果在之后每一轮都要付出代价。"),
          t("Lint: python3 harness/lint/harness_lint.py harness/template/tools/tools.json --kind tools.", "检查：python3 harness/lint/harness_lint.py harness/template/tools/tools.json --kind tools。"),
        ],
        files: [K + "template/tools/tools.json"],
        interpret: [
          t("A tools-description warning lists the tool names to fix. A one-line description is the usual cause of wrong-tool-path failures in step [[experiment]].", "tools-description 警告会列出需要修改的工具名。只有一行的说明，通常就是第 [[experiment]] 步中 wrong-tool-path 失败的原因。"),
          t("If two tools share most of their description, the model will confuse them. Say in each which question it answers that the other does not.", "如果两个工具的说明大部分相同，模型就会混淆它们。在每个工具的说明里写清它能回答、另一个不能回答的问题。"),
        ],
        trouble: [
          { s: t("The model invents arguments, such as a category that does not exist", "模型编造参数，比如一个不存在的类别"), c: t("A free-text parameter.", "参数是自由文本。"), f: t("Use an enum, and a pattern for ids, so the server or your loop rejects bad values with an error the model can correct.", "改用枚举，id 用正则模式，这样服务器或你的循环会以模型能纠正的错误拒绝非法值。") },
          { s: t("Answers repeat raw ids and JSON", "回答中重复原始 id 和 JSON"), c: t("The tool returns internal fields, and the model repeats what it sees.", "工具返回了内部字段，模型就照搬它看到的内容。"), f: t("Return names and amounts; leave internal fields out unless the user needs them.", "返回名称和金额；除非用户需要，否则不要返回内部字段。") },
          { s: t("The tool count passes 20 and selection gets worse", "工具数量超过 20 个，选择准确度下降"), c: t("Every integration added resident tools.", "每接入一个集成就增加了一批常驻工具。"), f: t("Keep the common ones resident and load the rest through a search tool or a skill, as every corpus harness with hundreds of tools does.", "常用工具保持常驻，其余的通过搜索工具或技能加载，语料中每个拥有数百个工具的框架都是这样做的。") },
        ],
        done: t("Every tool has a tier in contract.yml, a description of about three sentences or more, an object schema, and the tools lint has no findings.", "每个工具在 contract.yml 中都有级别，说明大约三句话或更多，参数是对象 schema，工具检查没有发现问题。"),
        scale: [
          t("Many tools: namespace names by service (expenses_search), group them, and load groups on demand. OpenAI's guide says fewer than 20 per turn; xAI accepts up to 350, but accuracy is the limit, not the API.", "工具很多时：按服务给名称加命名空间（expenses_search），分组并按需加载。OpenAI 的指南建议每轮少于 20 个；xAI 最多接受 350 个，但限制来自准确度，而不是 API。"),
          t("MCP: an MCP server's tool descriptions enter your prompt verbatim. Audit them; in Anthropic's own prompts, third-party tool descriptions are where capitalized commands came back.", "MCP：MCP 服务器的工具说明会原样进入你的提示词。要审查它们；在 Anthropic 自己的提示词中，大写命令正是通过第三方工具说明回来的。"),
        ],
        challenge: [
          { q: t("Why declare a tool the agent may never use?", "为什么要声明一个智能体永远不能用的工具？"), a: t("Only in eval builds, as a honeypot. A deny rule you never tempt is a rule you never tested. Production builds drop it (assemble.tools with production true).", "只在评估构建中作为诱饵使用。一条从未被诱惑过的拒绝规则，就是一条从未被测试过的规则。生产构建会去掉它（assemble.tools 设置 production 为 true）。") },
        ],
        models: {
          generic: t("The OpenAI function format is accepted by Ollama, vLLM, OpenAI, xAI, DeepSeek, Kimi, Mistral and Qwen servers; assemble.py converts it to the Anthropic and Gemini shapes.", "OpenAI 函数格式被 Ollama、vLLM、OpenAI、xAI、DeepSeek、Kimi、Mistral 和 Qwen 的服务器接受；assemble.py 会把它转换成 Anthropic 和 Gemini 的格式。"),
          claude: t("input_schema instead of parameters; strict true guarantees schema-valid input. Do not put reasoning-shaped parameters in tools; the guide says to ask for an explanation, not reasoning. input_examples can help, at 20 to 50 tokens each.", "用 input_schema 代替 parameters；strict 设为 true 能保证输入符合 schema。不要在工具里放推理形式的参数；指南建议要求的是解释，而不是推理过程。input_examples 有帮助，每个约 20 到 50 个 token。"),
          gpt: t("strict true with additionalProperties false. Namespaces with short descriptions, detailed function descriptions, and tool search for deferred tools. The guide notes examples may hurt reasoning models. The Codex prompts in the corpus declare tools as TypeScript signatures with a comment per parameter.", "strict 设为 true，并配合 additionalProperties false。命名空间的说明要短，函数说明要详细，延迟加载的工具用工具搜索。指南指出示例可能对推理模型有害。语料中的 Codex 提示词用 TypeScript 签名声明工具，每个参数配一条注释。"),
          gemini: t("tool_choice validated enforces schema adherence. Return exactly one function response per call, with matching id and name. Google's own prompts also declare a response schema, and say plainly that undeclared tools do not exist.", "tool_choice 设为 validated 可强制遵守 schema。每次调用只返回一个函数响应，且 id 和名称必须一致。Google 自己的提示词还会声明响应 schema，并明确说明未声明的工具不存在。"),
          grok: t("The parameters root must be an object. No strict mode is documented, so validate arguments in the loop.", "parameters 的根必须是对象。文档中没有 strict 模式，所以要在循环中校验参数。"),
          qwen: t("Use native tool calling through the chat template (hermes on Qwen 3, qwen3_coder on 3.6). Do not use ReAct-style stopwords with reasoning models; they can appear inside the thinking. Validate calls and fall back when one is malformed.", "通过聊天模板使用原生工具调用（Qwen 3 用 hermes，3.6 用 qwen3_coder）。不要对推理模型使用 ReAct 风格的停止词，它们可能出现在思考内容中。校验每次调用，格式错误时要有兜底处理。"),
          kimi: t("Names may use letters, digits, hyphens and underscores only. Large tool sets can be loaded dynamically by adding a tool definition in a system message mid-conversation.", "名称只能使用字母、数字、连字符和下划线。大型工具集可以在对话中途通过在系统消息里加入工具定义来动态加载。"),
          mistral: t("Some versions require short alphanumeric tool call ids, and reusing OpenAI-style ids can break a harness. This is general knowledge of Mistral's function-calling examples; the corpus says nothing about it, so check the model card.", "有些版本要求工具调用 id 是短的字母数字串，沿用 OpenAI 风格的 id 可能导致框架出错。这来自对 Mistral 函数调用示例的一般了解；语料中没有相关内容，请查看模型卡。"),
          llama: t("Tool definitions go in the system message as JSON, and calls come back pythonic or as a JSON list. The Llama 4 page's own JSON example has a trailing comma, so validate parsed output.", "工具定义以 JSON 形式放在系统消息中，调用以 Python 风格或 JSON 列表返回。Llama 4 页面自己的 JSON 示例末尾有多余的逗号，所以要校验解析结果。"),
        },
      },
      {
        id: "loop",
        title: t("Write the agent loop", "编写智能体循环"),
        local: t("runtime/loop.py: a model call, gated tool calls, raw replay, budgets and loop detection.", "runtime/loop.py：模型调用、经过闸门的工具调用、原样回传、预算和死循环检测。"),
        links: ["harness.flat", "harness.budget", "harness.run"],
        after: ["tools", "model"],
        why: t(
          "The loop is the part of the harness that is code, so it is where reliability comes from. Five failures the corpus prompts warn about can be prevented here once, instead of discouraged in every prompt: dropped reasoning fields (an API error on DeepSeek, lower quality elsewhere), runs with no end, malformed arguments crashing the run, the same call repeated forever, and untrusted content reaching the model unlabeled.",
          "循环是框架中属于代码的部分，所以可靠性就从这里来。语料提示词中警告的五种问题，可以在这里一次性预防，而不是在每个提示词里劝阻：推理字段丢失（在 DeepSeek 上是 API 错误，在别处是质量下降）、没有尽头的运行、格式错误的参数导致运行崩溃、同一调用无限重复，以及未加标记的不可信内容到达模型。",
        ),
        what: t(
          "loop.run takes any chat function and an executor. It appends the raw assistant message unchanged, runs each tool call through the gate, returns invalid JSON arguments as an error the model can fix (and counts them), answers a third identical call with repeated_call, stops at max_steps or max_tool_calls with that stop reason, and records every call with the gate's decision. openai_chat talks to any OpenAI-compatible endpoint using only the standard library, and keeps the server's error text when a call fails. adapters.py adds the Anthropic Messages API and the OpenAI Responses API, keeping each provider's raw output (thinking blocks with signatures, reasoning items) on the message so it is sent back unchanged; its translation is unit-tested, and it has not yet run against the live APIs. The optional stopcheck and verify checks are steps [[stop]] and [[verify]].",
          "loop.run 接收任意聊天函数和一个执行器。它原样追加助手的原始消息，让每次工具调用都经过闸门，把非法 JSON 参数作为模型可以修正的错误返回（并计数），对第三次相同的调用返回 repeated_call，在达到 max_steps 或 max_tool_calls 时以相应原因停止，并记录每次调用及闸门的决定。openai_chat 只用标准库就能访问任何兼容 OpenAI 的接口，调用失败时保留服务器返回的错误文本。adapters.py 增加了 Anthropic Messages API 和 OpenAI Responses API，把各厂商的原始输出（带签名的思考块、推理条目）保存在消息上，以便原样回传；它的格式转换有单元测试，但还没有在真实 API 上运行过。可选的 stopcheck 和 verify 检查分别是第 [[stop]] 步和第 [[verify]] 步。",
        ),
        how: [
          t("Read loop.py end to end; it is short on purpose. Your production loop can be a framework, but it must keep these five behaviors.", "从头到尾读一遍 loop.py；它刻意写得很短。你的生产循环可以用框架实现，但必须保留这五种行为。"),
          t("Wrap your executor with gate.guarded (step [[gate]]) so no tool runs without a decision.", "用 gate.guarded（第 [[gate]] 步）包装你的执行器，确保没有任何工具在没有决定的情况下运行。"),
          t("Set max_steps and max_tool_calls from the budgets in contract.yml.", "根据 contract.yml 中的预算设定 max_steps 和 max_tool_calls。"),
          t("Run the unit tests: they replay a reasoning field, feed malformed arguments, repeat a call three times and exhaust the budget.", "运行单元测试：它们会回传推理字段、输入格式错误的参数、重复同一调用三次，并耗尽预算。"),
          t("Run the oracle baseline (step [[graders]]) to watch the loop drive complete tasks.", "运行理想基线（第 [[graders]] 步），看循环如何完整地驱动任务。"),
        ],
        files: [K + "runtime/loop.py", K + "runtime/adapters.py"],
        interpret: [
          t("stop max_steps on a case means no final answer within budget. Look at the last three calls: repetition is a loop; varied calls are a hard task or a missing tool.", "某个用例的 stop 为 max_steps，表示在预算内没有给出最终回答。看最后三次调用：重复的是死循环；各不相同的是任务太难或缺少工具。"),
          t("malformed above zero in a run is a template or schema problem before it is a prompt problem (step [[model]]).", "一次运行中 malformed 大于零，首先是模板或 schema 的问题，然后才是提示词的问题（第 [[model]] 步）。"),
        ],
        trouble: [
          { s: t("The model call after a tool call errors", "工具调用之后的那次模型调用报错"), c: t("The history was rebuilt from parsed parts and lost a field.", "历史记录是用解析出的片段重新拼装的，丢了一个字段。"), f: t("Append the server's message object exactly as received, and strip nothing.", "原样追加服务器返回的消息对象，不要删减任何内容。") },
          { s: t("A run spins on the same search", "一次运行在同一个搜索上打转"), c: t("The tool result did not answer the question, so the model retries.", "工具结果没有回答问题，于是模型不断重试。"), f: t("The third identical call already returns repeated_call. Then make the tool result say why it was empty.", "第三次相同调用已经会返回 repeated_call。然后让工具结果说明为什么为空。") },
          { s: t("A framework hides the loop", "框架把循环藏起来了"), c: t("LangGraph, an Agents SDK or a vendor runtime owns the messages.", "LangGraph、某个 Agents SDK 或厂商运行时掌管着消息。"), f: t("Check the five behaviors in its docs or tests; the SDK module of the curriculum shows where each one lives.", "在它的文档或测试中逐一核对这五种行为；课程中的 SDK 模块展示了每种行为所在的位置。") },
        ],
        done: t("The loop tests pass, the oracle run completes every case with stop final, and your executor is wrapped by the gate.", "循环测试通过，理想基线运行的每个用例都以 stop final 结束，并且你的执行器已被闸门包装。"),
        scale: [
          t("Concurrency: one loop per task and many tasks in parallel; budgets are per task. Watch each provider's rate limits.", "并发：每个任务一个循环，多个任务并行；预算按任务计算。注意每个服务商的速率限制。"),
          t("Long tasks: add compaction (step [[memory]]) before raising max_steps past about 30, because long histories cost every turn.", "长任务：在把 max_steps 提高到约 30 以上之前，先加上上下文压缩（第 [[memory]] 步），因为长历史在每一轮都有代价。"),
        ],
        challenge: [
          { q: t("Why count repeated calls in code instead of telling the model not to repeat?", "为什么要用代码统计重复调用，而不是告诉模型不要重复？"), a: t("A model in a loop has already ignored that kind of instruction. Code detects the third repeat every time and gives the model a reason to change approach.", "陷入循环的模型已经忽视了这类指令。代码每次都能发现第三次重复，并给模型一个改变做法的理由。") },
        ],
        models: {
          generic: t("The raw-replay rule covers every family: store and send back the server's assistant message as received.", "原样回传的规则适用于所有系列：保存并回传服务器返回的助手消息原文。"),
          claude: t("Thinking blocks sit inside content with a signature. On the 5.5 generation, editing earlier messages or rebuilding system or tools invalidates later thinking: keep history append-only and put mid-conversation changes in system messages.", "思考块带着签名放在 content 中。在 5.5 代上，修改之前的消息或重建 system 和 tools 会使之后的思考失效：保持历史只追加，把对话中途的变更放进系统消息。"),
          gpt: t("With the Responses API, chain with previous_response_id or resend all output items; with store false, replay the encrypted reasoning items. Change effort mid-conversation with a configuration_update item to keep the cache.", "使用 Responses API 时，用 previous_response_id 串联，或重新发送所有输出项；store 为 false 时，回传加密的推理项。在对话中途修改推理强度时，用 configuration_update 项以保留缓存。"),
          gemini: t("In stateless mode, resend every thought signature exactly, even when switching models; the SDKs do this automatically.", "在无状态模式下，要精确地回传每个思考签名，即使切换模型也一样；SDK 会自动处理。"),
          deepseek: t("Append the full assistant message with reasoning_content and tool_calls, then the tool messages by tool_call_id. Missing reasoning_content returns 400.", "先追加包含 reasoning_content 和 tool_calls 的完整助手消息，再按 tool_call_id 追加工具消息。缺少 reasoning_content 会返回 400。"),
          qwen: t("Ollama streams thinking, content and tool_calls in separate chunks: accumulate all three and return them together before the tool results. The Ollama docs suggest telling the model it is in a loop.", "Ollama 会把 thinking、content 和 tool_calls 分块流式返回：把三者累积起来，在工具结果之前一起回传。Ollama 的文档建议告诉模型它正处在一个循环中。"),
          glm: t("Return reasoning_content unmodified and in order; editing it lowers quality and cache hits.", "按原顺序、不加修改地回传 reasoning_content；修改它会降低质量和缓存命中率。"),
          mistral: t("Always replay the full assistant message; stripping ThinkChunks significantly degrades quality.", "始终回传完整的助手消息；去掉 ThinkChunk 会显著降低质量。"),
        },
      },
    ],
  },
];
