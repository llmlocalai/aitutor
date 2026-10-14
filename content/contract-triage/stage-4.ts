import { t } from "@/lib/types";
import type { Stage } from "./types";

const K = "native/contract-triage/overlay/";

export const stage4: Stage = {
  id: "s4",
  n: "4",
  title: t("Stage 4: evaluate", "第 4 阶段：评估"),
  dates: t("Nov. 9 to 15 · about 24 hours", "11 月 9 日至 15 日 · 约 24 小时"),
  goal: t(
    "Prove the server makes a model measurably more accurate and safer: an answer key the agent cannot see, a golden set of about thirty rows, scorers fixed before the first run, MLflow 3 on Databricks with and without the server, five repeats each. Target: 85 percent correct with the server, against a documented no-tool baseline, with every decoy, no-action and injection case passed.",
    "证明服务器能让模型可量化地更准确、更安全：一个智能体看不到的答案键，约三十行的黄金集，在首次运行前就确定的评分器，在 Databricks 上用 MLflow 3 分别在有和没有服务器的情况下各运行五次。目标：有服务器时正确率 85%，并与有记录的无工具基线对比，所有诱饵、无需行动和注入用例全部通过。",
  ),
  steps: [
    {
      id: "answer-key",
      bp: "4.1",
      title: t("Build an answer key the agent cannot see", "建立智能体看不到的答案键"),
      what: t("eval/answer_key.sql: each expected answer computed from bronze only, by SQL written separately from silver and gold; results kept in the schema contract_triage_eval, where the app's principal has no grant.", "eval/answer_key.sql：每个预期答案只用 bronze 计算，SQL 与 silver 和 gold 分开编写；结果保存在 contract_triage_eval schema 中，应用的服务主体在那里没有任何权限。"),
      why: t("If the key reused the silver and gold logic, a bug would hide in both and every score would look perfect. The key takes the latest action differently (by a max of date and mod number, not a window function) and joins SAM.gov on its own; agreement between two independent paths is the evidence. Grants enforce the secrecy, not a convention.", "如果答案键复用 silver 和 gold 的逻辑，缺陷会同时藏在两边，每个分数看起来都完美。答案键用不同的方法取最新动作（按日期与修改号取最大值，而不是窗口函数），并自行关联 SAM.gov；两条独立路径结果一致才是证据。保密靠授权来保证，而不是靠约定。"),
      how: [
        { t: t("Create the eval schema (no grant to the app), then build the golden set from the key and check it against the tools.", "创建评估 schema（不授权给应用），然后从答案键生成黄金集，并与工具结果核对。"), c: [
          { w: "dbx-sql", code: `CREATE SCHEMA IF NOT EXISTS <your_catalog>.contract_triage_eval COMMENT 'Answer key: no grant to the app';
CREATE VOLUME IF NOT EXISTS <your_catalog>.contract_triage_eval.keys;` },
          { w: "repo", code: `uv run python eval/build_golden.py --warehouse "$WAREHOUSE_ID" --catalog "$CATALOG" --profile "$PROFILE" --offices "$OFFICES"
databricks fs cp eval/golden_set.json "dbfs:/Volumes/$CATALOG/contract_triage_eval/keys/golden_set.json" --overwrite -p "$PROFILE"
DATA_BACKEND=databricks DATABRICKS_CONFIG_PROFILE="$PROFILE" DATABRICKS_WAREHOUSE_ID="$WAREHOUSE_ID" \\
  DATABRICKS_CATALOG="$CATALOG" uv run python eval/local/run_tool_eval.py` },
        ] },
      ],
      files: [K + "eval/answer_key.sql", K + "eval/build_golden.py", K + "eval/local/run_tool_eval.py"],
      test: [{ w: "repo", expect: t("run_tool_eval prints PASS for every row with a tool check and \"N/N rows agree between the answer key and the tools\", exit 0. On the fixture the replay shows 11/11. Every disagreement is traced to a cause (a key bug, a gold bug, or a data quirk) before any model runs.", "run_tool_eval 对每个带工具检查的行输出 PASS，并输出 “N/N rows agree between the answer key and the tools”，退出码 0。在样例上回放显示 11/11。任何不一致都要在运行模型之前追查到原因（答案键缺陷、gold 缺陷或数据特例）。") }],
      replay: ["golden"],
      trouble: [{ s: t("FAIL with extra PIIDs from the tool", "FAIL，工具多出了一些 PIID"), c: t("The two paths disagree on which action is latest when two actions share a date and a mod number.", "当两个动作的日期和修改号相同时，两条路径对哪个是最新动作判断不一。"), f: t("Look at the award with hand_check.py; decide the rule; fix the side that is wrong and log it in docs/eval-changes.md.", "用 hand_check.py 查看该合同；确定规则；修正错误的一方并记录在 docs/eval-changes.md。") }],
      done: t("Key and tools agree on every row, and on the ten hand-checked awards.", "答案键与工具在每一行、以及十个手工核对的合同上都一致。"),
      after: ["hand-check", "grants"],
      ran: "replayed",
      hours: 4,
    },
    {
      id: "golden",
      bp: "4.2",
      title: t("Write the golden set", "编写黄金集"),
      what: t("eval/golden_set.json in MLflow format (inputs.request, expectations.expected_facts as a list) and eval/evaluation.xml with ten questions in the mcp-builder format.", "MLflow 格式的 eval/golden_set.json（inputs.request、expectations.expected_facts 为列表），以及 mcp-builder 格式、含十个问题的 eval/evaluation.xml。"),
      why: t("A balanced set tests accuracy, restraint and safety: core counts at three window sizes, office resolution, multi-tool questions, decoys (ended but closed in SAM.gov, must not be listed), no-action windows, out-of-scope requests that must be declined, and injection rows if GSA allows labeled synthetic records. expected_facts must be a list under expectations, or the Correctness judge ignores it on MLflow 3.", "一个均衡的集合同时检验准确、克制和安全：三种窗口大小下的核心计数、办公室识别、多工具问题、诱饵（已到期但在 SAM.gov 已结案，不得列出）、无需行动的窗口、必须拒绝的越界请求，以及在 GSA 允许带标记的合成记录时的注入用例。expected_facts 必须是 expectations 下的列表，否则 MLflow 3 的 Correctness 评审会忽略它。"),
      how: [{ t: t("Build it (4.1 did), read every row, and add the injection rows only with GSA's written yes.", "生成它（第 4.1 步已完成），逐行阅读；只有在 GSA 书面同意后才加入注入用例。"), c: [{ w: "repo", code: `jq -r '.[] | [.expectations.category, .inputs.request] | @tsv' eval/golden_set.json | column -t -s $'\\t' | cut -c1-160
# with GSA's OK for labeled synthetic records (0.2):
uv run python eval/build_golden.py --warehouse "$WAREHOUSE_ID" --catalog "$CATALOG" --profile "$PROFILE" --offices "$OFFICES" --synthetic
git add eval/golden_set.json eval/evaluation.xml && git commit -m "Golden set from the answer key" && git push` }] }],
      test: [{ w: "repo", code: `jq 'group_by(.expectations.category) | map({(.[0].expectations.category): length}) | add' eval/golden_set.json`, expect: t("About 30 rows across core, office_resolution, multi_tool, decoy, no_action and out_of_scope (plus injection). A second reader answers five random rows from the key alone and agrees.", "约 30 行，分布在 core、office_resolution、multi_tool、decoy、no_action 和 out_of_scope（以及 injection）中。第二位读者仅凭答案键回答五个随机行，并得出一致结果。") }],
      replay: ["golden"],
      trouble: [{ s: t("No decoy rows", "没有诱饵行"), c: t("No pilot office has an ended, SAM.gov-closed award without a K action.", "没有任何试点办公室存在已到期、SAM.gov 已结案但没有 K 动作的合同。"), f: t("Add an office that has one (query gold_closeout_candidates WHERE sam_closed), or state the gap in evaluation.md.", "加入一个有这种合同的办公室（查询 gold_closeout_candidates WHERE sam_closed），或在 evaluation.md 中说明这一缺口。") }],
      done: t("About 30 rows, each tagged by category.", "约 30 行，每行都标注了类别。"),
      after: ["answer-key"],
      ran: "replayed",
      hours: 4,
    },
    {
      id: "scorers",
      bp: "4.3",
      title: t("Define the scorers before the first run", "在首次运行前确定评分器"),
      what: t("eval/scorers.py: code-based checks (exact count, dollars within 0.5 percent, PIID recall and precision 0.9 or more, decoy absent, refusal present) as one MLflow scorer, code_checks, beside the template's judges and a review-candidate Guidelines judge.", "eval/scorers.py：基于代码的检查（计数精确、金额误差在 0.5% 以内、PIID 召回率和精确率不低于 0.9、诱饵不出现、必须拒绝时确有拒绝），合成一个 MLflow 评分器 code_checks，与模板的评审以及一个 review-candidate 的 Guidelines 评审并列。"),
      why: t("Rules set after seeing results drift toward the result. Code decides pass or fail on numbers; LLM judges grade wording only, because a judge model can be talked into accepting 4 when the answer is 3. Three deliberately wrong answers must fail before the scorers are trusted.", "看到结果后再定的规则会向结果靠拢。数字的对错由代码判定；LLM 评审只评措辞，因为评审模型可能被说服把 4 当作 3 的正确答案。在信任评分器之前，三个故意写错的答案必须判为失败。"),
      how: [{ t: t("Read the file and run its tests.", "阅读文件并运行它的测试。"), c: [{ w: "repo", code: `uv run pytest tests/test_scorers.py -v` }] }],
      files: [K + "eval/scorers.py"],
      test: [{ w: "repo", code: `uv run pytest tests/test_scorers.py -q`, expect: t("5 passed: the right answer passes; a wrong count, a listed decoy and a missing refusal all fail.", "5 passed：正确答案通过；计数错误、列出诱饵和缺少拒绝都判为失败。") }],
      replay: ["tests"],
      trouble: [{ s: t("A correct answer fails exact_count", "正确答案在 exact_count 上失败"), c: t("The model wrote the count as a word the scorer does not know (\"a dozen\").", "模型用评分器不认识的词写了数量（“a dozen”）。"), f: t("Add it to _WORDNUM and a test; never edit the golden row to fit.", "把它加入 _WORDNUM 并补一个测试；绝不为了通过而修改黄金集。") }],
      done: t("Three wrong answers fail.", "三个错误答案都判为失败。"),
      after: ["golden"],
      ran: "replayed",
      hours: 3,
    },
    {
      id: "mlflow",
      bp: "4.4",
      title: t("Learn: run the MLflow eval on Databricks", "学习：在 Databricks 上运行 MLflow 评估"),
      what: t("A scored run in an MLflow experiment you own: the eval service principal provisioned, eval_auth.py in the exported agent, and the kit's triage_eval.py run in a notebook there.", "在你拥有的 MLflow 实验中完成一次打分运行：配置好评估用的服务主体，把 eval_auth.py 放进导出的智能体，并在那里的 notebook 中运行工具包的 triage_eval.py。"),
      why: t("This is the template's official path and shows judges native platform use. A notebook cannot reach an OAuth-gated app with its own identity, so the template's setup-eval-sp.sh creates a service principal with CAN_USE on the app and stores its credentials in a secret scope; eval_auth.py injects them into the unmodified agent at runtime.", "这是模板的官方路径，也向评委展示了对平台的原生使用。notebook 无法用自己的身份访问受 OAuth 保护的应用，所以模板的 setup-eval-sp.sh 会创建一个对应用拥有 CAN_USE 的服务主体，并把凭证存进 secret scope；eval_auth.py 在运行时把它们注入未修改的智能体。"),
      how: [
        { t: t("Create the experiment and provision the eval principal (needs workspace admin; an account-level step may send you to the UI once).", "创建实验并配置评估服务主体（需要工作区管理员；账号级的一步可能需要你到界面操作一次）。"), c: [{ w: "repo", code: `EXP_ID=$(databricks experiments create-experiment "/Users/$DBX_USER/contract-triage-eval" -p "$PROFILE" -o json | jq -r .experiment_id)
echo "export EXP_ID=$EXP_ID" >> ~/.contract-triage.env
set -a; source deploy/databricks/.env; set +a
bash eval/databricks/setup-eval-sp.sh` }] },
        { t: t("Copy the auth patch and the eval script into the exported agent folder.", "把认证补丁和评估脚本复制到导出的智能体文件夹。"), c: [{ w: "repo", code: `databricks workspace import "$AGENT_FOLDER/agent_server/eval_auth.py" --file eval/databricks/agent_server/eval_auth.py --format AUTO --overwrite -p "$PROFILE"
databricks workspace import "$AGENT_FOLDER/triage_eval.py" --file eval/databricks/triage_eval.py --format AUTO --overwrite -p "$PROFILE"` }] },
        { t: t("In a notebook in $AGENT_FOLDER: cell 1 installs and restarts; cell 2 is triage_eval.py with CONFIG filled (MCP_SERVER_URL, MODEL from 3.4, EXPERIMENT_ID, GIT_FOLDER). For a first run set ARMS = [\"with_server\"] and REPEATS = 1.", "在 $AGENT_FOLDER 中的 notebook 里：第 1 个单元格安装依赖并重启；第 2 个单元格是填好 CONFIG 的 triage_eval.py（MCP_SERVER_URL、第 3.4 步的 MODEL、EXPERIMENT_ID、GIT_FOLDER）。第一次运行时设 ARMS = [\"with_server\"]、REPEATS = 1。"), c: [{ w: "dbx-nb", code: `%pip install openai-agents databricks-openai
%restart_python` }] },
      ],
      files: [K + "eval/databricks/triage_eval.py"],
      test: [{ w: "dbx-nb", expect: t("A per-category table prints at the end, and the experiment shows one run with traces. Open three traces and confirm the right tools were called with the right office code.", "最后打印按类别统计的表格，实验中显示一次带追踪的运行。打开三条追踪，确认调用了正确的工具和正确的办公室代码。") }],
      trouble: [
        { s: t("Agent says \"I don't have access to tools\"", "智能体说 “I don't have access to tools”"), c: t("The eval principal lacks CAN_USE on the app, so the MCP connection failed silently.", "评估服务主体对应用没有 CAN_USE，导致 MCP 连接静默失败。"), f: t("Re-run setup-eval-sp.sh or grant it in Compute > Apps > Permissions.", "重新运行 setup-eval-sp.sh，或在 Compute > Apps > Permissions 中授权。") },
        { s: t("ENDPOINT_NOT_FOUND on the model", "模型报 ENDPOINT_NOT_FOUND"), c: t("MODEL is not a serving endpoint name.", "MODEL 不是一个服务端点名称。"), f: t("Use the name you checked in 3.4.", "使用第 3.4 步核对过的名字。") },
        { s: t("The app is overloaded", "应用负载过高"), c: t("Parallel eval workers.", "评估并行 worker 太多。"), f: t("Uncomment MLFLOW_GENAI_EVAL_MAX_WORKERS = 1 in CONFIG.", "在 CONFIG 中取消注释 MLFLOW_GENAI_EVAL_MAX_WORKERS = 1。") },
      ],
      done: t("Metrics print and traces show in the experiment.", "指标已打印，实验中可见追踪。"),
      after: ["scorers", "export-agent"],
      ran: "you",
      unconfirmed: t("triage_eval.py follows the template's agent_eval_offline.py line for line where it can. Two parts are new and not run here: the baseline arm sets agent.MCP_SERVERS to an empty list, and the per-category table reads the code_checks column from results.tables[\"eval_results\"]; if either errors, print table.columns and adjust.", "triage_eval.py 尽可能逐行沿用模板的 agent_eval_offline.py。有两部分是新增的，这里没有运行过：基线组把 agent.MCP_SERVERS 设为空列表，按类别统计的表格从 results.tables[\"eval_results\"] 读取 code_checks 列；如果其中任何一个报错，打印 table.columns 并调整。"),
      hours: 5,
    },
    {
      id: "baseline",
      bp: "4.5",
      title: t("Run the baseline and the repeats", "运行基线组和重复运行"),
      what: t("Both arms, with and without the server, five repeats each, and a table of pass rate by category and arm.", "两组（有服务器、无服务器）各重复五次，以及一张按类别和组别统计的通过率表格。"),
      why: t("Lift over a no-tool baseline is the clearest evidence of value, and repeats show variance, so one lucky run cannot carry the claim. The baseline should fail nearly every count question; if it passes one, that question is answerable from memory and must be rewritten.", "相对无工具基线的提升是价值最清楚的证据，重复运行显示方差，这样一次碰巧的好结果撑不起结论。基线应该几乎答错每个计数问题；如果它答对了某题，说明这题凭记忆就能回答，必须改写。"),
      how: [{ t: t("Set ARMS = [\"with_server\", \"baseline\"] and REPEATS = 5 in CONFIG and run cell 2 again.", "在 CONFIG 中设 ARMS = [\"with_server\", \"baseline\"]、REPEATS = 5，再运行第 2 个单元格。") }],
      test: [{ w: "dbx-nb", expect: t("Ten runs in the experiment, tagged arm and repeat. The displayed table has one row per run with a pass rate per category; with_server core near or above 0.85, baseline core near 0.", "实验中有十次运行，带 arm 和 repeat 标签。显示的表格每次运行一行，含各类别通过率；with_server 的 core 接近或超过 0.85，baseline 的 core 接近 0。") }],
      trouble: [{ s: t("Baseline passes count questions", "基线答对了计数问题"), c: t("The question leaks the answer, or the count is zero and \"none\" is a lucky guess.", "问题泄露了答案，或者计数为零而 “none” 是碰巧猜中。"), f: t("Rewrite the question; keep zero-count rows in no_action, where restraint is the point.", "改写问题；零计数的行放在 no_action 类别，那里考的就是克制。") }],
      done: t("A table of pass rate by category and arm, with run IDs.", "一张带运行 ID、按类别和组别统计的通过率表格。"),
      after: ["mlflow"],
      ran: "you",
      hours: 3,
    },
    {
      id: "phoenix",
      bp: "4.6",
      title: t("Fallback: the Phoenix harness on your laptop", "后备方案：笔记本上的 Phoenix 评估框架"),
      what: t("eval/phoenix/ built by following the template's mcp-eval skill, running the server over stdio on the snapshot backend.", "按照模板的 mcp-eval skill 构建 eval/phoenix/，在快照后端上通过 stdio 运行服务器。"),
      why: t("If the eval service principal cannot be created, you still need numbers. The skill defines the module layout, the agent, the judges and the datasets registry; the golden set and code scorers from 4.2 and 4.3 plug in unchanged.", "如果无法创建评估服务主体，你仍然需要数据。skill 定义了模块结构、智能体、评审和数据集注册表；第 4.2 和 4.3 步的黄金集和代码评分器可以原样接入。"),
      how: [{ t: t("Have Claude Code build it from the skill, then run it.", "让 Claude Code 依照 skill 构建它，然后运行。"), c: [{ w: "claude", code: `Read .agents/skills/mcp-eval/SKILL.md and build eval/phoenix/ exactly as it describes for this server
(contract_triage, stdio, DATA_BACKEND=snapshot). Use eval/golden_set.json as the dataset and add
eval/scorers.py code_checks as a deterministic evaluator next to the LLM judges.` }] }],
      test: [{ w: "repo", code: `ls eval/phoenix && cat eval/phoenix/README.md | head -30`, expect: t("One full run completes; evaluation.md says which harness produced which numbers.", "完成一次完整运行；evaluation.md 写明哪些数字来自哪个评估框架。") }],
      trouble: [{ s: t("No model key on the laptop", "笔记本上没有模型密钥"), c: t("The skill expects a USAi or other OpenAI-compatible gateway.", "skill 需要 USAi 或其他兼容 OpenAI 的网关。"), f: t("Use your own key or a local model behind an OpenAI-compatible endpoint; record which.", "使用你自己的密钥，或通过兼容 OpenAI 端点暴露的本地模型；记录用的是哪个。") }],
      done: t("One Phoenix run completes (only if 4.4 is blocked).", "完成一次 Phoenix 运行（仅当 4.4 受阻时）。"),
      after: ["scorers"],
      ran: "you",
      hours: 4,
    },
    {
      id: "fix-rerun",
      bp: "4.7",
      title: t("Fix from failures, then rerun", "根据失败修复，然后重新运行"),
      what: t("Changes to names, docstrings, defaults and hints, each tied to a failed row, in docs/eval-changes.md with before and after scores.", "对名称、docstring、默认值和提示的修改，每项都对应一个失败的行，记录在 docs/eval-changes.md 中，附修改前后的分数。"),
      why: t("A before-and-after table is strong Technical Quality evidence. Classifying each failure (wrong tool, wrong arguments, misread output, data error) points at the fix. Never edit the golden set to fit the server: that turns the eval into a mirror.", "修改前后的对比表是有力的技术质量证据。把每次失败归类（选错工具、参数错误、误读输出、数据错误），就能指向修复方向。绝不为了迁就服务器而修改黄金集：那会让评估变成一面镜子。"),
      how: [{ t: t("Log each change, push, redeploy, rerun.", "记录每项修改，推送，重新部署，重新运行。"), c: [{ w: "repo", code: `cp -n "$KIT/docs/eval-changes.md" docs/ && open -e docs/eval-changes.md
git add -A && git commit -m "Eval fixes: <rows>" && git push
set -a; source deploy/databricks/.env; set +a && bash deploy/databricks/deploy-databricks-app.sh` }] }],
      files: [K + "docs/eval-changes.md"],
      test: [{ w: "repo", code: `git diff --stat HEAD~5 -- eval/golden_set.json`, expect: t("No change to the golden set since it was built; docs/eval-changes.md lists each change with scores; a second full run is saved.", "黄金集自生成后没有改动；docs/eval-changes.md 列出每项修改及分数；第二次完整运行已保存。") }],
      trouble: [{ s: t("A fix helps one row and breaks another", "一个修复改善了一行却破坏了另一行"), c: t("Docstrings compete: two tools now claim the same question.", "docstring 互相竞争：两个工具现在都声称能回答同一个问题。"), f: t("Sharpen the \"do not use\" lines of both.", "把两者的 “do not use” 说明都写得更明确。") }],
      done: t("Second full run saved.", "第二次完整运行已保存。"),
      after: ["baseline"],
      ran: "you",
      hours: 4,
    },
    {
      id: "eval-doc",
      bp: "4.8",
      title: t("Draft the evaluation document", "起草评估文档"),
      what: t("docs/evaluation.md in GSA's four parts: methodology, performance metrics, security considerations, lessons learned and recommendations.", "按 GSA 的四个部分编写 docs/evaluation.md：方法、性能指标、安全考量、经验与建议。"),
      why: t("Writing it now shows missing evidence while there is time to collect it. Every number cites an MLflow run ID or a dq_results row; data quality results from 1.6 appear as stated limits.", "现在就写，能在还来得及收集时发现缺少的证据。每个数字都注明 MLflow 运行 ID 或 dq_results 行；第 1.6 步的数据质量结果作为陈述的局限出现。"),
      how: [{ t: t("Start from the kit's skeleton.", "从工具包的骨架开始。"), c: [{ w: "repo", code: `cp -n "$KIT/docs/evaluation.md" docs/ && open -e docs/evaluation.md` }] }],
      files: [K + "docs/evaluation.md"],
      test: [{ w: "repo", code: `grep -cE "run id|run_id|dq_results" docs/evaluation.md`, expect: t("Several matches: every number traces to a run ID or a dq_results row.", "多处匹配：每个数字都能追溯到运行 ID 或 dq_results 行。") }],
      trouble: [{ s: t("A number has no run ID", "某个数字没有运行 ID"), c: t("It came from a Playground session.", "它来自 Playground 会话。"), f: t("Rerun it through the eval, or drop it.", "通过评估重新运行，或删掉它。") }],
      done: t("Every number traces to a run ID.", "每个数字都能追溯到运行 ID。"),
      after: ["fix-rerun"],
      ran: "you",
      hours: 3,
    },
  ],
  gate: {
    id: "g4",
    title: t("Gate G4 (Sun. Nov. 15)", "G4 关卡（11 月 15 日周日）"),
    rows: [
      { check: t("With-server accuracy", "有服务器时的准确率"), pass: t("85 percent or more (mean of 5)", "85% 或以上（5 次平均）"), fail: t("Use stage 5 time for fixes; cut the workflow", "用第 5 阶段的时间修复；砍掉工作流") },
      { check: t("Baseline", "基线"), pass: t("Documented, five runs", "已记录，五次运行"), fail: t("Run it before anything else", "先运行它") },
      { check: t("Decoys, no-action, injection", "诱饵、无需行动、注入"), pass: t("All pass", "全部通过"), fail: t("Block release until fixed", "修复之前不得发布") },
    ],
  },
};
