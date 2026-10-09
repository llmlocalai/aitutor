import { t } from "@/lib/types";
import type { ModelProfile } from "./types";

/**
 * Model guide. Vendor facts come from the vendor pages listed in `docs`, read on 2026-10-09
 * (the research notes are not published; every fact here names its page). Corpus facts come from
 * the reported prompts at the listed paths. A starting profile is a hypothesis until step 16 runs.
 */
export const models: ModelProfile[] = [
  {
    id: "generic",
    label: "Any OpenAI-compatible model",
    kind: t("Any model served behind an OpenAI-compatible /chat/completions endpoint: Ollama, vLLM, llama.cpp, LM Studio or a hosted API.", "任何通过兼容 OpenAI 的 /chat/completions 接口提供服务的模型：Ollama、vLLM、llama.cpp、LM Studio 或托管 API。"),
    structure: t("Markdown sections, identity first, every rule with a reason, the date at the top.", "Markdown 分节，身份在前，每条规则带理由，日期放在开头。"),
    tools: t("OpenAI function format with JSON Schema parameters, an object at the root, enums and patterns where values are fixed.", "OpenAI 函数格式，参数用 JSON Schema，根为对象，固定取值处使用枚举和正则模式。"),
    reasoning: t("Whatever the server exposes; probe for extra fields in the assistant message and replay them unchanged.", "以服务器提供的为准；探测助手消息中的额外字段，并原样回传。"),
    sampling: t("Server defaults unless the model card says otherwise.", "除非模型卡另有说明，否则使用服务器默认值。"),
    context: t("Measure it with the probe; never assume the advertised window is the one the server uses.", "用探测工具测量；绝不假设服务器使用的就是宣传的窗口大小。"),
    profile: [
      t("Budget about 6,000 tokens for prompt plus tools.", "提示词加工具的预算约 6,000 token。"),
      t("Skills on demand; runtime checks on until the experiment says otherwise.", "技能按需加载；在实验得出不同结论之前，保持运行时检查开启。"),
      t("Run the control, minimal and runtime-checks variants first.", "先运行对照组、minimal 和 runtime-checks 变体。"),
    ],
    gotchas: [
      t("Tool support depends on the chat template, not the API shape.", "工具支持取决于聊天模板，而不是 API 的形式。"),
      t("A silently truncated prompt looks like a model that ignores rules.", "被悄悄截断的提示词，看起来就像一个不遵守规则的模型。"),
    ],
    evidence: [
      { path: "Pi/instructions.md", note: t("A minimum viable coding harness in under 3 KB: four tools and on-demand skills.", "一个不到 3 KB 的最小可用编码框架：四个工具加按需加载的技能。") },
    ],
    docs: [{ title: "Ollama tool calling", url: "https://docs.ollama.com/capabilities/tool-calling" }],
  },
  {
    id: "claude",
    label: "Anthropic Claude",
    kind: t("Hosted frontier models (Opus, Sonnet, Haiku, Fable 5.x) through the Claude API, the Agent SDK or Claude Code.", "通过 Claude API、Agent SDK 或 Claude Code 使用的托管前沿模型（Opus、Sonnet、Haiku、Fable 5.x）。"),
    structure: t("XML tags as section containers with descriptive names, nested where useful; identity and values first, tools last; long documents first and the question last. Explain why a rule exists; say what to do rather than what to avoid.", "用带描述性名称的 XML 标签作为节容器，必要时嵌套；身份和价值观在前，工具在后；长文档在前，问题在后。说明规则存在的理由；说明该做什么，而不是该避免什么。"),
    tools: t("name, description and input_schema; descriptions of three to four sentences are the biggest lever; strict true for schema-valid input; parallel calls on by default. tool_choice any or tool returns 400 on Opus 5.5, Sonnet 5.5 and Fable 5.1.", "使用 name、description 和 input_schema；三到四句话的说明是最大的杠杆；strict 设为 true 可保证输入符合 schema；并行调用默认开启。在 Opus 5.5、Sonnet 5.5 和 Fable 5.1 上，tool_choice 设为 any 或 tool 会返回 400。"),
    reasoning: t("Adaptive thinking with an effort level; budget_tokens returns 400 on 4.7 and later. Thinking is on by default or always on for the 5.x models. Return thinking blocks with their signatures unchanged.", "使用带 effort 档位的自适应思考；在 4.7 及之后的版本上 budget_tokens 会返回 400。5.x 模型默认开启或始终开启思考。原样回传带签名的思考块。"),
    sampling: t("No sampling guidance needed for agent work; control length with effort and instructions.", "智能体工作无需采样指导；用 effort 和指令控制长度。"),
    context: t("1M tokens by default on the 5.5 generation; server-side compaction (beta) and context editing for long runs; keep history append-only.", "5.5 代默认 1M token；长时间运行使用服务器端压缩（测试版）和上下文编辑；保持历史只追加。"),
    profile: [
      t("XML sections, rules with reasons, skills on demand, a budget of about 12,000 tokens.", "XML 分节，规则带理由，技能按需加载，预算约 12,000 token。"),
      t("No prefill (not supported on 4.6 and later); no forced tool choice on the 5.5 generation.", "不使用预填充（4.6 及以后不支持）；在 5.5 代上不强制工具调用。"),
      t("Test markdown and caps-rules first.", "先测试 markdown 和 caps-rules。"),
    ],
    gotchas: [
      t("Aggressive wording (CRITICAL, MUST) over-triggers tools on 4.5 and 4.6-era models.", "在 4.5 和 4.6 时代的模型上，强硬措辞（CRITICAL、MUST）会导致工具被过度触发。"),
      t("\"Can you suggest changes\" yields suggestions only: newer models follow instructions literally.", "“Can you suggest changes”只会得到建议：较新的模型会按字面执行指令。"),
      t("Opus 4.6 over-delegates to subagents; Opus 5 runs long and verifies well on its own.", "Opus 4.6 容易过度委派给子智能体；Opus 5 回答偏长，但自己就能很好地验证。"),
      t("Editing earlier messages or rebuilding system or tools invalidates later thinking on the 5.5 generation.", "在 5.5 代上，修改之前的消息或重建 system 和 tools 会使之后的思考失效。"),
    ],
    evidence: [
      { path: "Anthropic/claude-code/claude-code-opus-5.5.md", note: t("A behavior core of about 7 KB before the injected context, against about 28 KB in the Opus 4.6 version.", "在注入的上下文之前，行为核心约 7 KB，而 Opus 4.6 版本约为 28 KB。") },
      { path: "Anthropic/claude-code/claude-code-haiku-5.5.md", note: t("Adds an autonomy block the larger tiers do not get: the smaller model gets explicit guards against stopping early.", "加了一段较大档位没有的自主性说明：较小的模型得到了防止过早停止的明确约束。") },
      { path: "Anthropic/claude-code/skills/skill-creator/SKILL.md", note: t("The skill eval loop: with-skill and baseline runs, graded assertions, trigger tuning on a 60/40 split.", "技能评估循环：使用技能与基线的对比运行、带评分的断言、按 60/40 划分进行触发调优。") },
    ],
    docs: [
      { title: "Claude prompting best practices", url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices" },
      { title: "Define tools", url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools" },
      { title: "Agent Skills overview", url: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview" },
      { title: "Context windows", url: "https://platform.claude.com/docs/en/build-with-claude/context-windows" },
    ],
  },
  {
    id: "gpt",
    label: "OpenAI GPT-6 and GPT-5.x",
    kind: t("Hosted models (GPT-6 Astra, Sol, Luna; GPT-5.6) through the Responses API, the Agents SDK or Codex.", "通过 Responses API、Agents SDK 或 Codex 使用的托管模型（GPT-6 Astra、Sol、Luna；GPT-5.6）。"),
    structure: t("A developer message (the new system message) with Markdown sections: Identity, Instructions, Examples, Context; XML to delimit documents. High-level goals for reasoning models, explicit steps for non-reasoning ones. Never ask reasoning models to think step by step.", "使用开发者消息（新的系统消息），以 Markdown 分节：Identity、Instructions、Examples、Context；用 XML 分隔文档。对推理模型给出高层目标，对非推理模型给出明确步骤。绝不要求推理模型逐步思考。"),
    tools: t("Functions with strict true and additionalProperties false; fewer than 20 per turn; namespaces and tool search for the rest; reasoning items passed back with tool outputs. GPT-6 tool calling needs the Responses API.", "函数使用 strict true 和 additionalProperties false；每轮少于 20 个；其余通过命名空间和工具搜索加载；随工具输出回传推理项。GPT-6 的工具调用需要 Responses API。"),
    reasoning: t("reasoning.effort from none or low up to max depending on the model; text.verbosity for default length; change effort mid-thread with a configuration_update item.", "reasoning.effort 根据模型从 none 或 low 到 max；text.verbosity 控制默认长度；对话中途用 configuration_update 项修改推理强度。"),
    sampling: t("Remove temperature and top_p when reasoning is not none.", "推理不为 none 时，去掉 temperature 和 top_p。"),
    context: t("Persisted reasoning across turns by default on GPT-5.6; prompt caching rewards stable prefixes; compaction is supported.", "GPT-5.6 默认跨轮保留推理内容；提示词缓存鼓励稳定的前缀；支持上下文压缩。"),
    profile: [
      t("Markdown sections, rules with reasons, one compact autonomy policy, a budget of about 12,000 tokens.", "Markdown 分节，规则带理由，一条简洁的自主策略，预算约 12,000 token。"),
      t("A clear channel for progress and a self-contained final answer.", "清晰的进度通道，以及自成一体的最终回答。"),
      t("Test xml and runtime-checks first.", "先测试 xml 和 runtime-checks。"),
    ],
    gotchas: [
      t("Repeated ask-first rules cause needless pauses; Astra asks more clarifying questions and is more sensitive to conflicting AGENTS.md or skill guidance.", "反复强调先问再做会导致不必要的停顿；Astra 会问更多澄清问题，并且对 AGENTS.md 或技能中相互冲突的指导更敏感。"),
      t("Reasoning models avoid Markdown in the API unless the developer message starts with \"Formatting re-enabled\".", "除非开发者消息以 “Formatting re-enabled” 开头，否则推理模型在 API 中会避免使用 Markdown。"),
      t("The Evals platform goes read-only on October 31, 2026 and shuts down on November 30, 2026.", "Evals 平台将于 2026 年 10 月 31 日变为只读，并于 2026 年 11 月 30 日关闭。"),
      t("The guide warns apply_patch can report success on failure: verify edits.", "指南警告 apply_patch 可能在失败时仍报告成功：要核实编辑结果。"),
    ],
    evidence: [
      { path: "OpenAI/Codex/gpt-6-sol.md", note: t("About 0.3 capitalized commands per thousand words of prose, against 1.2 in the GPT-5 Codex CLI prompt.", "正文每千词约 0.3 个大写命令，而 GPT-5 Codex CLI 提示词约为 1.2 个。") },
      { path: "OpenAI/Codex/gpt-6-luna.md", note: t("The cheap tier is told not to add or run tests unless asked; Sol tests in proportion to risk.", "低成本档位被告知除非用户要求，否则不添加也不运行测试；Sol 按风险程度测试。") },
      { path: "OpenAI/dots/available-skills.md", note: t("The skill index the model sees: one line per skill, descriptions cut near 200 characters.", "模型看到的技能索引：每个技能一行，description 在 200 个字符左右被截断。") },
    ],
    docs: [
      { title: "Prompt engineering", url: "https://developers.openai.com/api/docs/guides/prompt-engineering" },
      { title: "Using GPT-6", url: "https://developers.openai.com/api/docs/guides/latest-model" },
      { title: "Function calling", url: "https://developers.openai.com/api/docs/guides/function-calling" },
      { title: "AGENTS.md for Codex", url: "https://learn.chatgpt.com/docs/agent-configuration/agents-md" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini 3.x",
    kind: t("Hosted models (Gemini 3.5 to 3.8 Flash, 3.1 Pro and others) through the Gemini API, Vertex AI or Gemini CLI.", "通过 Gemini API、Vertex AI 或 Gemini CLI 使用的托管模型（Gemini 3.5 到 3.8 Flash、3.1 Pro 等）。"),
    structure: t("XML-style tags or Markdown headings, one format per prompt; role, constraints and output format first; with long context, the context first and the instructions at the very end. Be precise and direct; older prompt-engineering techniques can cause over-analysis.", "使用 XML 风格标签或 Markdown 标题，每个提示词只用一种；角色、约束和输出格式在前；上下文很长时，先放上下文，指令放在最后。精确、直接；旧的提示词工程技巧可能导致过度分析。"),
    tools: t("Function declarations with type, name, description and parameters; tool_choice auto, any, none or validated; exactly one function response per call with matching id and name.", "函数声明包含 type、name、description 和 parameters；tool_choice 可为 auto、any、none 或 validated；每次调用只返回一个函数响应，且 id 和名称必须一致。"),
    reasoning: t("thinking_level replaces thinking_budget (sending both is a 400); default medium on 3.5 to 3.8 Flash, high on 3.1 Pro; minimal does not guarantee thinking is off. Resend thought signatures exactly in stateless mode.", "thinking_level 取代了 thinking_budget（两者同时发送会返回 400）；3.5 到 3.8 Flash 默认 medium，3.1 Pro 默认 high；minimal 并不保证关闭思考。在无状态模式下要精确回传思考签名。"),
    sampling: t("Keep temperature, top_p and top_k at the defaults; values below 1.0 can cause looping.", "temperature、top_p 和 top_k 保持默认；低于 1.0 的值可能导致循环。"),
    context: t("1M input on 3.5 Flash; context caching; thought tokens count against max_output_tokens.", "3.5 Flash 支持 1M 输入；支持上下文缓存；思考 token 计入 max_output_tokens。"),
    profile: [
      t("XML sections or Markdown (pick one), rules with reasons, a budget of about 10,000 tokens.", "XML 分节或 Markdown（二选一），规则带理由，预算约 10,000 token。"),
      t("Explicit step and retry budgets; a rule separating inquiries from directives if the agent should act.", "明确的步数和重试预算；如果智能体应该行动，加一条区分询问和指令的规则。"),
      t("Test markdown and date-last first.", "先测试 markdown 和 date-last。"),
    ],
    gotchas: [
      t("Mismatched function responses come back as an empty reply with finish reason STOP.", "函数响应不匹配时，会返回空回复且结束原因为 STOP。"),
      t("Gemini 3.5 Flash's default thinking dropped from high to medium; retest after upgrading.", "Gemini 3.5 Flash 的默认思考档位从 high 降到了 medium；升级后要重新测试。"),
      t("To reduce excess tool calls, lower the thinking level first, then add a tool-call budget.", "要减少过多的工具调用，先降低思考档位，再加上工具调用预算。"),
    ],
    evidence: [
      { path: "Google/gemini-cli.md", note: t("A named lifecycle (research, strategy, execution), an inquiry-versus-directive rule, and a cost model for context.", "一个命名的生命周期（研究、策略、执行）、一条区分询问和指令的规则，以及一个上下文成本模型。") },
      { path: "Google/gemini-3-pro.md", note: t("A step budget (four code steps), fix an error at most once, and undeclared tools stated not to exist.", "步数预算（四个代码步骤）、错误最多修一次，并明确说明未声明的工具不存在。") },
    ],
    docs: [
      { title: "Prompt design strategies", url: "https://ai.google.dev/gemini-api/docs/prompting-strategies" },
      { title: "Thinking", url: "https://ai.google.dev/gemini-api/docs/thinking" },
      { title: "What's new in Gemini 3.5 Flash", url: "https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5" },
      { title: "Gemini CLI GEMINI.md", url: "https://geminicli.com/docs/cli/gemini-md/" },
    ],
  },
  {
    id: "grok",
    label: "xAI Grok 4.x",
    kind: t("Hosted models (Grok 4.5 to 4.7, 4.20 multi-agent) through the xAI API, which accepts the OpenAI client.", "通过 xAI API 使用的托管模型（Grok 4.5 到 4.7、4.20 多智能体），该 API 兼容 OpenAI 客户端。"),
    structure: t("No xAI prompting guide was found. xAI's own prompts put policy and precedence first, then identity, then tools, and use almost no capitalized commands.", "没有找到 xAI 的提示词指南。xAI 自己的提示词把策略和优先级放在最前面，然后是身份，最后是工具，几乎不用大写命令。"),
    tools: t("OpenAI-style functions; the parameters root must be an object; parallel calls on by default; up to 350 tools; no strict mode documented.", "OpenAI 风格的函数；parameters 的根必须是对象；并行调用默认开启；最多 350 个工具；文档中没有 strict 模式。"),
    reasoning: t("reasoning_effort low, medium, high (default) or xhigh; reasoning cannot be disabled; return encrypted reasoning items unchanged in the Responses API.", "reasoning_effort 可为 low、medium、high（默认）或 xhigh；推理无法关闭；在 Responses API 中原样回传加密的推理项。"),
    sampling: t("presence and frequency penalties and stop return errors on reasoning models.", "在推理模型上，presence 和 frequency 惩罚以及 stop 会报错。"),
    context: t("Long-context guidance was not found on the pages read.", "所读页面中没有找到长上下文方面的指导。"),
    profile: [
      t("Markdown sections with policy first, rules with reasons, a budget of about 10,000 tokens.", "Markdown 分节，策略在前，规则带理由，预算约 10,000 token。"),
      t("Concrete banned phrases for writing style, a closed triage list for asking.", "写作风格上列出具体的禁用短语，提问方面使用封闭的分类清单。"),
      t("Test caps-rules and xml first.", "先测试 caps-rules 和 xml。"),
    ],
    gotchas: [
      t("On grok-4.20-multi-agent the effort setting chooses the number of agents, not the depth.", "在 grok-4.20-multi-agent 上，推理强度设置决定的是智能体数量，而不是思考深度。"),
      t("Subagents in the Grok CLI receive a compacted AGENTS.md; pass the rules they need inline.", "Grok CLI 中的子智能体收到的是压缩版的 AGENTS.md；要把所需规则直接写进任务说明。"),
    ],
    evidence: [
      { path: "xAI/grok-4.7.md", note: t("No MUST in the prose; emphasis by placement and bold.", "正文中没有 MUST；强调靠位置和加粗。") },
      { path: "xAI/grok-4.7-cli.md", note: t("A feedback tool with a failure taxonomy (overeager, stopped early, hallucinated, stuck in a loop) that works as an eval label set.", "一个带失败分类的反馈工具（过于积极、过早停止、幻觉、陷入循环），可以直接用作评估标签集。") },
    ],
    docs: [
      { title: "xAI function calling", url: "https://docs.x.ai/docs/guides/function-calling" },
      { title: "xAI reasoning", url: "https://docs.x.ai/docs/guides/reasoning" },
    ],
  },
  {
    id: "qwen",
    label: "Qwen 3 and 3.6",
    kind: t("Open-weight models run locally (Ollama, vLLM, SGLang) or hosted by Alibaba Cloud; mixture-of-experts builds such as 35B-A3B run well on one workstation.", "开放权重模型，可在本地运行（Ollama、vLLM、SGLang）或由阿里云托管；像 35B-A3B 这样的混合专家版本在一台工作站上就能运行得很好。"),
    structure: t("Short and concrete. Alibaba's own hosted prompts in the corpus are a date line plus tool schemas, written in English. Put the behavior your harness needs in a small prompt and the procedures in skills.", "简短而具体。语料中阿里巴巴自己托管的提示词只有一行日期加工具 schema，并且用英文写。把你的框架需要的行为写进一个小提示词，把流程放进技能。"),
    tools: t("Native tool calling through the chat template: the hermes format on Qwen 3, the qwen3_coder parser on 3.6 (vLLM and SGLang). Qwen-Agent is the reference implementation. No ReAct-style stopwords with reasoning models.", "通过聊天模板使用原生工具调用：Qwen 3 使用 hermes 格式，3.6 使用 qwen3_coder 解析器（vLLM 和 SGLang）。Qwen-Agent 是参考实现。不要对推理模型使用 ReAct 风格的停止词。"),
    reasoning: t("Thinking on by default; disable per request with chat_template_kwargs enable_thinking false. Qwen 3.6 does not officially support the /think and /no_think soft switches; preserve_thinking keeps earlier reasoning for agent work.", "思考默认开启；可在单次请求中用 chat_template_kwargs enable_thinking false 关闭。Qwen 3.6 并未正式支持 /think 和 /no_think 软开关；preserve_thinking 可为智能体工作保留之前的推理。"),
    sampling: t("Qwen 3 thinking: temperature 0.6, top_p 0.95, top_k 20; non-thinking: 0.7, 0.8, 20. Qwen 3.6 thinking for general tasks: temperature 1.0, top_p 0.95, top_k 20, presence_penalty 1.5; for precise coding: 0.6, 0.95, 20 with presence_penalty 0. Never greedy decoding in thinking mode.", "Qwen 3 思考模式：temperature 0.6、top_p 0.95、top_k 20；非思考模式：0.7、0.8、20。Qwen 3.6 用于一般任务的思考模式：temperature 1.0、top_p 0.95、top_k 20、presence_penalty 1.5；用于精确编码：0.6、0.95、20，presence_penalty 为 0。思考模式下绝不使用贪心解码。"),
    context: t("Qwen 3.6 has a 262K native window; keep at least 128K if you preserve thinking. On Ollama raise the context to 64K or more for agents and check it with ollama ps.", "Qwen 3.6 原生窗口为 262K；如果保留思考内容，至少保留 128K。在 Ollama 上为智能体把上下文提高到 64K 或更多，并用 ollama ps 检查。"),
    profile: [
      t("Markdown sections, rules with reasons, a budget of about 4,000 tokens, skills on demand.", "Markdown 分节，规则带理由，预算约 4,000 token，技能按需加载。"),
      t("Runtime checks on; safety enforced by the gate, because the vendor prompt carries none.", "开启运行时检查；由闸门负责安全，因为厂商提示词中没有任何安全内容。"),
      t("Test minimal and runtime-checks first.", "先测试 minimal 和 runtime-checks。"),
    ],
    gotchas: [
      t("A higher presence penalty can cause language mixing.", "较高的 presence 惩罚可能导致语言混杂。"),
      t("Malformed calls happen; parse and validate independently with a fallback.", "格式错误的调用时有发生；要独立解析和校验，并准备兜底处理。"),
      t("A truncated prompt on a small default context looks like disobedience.", "在较小的默认上下文中被截断的提示词，看起来就像不服从。"),
    ],
    evidence: [
      { path: "Qwen/qwen3.6-plus.md", note: t("About 6.7 KB, of which about 120 bytes are prose: a date line and a cutoff line. The rest is eight tool schemas.", "约 6.7 KB，其中正文只有约 120 字节：一行日期和一行知识截止时间。其余是八个工具 schema。") },
      { path: "Qwen/qwen3.8-max.md", note: t("Tools in a tools wrapper, a reminder that reasoning may come before a call but not after, and the identity line last.", "工具放在 tools 包装中，一条提醒说明推理可以在调用之前但不能在之后，身份句放在最后。") },
    ],
    docs: [
      { title: "Qwen function calling", url: "https://qwen.readthedocs.io/en/latest/framework/function_call.html" },
      { title: "Qwen3.6-35B-A3B model card", url: "https://huggingface.co/Qwen/Qwen3.6-35B-A3B" },
      { title: "Ollama context length", url: "https://docs.ollama.com/context-length" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek V4",
    kind: t("Hosted models (deepseek-flash, deepseek-v4-pro) through OpenAI-format and Anthropic-format endpoints; open weights for self-hosting.", "通过 OpenAI 格式和 Anthropic 格式接口使用的托管模型（deepseek-flash、deepseek-v4-pro）；也提供开放权重供自行部署。"),
    structure: t("The vendor's guide gives no prompt-structure advice. Its own hosted prompt is 438 bytes: a date, a location, one tool. Keep the system prompt short and the tool descriptions clear.", "厂商的指南没有给出提示词结构方面的建议。它自己的托管提示词只有 438 字节：一个日期、一个地点、一个工具。系统提示词保持简短，工具说明写清楚。"),
    tools: t("OpenAI-style tools; with tools present, the reasoning_content of every earlier turn must be sent back, or the API returns 400.", "OpenAI 风格的工具；带工具时，之前每一轮的 reasoning_content 都必须回传，否则 API 返回 400。"),
    reasoning: t("Thinking on by default at high effort; toggle with the thinking parameter; reasoning_effort low, high or max.", "思考默认开启，强度为 high；用 thinking 参数切换；reasoning_effort 可为 low、high 或 max。"),
    sampling: t("In thinking mode temperature and the penalties have no effect; where temperature applies, 0.0 is recommended for coding and math.", "思考模式下 temperature 和各种惩罚都不起作用；在 temperature 生效的场景中，编码和数学推荐 0.0。"),
    context: t("Histories grow fast because reasoning is resent with tools; compact earlier.", "由于带工具时要重新发送推理内容，历史增长很快；要更早压缩。"),
    profile: [
      t("Markdown sections, a budget of about 4,000 tokens, skills on demand, runtime checks on.", "Markdown 分节，预算约 4,000 token，技能按需加载，开启运行时检查。"),
      t("Test minimal and runtime-checks first.", "先测试 minimal 和 runtime-checks。"),
    ],
    gotchas: [
      t("Omitting reasoning_content with tools returns an error, so the whole request fails.", "带工具时省略 reasoning_content 会返回错误，整个请求随之失败。"),
    ],
    evidence: [
      { path: "DeepSeek/deepseek-chat.md", note: t("The smallest open-weight vendor prompt in the corpus: 438 bytes.", "语料中最小的开放权重厂商提示词：438 字节。") },
    ],
    docs: [
      { title: "DeepSeek thinking mode", url: "https://api-docs.deepseek.com/guides/thinking_mode" },
      { title: "DeepSeek parameter settings", url: "https://api-docs.deepseek.com/quick_start/parameter_settings" },
    ],
  },
  {
    id: "kimi",
    label: "Moonshot Kimi K3 and K2.6",
    kind: t("Hosted models (kimi-k3 with 1M context, K2.6, K2.7 Code) positioned for long-horizon coding agents; K2-class open weights are very large mixture-of-experts models.", "托管模型（具有 1M 上下文的 kimi-k3、K2.6、K2.7 Code），定位于长周期编码智能体；K2 级开放权重模型是非常大的混合专家模型。"),
    structure: t("No structure guidance on the pages read. Kimi 3's own prompt is calm, uses XML-style section tags, and labels injected context as an active directive or passive background.", "所读页面中没有结构方面的指导。Kimi 3 自己的提示词语气平和，使用 XML 风格的节标签，并把注入的上下文标为主动指令或被动背景。"),
    tools: t("OpenAI-style tools; names of letters, digits, hyphens and underscores; tool_choice required forces a call on the first turn; large sets can be loaded dynamically through a system message.", "OpenAI 风格的工具；名称由字母、数字、连字符和下划线组成；tool_choice 设为 required 会在第一轮强制调用；大型工具集可以通过系统消息动态加载。"),
    reasoning: t("K3 always thinks; reasoning_effort low, high or max (default max). Return the complete assistant message unchanged.", "K3 始终思考；reasoning_effort 可为 low、high 或 max（默认 max）。原样回传完整的助手消息。"),
    sampling: t("K3 fixes temperature 1.0 and top_p 0.95; omit them.", "K3 固定 temperature 为 1.0、top_p 为 0.95；不要传这两个参数。"),
    context: t("Use max_completion_tokens, not max_tokens; automatic caching with a 5-minute or 1-hour lifetime.", "使用 max_completion_tokens 而不是 max_tokens；自动缓存，有效期为 5 分钟或 1 小时。"),
    profile: [
      t("Markdown or XML sections, rules with reasons, a budget of about 8,000 tokens, a step cap stated in the prompt.", "Markdown 或 XML 分节，规则带理由，预算约 8,000 token，在提示词中写明步数上限。"),
      t("Test xml and minimal first.", "先测试 xml 和 minimal。"),
    ],
    gotchas: [
      t("With json_schema and strict true, parse only message.content, never reasoning_content.", "使用 json_schema 且 strict 为 true 时，只解析 message.content，绝不解析 reasoning_content。"),
      t("The built-in web search is marked not recommended for production.", "内置的网页搜索被标注为不推荐用于生产环境。"),
    ],
    evidence: [
      { path: "Kimi/kimi-3.md", note: t("No capitalized commands in its prose; trust labels on injected context; explicit handling of the training cutoff.", "正文中没有大写命令；为注入的上下文加信任标签；明确处理训练数据截止时间。") },
      { path: "Kimi/kimi-2.6.md", note: t("One usage line per tool and a cap of 25 steps per turn, with most tasks expected to need 0 to 3.", "每个工具一行用法说明，每轮最多 25 步，并预期大多数任务只需要 0 到 3 步。") },
    ],
    docs: [
      { title: "Kimi K3 quickstart", url: "https://platform.kimi.ai/docs/guide/kimi-k3-quickstart" },
      { title: "Kimi tool calls", url: "https://platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls" },
    ],
  },
  {
    id: "glm",
    label: "Zhipu GLM 4.7 and 5.x",
    kind: t("Hosted by Z.ai and also served by third parties; hybrid reasoning models with interleaved thinking.", "由 Z.ai 托管，也由第三方提供服务；具备交错思考能力的混合推理模型。"),
    structure: t("No prompting guide was read, and the corpus reports that Z.ai serves no system prompt at all: behavior comes from training. Your harness supplies all of it.", "没有读到提示词指南，语料还报告说 Z.ai 根本不提供系统提示词：行为完全来自训练。你的框架需要提供全部内容。"),
    tools: t("Append the assistant message with reasoning_content and tool_calls, then the tool result; return reasoning unmodified and in order.", "先追加包含 reasoning_content 和 tool_calls 的助手消息，再追加工具结果；按原顺序、不加修改地回传推理内容。"),
    reasoning: t("Thinking on by default on GLM 4.7 and 5.x and forced on 5.3; disable with thinking type disabled where allowed; preserved thinking needs clear_thinking false on the standard API.", "GLM 4.7 和 5.x 默认开启思考，5.3 强制开启；在允许的情况下用 thinking type disabled 关闭；在标准 API 上保留思考内容需要设置 clear_thinking 为 false。"),
    sampling: t("No sampling guidance on the pages read.", "所读页面中没有采样方面的指导。"),
    context: t("Editing earlier reasoning lowers quality and cache hits.", "修改之前的推理内容会降低质量和缓存命中率。"),
    profile: [
      t("Markdown sections, rules with reasons, a budget of about 6,000 tokens, gate and runtime checks on.", "Markdown 分节，规则带理由，预算约 6,000 token，开启闸门和运行时检查。"),
      t("Test minimal and runtime-checks first.", "先测试 minimal 和 runtime-checks。"),
    ],
    gotchas: [
      t("The standard API strips earlier thinking by default, unlike the Coding Plan endpoint.", "与 Coding Plan 接口不同，标准 API 默认会去掉之前的思考内容。"),
    ],
    evidence: [
      { path: "GLM/README.md", note: t("A one-line claim that neither the chat site nor the API injects a system prompt.", "一行说明，声称无论是聊天网站还是 API 都不注入系统提示词。") },
    ],
    docs: [{ title: "Z.ai thinking mode", url: "https://docs.z.ai/guides/capabilities/thinking-mode" }],
  },
  {
    id: "mistral",
    label: "Mistral Small, Medium 3.5, Large 4, Devstral",
    kind: t("Hosted through La Plateforme and open weights for many sizes; Devstral and Codestral for coding.", "通过 La Plateforme 托管，许多尺寸也提供开放权重；Devstral 和 Codestral 用于编码。"),
    structure: t("Role and task first; Markdown or XML tags; decision trees instead of contradictory rules; objective criteria instead of vague words; request only the output you need.", "角色和任务在前；使用 Markdown 或 XML 标签；用决策树代替相互矛盾的规则；用客观标准代替模糊的词；只要求你需要的输出。"),
    tools: t("OpenAI-style tools; tool_choice auto, any or none; parallel calls on by default.", "OpenAI 风格的工具；tool_choice 可为 auto、any 或 none；并行调用默认开启。"),
    reasoning: t("reasoning_effort high or none on Small, Medium 3.5 and Large 4; the Magistral models are deprecated. Replay the full assistant message.", "Small、Medium 3.5 和 Large 4 的 reasoning_effort 可设为 high 或 none；Magistral 模型已弃用。回传完整的助手消息。"),
    sampling: t("No sampling values on the pages read; check the model card for low-temperature coding models.", "所读页面中没有采样参数；低温度编码模型请查看模型卡。"),
    context: t("Re-evaluate prompts on every model update, as the guide asks.", "按指南要求，每次模型更新时重新评估提示词。"),
    profile: [
      t("Markdown sections, rules with reasons written as decisions, a budget of about 6,000 tokens.", "Markdown 分节，规则带理由并写成决策形式，预算约 6,000 token。"),
      t("Test xml and bare-rules first.", "先测试 xml 和 bare-rules。"),
    ],
    gotchas: [
      t("Stripping ThinkChunks from replayed messages significantly degrades quality.", "从回传消息中去掉 ThinkChunk 会显著降低质量。"),
      t("Some versions need short alphanumeric tool call ids. This is general knowledge of Mistral's function-calling examples; the corpus says nothing about it, so check the model card.", "有些版本要求工具调用 id 是短的字母数字串。这来自对 Mistral 函数调用示例的一般了解；语料中没有相关内容，请查看模型卡。"),
    ],
    evidence: [
      { path: "Mistral/mistral-medium-3.5.md", note: t("A conventional prose prompt with worked examples, and one section duplicated: the kind of defect a prompt linter catches.", "一份带示例的常规正文提示词，其中有一个小节重复了：正是提示词检查器能抓到的那类缺陷。") },
    ],
    docs: [
      { title: "Mistral prompting capabilities", url: "https://docs.mistral.ai/guides/prompting_capabilities/" },
      { title: "Mistral function calling", url: "https://docs.mistral.ai/capabilities/function_calling/" },
      { title: "Mistral reasoning", url: "https://docs.mistral.ai/capabilities/reasoning/" },
    ],
  },
  {
    id: "llama",
    label: "Meta Llama 4",
    kind: t("Open-weight mixture-of-experts models (Scout, Maverick) run locally or hosted; Llama Guard 4 for moderation.", "开放权重的混合专家模型（Scout、Maverick），可本地运行或托管；Llama Guard 4 用于内容审核。"),
    structure: t("A short, customizable system prompt; tool definitions as JSON in the system message; the template uses header tokens and names the tool role ipython.", "简短、可定制的系统提示词；工具定义以 JSON 形式放在系统消息中；模板使用头部 token，并把工具角色命名为 ipython。"),
    tools: t("Calls come back pythonic or as a JSON list of name and parameters; text and calls are not mixed in one reply; never call when no functions are listed.", "调用以 Python 风格或包含 name 和 parameters 的 JSON 列表返回；同一条回复中不混合文字和调用；没有列出函数时绝不调用。"),
    reasoning: t("No reasoning controls documented for Llama 4.", "Llama 4 没有文档化的推理控制参数。"),
    sampling: t("No sampling guidance on the page read.", "所读页面中没有采样方面的指导。"),
    context: t("Run through Ollama or vLLM, measure the effective context with the probe.", "通过 Ollama 或 vLLM 运行，用探测工具测量实际上下文。"),
    profile: [
      t("Markdown sections, a budget of about 3,000 tokens, skills on demand, runtime checks on, gate for safety, Llama Guard on outputs if you need moderation.", "Markdown 分节，预算约 3,000 token，技能按需加载，开启运行时检查，用闸门保证安全，需要内容审核时在输出上使用 Llama Guard。"),
      t("Test minimal, runtime-checks and caps-rules against bare-rules first.", "先测试 minimal、runtime-checks，以及 caps-rules 与 bare-rules 的对比。"),
    ],
    gotchas: [
      t("The page's own JSON example has a trailing comma: validate parsed calls.", "页面自己的 JSON 示例末尾有多余的逗号：要校验解析出的调用。"),
    ],
    evidence: [
      { path: "Meta/muse-agent/skills", note: t("Meta's own agent harness (Muse): 89 SKILL.md files, 13 eval folders with 353 simulated-user cases, and per-method allow or ask manifests.", "Meta 自己的智能体框架（Muse）：89 个 SKILL.md 文件，13 个评估文件夹中有 353 个模拟用户用例，以及按方法区分 allow 或 ask 的清单。") },
    ],
    docs: [{ title: "Llama 4 prompt format", url: "https://dev.meta.ai/llama/docs/model-cards-and-prompt-formats/llama4" }],
  },
];

export const modelById = Object.fromEntries(models.map((m) => [m.id, m]));
