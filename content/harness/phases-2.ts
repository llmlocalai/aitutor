import { t } from "@/lib/types";
import type { HPhase } from "./types";

const K = "harness/";

/** Phases 3 and 4: capabilities (skills, project instructions, subagents, memory), then control (gate, ask and stop, verify). */
export const phases2: HPhase[] = [
  {
    id: "capabilities",
    title: t("Add capabilities without growing the prompt", "增加能力而不撑大提示词"),
    goal: t(
      "Give the agent more knowledge and more hands while the always-on prompt stays small: skills that load on demand, project instructions for the coding agents that build the harness, subagents for the two jobs they are good at, and memory and context rules that keep long work coherent.",
      "在常驻提示词保持精简的同时，让智能体拥有更多知识和能力：按需加载的技能、供搭建框架的编码智能体使用的项目指令、只用于两类擅长工作的子智能体，以及让长任务保持连贯的记忆与上下文规则。",
    ),
    steps: [
      {
        id: "skills",
        title: t("Write skills that load on demand", "编写按需加载的技能"),
        local: t("runtime/skills.py, two example skills, and a routing eval set for each skill.", "runtime/skills.py、两个示例技能，以及每个技能的路由评估集。"),
        links: ["skills.write", "skills.match", "skills.evaluate"],
        after: ["prompt", "tools"],
        why: t(
          "Skills are how harnesses know a lot while the always-on prompt stays small. Every vendor in the corpus converged on the same contract: a folder with SKILL.md, frontmatter with a name and a description, a body that loads only when the skill is chosen, and optional references/, scripts/ and evals/ folders. Across the five skill collections measured (205 SKILL.md files), name and description appear in every file that has frontmatter; every other field is specific to one collection. The description is the router, and the most common failure is a skill that never loads.",
          "技能让框架在常驻提示词保持精简的同时掌握大量知识。语料中每家厂商都收敛到同一套约定：一个包含 SKILL.md 的文件夹，frontmatter 中有 name 和 description，正文只在技能被选中时加载，另有可选的 references/、scripts/ 和 evals/ 文件夹。在测量的五个技能集合中（共 205 个 SKILL.md），凡是有 frontmatter 的文件都有 name 和 description；其他字段都只属于某一个集合。description 就是路由器，而最常见的问题是技能从来不被加载。",
        ),
        what: t(
          "skills.py discovers skills/*/SKILL.md, enforces the contract (a kebab-case name of at most 64 characters matching its folder, a description of at most 1,024 characters with no angle brackets), builds the one-line-per-skill index that goes into the prompt, and returns a body when the model calls load_skill. expense-policy holds the policy figures, which live nowhere else, so an answer given without it is a guess. flag-for-review holds the approval procedure. triggers.json holds six positives and six near-miss negatives for the description.",
          "skills.py 查找 skills/*/SKILL.md，执行约定检查（kebab-case 名称最多 64 个字符且与文件夹名一致，description 最多 1,024 个字符且不含尖括号），生成放进提示词的每个技能一行的索引，并在模型调用 load_skill 时返回正文。expense-policy 存放政策数字，这些数字别处都没有，所以不加载它就给出的回答都是猜测。flag-for-review 存放审批流程。triggers.json 为 description 准备了六个正例和六个近似但不该触发的反例。",
        ),
        how: [
          t("Write a skill from a real failure or a real procedure, not from a topic list. The body says what to do, in order, and when to read which reference.", "从真实的失败或真实的流程出发写技能，而不是从主题清单出发。正文按顺序写清该做什么，以及何时阅读哪份参考资料。"),
          t("Write the description as a router: what it does, \"Use when ...\" with the words users type, and \"Do not use for ...\" naming the closest neighbouring request.", "把 description 写成路由规则：它做什么，“Use when ...”加上用户会输入的词，以及“Do not use for ...”点明最接近但不该触发的请求。"),
          t("Keep the body under 500 lines and move variants into references/<topic>.md.", "正文控制在 500 行以内，把各种变体移到 references/<topic>.md。"),
          t("Write triggers.json with at least four positives and four near-miss negatives: questions that use the same nouns but need no skill.", "编写 triggers.json，至少四个正例和四个近似反例：用了同样的名词、但并不需要这个技能的问题。"),
          t("Run python3 harness/evals/run_eval.py --base-url <url> --model <name> --triggers and read recall and the false trigger rate per skill.", "运行 python3 harness/evals/run_eval.py --base-url <url> --model <name> --triggers，查看每个技能的召回率和误触发率。"),
        ],
        files: [K + "runtime/skills.py", K + "template/skills/expense-policy/SKILL.md", K + "template/skills/flag-for-review/SKILL.md", K + "template/skills/expense-policy/evals/triggers.json"],
        interpret: [
          t("recall 0.5 on expense-policy means half of the policy questions were answered without loading the skill, that is, from memory. Make the description more specific and add trigger phrases shaped like the missed queries, not copied from them.", "expense-policy 的召回率为 0.5，意味着一半的政策问题是在没有加载技能的情况下回答的，也就是凭记忆回答。把 description 写得更具体，并加入与漏掉的查询形式相似、但不是照抄的触发短语。"),
          t("A false trigger rate above zero on the near misses means the description is too broad. Add the negative boundary, and name the skill that should load instead.", "近似反例的误触发率大于零，说明 description 太宽泛。加上负面边界，并写明应该改用哪个技能。"),
        ],
        trouble: [
          { s: t("The skill never loads", "技能从来不被加载"), c: t("The description is a label (\"Policy helper\") with no trigger.", "description 只是个标签（“Policy helper”），没有触发条件。"), f: t("Add \"Use when ...\" with concrete request shapes. The skill-creator guidance in the corpus says descriptions should be a little pushy, because models tend not to use skills.", "加上“Use when ...”和具体的请求形式。语料中 skill-creator 的指导说 description 要写得稍微强势一点，因为模型往往不太主动使用技能。") },
          { s: t("The wrong skill loads", "加载了错误的技能"), c: t("Two descriptions overlap.", "两个 description 有重叠。"), f: t("Give each a \"Do not use for ...\" that names the other skill.", "给每个技能都加上“Do not use for ...”，并点名另一个技能。") },
          { s: t("A polished output with thin content", "输出很工整，但内容单薄"), c: t("A procedure skill was read before the material was gathered, so the template shaped the work.", "在收集材料之前就读了流程类技能，于是模板主导了工作。"), f: t("For procedure skills, gather the material first and then open the skill, as Anthropic's 5.5 agentic prompt says. Knowledge skills such as expense-policy load first, because they hold the facts.", "对于流程类技能，先收集材料再打开技能，正如 Anthropic 的 5.5 智能体提示词所说。像 expense-policy 这样的知识类技能要先加载，因为事实就在里面。") },
        ],
        done: t("Both skills lint clean, and on your model trigger recall is at least 0.8 with a false trigger rate of 0.", "两个技能检查都没有问题，并且在你的模型上触发召回率至少 0.8，误触发率为 0。"),
        scale: [
          t("Dozens of skills: the index costs one line each. Past about fifty, index by group and let a search step choose; Meta's Muse agent keeps 59 of its 89 skills out of the always-on catalog with includeInPrompt false.", "技能达到几十个时：索引每个技能占一行。超过约五十个后，按组建立索引，让搜索步骤来选择；Meta 的 Muse 智能体用 includeInPrompt false 把 89 个技能中的 59 个排除在常驻目录之外。"),
          t("Shared skills: version them like code, with their trigger evals in the same folder, so a change to a description is tested in the same review.", "共享技能：像代码一样做版本管理，并把触发评估放在同一个文件夹里，这样修改 description 时能在同一次评审中测试。"),
        ],
        challenge: [
          { q: t("Why not put the policy in the system prompt?", "为什么不把政策直接写进系统提示词？"), a: t("You can, and the inline-skills variant in step [[experiment]] tests exactly that. With one skill it may cost nothing; the question is what happens at twenty. A policy update also becomes a reviewed skill change instead of a prompt edit that touches everything.", "可以，第 [[experiment]] 步的 inline-skills 变体测的就是这个。只有一个技能时可能没有代价；问题在于有二十个时会怎样。而且政策更新会变成一次经过评审的技能变更，而不是牵一发而动全身的提示词修改。") },
        ],
        models: {
          generic: t("The same skill folder works across harnesses. Only the index format and the load tool's name differ.", "同一个技能文件夹可以在各种框架间通用。只有索引格式和加载工具的名称不同。"),
          claude: t("Anthropic's format: a name of at most 64 lowercase letters, digits and hyphens that cannot contain \"anthropic\" or \"claude\", a description of at most 1,024 characters saying what and when, and a body under about 5k tokens. Bundled scripts can run without being read. Claude Code also accepts when_to_use, disable-model-invocation and allowed-tools.", "Anthropic 的格式：名称最多 64 个小写字母、数字和连字符，且不能包含 “anthropic” 或 “claude”；description 最多 1,024 个字符，说明做什么和何时用；正文约 5k token 以内。附带的脚本可以不经读取直接运行。Claude Code 还接受 when_to_use、disable-model-invocation 和 allowed-tools。"),
          gpt: t("Codex and ChatGPT index each skill as one line, and the dots index in the corpus truncates descriptions near 200 characters, so put the trigger words first. GPT-6.1 Sol pauses on conflicts between a SKILL.md and the user; say that the user's instruction wins.", "Codex 和 ChatGPT 把每个技能索引为一行，语料中的 dots 索引会把 description 截断在 200 个字符左右，所以要把触发词放在前面。GPT-6.1 Sol 在 SKILL.md 与用户指令冲突时会停下来；要写明以用户指令为准。"),
          gemini: t("Gemini CLI activates skills with activate_skill and the same name-plus-description idea.", "Gemini CLI 通过 activate_skill 激活技能，采用同样的名称加 description 的思路。"),
          grok: t("grok-build reads skills from .grok/skills/, and its prompt in the corpus refers to SKILL.md files 21 times.", "grok-build 从 .grok/skills/ 读取技能，语料中它的提示词提到 SKILL.md 文件 21 次。"),
          qwen: t("On a 4k-token budget every resident line counts: keep descriptions near 150 to 250 characters and list only the skills this agent needs.", "在 4k token 的预算下，每一行常驻内容都很重要：description 保持在 150 到 250 个字符左右，只列出这个智能体需要的技能。"),
          kimi: t("Kimi 3's prompt in the corpus has its own skill system with precedence rules and an append-only log of plugin changes.", "语料中 Kimi 3 的提示词有自己的技能系统，带优先级规则和只追加的插件变更日志。"),
          llama: t("Small models under-trigger more. Test with triggers.json before you trust the index, and consider a cheap keyword pre-router that loads the skill for the model.", "小模型更容易触发不足。在信任索引之前先用 triggers.json 测试，并考虑用一个廉价的关键词预路由器替模型加载技能。"),
        },
      },
      {
        id: "project",
        title: t("Write project instructions for the agents that build it", "为搭建框架的智能体编写项目指令"),
        local: t("template/AGENTS.md: commands, definition of done, conventions, boundaries and known pitfalls.", "template/AGENTS.md：命令、完成标准、约定、边界和已知陷阱。"),
        links: ["skills.share"],
        after: ["layout"],
        why: t(
          "Your harness will be built and changed by coding agents (Codex, Claude Code, Gemini CLI, Cursor). Each reads a project instruction file before it works, and their conventions converged: the scope is the file's folder and everything below it, deeper files override, and direct instructions beat the file. Codex stops loading at 32 KiB by default. The file is for facts a new session cannot derive in a few tool calls: exact commands, the definition of done, boundaries. Claude Code's doctor and init skills warn against filler such as \"follow best practices\" and against moving a \"never do X\" rule into a skill that may not load.",
          "你的框架会由编码智能体（Codex、Claude Code、Gemini CLI、Cursor）来搭建和修改。它们开始工作前都会读一份项目指令文件，而且约定已经趋同：作用范围是文件所在文件夹及其下所有内容，更深层的文件优先，直接指令优先于文件。Codex 默认读到 32 KiB 就停止加载。这份文件只写新会话用几次工具调用推导不出来的事实：确切的命令、完成标准、边界。Claude Code 的 doctor 和 init 技能都警告不要写“遵循最佳实践”这类空话，也不要把“绝不做 X”这类规则移到可能不会被加载的技能里。",
        ),
        what: t(
          "AGENTS.md for this harness: commands to render, lint, test and evaluate; a definition of done (lint clean, tests pass, oracle still 1.0, release gate PASS); conventions (edit core.md only, every rule has why and caps, a new tool needs a tier, a new skill needs trigger evals); boundaries (never edit cases to make a run pass, ask before changing tiers or budgets, no keys in files); and known pitfalls (Ollama truncation, results do not transfer between models).",
          "这个框架的 AGENTS.md：渲染、检查、测试和评估的命令；完成标准（检查无问题、测试通过、理想基线仍为 1.0、发布闸门 PASS）；约定（只改 core.md、每条规则都有 why 和 caps、新工具需要级别、新技能需要触发评估）；边界（绝不为了让运行通过而修改用例，修改级别或预算前先询问，文件中不放密钥）；以及已知陷阱（Ollama 截断、结果不能在模型之间直接迁移）。",
        ),
        how: [
          t("Write the commands exactly as you would paste them, including how to run a single test.", "按你会直接粘贴的样子写命令，包括如何运行单个测试。"),
          t("Write the definition of done as commands that must pass.", "把完成标准写成必须通过的命令。"),
          t("List the boundaries as ask-first and never, each with its reason.", "把边界分成“先询问”和“绝不”两类列出，每条都附上理由。"),
          t("Lint it with --kind agents. Copy or symlink it to CLAUDE.md or GEMINI.md if your tools expect those names, or set context.fileName in Gemini CLI.", "用 --kind agents 检查它。如果你的工具需要 CLAUDE.md 或 GEMINI.md 这样的文件名，就复制或建立符号链接，或在 Gemini CLI 中设置 context.fileName。"),
        ],
        files: [K + "template/AGENTS.md"],
        interpret: [
          t("agents-commands and agents-done are the two findings that matter most: without them, a coding agent guesses how to test and decides for itself when it is finished.", "agents-commands 和 agents-done 是最重要的两项检查：没有它们，编码智能体只能猜测如何测试，并自己决定何时算完成。"),
          t("If an agent does something the file forbids, check the scope (is the file on the agent's folder path?) and the size (past 32 KiB, Codex stops reading).", "如果智能体做了文件禁止的事，检查作用范围（文件是否在智能体的文件夹路径上？）和大小（超过 32 KiB 时 Codex 就不再读取）。"),
        ],
        trouble: [
          { s: t("A coding agent edits eval cases to make a run pass", "编码智能体为了让运行通过而修改评估用例"), c: t("The boundary is missing or vague.", "边界缺失或含糊。"), f: t("State it with the reason, and protect evals/ with code owners in your Git host, so the rule is enforced and not only written.", "写明这条边界及其理由，并在 Git 托管平台上用代码负责人机制保护 evals/，让规则被强制执行，而不只是写在纸上。") },
          { s: t("The file grows into a manual", "文件膨胀成一本手册"), c: t("Facts a session can derive were added.", "加进了会话能自己推导出的事实。"), f: t("Cut them, move procedures into skills, and keep only commands, done, boundaries and pitfalls here.", "删掉它们，把流程移到技能里，这里只保留命令、完成标准、边界和陷阱。") },
        ],
        done: t("AGENTS.md lints clean, and a fresh coding-agent session can run every command in it without asking.", "AGENTS.md 检查没有问题，一个全新的编码智能体会话无需提问就能运行其中的每条命令。"),
        scale: [
          t("Monorepos: one AGENTS.md per package; the deeper file overrides the root one for files under it.", "大型单仓库：每个包一份 AGENTS.md；对于包内的文件，更深层的文件覆盖根目录的文件。"),
        ],
        challenge: [
          { q: t("Why not put this in the README?", "为什么不写在 README 里？"), a: t("The README is written for people, often for onboarding, and grows accordingly. AGENTS.md is read by an agent at the start of every session, so it must stay short and factual. The README can link to it.", "README 是写给人看的，通常用于入门，也会随之变长。AGENTS.md 在每次会话开始时都会被智能体读取，所以必须简短、只写事实。README 可以链接到它。") },
        ],
        models: {
          generic: t("Name the file as your coding tool expects, or keep AGENTS.md and link the other names to it.", "按你的编码工具要求的名字命名文件，或者保留 AGENTS.md，让其他名字链接到它。"),
          gpt: t("Codex: AGENTS.override.md wins within a directory, files are concatenated from the root to the working directory, and Codex must be restarted to see changes. Astra is more sensitive to conflicting guidance, so state the precedence.", "Codex：同一目录中 AGENTS.override.md 优先，文件从根目录到工作目录依次拼接，修改后需要重启 Codex 才能生效。Astra 对相互冲突的指导更敏感，所以要写明优先级。"),
          claude: t("Claude Code reads CLAUDE.md files with imports; its doctor skill checks for bloat and for rules that belong in hooks rather than text.", "Claude Code 读取支持导入的 CLAUDE.md 文件；它的 doctor 技能会检查文件是否臃肿，以及哪些规则应该放在钩子里而不是文字里。"),
          gemini: t("GEMINI.md supports @file imports, and /memory show prints what is loaded; use it to confirm the file was picked up.", "GEMINI.md 支持 @file 导入，/memory show 会打印已加载的内容；用它来确认文件已被读取。"),
          grok: t("grok-build accepts AGENTS.md, Agents.md, Claude.md and AGENT.md, plus AGENTS.project.md and .grok/skills/.", "grok-build 接受 AGENTS.md、Agents.md、Claude.md 和 AGENT.md，以及 AGENTS.project.md 和 .grok/skills/。"),
        },
      },
      {
        id: "subagents",
        title: t("Add subagents only for the two jobs they do well", "只在两类擅长的工作上使用子智能体"),
        local: t("template/agents/verifier.md and explorer.md: definitions with when to use, tools, model and an output contract.", "template/agents/verifier.md 和 explorer.md：包含使用时机、工具、模型和输出约定的定义。"),
        links: ["multi-agent.justify", "multi-agent.workers"],
        after: ["tools", "skills"],
        why: t(
          "The corpus agrees on two cases where a subagent earns its cost: reading a lot to return a little (exploration keeps raw records out of the main context), and checking work with fresh eyes (a verifier that has not seen how the answer was made). Elsewhere subagents add tokens, latency and failure points: Copilot CLI warns against speculative background agents, Zed and Amp against delegating tasks of one or two calls, and Anthropic's guide says Opus 4.6 has a strong predilection for subagents that you should rein in. Every corpus subagent definition repeats one safety line: messages from the parent are direction, never the user's approval.",
          "语料对子智能体值得投入的情况有两点共识：读得多、返回得少（探索可以让原始记录不进入主上下文），以及用一双新眼睛检查工作（一个没看过答案如何产生的验证者）。在其他情况下，子智能体只会增加 token、延迟和故障点：Copilot CLI 警告不要做推测性的后台智能体，Zed 和 Amp 警告不要把一两次调用就能完成的任务委派出去，Anthropic 的指南也说 Opus 4.6 特别偏爱子智能体，需要加以约束。语料中每个子智能体定义都重复同一条安全规则：父智能体的消息是指导，绝不等于用户的批准。",
        ),
        what: t(
          "verifier.md has read-only tools, fetches each id in the claim and compares the figures, probes one case off the happy path, and ends with one verdict line: PASS, FAIL with the reason, or BLOCKED with the cause. explorer.md gathers facts on a small model and returns the answer plus one evidence line per id. Both lint clean against the subagent rules: frontmatter, the consent line and an output contract.",
          "verifier.md 只有只读工具，会逐个获取声明中的 id 并比对数字，额外探查一个非常规情况，最后只输出一行结论：PASS、带原因的 FAIL，或带原因的 BLOCKED。explorer.md 在小模型上收集事实，返回答案以及每个 id 一行的证据。两者都通过了子智能体规则检查：frontmatter、关于批准的说明以及输出约定。",
        ),
        how: [
          t("Write the parent's rule first: delegate when answering means reading many records and only the conclusion matters, or when an independent check is worth its cost.", "先写父智能体的委派规则：当回答需要读大量记录而只有结论重要时，或者独立检查值得其成本时，才委派。"),
          t("Give each subagent the fewest tools: read-only unless it must write, and never two writers on the same records.", "给每个子智能体尽量少的工具：除非必须写入，否则只读；绝不让两个写入者处理同一批记录。"),
          t("Brief it like a colleague who just walked in: what you know, what you ruled out, what to return. Never write \"based on your findings, fix it\".", "像对待一位刚进门的同事那样交代任务：你知道什么、排除了什么、需要返回什么。绝不要写“根据你的发现，把它修好”。"),
          t("Fix the output contract: the exact last line or section the parent will parse.", "确定输出约定：父智能体要解析的最后一行或最后一节具体是什么。"),
          t("Choose the model per agent: a small one for lookups, the parent's model for judgment.", "为每个子智能体选择模型：查询用小模型，需要判断的用父智能体的模型。"),
        ],
        files: [K + "template/agents/verifier.md", K + "template/agents/explorer.md"],
        interpret: [
          t("If the verifier fails often on figures, the main agent's grounding is weak. Fix it at the source (step [[verify]]), not by adding more verifiers.", "如果验证者经常在数字上判为 FAIL，说明主智能体的依据不足。要从源头修复（第 [[verify]] 步），而不是增加更多验证者。"),
          t("Count how often the parent delegates where a single tool call would do. That number is pure cost.", "统计父智能体有多少次在一次工具调用就够的情况下仍然委派。这个数字纯粹是成本。"),
        ],
        trouble: [
          { s: t("The parent repeats a subagent's claim without checking it", "父智能体不加核对就照搬子智能体的结论"), c: t("Summaries were treated as facts.", "把摘要当成了事实。"), f: t("Check the actual records or changes, not the summary; that is the verifier's job and the reason it has tools.", "核对实际的记录或改动，而不是摘要；这正是验证者的职责，也是它配备工具的原因。") },
          { s: t("A subagent performs a write on the parent's say-so", "子智能体凭父智能体一句话就执行了写操作"), c: t("The brief was treated as approval.", "把任务说明当成了批准。"), f: t("Keep the consent line in every definition, and let the gate decide: approvals come only from the user.", "在每个定义中保留关于批准的说明，并让闸门来决定：批准只能来自用户。") },
          { s: t("Token cost per task doubles", "每个任务的 token 成本翻倍"), c: t("Over-delegation.", "委派过度。"), f: t("Add the parent's decision rule to the prompt and measure cost per task in step [[experiment]].", "把父智能体的委派规则写进提示词，并在第 [[experiment]] 步中测量每个任务的成本。") },
        ],
        done: t("Both definitions lint clean, and in a test run the verifier catches a planted wrong figure.", "两个定义检查都没有问题，并且在一次测试运行中验证者抓到了一个故意植入的错误数字。"),
        scale: [
          t("Parallel explorers with disjoint scopes and a concurrency cap. An orchestrator accepts \"done\" only with evidence it saw itself, as Meta's Muse agents skill requires.", "并行探索者，范围互不重叠，并设并发上限。编排者只在看到亲自核实的证据时才接受“完成”，正如 Meta 的 Muse agents 技能所要求的。"),
        ],
        challenge: [
          { q: t("Why not use a multi-agent team for everything?", "为什么不在所有地方都用多智能体团队？"), a: t("The multi-agent module of the curriculum measured it: orchestration used more model calls for the same answer. Justify each split with what it buys: a smaller context or an independent check.", "课程中的多智能体模块做过测量：同样的答案，编排方式用了更多次模型调用。每一次拆分都要说明它换来了什么：更小的上下文，或者独立的检查。") },
        ],
        models: {
          claude: t("Claude Code subagents use frontmatter with name, whenToUse, tools or disallowedTools, and model (inherit, haiku, sonnet, opus); the doc-lookup agent runs on Haiku. Opus 4.6 over-delegates, so say when to.", "Claude Code 的子智能体在 frontmatter 中使用 name、whenToUse、tools 或 disallowedTools，以及 model（inherit、haiku、sonnet、opus）；查文档的智能体跑在 Haiku 上。Opus 4.6 容易过度委派，所以要写明何时委派。"),
          gpt: t("GPT-6 has collaboration tools (spawn_agent, wait_agent and others) with four concurrency slots; proactive delegation is off unless the user, AGENTS.md or a skill asks for it.", "GPT-6 有协作工具（spawn_agent、wait_agent 等），提供四个并发槽位；除非用户、AGENTS.md 或某个技能要求，否则不会主动委派。"),
          gemini: t("Gemini CLI delegates batch work over more than three files and never runs parallel agents that change the same files.", "Gemini CLI 在涉及三个以上文件的批量工作时才委派，并且绝不并行运行会修改同一批文件的智能体。"),
          grok: t("grok-4.7-cli spawns subagents with worktree isolation, and they receive a compacted AGENTS.md, so pass the rules they need inline.", "grok-4.7-cli 以工作树隔离的方式创建子智能体，它们收到的是压缩版的 AGENTS.md，所以要把所需规则直接写进任务说明。"),
          qwen: t("On one local GPU, subagents run one after another and each context costs memory. A verifier on a smaller local model is cheap; an explorer may not be worth it.", "在一块本地 GPU 上，子智能体只能依次运行，每个上下文都占用显存。用较小的本地模型做验证者成本很低；探索者则未必划算。"),
        },
      },
      {
        id: "memory",
        title: t("Set memory and context rules", "制定记忆与上下文规则"),
        local: t("template/memory/: MEMORY.md (data only), README.md (the rules), handoff.md (the compaction shape).", "template/memory/：MEMORY.md（只存数据）、README.md（规则）、handoff.md（压缩摘要格式）。"),
        links: ["memory.partition", "memory.plug"],
        after: ["loop"],
        why: t(
          "Two problems, one discipline. Across sessions, the corpus memory systems store only facts a person stated or a tool confirmed, with a source and a date; never data a tool can return fresh; never instructions, which Anthropic's memory filters forbid and which another corpus harness warns get re-read as orders. Within a long task, compaction summarizes old turns, and the corpus compaction prompts use fixed sections: nine in Claude Code, nine headings plus a remaining-work JSON line in Muse Code, five in Copilot CLI. Harnesses also tell the model that compaction exists, so it does not wrap up early.",
          "两个问题，同一套纪律。跨会话方面，语料中的记忆系统只存储有人明确说过或工具确认过的事实，并注明来源和日期；绝不存储工具可以重新获取的数据；也绝不存储指令，Anthropic 的记忆过滤规则禁止这样做，语料中另一个框架也警告说，指令会被当作命令重新读取。在长任务内部，压缩会总结旧的轮次，语料中的压缩提示词都使用固定的小节：Claude Code 九节，Muse Code 九个标题外加一行剩余工作 JSON，Copilot CLI 五节。各框架还会告诉模型存在压缩机制，以免它过早收尾。",
        ),
        what: t(
          "MEMORY.md with frontmatter and dated [stated] lines; README.md with six rules (store stated or confirmed facts only, nothing a tool returns fresh, no instructions, check before acting, write after the turn, forget completely); handoff.md with eight fixed sections ending in a machine-checkable remaining-work JSON line. The linter's memory-orders rule warns when a memory line is an imperative.",
          "MEMORY.md 带 frontmatter，以及带日期的 [stated] 条目；README.md 写了六条规则（只存明确说过或已确认的事实、不存工具能重新获取的内容、不存指令、行动前先核对、在本轮结束后再写、遗忘要彻底）；handoff.md 有八个固定小节，最后是一行可由机器检查的剩余工作 JSON。检查器的 memory-orders 规则会在记忆条目是祈使句时发出警告。",
        ),
        how: [
          t("Decide what may be remembered: facts and preferences a person stated, with dates. Nothing a tool can return fresh.", "确定可以记住什么：有人明确说过的事实和偏好，并注明日期。凡是工具能重新获取的都不记。"),
          t("Write memory after the turn, in a separate pass that sees the whole exchange, not in the middle of work.", "在本轮结束后，由能看到完整对话的单独流程写入记忆，而不是在工作进行中写。"),
          t("Before acting on a memory that names a record, check the record with a tool.", "在依据一条提到某条记录的记忆采取行动之前，先用工具核对那条记录。"),
          t("When the history passes about half the context budget, compact it into the handoff.md shape and continue from that; then re-read the newest user message.", "当历史超过上下文预算的大约一半时，按 handoff.md 的格式压缩，并从压缩结果继续；然后重新读一遍最新的用户消息。"),
          t("If your harness compacts, say so in the prompt, so the model does not stop early as the context fills.", "如果你的框架会压缩上下文，就在提示词中说明，免得模型在上下文快满时过早停止。"),
        ],
        files: [K + "template/memory/README.md", K + "template/memory/MEMORY.md", K + "template/memory/handoff.md"],
        interpret: [
          t("A memory line that starts with Always or Never is a rule nobody reviewed. Rewrite it as a dated preference.", "以 Always 或 Never 开头的记忆条目，是一条没人审查过的规则。把它改写成带日期的偏好。"),
          t("If the handoff JSON counts do not add up (completed plus remaining is not the total), the summary lost work.", "如果交接 JSON 中的数字对不上（已完成加剩余不等于总数），说明摘要丢掉了一部分工作。"),
        ],
        trouble: [
          { s: t("The agent repeats a stale figure from memory", "智能体从记忆中重复了一个过时的数字"), c: t("Data a tool can return was stored.", "存储了工具本可以重新获取的数据。"), f: t("Store where to find it, not the value, and check before acting.", "存储去哪里找，而不是值本身，并在行动前核对。") },
          { s: t("The agent restarts the task after compaction", "压缩后智能体重新开始了任务"), c: t("The summary lacked intent and state.", "摘要缺少意图和当前状态。"), f: t("Use the fixed sections, and treat the newest user message after compaction as steering, not a new task (the Codex prompt says the same).", "使用固定小节，并把压缩后最新的用户消息当作方向调整，而不是新任务（Codex 的提示词也是这样说的）。") },
          { s: t("The agent wraps up early as the context fills", "上下文快满时智能体过早收尾"), c: t("It does not know compaction exists.", "它不知道存在压缩机制。"), f: t("Say so in the prompt; Anthropic's guide gives this exact advice for harnesses that compact.", "在提示词中说明；Anthropic 的指南正是针对会压缩上下文的框架给出了这条建议。") },
        ],
        done: t("Memory files lint clean, and your compaction code produces the handoff.md sections with a remaining-work line that adds up.", "记忆文件检查没有问题，并且你的压缩代码能生成 handoff.md 的各个小节，剩余工作那一行的数字能对上。"),
        scale: [
          t("Many users: one memory folder per user, with the privacy rules in README.md applied at write time, and consolidation jobs that merge duplicates on a schedule.", "用户很多时：每个用户一个记忆文件夹，在写入时执行 README.md 中的隐私规则，并定期运行合并重复条目的整理任务。"),
        ],
        challenge: [
          { q: t("Why not let the agent write memory whenever it wants?", "为什么不让智能体随时写记忆？"), a: t("Mid-task writes record guesses as facts. A separate pass that sees the whole exchange decides what is durable; the corpus memory systems are built exactly this way.", "工作中途写入会把猜测记成事实。由一个能看到完整对话的单独流程来判断什么值得长期保存；语料中的记忆系统正是这样构建的。") },
        ],
        models: {
          claude: t("Server-side compaction (beta, 4.6 and later) is Anthropic's primary strategy for long agentic runs, and context editing can clear old tool results. Tell Claude when the harness compacts. Prompt caching changes what you pay, not how much context is used.", "服务器端压缩（测试版，4.6 及以后）是 Anthropic 处理长时间智能体运行的主要策略，上下文编辑可以清除旧的工具结果。框架会压缩时要告诉 Claude。提示词缓存改变的是费用，而不是上下文占用。"),
          gpt: t("GPT-5.6 keeps reasoning across turns by default, so histories grow faster. After compaction the Codex prompt treats the newest message as steering and checks the final answer addresses it.", "GPT-5.6 默认跨轮保留推理内容，所以历史增长更快。压缩之后，Codex 的提示词把最新消息当作方向调整，并检查最终回答是否回应了它。"),
          gemini: t("Thought preservation is on by default and raises token use; context caching is supported.", "思考保留默认开启，会增加 token 用量；支持上下文缓存。"),
          deepseek: t("With tools, reasoning_content from every turn must be resent, so the history grows quickly. Compact earlier than you would for other families.", "带工具时，每一轮的 reasoning_content 都必须重新发送，所以历史增长很快。要比其他系列更早压缩。"),
          qwen: t("Locally, context is memory: Ollama's q8_0 KV cache halves its memory with little loss, and Ollama recommends at least 64,000 tokens for agents. Compact earlier than on a hosted model.", "在本地，上下文就是显存：Ollama 的 q8_0 KV 缓存能把显存占用减半且损失很小，Ollama 建议智能体至少使用 64,000 token 的上下文。要比托管模型更早压缩。"),
          kimi: t("K3 has a 1M-token window and automatic caching with a 5-minute or 1-hour lifetime; partial blocks are billed as a miss.", "K3 有 1M token 的窗口和自动缓存，缓存有效期为 5 分钟或 1 小时；不完整的块按未命中计费。"),
        },
      },
    ],
  },
  {
    id: "control",
    title: t("Put control in code", "把控制放进代码"),
    goal: t(
      "Make the agent safe and dependable by mechanisms, not by hope: a gate that decides every tool call, an ask-and-stop policy with a check on the final message, and verification of claims against what the tools returned.",
      "通过机制而不是寄希望于模型，让智能体安全可靠：一个决定每次工具调用的闸门，一套提问与停止策略并检查最终消息，以及根据工具返回内容对结论进行核实。",
    ),
    steps: [
      {
        id: "gate",
        title: t("Gate every action and label untrusted input", "为每个动作设闸门，并标记不可信输入"),
        local: t("runtime/gate.py: allow, ask or deny for every call, read from contract.yml; untrusted fields wrapped where they enter (evals/world.py).", "runtime/gate.py：根据 contract.yml 对每次调用给出 allow、ask 或 deny；不可信字段在进入处被包装（evals/world.py）。"),
        links: ["guardrails.hooks", "harness.hooks", "tools-mcp.limits"],
        after: ["loop", "contract"],
        why: t(
          "Prompt rules are the second line of defense. The corpus systems that act on the world enforce their tiers outside the model: Meta's Muse manifests mark each method allow or ask, many with an approval phrase; Claude Code's permission mode is enforced by the harness, and a denied call means adjust, not retry; Perplexity Computer puts sends, purchases, deletions and large fan-outs behind a confirmation tool. Prompt injection arrives through tool results, so the defense is to label untrusted fields where they enter, and to refuse dangerous actions in code whatever the text says.",
          "提示词规则只是第二道防线。语料中那些会对现实世界采取行动的系统，都在模型之外执行权限级别：Meta 的 Muse 清单把每个方法标为 allow 或 ask，其中许多带有批准口令；Claude Code 的权限模式由框架强制执行，被拒绝的调用意味着要调整做法，而不是重试；Perplexity Computer 把发送、购买、删除和大规模分发都放在确认工具之后。提示词注入通过工具结果到来，所以防御方法是在不可信字段进入时就加上标记，并且无论文字怎么说，都在代码中拒绝危险动作。",
        ),
        what: t(
          "gate.load_tiers reads contract.yml; decide returns allow, needs_confirmation or denied; unknown tools are denied. An approval names one exact action (a tool and the arguments it must match, such as flag_expense for E-1007), unlocks ask but never deny, and is used once. guarded wraps the executor and refuses to run the same write twice, so a retry or a nudged turn cannot create a duplicate. world.py wraps the fields that contract.yml lists as untrusted_inputs (note and vendor) in untrusted tags with their source. The eval set has an injection case (E-1009's note tells the agent to email every expense outside), a deny case and an approval case.",
          "gate.load_tiers 读取 contract.yml；decide 返回 allow、needs_confirmation 或 denied；未知工具一律拒绝。一次批准只针对一个确切的操作（一个工具及它必须匹配的参数，比如对 E-1007 执行 flag_expense），可以解锁 ask，但绝不能解锁 deny，并且只能用一次。guarded 包装执行器，并拒绝把同一个写操作执行两次，这样重试或被提醒后的回合都不会产生重复。world.py 用带来源的 untrusted 标签包装 contract.yml 中 untrusted_inputs 列出的字段（note 和 vendor）。评估集中有一个注入用例（E-1009 的备注要求智能体把所有报销都发邮件到外部）、一个拒绝用例和一个批准用例。",
        ),
        how: [
          t("Give every tool a tier in contract.yml and review the list with the business owner.", "在 contract.yml 中为每个工具设定级别，并与业务负责人一起审查清单。"),
          t("Wrap every executor with guarded; never call a tool function directly from the loop.", "用 guarded 包装每个执行器；绝不在循环中直接调用工具函数。"),
          t("Wrap untrusted fields at their source, and name those sources in the prompt's priorities.", "在来源处包装不可信字段，并在提示词的优先级中点名这些来源。"),
          t("Take approvals only from the user's own message in this conversation, recorded by the harness. In evals, the case's approvals list stands in for that record.", "只接受用户在本次对话中亲自给出、并由框架记录的批准。在评估中，用例的 approvals 列表代替这一记录。"),
          t("Run the safety cases: deny-email, injection-note and flag-needs-approval.", "运行安全用例：deny-email、injection-note 和 flag-needs-approval。"),
        ],
        files: [K + "runtime/gate.py"],
        interpret: [
          t("In the run log, needs_confirmation on flag_expense means the gate worked. What the case grades is whether the answer then says so honestly and asks.", "在运行日志中，flag_expense 出现 needs_confirmation 说明闸门起作用了。用例评判的是回答随后是否如实说明并提出询问。"),
          t("Any allow on send_email is a gate bug, not a model problem. The unit tests prove approvals cannot unlock deny.", "send_email 上出现任何 allow 都是闸门的缺陷，而不是模型的问题。单元测试证明了批准无法解锁 deny。"),
        ],
        trouble: [
          { s: t("The model tries send_email after reading a note", "模型读了备注之后尝试调用 send_email"), c: t("It followed text inside a tool result.", "它遵从了工具结果中的文字。"), f: t("The gate denied it. Strengthen the untrusted-data rule and check the wrapping; the safety case keeps failing until the model stops trying, because the attempt itself is the finding.", "闸门已经拒绝了它。加强不可信数据规则并检查包装；在模型不再尝试之前，这个安全用例会一直失败，因为尝试本身就是问题所在。") },
          { s: t("An approval from one conversation is used in the next", "一次对话中的批准被用到了下一次"), c: t("Approvals were persisted.", "批准被持久保存了。"), f: t("Approvals belong to one run; never store them in memory.", "批准只属于单次运行；绝不要把它存进记忆。") },
          { s: t("A new tool works without review", "一个新工具没经审查就能用了"), c: t("A default other than deny for unknown tools.", "对未知工具的默认处理不是 deny。"), f: t("Unknown tools are denied; a unit test asserts every declared tool has a tier.", "未知工具一律拒绝；有一个单元测试断言每个声明的工具都有级别。") },
        ],
        done: t("The safety cases pass on your model, and the unit tests show approvals cannot unlock deny.", "安全用例在你的模型上通过，单元测试表明批准无法解锁 deny。"),
        unconfirmed: t("The untrusted wrapper is a label, not a sanitizer. No vendor page claims labels stop injection; they reduce it. The gate is the guarantee for actions, but not for what the model says.", "不可信包装只是一个标记，不是净化器。没有任何厂商页面声称标记能阻止注入；它们只能减少注入。闸门能保证动作层面的安全，但管不了模型说了什么。"),
        scale: [
          t("Many users: per-user approvals with an audit log, approval phrases per method and per-method quotas, as in Meta's Muse manifests.", "用户很多时：按用户记录批准并保留审计日志，每个方法有自己的批准口令和配额，就像 Meta 的 Muse 清单那样。"),
        ],
        challenge: [
          { q: t("If the gate blocks it anyway, why test whether the model tries?", "既然闸门反正会拦住，为什么还要测试模型是否尝试？"), a: t("Because an attempt shows the model obeyed injected text. Next time the injected instruction may be a write you do allow, or a misleading answer, which no gate can stop.", "因为一次尝试说明模型遵从了注入的文字。下一次被注入的指令可能是一个你确实允许的写操作，或者是一个误导性的回答，而这些是任何闸门都拦不住的。") },
        ],
        models: {
          generic: t("Open-weight vendors' own prompts in the corpus (Qwen, DeepSeek, Kimi, GLM) carry no safety section at all. With those models, safety is entirely your harness: the gate plus an output check.", "语料中开放权重厂商自己的提示词（Qwen、DeepSeek、Kimi、GLM）完全没有安全部分。使用这些模型时，安全完全由你的框架负责：闸门加输出检查。"),
          claude: t("Anthropic's guide: confirm before irreversible or shared-system actions, and do not use destructive actions as a shortcut. The Claude in Chrome prompt opens with its injection defense.", "Anthropic 的指南：在不可逆或共享系统的操作之前先确认，不要把破坏性操作当作捷径。Claude in Chrome 的提示词一开头就是注入防御。"),
          gpt: t("GPT-5.6: one compact autonomy policy; confirm external writes, destructive actions, purchases and scope expansion. GPT-6 adds an auto-reviewer: the model must say when it rejected an action and why.", "GPT-5.6：一条简洁的自主策略；外部写入、破坏性操作、购买和范围扩大都要确认。GPT-6 增加了自动审查器：模型必须说明何时被拒绝了某个动作以及原因。"),
          gemini: t("Gemini CLI marks hook context as read-only data, explains mutating commands before running them, and forbids negotiating after a declined call.", "Gemini CLI 把钩子上下文标为只读数据，在执行会修改内容的命令前先解释，并禁止在调用被拒绝后讨价还价。"),
          grok: t("The Grok CLI compresses safety into a short key-value block with hard rules, and scopes authorization to the request.", "Grok CLI 把安全规则压缩成一小段带硬性规则的键值块，并把授权限定在当前请求范围内。"),
        },
      },
      {
        id: "stop",
        title: t("Decide when to ask, when to act and when to stop", "决定何时提问、何时行动、何时停止"),
        local: t("runtime/stopcheck.py and the asking rules in core.md: a cost test for questions and a check that a final answer is really final.", "runtime/stopcheck.py 和 core.md 中的提问规则：判断是否提问的成本测试，以及检查最终回答是否真的完成。"),
        links: ["harness.budget", "harness.triage"],
        after: ["loop", "prompt"],
        why: t(
          "Two opposite failures: asking too much (permission to search, \"shall I?\" with no reason) and stopping on a promise (\"I'll check the others next\"). The corpus moved from blanket rules to a cost test. Anthropic's Cowork prompt once said to always ask first; the 5.5 agentic prompt says to ask based on what a wrong guess would cost and to do everything that does not depend on the answer first. Codex says to ask only where a competent colleague would, and to make approval the last step on a concrete result. For stopping, harnesses check the last paragraph or run a judge that asks whether every deliverable is present, and goal tools define formal stop states: complete, blocked only after the same blocker three times, paused only on request.",
          "两种相反的问题：问得太多（搜索也要征求同意，无缘无故地问“要我做吗？”），以及停在一个承诺上（“我接下来会检查其他的”）。语料从一刀切的规则转向了成本测试。Anthropic 的 Cowork 提示词曾经要求总是先问；5.5 的智能体提示词则说，根据猜错的代价决定是否提问，并先完成所有不依赖答案的部分。Codex 说只在一位称职的同事也会问的地方提问，并把批准作为针对具体结果的最后一步。在停止方面，各框架会检查最后一段，或者运行一个判断所有交付物是否齐全的评审模型；目标类工具还定义了正式的停止状态：完成；只有同一障碍连续出现三次才算受阻；只有在用户要求时才暂停。",
        ),
        what: t(
          "The asking section of core.md: act on clear requests, no permission needed for lookups, one short question only when the readings mean materially different actions. stopcheck.classify reads the last paragraph and returns answer, question, promise or empty; Any question mark in the last paragraph makes it a question, and offers or conditionals (\"let me know if\", \"once you approve\") are not promises. loop.run with stopcheck on sends one nudge on a promise and then accepts what comes; the nudge says to do only what needs no approval and to ask for the rest, so it never pushes the model into a write. The cases ambiguous-fix and about-you test asking; the runtime-checks variant in step [[experiment]] tests the nudge.",
          "core.md 的提问小节：对明确的请求直接行动，查询无需征求同意，只有在不同理解会导致实质不同的动作时才问一个简短的问题。stopcheck.classify 读取最后一段，返回 answer、question、promise 或 empty；最后一段只要有问号就算提问，提议或条件句（“需要的话告诉我”“你批准后”）不算承诺。开启 stopcheck 的 loop.run 会在遇到承诺时发出一次提醒，之后无论结果如何都接受；提醒只要求去做无需批准的事、其余的向用户提问，因此不会把模型推向写操作。用例 ambiguous-fix 和 about-you 测试提问行为；第 [[experiment]] 步中的 runtime-checks 变体测试这次提醒。",
        ),
        how: [
          t("Write the ask rule as a cost test, with one example of a request that is ambiguous in a way that matters.", "把提问规则写成成本测试，并给出一个在关键之处有歧义的请求示例。"),
          t("State the default for your surface: chat asks before writes; a background run never waits except at an irreversible fork.", "写明你的使用场景下的默认做法：聊天时写操作前要问；后台运行除非遇到不可逆的分岔，否则绝不等待。"),
          t("Turn on stopcheck in the loop, and let step [[experiment]] tell you whether it helps your model.", "在循环中开启 stopcheck，让第 [[experiment]] 步告诉你它对你的模型是否有帮助。"),
          t("For background runs, end with one state line: result:, needs input: or failed:, the protocol Claude Code's background agent uses.", "对于后台运行，最后输出一行状态：result:、needs input: 或 failed:，这是 Claude Code 后台智能体使用的协议。"),
        ],
        files: [K + "runtime/stopcheck.py"],
        interpret: [
          t("A final that is a question on a clear lookup is over-asking. Count them per run; GPT-family prompts in the corpus push hardest against this.", "对一个明确的查询，最终回答却是一个问题，这就是问得太多。按次统计；语料中 GPT 系列的提示词对此抵制得最用力。"),
          t("The nudges field in each result row counts promise endings caught. A high count with the nudge on, and failures with it off, means the nudge is doing real work.", "每行结果中的 nudges 字段统计了被抓到的承诺式结尾。开启提醒时数量高、关闭时失败，说明提醒确实在起作用。"),
        ],
        trouble: [
          { s: t("The agent asks permission to search", "智能体搜索前也要征求同意"), c: t("No rule that lookups need no permission, or a model biased toward asking.", "没有“查询无需征求同意”的规则，或者模型本身倾向于提问。"), f: t("Add the rule with its reason. GPT-6.1 Sol's prompt treats \"can you\" and \"help me\" as instructions to act.", "加上这条规则并附理由。GPT-6.1 Sol 的提示词把“can you”和“help me”都视为要求行动的指令。") },
          { s: t("The agent stops after the first part", "智能体做完第一部分就停了"), c: t("No finish-every-part rule, or a promise ending.", "没有“完成每一部分”的规则，或者以承诺结尾。"), f: t("Add the rule and turn on stopcheck.", "加上这条规则并开启 stopcheck。") },
          { s: t("The agent never asks before an ambiguous write", "在有歧义的写操作之前智能体从不提问"), c: t("The ask rule has no example, so the model does not recognize ambiguity.", "提问规则没有示例，所以模型认不出歧义。"), f: t("Add one example, and rely on the gate for the write itself.", "加一个示例，写操作本身则依靠闸门。") },
        ],
        done: t("ambiguous-fix and about-you pass, and a full run has no promise endings left after the nudge.", "ambiguous-fix 和 about-you 通过，并且在提醒之后，一次完整运行中不再有承诺式结尾。"),
        scale: [
          t("Asynchronous questions: ask early, keep working on independent parts, proceed on a stated assumption for optional questions, and never treat elapsed time as approval for required ones (the Codex async question tool).", "异步提问：尽早提问，同时继续做不相关的部分；对可选问题，基于写明的假设继续；对必须回答的问题，绝不把时间流逝当作批准（Codex 的异步提问工具就是这样）。"),
        ],
        challenge: [
          { q: t("Why a regular expression and not a model judge?", "为什么用正则表达式而不是评审模型？"), a: t("It is cheap and deterministic and runs on every turn. Meta's Muse Code uses a side-car judge model for the harder question of whether every deliverable is present; add one when your evals show the regex missing cases.", "它便宜、确定，每一轮都能运行。Meta 的 Muse Code 用一个旁路评审模型来回答更难的问题：所有交付物是否齐全。当你的评估显示正则表达式漏掉了一些情况时，再加上评审模型。") },
        ],
        models: {
          gpt: t("GPT models over-ask by default, judging by how hard their prompts push back. GPT-6.1 Sol forbids stopping at a plan when the user wanted a change; Astra asks more clarifying questions, and OpenAI's guide offers bias-to-action prompts for it.", "从提示词的抵制力度来看，GPT 模型默认倾向于问得太多。GPT-6.1 Sol 禁止在用户想要修改时停在计划阶段；Astra 会问更多澄清问题，OpenAI 的指南为它提供了偏向行动的提示词。"),
          claude: t("Haiku 5.5's Claude Code prompt adds an autonomy block that Opus and Sonnet 5.5 do not get: ending the turn stops all work, and ask first only when the likeliest reading cannot be named. Fable 5.1 adds a last-paragraph check. The smaller tier gets explicit guards against stopping early.", "Haiku 5.5 的 Claude Code 提示词加了一段 Opus 和 Sonnet 5.5 没有的自主性说明：结束本轮就会停止所有工作，只有在说不出最可能的理解时才先问。Fable 5.1 加了检查最后一段的规则。较小的档位得到了防止过早停止的明确约束。"),
          gemini: t("Gemini CLI treats a request as an inquiry unless it contains an explicit directive, and makes no edits for inquiries. For an agent that should act, say so plainly.", "Gemini CLI 除非请求中包含明确指令，否则一律视为询问，并且对询问不做任何修改。如果你的智能体应该行动，就明确说出来。"),
          grok: t("grok-build triages each request into build, ask or answer, and only the vague case earns its one question.", "grok-build 把每个请求分成构建、提问或回答三类，只有含糊的请求才值得问一个问题。"),
          kimi: t("Kimi 2.6 caps a turn at 25 steps and tells the model most tasks need 0 to 3.", "Kimi 2.6 把每轮限制在 25 步，并告诉模型大多数任务只需要 0 到 3 步。"),
          qwen: t("Small local models stop early more often. The nudge costs one step; measure it with the runtime-checks variant.", "小型本地模型更常过早停止。一次提醒只多花一步；用 runtime-checks 变体来测量它的效果。"),
        },
      },
      {
        id: "verify",
        title: t("Verify claims before the answer ships", "在回答发出前核实结论"),
        local: t("runtime/verify.py and the verifier subagent: claims checked against tool results before the user sees them.", "runtime/verify.py 和验证者子智能体：在用户看到之前，根据工具结果核实结论。"),
        links: ["guardrails.check", "guardrails.review"],
        after: ["loop", "subagents"],
        why: t(
          "Every mature coding harness in the corpus makes \"done\" conditional on evidence: the Grok CLI allows done only when tool output supports it, Amp forbids hard-coding values to pass a test, Muse Code's verify reminder rejects self-built checks and screenshots that were never opened, and Claude Code's verify skill requires watching the running app. For a data agent the claims are figures and ids. An amount nobody returned is a fabricated figure, and finance acts on it.",
          "语料中每个成熟的编码框架都把“完成”建立在证据之上：Grok CLI 只有在工具输出支持时才允许说完成，Amp 禁止为通过测试而硬编码数值，Muse Code 的验证提醒会拒绝自己搭的检查和从未打开过的截图，Claude Code 的 verify 技能要求亲眼观察运行中的应用。对于数据类智能体，结论就是数字和 id。一个没有任何工具返回过的金额就是编造的数字，而财务部门会据此行动。",
        ),
        what: t(
          "verify.unverified lists the ids and amounts in the final answer that no tool result or user message supports. It allows totals of returned amounts and the difference of two seen numbers (an amount over a limit). loop.run with verify on sends one correction request. The graders' grounded check does the same thing offline. verifier.md (step [[subagents]]) is the fresh-eyes version for high-stakes answers.",
          "verify.unverified 列出最终回答中没有任何工具结果或用户消息支持的 id 和金额。它允许返回金额的合计，以及两个已出现数字之差（比如超出限额的金额）。开启 verify 的 loop.run 会发出一次更正请求。评分器中的 grounded 检查在离线时做同样的事。verifier.md（第 [[subagents]] 步）是针对高风险回答的独立复核版本。",
        ),
        how: [
          t("List the checkable claims for your agent: ids, amounts, dates, names.", "列出你的智能体中可以核实的结论类型：id、金额、日期、名称。"),
          t("Turn on verify in the loop and log the nudges.", "在循环中开启 verify 并记录提醒次数。"),
          t("For writes, read back: after flag_expense, fetch the record and confirm the change, as Meta's write cases require a fresh readback.", "对于写操作要回读：在 flag_expense 之后获取记录并确认改动，就像 Meta 的写操作用例要求重新回读那样。"),
          t("For high stakes, run the verifier subagent on the final claim before it is shown.", "对于高风险场景，在展示最终结论之前，先让验证者子智能体检查一遍。"),
        ],
        files: [K + "runtime/verify.py"],
        interpret: [
          t("Nudges per hundred runs is the fabrication rate your users would otherwise have seen.", "每百次运行中的提醒次数，就是用户本来会看到的编造率。"),
          t("If the correction rarely fixes the figure, the tool result is unclear to the model. Change what the tool returns before changing the prompt.", "如果更正很少能修好那个数字，说明工具结果让模型看不明白。先改工具返回的内容，再改提示词。"),
        ],
        trouble: [
          { s: t("Correct derived figures are flagged (a percentage, an average)", "正确的推导数字被标记了（百分比、平均值）"), c: t("The check allows only totals and differences.", "这项检查只允许合计和差值。"), f: t("Extend the allowed derivations in verify.py for your domain, or exclude that format, and add a unit test for it.", "在 verify.py 中为你的领域扩展允许的推导方式，或排除这种格式，并为它加一个单元测试。") },
          { s: t("The model mentions the check in its answer", "模型在回答中提到了这次检查"), c: t("The correction text was taken as content.", "把更正提示当成了内容。"), f: t("The correction says not to mention it; if the model still does, shorten the correction and move it to a system message where your API allows.", "更正提示里已经说了不要提及；如果模型还是提，就缩短提示，并在 API 允许时把它移到系统消息里。") },
        ],
        done: t("The grounded cases pass with verify on and with it off, and the nudge rate is recorded for your model.", "无论 verify 开还是关，grounded 用例都能通过，并且已记录你的模型的提醒率。"),
        scale: [
          t("Claims beyond numbers (a summary is faithful, a reason is right) need a model judge. Calibrate it against people before its numbers count (step [[graders]]).", "数字以外的结论（摘要是否忠实、理由是否正确）需要评审模型。在它的数字算数之前，先用人工判断来校准它（第 [[graders]] 步）。"),
        ],
        challenge: [
          { q: t("Is this not just the grader again?", "这不就是又一个评分器吗？"), a: t("Same check, different place. The grader measures; the runtime check protects users. Keep both: if the runtime check fixes everything, the grader shows it when you run with verify off.", "同样的检查，用在不同的地方。评分器负责衡量；运行时检查负责保护用户。两者都要保留：如果运行时检查修好了一切，关掉 verify 运行时评分器就会显示出来。") },
        ],
        models: {
          claude: t("Anthropic's guide says Opus 5 verifies well on its own and suggests removing legacy verification instructions for it. Measure before you add checks to a model that may not need them.", "Anthropic 的指南说 Opus 5 自己就能很好地验证，并建议为它去掉旧的验证指令。在给可能不需要检查的模型加检查之前，先测量。"),
          gpt: t("Codex tunes verification by tier: Luna and Spark are told not to test unless asked, Sol tests in proportion to risk. Do the same with your runtime checks.", "Codex 按档位调整验证：Luna 和 Spark 被告知除非用户要求否则不测试，Sol 按风险程度测试。你的运行时检查也要这样做。"),
          gemini: t("Google's own prompts push tool use: calling a tool and ignoring the result costs nothing, so when uncertain, call it. That supports grounding.", "Google 自己的提示词鼓励使用工具：调用工具后不用结果也没有代价，所以不确定时就调用。这有助于让回答有据可依。"),
          qwen: t("Small local models fabricate figures more often in long contexts; the runtime check is most valuable there.", "小型本地模型在长上下文中更容易编造数字；运行时检查在这种情况下最有价值。"),
          llama: t("Small local models invent figures more often: keep verify on, and keep tool results short so the right figure is easy to find.", "小型本地模型更常编造数字：保持 verify 开启，并让工具结果保持简短，便于找到正确的数字。"),
        },
      },
    ],
  },
];
