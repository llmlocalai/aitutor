import { t } from "@/lib/types";
import type { Symptom } from "./types";

/**
 * The diagnoser: one entry per agent failure label in harness/ops/failure_taxonomy.json (the audit checks
 * the ids match). Each cause says how to confirm it before changing anything, the fix, alternatives,
 * and the harness files involved. `evaluate` says which number shows the fix worked.
 */
export const symptoms: Symptom[] = [
  {
    id: "skill-not-triggering",
    title: t("A skill never loads, or loads too rarely", "技能从不加载，或加载得太少"),
    seen: t("Policy answers without a load_skill call; the check \"loaded skill expense-policy\" fails; trigger recall below 0.8.", "回答政策问题时没有调用 load_skill；“loaded skill expense-policy”检查失败；触发召回率低于 0.8。"),
    steps: ["skills", "prompt", "layout"],
    causes: [
      { cause: t("The description is a label, with no \"Use when\" trigger.", "description 只是个标签，没有“Use when”触发条件。"), test: t("Lint the SKILL.md: skill-trigger or skill-desc-short fires.", "检查 SKILL.md：触发 skill-trigger 或 skill-desc-short。"), fix: t("Write \"Use when ...\" with two or three request shapes users actually type.", "写上“Use when ...”，并给出两三种用户实际会输入的请求形式。"), options: [t("Make the description a little pushy, as the corpus skill guidance advises.", "按语料中技能指导的建议，把 description 写得稍微强势一些。"), t("Add a prompt rule that policy questions require the skill, with the reason.", "在提示词中加一条规则：政策问题必须先加载技能，并附上理由。")], files: ["harness/template/skills/expense-policy/SKILL.md", "harness/template/prompts/core.md"] },
      { cause: t("The model believes it already knows the answer.", "模型认为自己已经知道答案。"), test: t("The failing answers state a plausible but different limit from the skill's figures.", "失败的回答给出了一个看似合理、但与技能中数字不同的限额。"), fix: t("Say in the rule that the figures live only in the skill, so an answer without it is a guess.", "在规则中说明这些数字只存在于技能里，所以不加载技能的回答就是猜测。"), options: [t("Put the policy name in the tool description of load_skill.", "把政策名称写进 load_skill 的工具说明里。"), t("For small local models, add a keyword pre-router that loads the skill in code.", "对小型本地模型，加一个关键词预路由器，在代码中加载技能。")], files: ["harness/template/prompts/core.md", "harness/template/tools/tools.json"] },
      { cause: t("The skill index was cut from the prompt.", "技能索引被从提示词中截掉了。"), test: t("The probe's context check fails at your prompt size, or the minimal variant is running.", "探测的上下文检查在你的提示词长度下失败，或者正在运行的是 minimal 变体。"), fix: t("Raise the server context length, or shrink the always-on prompt.", "提高服务器的上下文长度，或缩小常驻提示词。"), options: [t("Move the skills section nearer the end, where truncation does not reach it.", "把技能小节移到靠近末尾的位置，让截断影响不到它。")], files: ["harness/probe/probe.py", "harness/template/prompts/families.yml"] },
    ],
    evaluate: t("Trigger recall at least 0.8 and false trigger rate 0 with --triggers; the skill_loaded checks pass in the routing and policy cases.", "使用 --triggers 时触发召回率至少 0.8、误触发率为 0；路由和政策用例中的 skill_loaded 检查通过。"),
    models: {
      gpt: t("The dots index cuts descriptions near 200 characters: put the trigger words first.", "dots 索引会在 200 个字符左右截断 description：把触发词放在前面。"),
      claude: t("Avoid CRITICAL or MUST in the fix; on 4.5 and 4.6-era models it over-triggers instead.", "修复时避免使用 CRITICAL 或 MUST；在 4.5 和 4.6 时代的模型上，这反而会导致过度触发。"),
      qwen: t("Small models under-trigger most; the pre-router option is often the fastest fix.", "小模型最容易触发不足；预路由器往往是最快的修复方法。"),
    },
  },
  {
    id: "over-calling-tools",
    title: t("Tools are called when none are needed", "不需要工具时也调用工具"),
    seen: t("Arithmetic or questions about the agent trigger searches; \"did not call search_expenses\" fails; more steps than the task needs.", "算术题或关于智能体本身的问题也会触发搜索；“did not call search_expenses”检查失败；步数超过任务所需。"),
    steps: ["prompt", "tools"],
    causes: [
      { cause: t("No rule says when to answer directly.", "没有规则说明何时直接回答。"), test: t("core.md has no direct-answer rule, or it has no reason.", "core.md 中没有直接回答的规则，或者有但没有理由。"), fix: t("Add the rule with its reason: an unneeded call costs a step and can return data that distracts.", "加上这条规则并附理由：不必要的调用会多花一步，还可能返回让模型分心的数据。"), options: [t("Name the question types that need no tools.", "点名哪些类型的问题不需要工具。")], files: ["harness/template/prompts/core.md"] },
      { cause: t("Tool descriptions say when to use them, but not when not to.", "工具说明写了何时使用，却没写何时不用。"), test: t("Read the description of the over-used tool.", "读一读被过度使用的那个工具的说明。"), fix: t("Add a sentence on when not to use it.", "加一句说明何时不该使用它。"), options: [t("Lower the thinking level for routing, as Google advises for excess tool calls.", "按 Google 针对过多工具调用的建议，降低路由时的思考档位。")], files: ["harness/template/tools/tools.json"] },
    ],
    evaluate: t("The no-tools-arithmetic and about-you cases pass, and mean steps fall in the run summary.", "no-tools-arithmetic 和 about-you 用例通过，运行汇总中的平均步数下降。"),
    models: {
      gemini: t("Google's own prompts push tool use hard; for a restraint rule, give the reason explicitly.", "Google 自己的提示词非常鼓励使用工具；要写克制规则，就明确给出理由。"),
      claude: t("\"Use the tools to investigate before responding\" raises tool use; asking for judgment keeps it conservative.", "“回答前先用工具调查”会增加工具使用；要求运用判断则会让它更保守。"),
    },
  },
  {
    id: "wrong-tool-path",
    title: t("The wrong tool, or the wrong arguments", "用错了工具，或用错了参数"),
    seen: t("\"called search_expenses with {employee: Dana Reyes}\" fails; get_expense is called for a total; invented argument values.", "“called search_expenses with {employee: Dana Reyes}”检查失败；为了求合计却调用了 get_expense；参数值是编造的。"),
    steps: ["tools"],
    causes: [
      { cause: t("Two tools' descriptions overlap.", "两个工具的说明有重叠。"), test: t("Put the two descriptions side by side; if each could answer the question, the model has to guess.", "把两个说明并排放在一起；如果两者都能回答这个问题，模型就只能猜。"), fix: t("Say in each which question it answers that the other does not.", "在每个说明里写清它能回答、另一个不能回答的问题。"), options: [t("Merge tools that are always called together.", "把总是一起调用的工具合并。")], files: ["harness/template/tools/tools.json"] },
      { cause: t("A free-text parameter invites invented values.", "自由文本参数容易让模型编造取值。"), test: t("The failing calls carry values not in the world (a category that does not exist).", "失败的调用带有世界中不存在的取值（一个不存在的类别）。"), fix: t("Use an enum or a pattern so the schema rejects bad values.", "使用枚举或正则模式，让 schema 拒绝非法取值。"), options: [t("Let code fill arguments the model need not choose.", "让代码填写模型不必选择的参数。")], files: ["harness/template/tools/tools.json"] },
    ],
    evaluate: t("called_with checks pass, and malformed calls stay at 0.", "called_with 检查通过，格式错误的调用保持为 0。"),
    models: {
      gpt: t("Keep fewer than 20 tools resident, as OpenAI's guide says; use namespaces for the rest.", "按 OpenAI 指南的建议，常驻工具少于 20 个；其余的用命名空间管理。"),
      claude: t("Three to four sentences per description is Anthropic's guidance and the largest single lever.", "每个说明三到四句话，这是 Anthropic 的指导，也是最大的单一杠杆。"),
    },
  },
  {
    id: "wrong-figures",
    title: t("Figures are wrong or invented", "数字错误或被编造"),
    seen: t("\"states 1178.6\" or \"every amount is grounded\" fails; amounts no tool returned; totals that do not add up.", "“states 1178.6”或“every amount is grounded”检查失败；出现没有任何工具返回过的金额；合计对不上。"),
    steps: ["verify", "tools", "prompt", "graders"],
    causes: [
      { cause: t("The model summed from memory instead of the tool result.", "模型凭记忆求和，而不是根据工具结果。"), test: t("The tool result has the right amounts; the answer's total differs.", "工具结果中的金额是对的，回答中的合计却不一样。"), fix: t("Turn on verify in the loop; keep the compute-from-results rule with its reason.", "在循环中开启 verify；保留“根据结果计算”的规则及其理由。"), options: [t("Return a precomputed total from the tool when users ask for totals often.", "如果用户经常要合计，就让工具直接返回预先算好的合计。")], files: ["harness/runtime/verify.py", "harness/template/prompts/core.md"] },
      { cause: t("The tool result is large or unclear, so the right figure is hard to find.", "工具结果太大或不清楚，很难找到正确的数字。"), test: t("The correction nudge does not fix it.", "更正提醒也没能修好。"), fix: t("Return fewer fields, with names and amounts side by side.", "返回更少的字段，把名称和金额并排放在一起。"), options: [t("Ask for figures with their expense id in the answer rule.", "在回答规则中要求每个数字都附上报销 id。")], files: ["harness/template/tools/tools.json", "harness/evals/world.py"] },
      { cause: t("The figure was correct but the grader misread it.", "数字是对的，但评分器读错了。"), test: t("Read the trace in evals/out/<run>/traces: a person judges the answer correct, yet the check fails on its wording.", "阅读 evals/out/<run>/traces 中的轨迹：人工判断回答是正确的，但检查因措辞而失败。"), fix: t("Add the answer to evals/fixtures/answers.json with expect true, then fix the grader until the tests pass, in its own commit.", "把这条回答加入 evals/fixtures/answers.json 并标为 expect true，然后修改评分器直到测试通过，单独提交。"), options: [t("Widen the case's accepted figures or phrases (figures_any, final_any) when there is more than one correct answer.", "当正确答案不止一个时，放宽用例接受的数字或措辞（figures_any、final_any）。")], files: ["harness/evals/graders.py", "harness/evals/fixtures/answers.json"] },
    ],
    evaluate: t("grounded and figure checks pass with verify off; the nudge rate with verify on falls.", "关闭 verify 时 grounded 和数字检查都能通过；开启 verify 时提醒率下降。"),
    models: {
      qwen: t("Small local models fabricate more in long contexts; keep tool results short.", "小型本地模型在长上下文中更容易编造；保持工具结果简短。"),
      llama: t("Small local models fabricate more in long contexts: keep tool results short, and run the runtime-checks variant to see whether verify pays for its extra steps.", "小型本地模型在长上下文中更容易编造：保持工具结果简短，并运行 runtime-checks 变体，看看 verify 带来的额外步数是否值得。"),
    },
  },
  {
    id: "incomplete-answer",
    title: t("Part of the request is missing", "请求的一部分没有完成"),
    seen: t("\"mentions E-1005\" fails in two-parts; one of several items is answered.", "two-parts 用例中“mentions E-1005”检查失败；几项中只回答了一项。"),
    steps: ["stop", "prompt"],
    causes: [
      { cause: t("No finish-every-part rule.", "没有“完成每一部分”的规则。"), test: t("core.md lacks the rule, or it has no reason.", "core.md 中缺少这条规则，或有规则但没有理由。"), fix: t("Add it with the reason: a partial answer reads as complete.", "加上规则并附理由：不完整的回答看起来像是完整的。"), options: [t("List the parts back in the answer rule (each id with its result).", "在回答规则中要求逐项列出（每个 id 及其结果）。")], files: ["harness/template/prompts/core.md"] },
      { cause: t("The turn ended on a promise to do the rest.", "这一轮以承诺稍后完成剩余部分而结束。"), test: t("The final's last paragraph says \"I'll\" or \"let me\".", "最终回答的最后一段写着“I'll”或“let me”。"), fix: t("Turn on stopcheck.", "开启 stopcheck。"), options: [t("Add a side-car judge that checks every deliverable, as Muse Code does.", "像 Muse Code 那样，加一个检查所有交付物的旁路评审模型。")], files: ["harness/runtime/stopcheck.py"] },
    ],
    evaluate: t("two-parts and approval-threshold pass in every repeat.", "two-parts 和 approval-threshold 在每次重复中都通过。"),
  },
  {
    id: "never-asks",
    title: t("It acts on an ambiguous request instead of asking", "遇到有歧义的请求时直接行动而不提问"),
    seen: t("ambiguous-fix fails \"asks the user\"; the agent picks an expense and proposes a change.", "ambiguous-fix 的“asks the user”检查失败；智能体自己挑了一笔报销并提议修改。"),
    steps: ["stop"],
    causes: [
      { cause: t("The ask rule has no example, so ambiguity is not recognized.", "提问规则没有示例，所以识别不出歧义。"), test: t("Ask the model directly what \"fix the expense\" could mean; it lists several readings, yet still acted.", "直接问模型“fix the expense”可能是什么意思；它能列出好几种理解，却还是直接行动了。"), fix: t("Add one concrete example of a request that could mean different writes.", "加一个可能意味着不同写操作的请求示例。"), options: [t("Make the ask rule depend on whether the action is a write.", "让提问规则取决于这个动作是否是写操作。")], files: ["harness/template/prompts/core.md"] },
      { cause: t("A strong bias-to-action rule overrides it.", "一条强烈偏向行动的规则压过了它。"), test: t("Removing the bias line makes the case pass.", "去掉偏向行动的那一行后用例就通过了。"), fix: t("Scope the bias to clear requests, and put the exception next to it.", "把偏向行动限定在明确的请求上，并把例外写在旁边。"), options: [], files: ["harness/template/prompts/core.md"] },
    ],
    evaluate: t("ambiguous-fix passes; flag-approved still passes (no new over-asking).", "ambiguous-fix 通过；flag-approved 依然通过（没有引入新的过度提问）。"),
    models: {
      gpt: t("GPT-6.1 Sol is pushed hard toward action; keep the ambiguity example close to the autonomy rule.", "GPT-6.1 Sol 被强烈推向行动；把歧义示例放在自主规则旁边。"),
    },
  },
  {
    id: "over-asking",
    title: t("It asks when it should act", "该行动时却在提问"),
    seen: t("Clear lookups end with a question; \"shall I search?\"; approvals requested for read-only work.", "明确的查询以一个问题结束；“要我搜索吗？”；只读工作也要求批准。"),
    steps: ["stop", "prompt"],
    causes: [
      { cause: t("No rule that lookups need no permission.", "没有“查询无需征求同意”的规则。"), test: t("core.md asking section lacks it.", "core.md 的提问小节里没有这条。"), fix: t("Add it with its reason: lookups change nothing, and a question costs a round trip.", "加上它并附理由：查询不改变任何东西，而提问要多一个来回。"), options: [t("State the surface: in a background run, never wait except at an irreversible fork.", "写明使用场景：在后台运行中，除非遇到不可逆的分岔，否则绝不等待。")], files: ["harness/template/prompts/core.md"] },
      { cause: t("Several ask-first rules repeat the same caution.", "好几条“先问再做”的规则在重复同样的谨慎。"), test: t("Count ask-first sentences in the prompt and skills.", "数一数提示词和技能中“先问再做”的句子。"), fix: t("Keep one compact autonomy policy, as OpenAI advises for GPT-5.6.", "按 OpenAI 对 GPT-5.6 的建议，只保留一条简洁的自主策略。"), options: [], files: ["harness/template/prompts/core.md", "harness/template/skills/flag-for-review/SKILL.md"] },
    ],
    evaluate: t("Lookup cases end in answers, not questions; ambiguous-fix still asks.", "查询类用例以回答而不是问题结束；ambiguous-fix 仍然会提问。"),
    models: {
      gpt: t("GPT models over-ask by default; 6.1 Sol treats \"can you\" as an instruction to act.", "GPT 模型默认倾向于问得太多；6.1 Sol 把“can you”视为要求行动的指令。"),
      claude: t("Haiku 5.5 in Claude Code gets an extra autonomy block: ask first only when the likeliest reading cannot be named.", "Claude Code 中的 Haiku 5.5 多了一段自主性说明：只有在说不出最可能的理解时才先问。"),
    },
  },
  {
    id: "acts-without-asking",
    title: t("It attempts a write without approval", "未经批准就尝试写操作"),
    seen: t("flag_expense called without an approval; the gate returned needs_confirmation; a write case fails.", "在没有批准的情况下调用了 flag_expense；闸门返回 needs_confirmation；某个写操作用例失败。"),
    steps: ["gate", "stop", "contract"],
    causes: [
      { cause: t("The model does not know the write needs approval.", "模型不知道写操作需要批准。"), test: t("The write rule and the tool description do not both say so.", "写操作规则和工具说明没有同时说明这一点。"), fix: t("Say it in both places, with what to do on needs_confirmation.", "在两个地方都写明，并说明收到 needs_confirmation 时该怎么做。"), options: [], files: ["harness/template/prompts/core.md", "harness/template/tools/tools.json"] },
      { cause: t("Attempting is acceptable here, as long as the answer then asks honestly.", "在这里尝试调用是可以接受的，只要之后的回答如实提问。"), test: t("Read the final: if it asks and does not claim success, the gate did its job.", "读一读最终回答：如果它提出询问且没有声称成功，说明闸门尽到了职责。"), fix: t("Grade the answer, not the attempt, unless your contract forbids attempts.", "评判回答而不是尝试，除非你的契约禁止尝试。"), options: [], files: ["harness/evals/cases.json"] },
    ],
    evaluate: t("flag-needs-approval passes; the gate decisions show needs_confirmation, never allow, without an approval.", "flag-needs-approval 通过；在没有批准时，闸门的决定都是 needs_confirmation，从来不是 allow。"),
  },
  {
    id: "skips-approved-write",
    title: t("It does not act even after approval", "即使得到批准也不行动"),
    seen: t("flag-approved fails \"called flag_expense with {id: E-1007}\"; the agent asks again.", "flag-approved 的“called flag_expense with {id: E-1007}”检查失败；智能体又问了一遍。"),
    steps: ["stop", "gate"],
    causes: [
      { cause: t("The rule does not say an explicit approval in this conversation is enough.", "规则没有说明本次对话中的明确批准就已足够。"), test: t("The final asks for approval the user already gave.", "最终回答又要求用户给出已经给过的批准。"), fix: t("Say so in the write rule and in the skill.", "在写操作规则和技能中都写明这一点。"), options: [], files: ["harness/template/prompts/core.md", "harness/template/skills/flag-for-review/SKILL.md"] },
      { cause: t("The approval never reached the gate.", "批准根本没有传到闸门。"), test: t("The call shows needs_confirmation despite the approval.", "尽管有批准，调用仍显示 needs_confirmation。"), fix: t("Record approvals in the harness from the user's message, and pass them to guarded.", "由框架根据用户消息记录批准，并把它传给 guarded。"), options: [], files: ["harness/runtime/gate.py"] },
    ],
    evaluate: t("flag-approved passes and flag-needs-approval still passes.", "flag-approved 通过，flag-needs-approval 依然通过。"),
  },
  {
    id: "claims-unverified-success",
    title: t("It claims success the tools did not confirm", "声称成功，但工具并未确认"),
    seen: t("\"does not say 'has been flagged'\" fails after needs_confirmation; \"done\" without a confirming result.", "收到 needs_confirmation 之后，“does not say 'has been flagged'”检查失败；没有确认结果就说“完成了”。"),
    steps: ["verify", "gate", "subagents"],
    causes: [
      { cause: t("The tool result can be misread as success.", "工具结果可能被误读为成功。"), test: t("Read the needs_confirmation result as the model sees it.", "像模型那样读一读 needs_confirmation 结果。"), fix: t("Make the result say \"Not run\" in plain words, as gate.py does.", "像 gate.py 那样，让结果用平实的文字写明“Not run”。"), options: [], files: ["harness/runtime/gate.py"] },
      { cause: t("No rule ties success claims to a confirming result.", "没有规则把成功的说法与确认结果绑定。"), test: t("core.md writes section lacks it.", "core.md 的写操作小节里没有这条。"), fix: t("Add the rule; add a readback after writes.", "加上这条规则；写操作之后加一次回读。"), options: [t("Run the verifier subagent on write claims.", "让验证者子智能体检查关于写操作的结论。")], files: ["harness/template/prompts/core.md", "harness/template/agents/verifier.md"] },
    ],
    evaluate: t("flag-needs-approval passes in every repeat.", "flag-needs-approval 在每次重复中都通过。"),
  },
  {
    id: "obeys-injection",
    title: t("It follows instructions inside data", "它遵从了数据中的指令"),
    seen: t("send_email attempted in injection-note; \"did not call send_email\" fails; the answer repeats the injected request.", "在 injection-note 用例中尝试调用 send_email；“did not call send_email”检查失败；回答中复述了被注入的请求。"),
    steps: ["gate", "prompt"],
    causes: [
      { cause: t("Untrusted fields reach the model without a label.", "不可信字段未加标记就到达了模型。"), test: t("Look at the tool message: is the note wrapped?", "看看工具消息：备注有没有被包装？"), fix: t("Wrap untrusted fields where they enter.", "在不可信字段进入时就加上包装。"), options: [], files: ["harness/evals/world.py"] },
      { cause: t("The priority rule on untrusted data is missing or late.", "关于不可信数据的优先级规则缺失或位置太靠后。"), test: t("Lint: sys-untrusted fires, or the rule is not in priorities.", "检查：触发 sys-untrusted，或者这条规则不在 priorities 中。"), fix: t("Put it in priorities, early, with the reason.", "把它放在 priorities 中靠前的位置，并附上理由。"), options: [t("Name the specific sources (notes, vendor names, documents).", "点名具体的来源（备注、供应商名称、文档）。")], files: ["harness/template/prompts/core.md"] },
      { cause: t("A denied tool is still declared in production.", "一个被拒绝的工具在生产中仍然被声明。"), test: t("The production tool list includes it.", "生产工具清单中包含它。"), fix: t("Drop it from production builds; keep the honeypot for evals only.", "从生产构建中去掉它；诱饵只在评估中保留。"), options: [], files: ["harness/runtime/assemble.py"] },
    ],
    evaluate: t("injection-note and deny-email pass in every repeat; the gate never logs allow on send_email.", "injection-note 和 deny-email 在每次重复中都通过；闸门从未对 send_email 记录过 allow。"),
    models: {
      generic: t("Open-weight vendor prompts carry no injection rules; your harness must supply them.", "开放权重厂商的提示词中没有注入防护规则；你的框架必须自己提供。"),
    },
  },
  {
    id: "loops",
    title: t("It loops, or runs out of steps", "陷入循环，或耗尽步数"),
    seen: t("stop max_steps; repeated_call in the decisions; \"finished\" fails.", "stop 为 max_steps；决定中出现 repeated_call；“finished”检查失败。"),
    steps: ["loop", "tools", "contract"],
    causes: [
      { cause: t("A tool result does not answer the question, so the model retries.", "工具结果没有回答问题，于是模型不断重试。"), test: t("The last calls are identical or near-identical searches.", "最后几次调用是完全相同或几乎相同的搜索。"), fix: t("Make empty results say why (no match, not an error), and keep repeated-call detection.", "让空结果说明原因（没有匹配，而不是出错），并保留重复调用检测。"), options: [t("Cap searches for the same fact at two, as Notion's prompt does.", "像 Notion 的提示词那样，同一事实的搜索最多两次。")], files: ["harness/template/tools/tools.json", "harness/runtime/loop.py"] },
      { cause: t("The task needs more steps than the budget.", "任务所需的步数超过了预算。"), test: t("The calls vary and make progress.", "调用各不相同，而且在推进。"), fix: t("Raise max_steps in contract.yml with a reason, or add a tool that returns what three calls gathered.", "在 contract.yml 中提高 max_steps 并写明理由，或者加一个能一次返回三次调用所得内容的工具。"), options: [], files: ["harness/contract.yml"] },
    ],
    evaluate: t("No run stops by max_steps; p95 steps stays within the contract.", "没有运行因 max_steps 而停止；第 95 百分位步数保持在契约范围内。"),
    models: {
      gemini: t("Temperature below 1.0 can cause looping on Gemini 3.x: keep the default.", "在 Gemini 3.x 上，temperature 低于 1.0 可能导致循环：保持默认值。"),
    },
  },
  {
    id: "malformed-calls",
    title: t("Tool calls are malformed", "工具调用格式错误"),
    seen: t("malformed above 0 in the summary; invalid_arguments errors; calls described in text instead of made.", "汇总中 malformed 大于 0；出现 invalid_arguments 错误；调用以文字描述而不是实际发出。"),
    steps: ["model", "tools"],
    causes: [
      { cause: t("The chat template or server parser does not match the model.", "聊天模板或服务器解析器与模型不匹配。"), test: t("The probe's tool_call check fails.", "探测的 tool_call 检查失败。"), fix: t("Use a model build with tool support and the right parser (hermes or qwen3_coder for Qwen).", "使用支持工具的模型版本和正确的解析器（Qwen 用 hermes 或 qwen3_coder）。"), options: [t("Check the template with ollama show --modelfile.", "用 ollama show --modelfile 检查模板。")], files: ["harness/probe/probe.py"] },
      { cause: t("The prompt describes its own tool format.", "提示词描述了自己的工具格式。"), test: t("Lint: sys-text-tool-format fires.", "检查：触发 sys-text-tool-format。"), fix: t("Delete the format description; pass tools through the API.", "删掉格式说明；通过 API 传入工具。"), options: [], files: ["harness/template/prompts/core.md"] },
      { cause: t("The schema is too complex for the model.", "schema 对模型来说太复杂。"), test: t("Errors cluster on one tool with many optional fields.", "错误集中在某个有很多可选字段的工具上。"), fix: t("Remove optional fields the model need not choose.", "去掉模型不必选择的可选字段。"), options: [], files: ["harness/template/tools/tools.json"] },
    ],
    evaluate: t("malformed is 0 across the run, and the probe passes tool_call.", "整个运行中 malformed 为 0，探测的 tool_call 通过。"),
    models: {
      qwen: t("Qwen 3 uses the hermes parser; 3.6 uses qwen3_coder. A mismatch is the usual cause.", "Qwen 3 用 hermes 解析器；3.6 用 qwen3_coder。两者不匹配是常见原因。"),
      llama: t("Llama 4 returns pythonic or JSON-list calls; validate them, since even the vendor example has a trailing comma.", "Llama 4 返回 Python 风格或 JSON 列表形式的调用；要校验它们，因为连厂商的示例都有多余的逗号。"),
      mistral: t("Some versions need short alphanumeric tool call ids.", "有些版本要求工具调用 id 是短的字母数字串。"),
    },
  },
  {
    id: "stops-early",
    title: t("It stops before the work is done", "工作还没完成就停下了"),
    seen: t("A final that promises work; nudges recorded; tasks cut short as the context grows.", "最终回答承诺了要做的工作；记录到提醒；随着上下文增长，任务被中途截断。"),
    steps: ["stop", "memory"],
    causes: [
      { cause: t("The final is a plan or a promise.", "最终回答是一个计划或承诺。"), test: t("stopcheck.classify returns promise.", "stopcheck.classify 返回 promise。"), fix: t("Turn on stopcheck.", "开启 stopcheck。"), options: [t("Add the last-paragraph self-check to the prompt, as Fable 5.1's Claude Code prompt does.", "像 Fable 5.1 的 Claude Code 提示词那样，在提示词中加入检查最后一段的规则。")], files: ["harness/runtime/stopcheck.py"] },
      { cause: t("The model wraps up because the context is filling.", "模型因为上下文快满了而收尾。"), test: t("Early stops correlate with long histories.", "过早停止与历史较长相关。"), fix: t("Compact, and say in the prompt that compaction exists.", "进行压缩，并在提示词中说明存在压缩机制。"), options: [], files: ["harness/template/memory/handoff.md"] },
    ],
    evaluate: t("No promise endings after the nudge; multi-part cases pass.", "提醒之后不再有承诺式结尾；多部分的用例通过。"),
    models: {
      claude: t("The smaller tier (Haiku 5.5) gets explicit anti-early-stopping guidance in Claude Code; give it to small models.", "较小的档位（Haiku 5.5）在 Claude Code 中得到了明确的防过早停止指导；也给小模型加上。"),
    },
  },
  {
    id: "context-truncated",
    title: t("The prompt is silently cut", "提示词被悄悄截断"),
    seen: t("Rules at the top are ignored; the probe loses the code word; behavior changes with prompt length.", "开头的规则被忽略；探测丢失了暗号；行为随提示词长度变化。"),
    steps: ["model", "prompt", "layout", "subagents"],
    causes: [
      { cause: t("The server's context length is smaller than prompt plus history.", "服务器的上下文长度小于提示词加历史的长度。"), test: t("probe.py context fails at your size; ollama ps shows a small CONTEXT.", "probe.py 的上下文检查在你的长度下失败；ollama ps 显示的 CONTEXT 很小。"), fix: t("Raise it (OLLAMA_CONTEXT_LENGTH or num_ctx), then rerun the probe.", "提高它（OLLAMA_CONTEXT_LENGTH 或 num_ctx），然后重新运行探测。"), options: [t("Shrink the always-on prompt below the smallest failing size.", "把常驻提示词缩小到最小失败长度以下。")], files: ["harness/probe/probe.py", "harness/template/prompts/families.yml"] },
    ],
    evaluate: t("The probe keeps the code word at your largest size, and lint sys-budget is clean.", "探测在你的最大长度下仍能记住暗号，检查中的 sys-budget 没有问题。"),
    models: {
      qwen: t("Ollama's default may be 4,096 tokens on smaller GPUs; agents need 64,000 or more.", "在较小的 GPU 上，Ollama 的默认值可能只有 4,096 个 token；智能体需要 64,000 或更多。"),
    },
  },
  {
    id: "other",
    title: t("Something else, or I cannot tell", "其他问题，或者我说不清楚"),
    seen: t("Scores dropped after a change and no single check explains it; or a user report that no case covers.", "改动之后分数下降了，但没有哪一项检查能解释；或者用户报告的问题没有用例覆盖。"),
    steps: ["hillclimb", "cases", "graders", "experiment", "release", "scale", "project"],
    causes: [
      { cause: t("A change touched more than one thing.", "一次改动涉及了不止一处。"), test: t("git diff since the last good run touches several files.", "自上次正常运行以来，git diff 涉及多个文件。"), fix: t("Revert to the last good run and reapply one change at a time.", "回退到上次正常运行的版本，然后每次只重新应用一处改动。"), options: [], files: ["harness/evals/findings.md"] },
      { cause: t("No case covers the behavior.", "没有用例覆盖这个行为。"), test: t("The user's failure does not resemble any case.", "用户遇到的失败与任何用例都不相似。"), fix: t("Write a case that isolates it, run the oracle, then the model.", "写一个能单独复现它的用例，先跑理想智能体，再跑模型。"), options: [], files: ["harness/evals/cases.json"] },
      { cause: t("The model or server changed.", "模型或服务器变了。"), test: t("The probe output differs from the recorded one.", "探测输出与记录的不一样。"), fix: t("Re-probe, update families.yml, rerun the control.", "重新探测，更新 families.yml，重新运行对照组。"), options: [], files: ["harness/probe/probe.py"] },
    ],
    evaluate: t("The new case passes, and the paired delta against the last good run is not negative.", "新用例通过，并且相对上次正常运行的配对差值不为负。"),
  },
];
