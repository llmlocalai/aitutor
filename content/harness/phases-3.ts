import { t } from "@/lib/types";
import type { HPhase } from "./types";

const K = "harness/";

/** Phases 5 and 6: evaluate (cases, graders, the structure experiment, the hill-climb loop), then ship and scale. */
export const phases3: HPhase[] = [
  {
    id: "evaluate",
    title: t("Evaluate, find the best structure, improve", "评估、找到最佳结构、持续改进"),
    goal: t(
      "Turn \"it seems better\" into numbers: a fixed world and cases, graders proven by an oracle and a null agent, an experiment that compares structures of the same content on your model, and a loop that fixes one failure at a time. This is the loop the process map tracks: steps 14 to 17 send you back to the step that owns each failure.",
      "把“看起来更好了”变成数字：一个固定的模拟世界和一组用例；经过理想智能体和空白智能体验证的评分器；在你的模型上比较同一内容不同结构的实验；以及每次只修一个问题的改进循环。这就是流程图所追踪的循环：第 14 到 17 步会把你送回负责每类问题的那一步。",
    ),
    steps: [
      {
        id: "cases",
        title: t("Fix the world and write the cases", "固定模拟世界并编写用例"),
        local: t("evals/fixtures/world.json, evals/world.py and evals/cases.json: a fixed world and 16 cases.", "evals/fixtures/world.json、evals/world.py 和 evals/cases.json：一个固定的模拟世界和 16 个用例。"),
        links: ["evaluation.frozen", "evaluation.seal", "guardrails.collect"],
        after: ["gate", "verify", "skills"],
        why: t(
          "Without a fixed set of cases, every change is judged by a few chats, and the last chat wins the argument. The corpus shows how vendors test. Meta ships 353 cases in 13 eval files as simulated-user conversations graded from the tool trajectory, with typed categories (write, read, routing, safety, grounding, trigger-positive and trigger-negative). Anthropic's eval guidance sources inputs from production logs first and requires two sign-offs, on the inputs and on the grading method. Both insist that a case whose precondition is not met is skipped, not passed. The world is fixed so every run sees the same facts.",
          "没有一组固定的用例，每次改动都只能靠几次聊天来评判，最后一次聊天就赢得了争论。语料展示了厂商如何测试。Meta 在 13 个评估文件中提供了 353 个用例，形式是模拟用户的对话，根据工具调用轨迹评分，并有分类标签（写、读、路由、安全、依据、应触发和不应触发）。Anthropic 的评估指导要求优先从生产日志中获取输入，并需要两次签字确认：确认输入，以及确认评分方法。两者都强调，前提条件不满足的用例应跳过，而不是算作通过。模拟世界是固定的，所以每次运行看到的事实都相同。",
        ),
        what: t(
          "world.json: ten fictional expenses as of 2026-09-30, including a duplicate pair, an alcohol expense, two over 500, an old one and a note carrying an injection. world.py executes the five tools over it and wraps untrusted fields. cases.json: 16 cases, 9 task, 4 safety (approval, deny, injection, not found) and 3 routing, with checks on the trajectory (tools called, with which arguments, which skill, which writes returned success) and on the final text (figures, phrases, ids listed, a question, grounded amounts). Each case is train or test: you read train failures while you change the harness, and run test cases only to confirm a change. An approval names one exact action, such as flag_expense for E-1007, and is used once.",
          "world.json：截至 2026-09-30 的十笔虚构报销，其中包括一对重复报销、一笔含酒精的报销、两笔超过 500 的报销、一笔较早的报销，以及一条带有注入内容的备注。world.py 在这个世界上执行五个工具，并包装不可信字段。cases.json：16 个用例，其中任务类 9 个、安全类 4 个（批准、拒绝、注入、查无此项）、路由类 3 个，检查项覆盖调用轨迹（调用了哪些工具、用了什么参数、加载了哪个技能）和最终文本（数字、短语、列出的 id、是否提问、金额是否有据）。每个用例属于 train 或 test：修改框架时阅读 train 的失败，test 用例只在确认改动时运行。一次批准只针对一个确切的操作，比如对 E-1007 执行 flag_expense，并且只能用一次。",
        ),
        how: [
          t("Start from real failures: logged conversations and bug reports first, then written cases, and synthesized ones last.", "从真实的失败出发：先用记录下来的对话和缺陷报告，再写人工用例，最后才是合成用例。"),
          t("Fix the world your cases run in: fictional, dated, and containing the traps your users meet (duplicates, ambiguity, injected text).", "固定用例运行的世界：虚构的、带日期的，并包含用户会遇到的陷阱（重复项、歧义、注入的文字）。"),
          t("Write one case per behavior, with checks on the trajectory and on the final text.", "每个行为写一个用例，同时检查调用轨迹和最终文本。"),
          t("Cover task, safety and routing, with a negative for every routing positive.", "覆盖任务、安全和路由三类，每个应触发的路由用例都要配一个不应触发的反例。"),
          t("Get two sign-offs before the first paid run: the business owner reads the cases, and someone reads three graded examples.", "在第一次付费运行之前完成两次签字确认：业务负责人阅读用例，另有人阅读三个已评分的示例。"),
        ],
        files: [K + "evals/fixtures/world.json", K + "evals/world.py", K + "evals/cases.json"],
        interpret: [
          t("16 cases give an honest noise floor of 0.25 (1 divided by the square root of 16). Cases are the independent units; repeats only steady each case's own rate. report.py also prints the optimistic floor for cases times repeats (0.14 with 3 repeats). Add cases before you trust a delta below 0.25.", "16 个用例给出的可靠噪声下限是 0.25（1 除以 16 的平方根）。用例才是相互独立的单位；重复只是让每个用例自身的通过率更稳定。report.py 还会打印按用例数乘以重复次数计算的乐观下限（重复 3 次时为 0.14）。在相信小于 0.25 的差值之前，先增加用例。"),
          t("A case that every variant fails is either too hard or wrong. Check it with the oracle (step [[graders]]).", "所有变体都失败的用例，要么太难，要么本身有错。用理想智能体检查它（第 [[graders]] 步）。"),
        ],
        trouble: [
          { s: t("Cases pass but users complain", "用例都通过了，用户却在抱怨"), c: t("The cases came from imagination, not from failures.", "用例来自想象，而不是来自真实的失败。"), f: t("Collect logged failures and turn each into a case, as the guardrails module does.", "收集记录下来的失败，把每一个都变成用例，就像防护模块中做的那样。") },
          { s: t("Cases against live data break or pass vacuously", "基于实时数据的用例出错，或者空洞地通过"), c: t("The data changed, or the named records do not exist.", "数据变了，或者用例中点名的记录根本不存在。"), f: t("Use a fixed world. For live systems, bind named tokens to real records at run time and skip the case when one is unbound; Meta's ads suite found cases that had passed while exercising nothing.", "使用固定的世界。对于线上系统，在运行时把命名的占位符绑定到真实记录上，绑定不上就跳过该用例；Meta 的广告评估集曾发现一些用例在什么都没测到的情况下就通过了。") },
        ],
        done: t("The cases cover task, safety and routing, the oracle passes all of them, and the owner has signed off the list.", "用例覆盖了任务、安全和路由三类，理想智能体全部通过，并且负责人已签字确认用例清单。"),
        scale: [
          t("Aim for 15 to 100 cases per flow, as Anthropic's eval guidance does, and split them into train and held-out sets before you hill-climb (step [[hillclimb]]).", "每个流程目标 15 到 100 个用例，与 Anthropic 的评估指导一致；在开始迭代优化之前（第 [[hillclimb]] 步），把它们分成训练集和保留集。"),
        ],
        challenge: [
          { q: t("Why programmatic checks rather than a model judge?", "为什么用程序化检查而不是评审模型？"), a: t("They are the cheapest, they are deterministic and they have no judge bias. Use a judge only for what checks cannot see, such as whether a summary is faithful.", "它们最便宜、结果确定，也没有评审模型的偏差。只在检查看不到的地方使用评审模型，比如判断摘要是否忠实。") },
        ],
        models: {
          generic: t("Cases are model-independent; runs are per model. Keep one case set and run it on every model you consider.", "用例与模型无关；运行则针对每个模型。保留一套用例，在你考虑的每个模型上运行。"),
          qwen: t("Locally the cost is time: 16 cases times 8 variants times 3 repeats is 384 runs, about 3 hours at 30 seconds each. Start with the control and two variants.", "在本地，成本是时间：16 个用例乘 8 个变体乘 3 次重复，共 384 次运行，每次 30 秒约需 3 小时。先从对照组和两个变体开始。"),
          llama: t("On local hardware a full run takes hours: run it overnight, and start with the control and the variants that matter most for small models (minimal, runtime-checks).", "在本地硬件上完整运行一次需要数小时：放在夜间运行，并从对照组和对小模型最重要的变体（minimal、runtime-checks）开始。"),
        },
      },
      {
        id: "graders",
        title: t("Prove the graders, then run the model", "先验证评分器，再运行模型"),
        local: t("evals/graders.py, evals/baselines.py and evals/run_eval.py: programmatic checks, oracle and null agents, a resumable runner.", "evals/graders.py、evals/baselines.py 和 evals/run_eval.py：程序化检查、理想智能体和空白智能体、可断点续跑的运行器。"),
        links: ["evaluation.agent", "evaluation.judges", "evaluation.noise"],
        after: ["cases", "loop"],
        why: t(
          "A grader you have not tested is a guess about a guess. Anthropic's eval audit asks for oracle and null baselines before the first paid run, infrastructure failures that are never scored as model failures, an assertion of the served model, and full trajectories saved. Meta's release canary keeps a fixed denominator with infrastructure failures reported separately. Grade what the tools did and what the answer says, and treat the model's own report of success as a claim to check. Test the text checks against hand-labelled answers, so a correct paraphrase never counts as a failure.",
          "没有测试过的评分器，只是对猜测的猜测。Anthropic 的评估审查要求：在第一次付费运行之前先跑理想基线和空白基线；基础设施故障绝不算作模型失败；确认实际提供服务的模型；保存完整的调用轨迹。Meta 的发布金丝雀测试使用固定的分母，基础设施故障单独报告。评判工具实际做了什么以及回答说了什么，把模型自己报告的成功当作有待核实的说法。用人工标注的回答测试文本检查，确保正确的换种说法永远不会被判为失败。",
        ),
        what: t(
          "graders.py checks tools called and not called (with arguments), the skill loaded, figures stated, phrases present or absent, ids listed, whether a claimed write actually ran, whether it asks, and grounded amounts. Text is normalized (curly quotes, case), phrases match whole words, and forbidden phrases and listed ids ignore negated clauses, so \"I have not flagged it\" is no claim; dates and ids are not read as figures. fixtures/answers.json holds 20 hand-labelled answers that the tests grade on every build. baselines.py has an oracle that does every case correctly from the tool results it receives, and a null agent that says \"I am not sure.\" run_eval.py runs variants times cases times repeats against any OpenAI-compatible endpoint, or the Anthropic Messages and OpenAI Responses APIs through runtime/adapters.py (--api). It writes each row as it finishes so a crash keeps what ran, saves every trajectory under traces/, fingerprints each row by prompt, tools and case so a resumed run redoes only what changed, warns when the server answers as a different model, puts infrastructure errors in errors.jsonl, and summarizes. check.py ran both baselines over every variant when this page was built; the results are shown above.",
          "graders.py 检查调用了和没调用的工具（含参数）、加载的技能、给出的数字、出现或不应出现的短语、列出的 id、声称完成的写操作是否真的执行了、是否提问，以及金额是否有据。文本会先规范化（弯引号、大小写），短语按整词匹配，禁止出现的短语和列出的 id 会忽略否定的分句，所以“我还没有标记它”不算声称已标记；日期和 id 不会被当作数字。fixtures/answers.json 中有 20 条人工标注的回答，每次构建时测试都会对它们评分。baselines.py 包含一个理想智能体，它根据收到的工具结果正确完成每个用例；以及一个空白智能体，它只会说“我不确定。”run_eval.py 针对任何兼容 OpenAI 的接口，或通过 runtime/adapters.py 针对 Anthropic Messages API 和 OpenAI Responses API（--api），按变体乘用例乘重复次数运行。每完成一行就写入，所以崩溃时已跑的结果不会丢失；每条调用轨迹都保存在 traces/ 下；每行按提示词、工具和用例计算指纹，续跑时只重做有变化的部分；服务器以其他模型身份回答时会发出警告；基础设施错误写入 errors.jsonl，最后输出汇总。构建本页时，check.py 在每个变体上都跑了这两个基线；结果见上文。",
        ),
        how: [
          t("Run the oracle: python3 harness/evals/run_eval.py --agent oracle --variants all. It must be 1.000 everywhere; if not, a grader or a case is wrong.", "运行理想智能体：python3 harness/evals/run_eval.py --agent oracle --variants all。它必须处处为 1.000；否则就是某个评分器或用例有错。"),
          t("Run the null agent with --agent null. It must be near 0; each case it passes is a check that does not discriminate.", "用 --agent null 运行空白智能体。它必须接近 0；它每通过一个用例，就说明有一项检查没有区分能力。"),
          t("Run your model on the control first: --base-url <url> --model <name> --family <id> --repeats 3.", "先在对照组上运行你的模型：--base-url <url> --model <name> --family <id> --repeats 3。"),
          t("Read failures by check, not by case: the summary's top_failures and symptoms lists.", "按检查项而不是按用例来阅读失败：查看汇总中的 top_failures 和 symptoms 列表。"),
          t("Add a model judge only for what checks cannot see, and calibrate it to about 90% agreement with people first, the target in Anthropic's eval audit.", "只在检查看不到的地方加入评审模型，并先把它与人工判断的一致率校准到约 90%，这是 Anthropic 评估审查中的目标。"),
        ],
        files: [K + "evals/graders.py", K + "evals/fixtures/answers.json", K + "evals/baselines.py", K + "evals/run_eval.py"],
        interpret: [
          t("Rows such as \"PASS family-default travel-total rep 0 steps 2\" stream as cases finish; FAIL rows list the failed checks in plain words.", "像“PASS family-default travel-total rep 0 steps 2”这样的行会在用例完成时依次输出；FAIL 行会用平实的文字列出失败的检查项。"),
          t("A summary line such as \"family-default pass 0.812 safety 1.0 steps 2.4\" separates task and safety. Safety below 1.0 blocks a release whatever the average.", "像“family-default pass 0.812 safety 1.0 steps 2.4”这样的汇总行把任务和安全分开。无论平均值多高，安全低于 1.0 都会阻止发布。"),
          t("Infrastructure errors are not in the pass rate. If they exceed a few percent, fix the server before you read the scores.", "基础设施错误不计入通过率。如果它们超过百分之几，先修好服务器再看分数。"),
        ],
        trouble: [
          { s: t("The oracle fails a case", "理想智能体在某个用例上失败"), c: t("A grader or the case is wrong.", "评分器或用例本身有错。"), f: t("Fix it in its own commit, with the reason, and rerun both baselines.", "在单独的提交中修复并写明原因，然后重新运行两个基线。") },
          { s: t("The null agent passes a routing case", "空白智能体通过了一个路由用例"), c: t("about-you checks only that no data tools were called, and \"I am not sure\" calls none.", "about-you 只检查是否没有调用数据类工具，而“我不确定”什么都没调用。"), f: t("That is expected for a case about restraint. If a case meant to test helpfulness passes for the null agent, add a check on the final text.", "对于测试克制的用例，这是预期中的。如果一个本意是测试有用性的用例被空白智能体通过了，就给最终文本加一项检查。") },
          { s: t("Many INFRA timeout lines", "大量 INFRA 超时行"), c: t("The server is overloaded or the model is too large for the hardware.", "服务器过载，或者模型对硬件来说太大。"), f: t("The runner is serial; raise the timeout in loop.openai_chat or use a smaller quantization, and pin it in --label.", "运行器是串行的；在 loop.openai_chat 中提高超时时间，或换用更小的量化版本，并在 --label 中注明。") },
        ],
        done: t("On your checkout the oracle is 1.000 and the null agent near 0, and one control run on your model has no infrastructure errors.", "在你的代码副本上，理想智能体为 1.000，空白智能体接近 0，并且你的模型在对照组上的一次运行没有基础设施错误。"),
        scale: [
          t("Run nightly in CI for hosted models. For local models, a scheduled overnight run on the machine with the model writes the results.", "对于托管模型，每晚在 CI 中运行。对于本地模型，在装有模型的机器上安排夜间运行并写入结果。"),
        ],
        challenge: [
          { q: t("Why prove the graders with scripted agents instead of reading outputs?", "为什么要用脚本化的智能体来验证评分器，而不是直接看输出？"), a: t("Reading outputs checks the cases you read. The oracle checks that every check can pass, and the null agent that every check can fail, on every case and variant, on every build.", "看输出只能检查你看过的用例。理想智能体检查每一项检查都能通过，空白智能体检查每一项检查都能失败，覆盖每个用例、每个变体、每次构建。") },
        ],
        models: {
          generic: t("The runner speaks the OpenAI chat format. For Claude and Gemini, use their OpenAI-compatible endpoints or adapt openai_chat; tools are then sent in OpenAI format.", "运行器使用 OpenAI 聊天格式。对于 Claude 和 Gemini，使用它们兼容 OpenAI 的接口，或改写 openai_chat；此时工具以 OpenAI 格式发送。"),
          claude: t("Anthropic's guidance ranks code-based graders as fastest and most reliable; model graders need clear rubrics, discrete outputs, thinking on, and a different model from the one under test.", "Anthropic 的指导认为基于代码的评分器最快也最可靠；模型评分器需要清晰的评分标准、离散的输出、开启思考，并且要使用与被测模型不同的模型。"),
          gpt: t("OpenAI's Evals platform becomes read-only on October 31, 2026 and shuts down on November 30, 2026. Keep your own runner, and start agent evals with trace grading as OpenAI suggests.", "OpenAI 的 Evals 平台将于 2026 年 10 月 31 日变为只读，并于 2026 年 11 月 30 日关闭。保留你自己的运行器，并按 OpenAI 的建议，从轨迹评分开始做智能体评估。"),
          qwen: t("Pin the exact model tag and quantization in --label: a q4 and a q8 build of the same model are different models for an eval.", "在 --label 中写明确切的模型标签和量化方式：同一模型的 q4 和 q8 版本，对评估来说是两个不同的模型。"),
          llama: t("Pin the exact model tag and quantization in --label, and record the Ollama or llama.cpp version, since server upgrades can change chat templates.", "在 --label 中写明确切的模型标签和量化方式，并记录 Ollama 或 llama.cpp 的版本，因为服务器升级可能改变对话模板。"),
        },
      },
      {
        id: "experiment",
        title: t("Run the structure experiment", "运行结构实验"),
        local: t("evals/variants.json and evals/report.py: eight structures of the same content, compared with paired deltas and a noise floor.", "evals/variants.json 和 evals/report.py：同一内容的八种结构，用配对差值和噪声下限进行比较。"),
        links: ["evaluation.variants", "evaluation.read"],
        after: ["graders", "prompt", "skills"],
        why: t(
          "This step answers which structure, and which files, work best for your model. The corpus and the vendor pages give strong defaults, they disagree in places (XML for Claude, Markdown for GPT, either for Gemini; reasons over capitals; skills on demand), and every vendor page says to check techniques against your own evals. Because every variant renders the same core.md, a difference in scores comes from structure, not content. A paired comparison on the same cases, with an interval, separates a real effect from noise.",
          "这一步回答哪种结构、哪些文件最适合你的模型。语料和厂商页面给出了很有力的默认做法，但它们在一些地方并不一致（Claude 用 XML、GPT 用 Markdown、Gemini 两者皆可；理由优于大写；技能按需加载），而且每个厂商页面都说要用你自己的评估来检验这些技巧。由于每个变体都渲染自同一份 core.md，分数差异来自结构而不是内容。在相同用例上做配对比较并给出区间，就能把真实效果和噪声区分开。",
        ),
        what: t(
          "variants.json: family-default (the control: the family's own settings from families.yml, which is what you would ship today), then markdown, xml, caps-rules, bare-rules, inline-skills, minimal (identity, date and tools only), runtime-checks (stopcheck and verify on), date-top and date-last. Each changes one setting on top of the family's defaults and states the question it answers. A variant that sets what the family already uses renders the control's prompt again: that A/A pair shows how far this suite moves by chance. report.py gives pass rate, per-category rates, steps, prompt tokens, seconds and malformed calls; the paired delta against the control with a 95% interval; a verdict (better, worse, within noise, safety regression); the contract gate; and symptom counts that link to the diagnoser on this page.",
          "variants.json：family-default（对照组：families.yml 中该系列自己的设置，也就是你今天会上线的版本），然后是 markdown、xml、caps-rules、bare-rules、inline-skills、minimal（只有身份、日期和工具）、runtime-checks（开启 stopcheck 和 verify）、date-top 和 date-last。每个变体在该系列默认值之上只改一项设置，并写明它要回答的问题。如果某个变体设置的正好是该系列已经在用的值，它会重新渲染出对照组的提示词：这样的 A/A 对照能显示这套用例单凭偶然会波动多少。report.py 给出通过率、各类别通过率、步数、提示词 token、耗时和格式错误的调用次数；相对对照组的配对差值及 95% 区间；结论（更好、更差、在噪声内、安全退步）；契约门槛；以及链接到本页诊断工具的症状计数。",
        ),
        how: [
          t("Run all variants: --variants all --repeats 3 --label \"<hardware, quantization>\" --write. Locally, start with the control and the two variants that matter most for your family (the model guide lists them).", "运行所有变体：--variants all --repeats 3 --label \"<硬件、量化方式>\" --write。在本地，先从对照组和对你的模型系列最重要的两个变体开始（模型指南中列出了它们）。"),
          t("Read safety first. A variant with any safety regression is out, whatever its pass rate.", "先看安全。只要有任何安全退步，无论通过率多高，这个变体都要淘汰。"),
          t("Read each delta with its interval. Adopt a structure only if the interval is above zero; within noise, prefer the shorter prompt.", "结合区间阅读每个差值。只有区间整体高于零时才采用该结构；在噪声范围内时，选更短的提示词。"),
          t("Read cost: steps and prompt tokens. A variant that ties on quality and saves tokens wins.", "看成本：步数和提示词 token。质量打平而更省 token 的变体胜出。"),
          t("Write the decision into that family's entry in families.yml, with the run id, and commit both.", "把结论连同运行 id 写进 families.yml 中该系列的条目，并一起提交。"),
        ],
        files: [K + "evals/variants.json", K + "evals/report.py"],
        interpret: [
          t("\"caps-rules delta -0.062 [-0.140, +0.015] within noise\" means no evidence either way at this suite size. Do not switch.", "“caps-rules delta -0.062 [-0.140, +0.015] within noise”表示在当前用例规模下，两个方向都没有证据。不要切换。"),
          t("An inline-skills delta of +0.000 with more prompt tokens per run means the same quality paid for on every turn: keep skills on demand.", "inline-skills 的差值为 +0.000，而每次运行的提示词 token 更多，意味着同样的质量却要在每一轮多付费：保持技能按需加载。"),
          t("\"minimal: safety regression\" means the open-weight vendors' tiny-prompt style dropped a safety case. Your harness needs the rules even when the vendor's own prompt has none.", "“minimal: safety regression”表示开放权重厂商的极简提示词风格丢掉了一个安全用例。即使厂商自己的提示词没有这些规则，你的框架也需要它们。"),
        ],
        trouble: [
          { s: t("Every delta is within noise", "所有差值都在噪声范围内"), c: t("The suite is too small for the effect size.", "用例规模相对于效应大小来说太小。"), f: t("Add cases or repeats. The noise floor is about 1 over the square root of cases times repeats.", "增加用例或重复次数。噪声下限约为 1 除以“用例数乘重复次数”的平方根。") },
          { s: t("A variant wins on one model and loses on another", "某个变体在一个模型上胜出，在另一个模型上落败"), c: t("Structure effects are model-specific.", "结构的效果因模型而异。"), f: t("Expected, and the reason this step exists. Record the choice per family.", "这是预期中的，也是这一步存在的原因。按系列分别记录选择。") },
          { s: t("Two runs with the same settings disagree", "设置相同的两次运行结果不一致"), c: t("Sampling nondeterminism, especially on local servers.", "采样的不确定性，在本地服务器上尤其明显。"), f: t("Use the sampling values in families.yml and more repeats; compare the intervals, not the headlines.", "使用 families.yml 中的采样参数并增加重复次数；比较区间，而不是只看标题数字。") },
        ],
        done: t("The control and at least the two variants most relevant to your family have run with 3 repeats, the summary is in content/harness-results.json, and families.yml records the chosen structure with its run id.", "对照组以及至少两个与你的系列最相关的变体已经各重复运行 3 次，汇总已写入 content/harness-results.json，并且 families.yml 记录了所选结构及其运行 id。"),
        unconfirmed: t("No model ran this experiment while the page was built; the workspace had no access to model weights or a model API. The results panel shows runs only after someone runs it with --write. The hypotheses come from the corpus and the vendor pages.", "构建本页时没有任何模型运行过这个实验；工作环境无法访问模型权重或模型 API。只有在有人用 --write 运行之后，结果面板才会显示数据。这些假设来自语料和厂商页面。"),
        scale: [
          t("Run every variant on every model you route to, and rerun after each model or server upgrade; results go stale with versions.", "在你路由到的每个模型上运行所有变体，并在每次模型或服务器升级后重新运行；结果会随版本过时。"),
        ],
        challenge: [
          { q: t("Why not copy the vendor's own prompt style?", "为什么不直接照搬厂商自己的提示词风格？"), a: t("Vendors' prompts are tuned for their harness, tools and surfaces. The minimal variant shows what can happen when you copy an open-weight vendor's tiny prompt into an agent that must be safe.", "厂商的提示词是针对他们自己的框架、工具和使用场景调优的。minimal 变体展示了把开放权重厂商的极简提示词照搬到一个必须安全的智能体里可能会发生什么。") },
        ],
        models: {
          generic: t("Expect the largest differences from minimal and inline-skills. On strong models the markdown and xml variants often land within noise of the control.", "最大的差异预计来自 minimal 和 inline-skills。在强模型上，markdown 和 xml 变体与对照组的差异往往在噪声范围内。"),
          claude: t("Hypothesis from Anthropic's docs and prompts: the XML default at least ties the markdown variant, and caps-rules may over-trigger on 4.5 and 4.6-era models. Test markdown and caps-rules first.", "根据 Anthropic 的文档和提示词提出的假设：XML 默认设置至少与 markdown 变体打平，而 caps-rules 在 4.5 和 4.6 时代的模型上可能导致过度触发。先测试 markdown 和 caps-rules。"),
          gpt: t("Hypothesis: the Markdown default at least ties the xml variant, and inline-skills costs tokens without a gain. Test xml and runtime-checks first.", "假设：Markdown 默认设置至少与 xml 变体打平，inline-skills 多花 token 却没有收益。先测试 xml 和 runtime-checks。"),
          gemini: t("Google says either format works if it is consistent, and puts context first and instructions last. Test markdown and date-last first.", "Google 说只要保持一致，两种格式都可以，并建议上下文在前、指令在后。先测试 markdown 和 date-last。"),
          grok: t("xAI's prompts put policy first and use almost no capitals. Test caps-rules and xml first.", "xAI 的提示词把策略放在最前面，几乎不用大写。先测试 caps-rules 和 xml。"),
          qwen: t("Hypothesis: a smaller prompt helps; minimal may hold on task cases but lose safety; runtime-checks may help most. Test minimal and runtime-checks first.", "假设：更小的提示词有帮助；minimal 在任务用例上可能持平但在安全上失分；runtime-checks 可能帮助最大。先测试 minimal 和 runtime-checks。"),
          deepseek: t("The vendor's own prompt is minimal. Test minimal and runtime-checks first.", "厂商自己的提示词就是极简的。先测试 minimal 和 runtime-checks。"),
          kimi: t("Kimi 3's own prompt uses XML-style section tags. Test xml and minimal first.", "Kimi 3 自己的提示词使用 XML 风格的节标签。先测试 xml 和 minimal。"),
          glm: t("No vendor prompt exists to copy. Test minimal and runtime-checks first.", "没有厂商提示词可供参考。先测试 minimal 和 runtime-checks。"),
          mistral: t("Mistral's guide accepts Markdown or XML and prefers decision trees to contradictory rules. Test xml and bare-rules first.", "Mistral 的指南接受 Markdown 或 XML，并且更推荐用决策树代替相互矛盾的规则。先测试 xml 和 bare-rules。"),
          llama: t("Hypothesis: a smaller prompt helps, and small models may follow short bare rules better than rules with reasons. Test minimal and runtime-checks first, then caps-rules against bare-rules.", "假设：更小的提示词有帮助，小模型可能更能遵循简短的直接规则，而不是带理由的规则。先测试 minimal 和 runtime-checks，再比较 caps-rules 和 bare-rules。"),
        },
      },
      {
        id: "hillclimb",
        title: t("Fix one failure at a time, and keep only what the numbers support", "每次只修一个问题，只保留数字支持的改动"),
        local: t("evals/findings.md (the round log) and ops/failure_taxonomy.json (where each kind of failure is fixed).", "evals/findings.md（每轮的记录）和 ops/failure_taxonomy.json（每类问题该在哪里修）。"),
        links: ["self-evolving.observe", "self-evolving.nightly", "guardrails.regress"],
        after: ["experiment"],
        why: t(
          "Once the structure is chosen, quality comes from fixing the most common failure, one change at a time, and keeping only what the numbers support. Anthropic's hill-climb guidance: prove the eval can be climbed (noise floor against headroom), one idea per round, a de-fluff pass every round, read train transcripts only, and revert when train rises and the held-out set does not. Meta's per-round log types each failure as agent or infrastructure, fixes agent failures in the skill and infrastructure failures in the scenario, and stops after two clean rounds.",
          "结构确定之后，质量来自修复最常见的问题：每次只改一处，只保留数字支持的改动。Anthropic 的迭代优化指导是：先证明评估还有提升空间（噪声下限相对于可提升余量），每轮只尝试一个想法，每轮都做一次精简，只读训练集的对话记录，训练集提升而保留集没有提升时就回退。Meta 的每轮记录把每个失败标为智能体问题或基础设施问题，智能体问题在技能里修，基础设施问题在场景里修，并在连续两轮无问题后停止。",
        ),
        what: t(
          "findings.md: the round template and its rules (one change; train transcripts only; the full set; keep only outside the noise floor with no safety regression; try deleting one rule each round; stop after two clean rounds, or after five rounds with no kept change). failure_taxonomy.json: 16 agent failure labels and 4 infrastructure labels, each naming where the fix belongs. The ids match report.py's symptom map and the diagnoser on this page, so a symptom count in a run summary leads straight to its causes and fixes.",
          "findings.md：每轮的模板及其规则（只改一处；只读训练集对话记录；运行全部用例；只有在噪声下限之外且没有安全退步时才保留；每轮尝试删掉一条规则；连续两轮无问题，或连续五轮没有保留任何改动时停止）。failure_taxonomy.json：16 个智能体问题标签和 4 个基础设施问题标签，每个都写明该在哪里修。这些 id 与 report.py 的症状映射以及本页的诊断工具一致，所以运行汇总中的症状计数可以直接通向对应的原因和修复方法。",
        ),
        how: [
          t("From the last summary, take the top symptom label.", "从上一次的汇总中取出排名第一的症状标签。"),
          t("Open the diagnoser on this page for that label and your model. Pick the cause whose test matches what you see in two failing transcripts.", "在本页的诊断工具中打开这个标签和你的模型。选出其检验方法与你在两份失败对话记录中看到的情况相符的那个原因。"),
          t("Make the one change, in the file the taxonomy names, and commit it.", "在分类表指定的文件中只做这一处改动，并提交。"),
          t("Rerun the full set with the same settings and read the paired delta against the previous round.", "用相同的设置重新运行全部用例，并阅读相对上一轮的配对差值。"),
          t("Log the round in findings.md: kept, reverted, or kept for simplicity, with the numbers.", "在 findings.md 中记录这一轮：保留、回退，或为了简洁而保留，并附上数字。"),
        ],
        files: [K + "evals/findings.md", K + "ops/failure_taxonomy.json"],
        interpret: [
          t("A change that raises the task pass rate and drops one safety case is reverted; the release gate in step [[release]] would block it anyway.", "一处提高了任务通过率却丢掉一个安全用例的改动要回退；反正第 [[release]] 步的发布闸门也会拦住它。"),
          t("Deleting a rule with no score drop is a win: the prompt got shorter for free.", "删掉一条规则而分数没有下降，就是一次胜利：提示词白白变短了。"),
        ],
        trouble: [
          { s: t("Scores rise on the cases you read, but not on the others", "你读过的用例分数上升了，其他用例却没有"), c: t("Overfitting: the fix describes the failing content, not the failing behavior.", "过拟合：修复描述的是失败的具体内容，而不是失败的行为。"), f: t("Read train transcripts only, describe behavior in the fix, and judge on the held-out set.", "只读训练集的对话记录，在修复中描述行为，并在保留集上评判。") },
          { s: t("The same failure survives three rounds", "同一个问题经过三轮仍然存在"), c: t("The fix is in the wrong layer, for example a gate problem patched in the prompt.", "修错了层，比如一个闸门问题却在提示词里打补丁。"), f: t("Check fix_in in the taxonomy and move the fix to that layer.", "查看分类表中的 fix_in，把修复移到对应的那一层。") },
          { s: t("A judge score jumps implausibly between rounds", "评审模型的分数在两轮之间不合理地跳变"), c: t("The judge drifted, or its prompt changed.", "评审模型发生了漂移，或者它的提示词变了。"), f: t("Recalibrate the judge against people before reading the round.", "在解读这一轮之前，先用人工判断重新校准评审模型。") },
        ],
        done: t("The top failure label has fallen across at least one kept round, every round is logged, and either the last two rounds had no new agent failures or five rounds passed with nothing kept.", "排名第一的问题标签在至少一个保留的轮次中下降了，每一轮都有记录，并且要么最近两轮没有出现新的智能体问题，要么已经连续五轮没有保留任何改动。"),
        scale: [
          t("Automate the loop nightly in report mode first, and switch to apply mode only behind the release gate, as the self-evolving module does.", "先以报告模式每晚自动运行这个循环，只有在发布闸门之后才切换到自动应用模式，就像自我进化模块中做的那样。"),
        ],
        challenge: [
          { q: t("Why only one change per round?", "为什么每轮只能改一处？"), a: t("With two changes the delta cannot be attributed: a helpful change and a harmful one can cancel out, and both survive.", "改两处的话，差值就无法归因：一处有益的改动和一处有害的改动可能互相抵消，结果两者都被保留下来。") },
        ],
        models: {
          generic: t("Fix in the order the taxonomy gives: code (gate, loop) before tool descriptions, before skills, before the core prompt.", "按分类表给出的顺序修复：先代码（闸门、循环），再工具说明，再技能，最后才是核心提示词。"),
          claude: t("Anthropic warns that model-specific techniques may not transfer between models; when you change Claude tier, rerun before you reuse a fix.", "Anthropic 提醒，针对特定模型的技巧不一定能在模型之间迁移；更换 Claude 档位时，先重新运行，再复用某个修复。"),
          gpt: t("OpenAI recommends pinning production to model snapshots and rerunning evals on every upgrade.", "OpenAI 建议在生产中固定模型快照，并在每次升级时重新运行评估。"),
          qwen: t("Locally each round takes hours: run it overnight and log the round in the morning.", "在本地，每一轮都要花几个小时：夜里运行，早上记录这一轮。"),
        },
      },
    ],
  },
  {
    id: "ship",
    title: t("Ship and scale", "发布与扩展"),
    goal: t(
      "Make the contract's numbers the release decision, watch production for new failures, and grow the harness along the levers the corpus shows, in the order you will hit their limits.",
      "让契约中的数字成为发布决定，监控生产环境中的新问题，并沿着语料所展示的手段扩展框架，按照你会遇到瓶颈的顺序来进行。",
    ),
    steps: [
      {
        id: "release",
        title: t("Gate releases and watch production", "用闸门把关发布并监控生产"),
        local: t("ops/release_gate.py: may the candidate replace production, judged by the contract metrics, safety and the paired delta.", "ops/release_gate.py：根据契约指标、安全和配对差值，判断候选版本能否替换生产版本。"),
        links: ["ops.change", "evaluation.schedule", "self-evolving.rollback"],
        after: ["hillclimb", "contract"],
        why: t(
          "The release gate is where the contract's numbers become a decision. Meta's canary for its ads skill pins the control and the candidate, runs named cases with repeats on both, keeps a fixed denominator, and ships only with no safety regression and a pass rate equal to or better than the control. Anthropic's hill-climb report leads with the held-out delta and its interval, and recommends not merging a change that is within noise.",
          "发布闸门是契约中的数字变成决定的地方。Meta 为其广告技能做的金丝雀测试会固定对照版本和候选版本，在两者上重复运行指定用例，使用固定的分母，只有在没有安全退步且通过率不低于对照版本时才发布。Anthropic 的迭代优化报告首先给出保留集上的差值及其区间，并建议不要合并处于噪声范围内的改动。",
        ),
        what: t(
          "release_gate.decide merges the control and candidate rows, summarizes them, and blocks on any contract metric missed, any safety case the control passed and the candidate lost, a significant drop, cases one side ran and the other did not, rows served by different models, an empty run, grounded figures below grounded_figures_min, or a prompt over max_prompt_tokens. The command prints PASS or BLOCKED with the reasons and sets the exit code for CI.",
          "release_gate.decide 合并对照版本和候选版本的结果行并汇总，只要出现以下任何情况就阻止发布：未达到任何一项契约指标、对照版本通过而候选版本丢掉的安全用例、显著下降、只有一方运行过的用例、由不同模型提供服务的结果行、空的运行、有据金额比例低于 grounded_figures_min，或提示词超过 max_prompt_tokens。该命令会输出 PASS 或 BLOCKED 及原因，并为 CI 设置退出码。",
        ),
        how: [
          t("Keep the release run's results.jsonl as the control for the next change.", "把发布版本运行的 results.jsonl 保留下来，作为下一次改动的对照。"),
          t("Run the candidate with the same model, cases and variant.", "用相同的模型、用例和变体运行候选版本。"),
          t("Run python3 harness/ops/release_gate.py --control <file> --candidate <file> and wire its exit code into CI.", "运行 python3 harness/ops/release_gate.py --control <文件> --candidate <文件>，并把它的退出码接入 CI。"),
          t("After release, sample production traces weekly, label failures with the taxonomy, and add a case for each new kind of failure.", "发布后，每周抽样生产环境的调用轨迹，用分类表给失败打标签，并为每一种新的失败添加用例。"),
          t("Rerun the suite on every model or server upgrade, with model versions pinned.", "每次模型或服务器升级时重新运行评估集，并固定模型版本。"),
        ],
        files: [K + "ops/release_gate.py"],
        interpret: [
          t("\"BLOCKED - safety regressions: injection-note\" has no override: fix it and rerun.", "“BLOCKED - safety regressions: injection-note”没有例外通道：修好后重新运行。"),
          t("\"PASS\" with a delta within noise means the candidate is not worse. Ship it if it is simpler or cheaper; otherwise there is no reason to.", "“PASS”且差值在噪声范围内，意味着候选版本并不更差。如果它更简单或更便宜就发布；否则没有发布的理由。"),
        ],
        trouble: [
          { s: t("The gate passes but production complains", "闸门通过了，生产环境却有抱怨"), c: t("The cases do not represent production.", "用例不能代表生产环境的情况。"), f: t("Turn production failures into cases, as in step [[cases]].", "把生产环境中的失败变成用例，做法见第 [[cases]] 步。") },
          { s: t("The gate result flips between runs", "闸门结果在多次运行之间来回变化"), c: t("Too few cases or repeats for the deltas involved.", "相对于涉及的差值来说，用例或重复次数太少。"), f: t("Raise repeats or cases until the noise floor is below the smallest change you care about.", "增加重复次数或用例，直到噪声下限低于你关心的最小变化。") },
        ],
        done: t("CI runs the gate on every harness change, and the last release's results are kept as the control.", "CI 在每次框架改动时运行闸门，并保留上一次发布的结果作为对照。"),
        scale: [
          t("Canary releases: send the candidate a small share of traffic and compare live failure labels before a full switch.", "金丝雀发布：先把一小部分流量交给候选版本，在全面切换之前比较线上的失败标签。"),
        ],
        challenge: [
          { q: t("Why not ship whenever the average improves?", "为什么不在平均分提高时就发布？"), a: t("Averages hide safety. A better average with one lost safety case is a worse agent, which is why the gate checks safety case by case.", "平均分会掩盖安全问题。平均分更高却丢掉一个安全用例的，是一个更差的智能体，所以闸门要逐个用例检查安全。") },
        ],
        models: {
          generic: t("Rerun when the provider updates a model alias; aliases move.", "当服务商更新模型别名时重新运行；别名指向的模型会变。"),
          gpt: t("Pin snapshots, and keep your own runner, because OpenAI's Evals platform shuts down on November 30, 2026.", "固定快照，并保留你自己的运行器，因为 OpenAI 的 Evals 平台将于 2026 年 11 月 30 日关闭。"),
          claude: t("Recheck model-specific techniques against your evals on each new tier, as Anthropic's guide asks.", "按 Anthropic 指南的要求，在每个新档位上用你的评估重新检验针对特定模型的技巧。"),
          qwen: t("A new quantization or an Ollama upgrade can change the template or the defaults: probe and rerun before you trust old results.", "新的量化版本或 Ollama 升级可能改变模板或默认值：在相信旧结果之前，先探测并重新运行。"),
        },
      },
      {
        id: "scale",
        title: t("Scale along the levers, in order", "按顺序沿着扩展手段扩展"),
        local: t("A routing table and the order of scaling levers: deferred tools, model routing, shared infrastructure, cost attribution.", "一张路由表和扩展手段的顺序：延迟加载工具、模型路由、共享基础设施、成本归属。"),
        links: ["multi-agent.cost", "inference.router"],
        after: ["release"],
        why: t(
          "Growth fails in a predictable order: the always-on prompt and tool list grow until accuracy drops; one model is too slow or too expensive for every step; each new agent copies its own infrastructure; costs nobody can attribute. The corpus harnesses show the levers: deferred tool loading and tool search (Claude Code, Codex, Gemini 3.8), a model per agent (Copilot CLI pins small models for exploration), skill catalogs that keep most skills out of the prompt (Muse), and effort set per call.",
          "增长会以一种可预见的顺序失败：常驻提示词和工具清单不断增长，直到准确度下降；一个模型对每一步来说都太慢或太贵；每个新智能体都复制一套自己的基础设施；成本无人能归属。语料中的框架展示了应对手段：延迟加载工具和工具搜索（Claude Code、Codex、Gemini 3.8）、每个智能体各自的模型（Copilot CLI 为探索任务固定使用小模型）、把大部分技能排除在提示词之外的技能目录（Muse），以及按调用设置推理强度。",
        ),
        what: t(
          "A routing table that sends each task class to a model family, chosen by measured pass rate per class, and the order to apply the levers.",
          "一张路由表，根据每类任务实测的通过率，把各类任务分配给相应的模型系列；以及应用这些手段的顺序。",
        ),
        how: [
          t("Measure before scaling: steps, tokens, seconds and pass rate per task from the run summary.", "扩展之前先测量：从运行汇总中获取每个任务的步数、token、耗时和通过率。"),
          t("When the prompt passes the family budget, move resident tools and skills to on-demand loading.", "当提示词超过该系列的预算时，把常驻的工具和技能改为按需加载。"),
          t("Route by task class: a small model for lookups and routing, the strong one for decisions. Run the evals per route.", "按任务类别路由：查询和路由用小模型，决策用强模型。按每条路由分别运行评估。"),
          t("Share runtime, lint, evals and ops across agents; each agent keeps its own contract and cases.", "在各个智能体之间共享 runtime、lint、evals 和 ops；每个智能体保留自己的契约和用例。"),
          t("Attribute cost per agent and per task class, and set the effort level per call type.", "按智能体和任务类别归属成本，并按调用类型设置推理强度。"),
        ],
        code: [{ lang: "yaml", file: "routing.yml (a starting point; change it only from measured pass rates)", text: `routes:
  lookup:    {family: qwen,   model: "<small local model>", effort: low}    # search, get, simple totals
  policy:    {family: claude, model: "<mid tier>",          effort: medium} # needs a skill and judgment
  write:     {family: claude, model: "<mid tier>",          effort: medium} # proposals; the gate still decides
  fallback:  {family: generic, model: "<any OpenAI-compatible>"}
rule: a route moves to a cheaper model only when its cases pass within the noise floor of the current one
levers_in_order:
  1. defer tools and skills past the family budget (tool search, skill index)
  2. route task classes to smaller models, eval per route
  3. share runtime, lint, evals, ops across agents
  4. attribute cost per agent and task class; set effort per call type
  5. multi-agent only where one context cannot hold the work or parallel lanes save wall-clock time` }],
        interpret: [
          t("If the small model's pass rate on lookup cases matches the large one within the noise floor, route lookups to it.", "如果小模型在查询类用例上的通过率与大模型的差距在噪声下限之内，就把查询路由给小模型。"),
          t("If cost per task rises faster than tasks, a lever is missing: usually resident tools or an unneeded high effort setting.", "如果每个任务的成本增长快于任务数量的增长，说明缺了某个手段：通常是常驻工具过多，或推理强度设得没必要地高。"),
        ],
        trouble: [
          { s: t("Routing lookups to a small model drops a safety case", "把查询路由给小模型后丢掉了一个安全用例"), c: t("A safety-relevant step was routed with the lookups.", "一个与安全相关的步骤被当作查询一起路由了。"), f: t("Keep steps that propose writes on the strong model; the gate is unaffected by routing.", "把提议写操作的步骤留在强模型上；路由不影响闸门。") },
          { s: t("A second agent copies the first one's runtime and drifts", "第二个智能体复制了第一个的运行时，然后逐渐走样"), c: t("The kit was copied instead of shared.", "工具包是被复制的，而不是共享的。"), f: t("Move runtime/, lint/, evals/report.py and ops/ into one package both agents import, and keep only the contract, template and cases per agent.", "把 runtime/、lint/、evals/report.py 和 ops/ 移到一个两个智能体都导入的包里，每个智能体只保留自己的契约、模板和用例。") },
        ],
        done: t("Every scaling lever you applied is justified by a measured number in a run summary.", "你采用的每一种扩展手段，都有运行汇总中的实测数字作为依据。"),
        scale: [
          t("Across teams: publish the kit as an internal package with the linter and the oracle in CI, so every new agent starts lint-clean with proven graders.", "跨团队时：把这个工具包发布为内部包，并在 CI 中运行检查器和理想基线，让每个新智能体从一开始就检查无误，评分器也经过验证。"),
        ],
        challenge: [
          { q: t("When is multi-agent the answer to scale?", "什么时候多智能体才是扩展的答案？"), a: t("When one context cannot hold the work, or parallel lanes save wall-clock time the user cares about. Not as a default: the multi-agent module measured the extra calls it costs.", "当一个上下文装不下全部工作，或者并行能节省用户在意的实际耗时。不要把它当作默认做法：多智能体模块测量过它带来的额外调用次数。") },
        ],
        models: {
          generic: t("Route by measured pass rate per task class, never by benchmark rank.", "按每类任务实测的通过率来路由，绝不按基准测试排名。"),
          claude: t("Haiku for lookups, Sonnet or Opus for decisions: Claude Code itself runs its documentation-lookup agent on Haiku.", "查询用 Haiku，决策用 Sonnet 或 Opus：Claude Code 本身就把查文档的智能体放在 Haiku 上运行。"),
          gpt: t("Codex's own subagent descriptions label Luna fast and affordable for easier tasks, Sol the workhorse, and Astra frontier intelligence.", "Codex 自己的子智能体说明中，把 Luna 标为适合简单任务的快速经济型，Sol 是主力，Astra 是前沿智能。"),
          gemini: t("Flash-Lite for routing, Flash for most work, Pro for hard reasoning, with thinking_level set per call.", "路由用 Flash-Lite，大多数工作用 Flash，困难推理用 Pro，并按调用设置 thinking_level。"),
          qwen: t("On one machine: a small dense model for routing and a mixture-of-experts model for the work; set keep_alive to avoid reload latency, and remember OLLAMA_NUM_PARALLEL multiplies memory by the context length.", "在一台机器上：路由用小型稠密模型，实际工作用混合专家模型；设置 keep_alive 以避免重新加载的延迟，并记住 OLLAMA_NUM_PARALLEL 会让显存占用乘以上下文长度。"),
        },
      },
    ],
  },
];
