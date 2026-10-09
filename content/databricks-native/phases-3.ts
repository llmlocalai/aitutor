import { t } from "@/lib/types";
import type { Phase } from "@/content/databricks/types";

const K = "native/databricks/";

/** Phases 7 and 8: ship, scale and operate. */
export const phases3: Phase[] = [
  {
    id: "ship",
    title: t("Ship: CI/CD, orchestration, observability", "上线：CI/CD、编排、可观测性"),
    goal: t(
      "GitLab is the only road to production. A merge request is tested and deployed to dev; a merge to main deploys staging and runs the evaluation gate; production is a manual, approved job that can only run on main. Jobs run the workflow on data arrival, and system tables show cost, quality and backlog on one screen.",
      "GitLab 是通往生产的唯一道路。合并请求会被测试并部署到 dev；合并到 main 会部署预发环境并运行评估门槛；生产部署是一个手动、需审批、只能在 main 上运行的作业。job 在数据到达时运行工作流，系统表在一屏上展示成本、质量和积压。",
    ),
    steps: [
      {
        id: "cicd",
        title: t("GitLab CI/CD: test, deploy, gate, promote", "GitLab CI/CD：测试、部署、门槛、晋级"),
        local: t(".gitlab-ci.yml: tests on merge requests with no workspace access, staging and the gate on main, a verified, approved production deploy on release, and the baseline carried as an artifact.", ".gitlab-ci.yml：合并请求上运行测试且不访问任何工作区，main 上部署预发并运行门槛，release 上经过验证和审批后部署生产，基线以产出物形式传递。"),
        links: ["ops.change", "evaluation.schedule", "guardrails.regress"],
        after: ["evalset", "identity", "repo"],
        components: ["gitlab", "bundle"],
        why: t(
          "Every control so far is only as strong as the path to production. If someone can deploy from a laptop, the eval gate is advice. The pipeline makes the controls mandatory: tests and the contract check on every merge request, with no workspace access; staging deploy, SQL, evaluation and gate on main; production only from the protected release branch, after a job proves this exact commit passed the gate on main, by a manual job in a protected GitLab environment, as a principal whose federation policy trusts only release. The release that reaches production becomes the next baseline, so the gate always compares against what users actually have.",
          "到目前为止的每一项控制，强度都取决于通往生产的那条路。如果有人能从笔记本直接部署，评估门槛就只是建议。流水线让这些控制成为强制要求：每个合并请求都要跑测试和契约检查，且不访问任何工作区；main 上要部署预发、执行 SQL、运行评估和门槛；生产只能从受保护的 release 分支部署：先有一个作业证明这个确切的提交在 main 上通过了门槛，然后由受保护 GitLab 环境中的手动作业，以一个联合策略只信任 release 的服务主体身份完成部署。进入生产的版本会成为下一个基线，所以门槛始终是与用户实际在用的版本做比较。",
        ),
        what: t(
          "Jobs: unit_tests (contract, pytest including the review-queue tests on a real Postgres, vendored-code drift) on merge requests and main; deploy_stg on main (render per-environment app settings, bundle deploy, run the pipeline once so the tables exist, apply the tool and metric SQL to the staging catalog, restart both apps); eval_gate on main (quality job, gate.py, gate_result.json with the commit sha); on release, verify_gate checks that exact sha passed, then deploy_prd runs manually in the protected environment and keeps baseline.json for the next gate. Each deploy runs `bundle run` for both apps, because deploy uploads code but does not restart an app.",
          "各作业：在合并请求和 main 上运行 unit_tests（契约、包括在真实 Postgres 上运行审核队列测试在内的 pytest、引入代码是否漂移）；main 上的 deploy_stg（写入按环境区分的 App 设置、bundle deploy、先运行一次 pipeline 让表存在、再把工具和指标 SQL 应用到预发 catalog、重启两个 App）；main 上的 eval_gate（质量检查 job、gate.py、带提交 sha 的 gate_result.json）；在 release 上，verify_gate 检查这个确切的 sha 是否通过，然后 deploy_prd 在受保护环境中手动运行，并保留 baseline.json 供下一次门槛使用。每次部署都会对两个 App 执行 `bundle run`，因为 deploy 只上传代码，不会重启 App。",
        ),
        how: [
          t("Commit .gitlab-ci.yml and requirements-ci.txt. Set the per-environment variables from step [[identity]], and pin SETUP_CLI_REF to a tag of the Databricks CLI installer.", "提交 .gitlab-ci.yml 和 requirements-ci.txt。设置第 [[identity]] 步中按环境划分的变量，并把 SETUP_CLI_REF 固定为 Databricks CLI 安装器的某个标签。"),
          t("Settings > CI/CD > Protected environments: production, deployment approval by the workflow owner and one platform engineer.", "在 Settings > CI/CD > Protected environments 中设置 production，部署需要工作流负责人和一位平台工程师审批。"),
          t("Open a merge request with a one-line prompt change and watch only the tests run; merge it and watch staging and the gate; fast-forward release to that commit and watch verify_gate, then the manual production button.", "开一个只改一行提示词的合并请求，看着只有测试在运行；合并后，看它经过预发和门槛；把 release fast-forward 到这个提交，看 verify_gate 运行，然后出现手动生产部署按钮。"),
          t("Deploy your own dev copy with setup/04_dev_deploy.sh. It runs the same copy, render and SQL steps as CI with your values, so dev never drifts from what CI ships.", "用 setup/04_dev_deploy.sh 部署你自己的 dev 副本。它用你的值执行与 CI 相同的复制、渲染和 SQL 步骤，所以 dev 永远不会与 CI 发布的内容产生偏差。"),
          t("Break it on purpose once: change a threshold in contract.yml to something the current agent cannot meet, and confirm the gate blocks production.", "故意让它失败一次：把 contract.yml 中的某个门槛改成当前智能体达不到的值，确认门槛会阻止生产部署。"),
        ],
        files: [K + ".gitlab-ci.yml", K + "databricks.yml", K + "src/evals/gate.py", K + "src/evals/verify_gate.py", K + "src/common/render_env.py", K + "src/common/apply_sql.py", K + "setup/04_dev_deploy.sh", K + "requirements-ci.txt"],
        interpret: [
          t("`gate FAILED (2 reasons)` with the reasons listed is the pipeline protecting production. The job log is the evidence an auditor wants: which release, which numbers, who approved.", "`gate FAILED (2 reasons)` 并列出原因，说明流水线在保护生产环境。作业日志就是审计人员需要的证据：哪个版本、哪些数字、谁批准的。"),
          t("`RELEASE BLOCKED: the gate result is for 3f2a..., not 9c1d...` means release points at a commit the gate has not passed, usually a newer main commit. Release the gated commit or wait for main's gate.", "`RELEASE BLOCKED: the gate result is for 3f2a..., not 9c1d...` 说明 release 指向了一个尚未通过门槛的提交，通常是 main 上更新的提交。发布已通过门槛的那个提交，或者等 main 的门槛跑完。"),
          t("deploy_prd waiting for approval after verify_gate is green is the normal state. Approvers should open gate_result.json and current.json (job artifacts) before clicking.", "verify_gate 通过后 deploy_prd 等待审批，是正常状态。审批人在点击之前应该打开 gate_result.json 和 current.json（作业产出物）看一看。"),
        ],
        trouble: [
          { s: t("deploy succeeded but the app runs old code", "deploy 成功了，但 App 运行的还是旧代码"), c: t("bundle deploy uploads code and updates resources but does not restart the app process.", "bundle deploy 会上传代码并更新资源，但不会重启 App 进程。"), f: t("Keep the `bundle run agent` and `bundle run reviewer` lines after every deploy.", "在每次 deploy 之后都保留 `bundle run agent` 和 `bundle run reviewer` 这两行。") },
          { s: t("render_env fails: has no value (placeholder)", "render_env 失败：没有值（占位符）"), c: t("A per-environment CI variable is unset, so the app would have deployed with a dev value.", "某个按环境区分的 CI 变量未设置，于是 App 会带着 dev 的值部署。"), f: t("Set it for that GitLab environment. Failing the deploy is the point: prd must never read fin_dev.", "为那个 GitLab 环境设置它。让部署失败正是目的：prd 绝不能读取 fin_dev。") },
          { s: t("The gate passes with no baseline", "在没有基线的情况下门槛通过了"), c: t("First release: there is nothing to regress from.", "首次发布：没有可以与之比较的版本。"), f: t("Expected once. The contract thresholds still apply; deploy_prd keeps that release's current.json as baseline.json, the first baseline.", "这只会发生一次。契约门槛仍然有效；deploy_prd 会把这次发布的 current.json 保存为 baseline.json，即第一个基线。") },
          { s: t("First deploy: functions.sql fails, table not found", "首次部署：functions.sql 失败，找不到表"), c: t("The tools and the metric view read gold tables, which exist only after the pipeline's first update.", "工具和指标视图读取 gold 表，而这些表要等 pipeline 第一次更新后才存在。"), f: t("Keep `bundle run spend_pipeline` between deploy and apply_sql. On later deploys it is an incremental refresh.", "在 deploy 和 apply_sql 之间保留 `bundle run spend_pipeline`。之后的部署中它只是一次增量刷新。") },
        ],
        done: t("A merge request runs tests only, main reaches staging and the gate, production deploys only from release after verify_gate and an approval, and a deliberately failing gate blocks it.", "合并请求只运行测试，main 能部署到预发并经过门槛，生产只能从 release 在 verify_gate 通过并经审批后部署，并且一个故意失败的门槛会阻止它。"),
        unconfirmed: t("The Python SDK's env-oidc support (used by apply_sql.py in CI) is assumed from the documented env-oidc auth type; gate.py and verify_gate.py read only local files. Downloading another job's artifacts with CI_JOB_TOKEN is a GitLab feature for the same project. Protected-environment approvals depend on your GitLab tier.", "Python SDK 对 env-oidc 的支持（CI 中的 apply_sql.py 会用到）是根据文档中的 env-oidc 认证类型推断的；gate.py 和 verify_gate.py 只读取本地文件。用 CI_JOB_TOKEN 下载另一个作业的产出物，是 GitLab 针对同一项目提供的功能。受保护环境的审批功能取决于你的 GitLab 版本等级。"),
        scale: [
          t("More workflows: a shared GitLab CI component (include: component) for the authenticate-deploy-gate pattern; each workflow repository supplies its contract and targets.", "工作流增多时：为“认证-部署-门槛”模式建一个共享的 GitLab CI 组件（include: component）；每个工作流仓库只需提供自己的契约和 target。"),
          t("More regions: one prd target per region, deployed in sequence from the same pipeline, the second only after the first's monitors are green.", "区域增多时：每个区域一个 prd target，在同一条流水线中依次部署，第二个区域要等第一个区域的监控正常之后才部署。"),
        ],
        challenge: [
          { q: t("Why a manual production step, when continuous deployment is best practice?", "持续部署才是最佳实践，为什么生产还要手动？"), a: t("For a workflow that proposes payments, a named approver is a control your auditors will ask for. The manual step costs a click after an automated gate; it can become automatic later for change types the contract allows, such as prompt wording below a risk threshold.", "对于一个会提议付款的工作流，具名的审批人是审计人员会要求的控制措施。这个手动步骤只是在自动门槛之后多点一下；之后对于契约允许的变更类型（例如低于风险阈值的提示词措辞调整），可以改成自动。") },
        ],
      },
      {
        id: "orchestrate",
        title: t("Orchestrate with Lakeflow Jobs", "用 Lakeflow Jobs 编排"),
        local: t("The orchestrator (file arrival: pipeline, batch triage, export), the weekly policy refresh, and the nightly quality job.", "编排 job（文件到达触发：pipeline、批量分诊、导出）、每周的政策刷新，以及每晚的质量检查 job。"),
        links: ["ops.scheduler", "ops.nightly", "ops.supervise"],
        after: ["agent", "review"],
        components: ["jobs"],
        why: t(
          "The workflow runs when data arrives, not when someone remembers. The orchestrator chains the pipeline, the batch triage against the deployed agent, and the export of decisions, with one run at a time so two runs never triage the same exceptions. The batch calls the same agent endpoint the evaluation measured: one code path, so what was tested is what runs. A per-run limit bounds cost and blast radius: a bad deploy can only spend one batch.",
          "工作流在数据到达时运行，而不是在有人想起来的时候。编排 job 把 pipeline、针对已部署智能体的批量分诊、决定导出串联起来，并且一次只允许一个运行，这样两个运行永远不会分诊同一批异常。批处理调用的是评估所衡量的同一个智能体端点：只有一条代码路径，所以测试过的就是实际运行的。每次运行的数量上限限定了成本和影响范围：一次错误的部署最多只会浪费一批。",
        ),
        what: t(
          "resources/jobs.yml defines spend_orchestrator (file-arrival trigger on the ERP landing folder; tasks refresh_pipeline, batch_triage, export_decisions; max_concurrent_runs 1; failure email), policy_refresh (Mondays) and quality (nightly eval and Genie benchmark). batch_triage.py selects exceptions with no live proposal, plus pending proposals whose invoice amount has since changed (made on old facts, so the agent supersedes them); a decided exception is never triaged again, which would invite a second approval of a payment, and a decided one whose amount changed is printed for a person. It sends only units in the agent principal's reviewer_scope, so an exception the agent cannot read is not escalated as not found every run for ever. It calls the agent with bounded concurrency and jittered backoff on 429, 5xx and network errors, records a failed call as one error instead of ending the batch, and fails the task above 5% errors.",
          "resources/jobs.yml 定义了 spend_orchestrator（在 ERP 落地目录上按文件到达触发；任务包括 refresh_pipeline、batch_triage、export_decisions；max_concurrent_runs 为 1；失败时发邮件）、policy_refresh（每周一）和 quality（每晚的评估和 Genie 基准测试）。batch_triage.py 选出没有在途提议的异常，以及发票金额已变化的待处理提议（它们基于旧事实做出，所以智能体会取代它们）；已决定的异常绝不会再次分诊，否则可能导致同一笔付款被第二次批准，而已决定但金额变化的异常会打印出来交给人处理。它只发送智能体服务主体在 reviewer_scope 中拥有的单元，这样智能体读不到的异常不会每次运行都以“找不到”被升级、永无止境。它以有限并发调用智能体，在遇到 429、5xx 和网络错误时带抖动地退避重试，把一次失败的调用记为一个错误而不是让整批终止，错误率超过 5% 时让任务失败。",
        ),
        how: [
          t("After the first deploy, set agent_url, agent_client_id (`databricks apps get agent-spend-exceptions`), pg_endpoint, pg_host and jobs_client_id (the runtime principal from step [[identity]], not the CI principal) per target.", "首次部署后，为每个 target 设置 agent_url、agent_client_id（`databricks apps get agent-spend-exceptions`）、pg_endpoint、pg_host 和 jobs_client_id（第 [[identity]] 步的运行时服务主体，不是 CI 服务主体）。"),
          t("Drop one test extract into the landing folder in dev and watch the orchestrator run end to end.", "在 dev 的落地目录中放一个测试抽取文件，观察编排 job 从头到尾运行一遍。"),
          t("Start with --concurrency 4 and --limit 100; raise both from the load test, not by feel.", "从 --concurrency 4 和 --limit 100 开始；根据负载测试提高这两个值，而不是凭感觉。"),
        ],
        files: [K + "resources/jobs.yml", K + "src/agent/batch_triage.py"],
        interpret: [
          t("`{'total': 100, 'queued': 91, 'escalated': 7, 'error': 2, 'seconds': 412.3}`: 91% handled, 7% sent to people with reasons, 2% errors (retried and still failed). 412 seconds for 100 at concurrency 4 means about 16 seconds per triage.", "`{'total': 100, 'queued': 91, 'escalated': 7, 'error': 2, 'seconds': 412.3}`：91% 已处理，7% 附带原因交给了人，2% 出错（重试后仍失败）。并发 4 时处理 100 个用了 412 秒，意味着每次分诊约 16 秒。"),
          t("A run that skips because another is in progress is max_concurrent_runs doing its job; if it happens every time, the batch takes longer than the arrival interval and needs more concurrency.", "某次运行因为另一次正在进行而被跳过，说明 max_concurrent_runs 在尽职；如果每次都这样，说明一批处理的耗时超过了数据到达的间隔，需要提高并发。"),
        ],
        trouble: [
          { s: t("batch_triage: 401 from the agent", "batch_triage：智能体返回 401"), c: t("The job's principal has no CAN_USE on the agent app, or the token expired mid-run.", "job 的服务主体对智能体 App 没有 CAN_USE 权限，或者令牌在运行中途过期了。"), f: t("The stg and prd targets grant CAN_USE on the agent to jobs_client_id; check it names the runtime principal. In dev the caller is you, the app's owner. For runs longer than about an hour, refresh headers per request.", "stg 和 prd 的 target 会向 jobs_client_id 授予智能体的 CAN_USE；检查它指向的是运行时服务主体。在 dev 中调用者是你，也就是 App 的所有者。对于超过约一小时的运行，每个请求都刷新一次请求头。") },
          { s: t("The same exceptions escalate as not found every run", "同一批异常每次运行都以“找不到”被升级"), c: t("Without --agent-principal the batch sends units the agent's row filter hides.", "没有 --agent-principal 时，批处理会发送被智能体行过滤隐藏的单元。"), f: t("Set agent_client_id so the job passes it, and add the missing reviewer_scope rows; step [[observe]] query 6 lists them.", "设置 agent_client_id 让 job 传入它，并补上缺失的 reviewer_scope 记录；第 [[observe]] 步的查询 6 会列出它们。") },
          { s: t("The job fails on errors above 5%", "错误率超过 5% 时 job 失败"), c: t("The agent or a dependency is unhealthy.", "智能体或某个依赖不健康。"), f: t("That is the intent: a failing batch pages someone instead of filling the queue with escalations. Check the agent app logs and the gateway first.", "这正是设计意图：失败的批处理会通知到人，而不是让队列里塞满升级处理。先检查智能体 App 的日志和网关。") },
        ],
        done: t("A file landing in dev produces queued proposals and exported decisions with no human starting anything.", "在 dev 中落地一个文件，无需任何人启动，就能产生排队中的提议和导出的决定。"),
        unconfirmed: t("The job trigger.file_arrival block shape is from the Jobs API as recalled; check it in `bundle validate`.", "job 的 trigger.file_arrival 块结构来自对 Jobs API 的记忆；请在 `bundle validate` 中核对。"),
        scale: [
          t("Volume grows: raise concurrency to the knee from step [[scale]], then shard by business unit (one task per unit in a for-each task) so one slow unit does not hold the rest.", "数据量增长时：把并发提高到第 [[scale]] 步测得的拐点，然后按业务单元分片（在 for-each 任务中每个单元一个任务），这样一个慢单元不会拖住其他单元。"),
          t("Near-real-time needs: replace file arrival with a continuous pipeline and a queue-driven triage; the agent and the controls do not change.", "需要近实时处理时：把文件到达触发换成持续运行的 pipeline 和由队列驱动的分诊；智能体和控制措施都不需要改。"),
        ],
        challenge: [
          { q: t("Why not run the agent inside the job, in-process, to save the HTTP hop?", "为什么不在 job 里直接以进程内方式运行智能体，省掉一次 HTTP 调用？"), a: t("Then the batch and the evaluated app could differ in dependencies, prompts and identity. The hop costs milliseconds against a 16-second triage; one code path is worth far more.", "那样的话，批处理和被评估的 App 可能在依赖、提示词和身份上出现差异。相对于一次 16 秒的分诊，这次调用只多几毫秒；而只有一条代码路径的价值要大得多。") },
        ],
      },
      {
        id: "observe",
        title: t("Observability: cost, quality, backlog, data quality", "可观测性：成本、质量、积压、数据质量"),
        local: t("Six queries over system tables, decisions, routing and the pipeline event log, on one dashboard, with alerts.", "基于系统表、决定记录、路由和 pipeline 事件日志的六条查询，放在一个仪表盘上，并配置告警。"),
        links: ["ops.status", "ops.logs", "ops.inventory"],
        after: ["orchestrate"],
        components: ["observe"],
        why: t(
          "The owner of this workflow needs five numbers every morning: what it cost, what it cost per exception, how often people agreed with it, how old the oldest undecided exception is, and how much bad data the pipeline caught. A sixth check guards the routing: any business unit with open exceptions but no human reviewer, or out of the agent's scope, is work that reaches nobody. Every resource carries the workload tag from the bundle, so cost is attributable to this workflow and not lost in a shared workspace bill.",
          "这个工作流的负责人每天早上需要五个数字：花了多少钱、每个异常花多少钱、人们同意它的频率、最老的待决异常有多久，以及 pipeline 拦下了多少坏数据。第六项检查守住路由：任何有待处理异常、却没有人工审核人员或不在智能体范围内的业务单元，都是无人接手的工作。每个资源都带有 bundle 中的 workload 标签，所以成本能归属到这个工作流，而不会淹没在共享工作区的账单里。",
        ),
        what: t(
          "observability.sql: daily DBUs by product for workload=spend-exceptions; DBUs per exception triaged; weekly approval rate and rejected payment proposals; backlog age by business unit; expectation results from the pipeline event log; units that reach nobody (query 6, alert on any row).",
          "observability.sql：workload=spend-exceptions 每天按产品统计的 DBU；每次异常分诊的 DBU；每周批准率和被拒绝的付款提议；按业务单元统计的积压时长；pipeline 事件日志中的期望规则结果；无人负责的单元（查询 6，返回任何一行就告警）。",
        ),
        how: [
          t("Run each query once in prd and fix names (catalog, any product names your account reports differently).", "在 prd 中把每条查询运行一次，并修正名称（catalog，以及你的账号中名称不同的产品）。"),
          t("Build one AI/BI dashboard from the five queries; share it with the workflow owner.", "用这五条查询建一个 AI/BI 仪表盘；分享给工作流负责人。"),
          t("Alerts: backlog oldest_days above the SLO, rejected_payments above zero in a week, dbus_per_exception up 30% week on week.", "告警：积压 oldest_days 超过 SLO；一周内 rejected_payments 大于零；dbus_per_exception 环比上升 30%。"),
          t("Set a budget policy and a budget alert for the workload tag in the account console.", "在账号控制台中为该 workload 标签设置预算策略和预算告警。"),
        ],
        files: [K + "src/ops/observability.sql"],
        interpret: [
          t("rejected_payments above zero means a person caught the agent proposing a payment they would not make. Each one is a candidate unsafe-error case for the next eval set.", "rejected_payments 大于零，说明有人拦下了智能体提议的一笔他们不会付的款。每一条都是下一个评估集中不安全错误用例的候选。"),
          t("DBUs per exception is the unit economics. Compare it with the cost of a person's time per exception from step [[contract]]; that ratio is the business case, measured, not projected.", "每个异常的 DBU 就是单位经济性。把它与第 [[contract]] 步中每个异常所需的人工时间成本对比；这个比值就是业务论证，而且是实测的，不是预测的。"),
        ],
        trouble: [
          { s: t("Cost query returns nothing", "成本查询没有返回结果"), c: t("Tags were not applied (presets missing) or system tables are not enabled.", "标签没有应用上（缺少 presets），或者系统表没有启用。"), f: t("Check one job's tags in the UI; ask an account admin to enable system.billing and grant SELECT.", "在界面中检查某个 job 的标签；请账号管理员启用 system.billing 并授予 SELECT。") },
          { s: t("event_log query fails", "event_log 查询失败"), c: t("The function needs the pipeline's table or id and owner-level access.", "该函数需要 pipeline 的表或 id，以及所有者级别的访问权限。"), f: t("Run it as the pipeline owner, or publish the event log to a table in the pipeline settings.", "以 pipeline 所有者身份运行，或者在 pipeline 设置中把事件日志发布到一张表。") },
        ],
        done: t("One dashboard shows the five numbers for production, with three alerts and a budget alert.", "一个仪表盘展示了生产环境的五个数字，并配置了三个告警和一个预算告警。"),
        unconfirmed: t("custom_tags on system.billing.usage and the event_log() table-valued function are standard system features; the exact JSON path of expectation metrics in the event log was not on the expectations page read.", "system.billing.usage 上的 custom_tags 和 event_log() 表值函数都是标准系统功能；事件日志中期望规则指标的确切 JSON 路径不在本指南阅读的期望规则页面上。"),
        scale: [
          t("At enterprise scale every workflow publishes the same five numbers under its own tag. A portfolio dashboard is then a GROUP BY workload, which is how a platform team shows value across twenty agents.", "在企业规模下，每个工作流都在自己的标签下发布同样的五个数字。这样一来，组合层面的仪表盘就只是一个按 workload 的 GROUP BY，平台团队正是这样展示二十个智能体的整体价值的。"),
        ],
        challenge: [
          { q: t("Approval rate is a vanity metric, isn't it?", "批准率不就是个虚荣指标吗？"), a: t("Alone, yes. Paired with rejected payment proposals (which must be zero) and a monthly second-reviewer sample (do people agree with each other?), it becomes a measured accuracy with a person behind every label.", "单独看，是的。但配上被拒绝的付款提议（必须为零）和每月一次的第二审核人抽样（人与人之间是否一致？），它就成了一个以人为每个标签背书的实测准确率。") },
        ],
      },
    ],
  },
  {
    id: "scale",
    title: t("Scale and operate", "扩展与运维"),
    goal: t(
      "Scaling an agent workflow is finding which limit you hit first and raising that one: model throughput, app concurrency, reviewer hours, cost per exception, or the evidence needed for more autonomy. Operating it is knowing how to roll back each layer independently in minutes.",
      "扩展一个智能体工作流，就是找出你最先碰到的那个限制，然后提升它：模型吞吐量、App 并发、审核人员工时、每个异常的成本，或者获得更高自主权所需的证据。运维它，就是知道如何在几分钟内独立回滚每一层。",
    ),
    steps: [
      {
        id: "scale",
        title: t("Load test, find the knee, then scale the limit you hit", "做负载测试，找到拐点，再扩展你碰到的那个限制"),
        local: t("load_test.py against staging with dry-run requests; a table of limits and levers per layer.", "以 dry-run 请求针对预发环境运行的 load_test.py；一张按层列出限制与杠杆的表。"),
        links: ["inference.latency", "inference.budget", "multi-agent.cost"],
        after: ["orchestrate"],
        components: ["agent", "gateway", "reviewer"],
        why: t(
          "\"Will it scale\" has no answer until you know where it breaks. The load test steps concurrency up and records p50 and p95 latency, error rate and throughput at each step. The first step that breaks the contract's p95 or exceeds 1% errors is the knee. Production concurrency stays below it, and the levers in the table raise it, one layer at a time, with a measurement after each.",
          "在知道它会在哪里崩溃之前，“它能不能扩展”这个问题没有答案。负载测试逐步提高并发，记录每一步的 p50 和 p95 延迟、错误率和吞吐量。第一个突破契约 p95 或错误率超过 1% 的步骤就是拐点。生产并发保持在拐点之下，而表中的杠杆用来一层一层地提高拐点，每调一次就测量一次。",
        ),
        what: t(
          "Runs four dry-run requests per worker at each concurrency level, prints a stats line per level, and names the knee. Pure helpers (percentile, step_stats, knee) are tested here.",
          "在每个并发级别上，每个工作线程发送四个 dry-run 请求，每个级别打印一行统计，并指出拐点所在。纯函数辅助工具（percentile、step_stats、knee）在这里经过测试。",
        ),
        how: [
          t("Export 200 exception ids from staging into ids.txt.", "从预发环境导出 200 个异常 id 到 ids.txt。"),
          t("`python load_test.py --agent-url <staging agent> --ids ids.txt --levels 1,2,4,8,16,32`.", "执行 `python load_test.py --agent-url <staging agent> --ids ids.txt --levels 1,2,4,8,16,32`。"),
          t("Read the gateway usage and app metrics for the same window to see which layer saturated.", "查看同一时间窗口内的网关用量和 App 指标，确定是哪一层饱和了。"),
          t("Set batch concurrency and gateway limits below the knee; repeat after any model, prompt or compute change.", "把批处理并发和网关限额设在拐点之下；任何模型、提示词或计算资源变更之后都要重新测一遍。"),
        ],
        files: [K + "src/scale/load_test.py"],
        code: [{ lang: "text", text: `layer            first limit you hit                        lever
model            429s or p95 growth at the gateway          provisioned throughput; a cheaper model for one class (eval first)
agent app        p95 grows while model latency is flat      larger app compute; fewer tool rounds (prompt); cache vendor_history per run
tools / Genie    Genie seconds dominate the trace           UC function for questions asked every time; warehouse sizing
AI Search        query latency at high QPS                  standard endpoint QPS; storage-optimized for very large corpora
pipeline         update time beyond the arrival interval    scheduled batches instead of per-file; liquid clustering; serverless
AI Functions     cost per document                          streaming tables only; backfills as budgeted runs
Lakebase         connections or lock waits                  autoscaling; short transactions; pool size per app
reviewers        backlog age grows with healthy compute     raise autonomy for one low-risk class, with evidence (step 22)
cost             DBUs per exception rising                  read traces: rounds, prompt size; model choice per class` }],
        interpret: [
          t("`{'concurrency': 8, 'p50_s': 14.1, 'p95_s': 31.4, 'error_rate': 0.0, 'rps': 0.51}` then `knee at concurrency: 8`: eight parallel triages break the 30-second p95. Run at 4 to 6 in production and raise the limit that saturated.", "`{'concurrency': 8, 'p50_s': 14.1, 'p95_s': 31.4, 'error_rate': 0.0, 'rps': 0.51}`，接着 `knee at concurrency: 8`：八个并行分诊会突破 30 秒的 p95。生产中以 4 到 6 的并发运行，并提升饱和的那个限制。"),
          t("Throughput times hours tells you capacity: 0.5 triages a second is 1,800 an hour. If the business produces 3,000 exceptions a day, the agent is not the bottleneck; reviewers are.", "吞吐量乘以小时数就是容量：每秒 0.5 次分诊就是每小时 1,800 次。如果业务每天产生 3,000 个异常，瓶颈不是智能体，而是审核人员。"),
        ],
        trouble: [
          { s: t("Errors appear at low concurrency", "低并发时就出现错误"), c: t("A rate limit set for people applies to the test principal.", "为个人设定的限流作用到了测试用的服务主体上。"), f: t("Run the load test as the batch principal with its own gateway limit.", "以批处理服务主体的身份运行负载测试，它有自己的网关限额。") },
          { s: t("Results vary run to run", "每次运行结果都不一样"), c: t("Pay-per-token endpoints are shared, so load from other tenants shows up.", "按 token 计费的端点是共享的，所以其他租户的负载也会体现出来。"), f: t("Repeat at two times of day and use the worse result; provisioned throughput removes most of the variance.", "在一天中的两个时段重复测试，取较差的结果；预置吞吐量可以消除大部分波动。") },
        ],
        done: t("A measured knee for staging, written next to the batch concurrency and gateway limits it justifies.", "得到预发环境实测的拐点，并把它写在由它推导出的批处理并发和网关限额旁边。"),
        scale: [
          t("From one business unit to the enterprise: onboard units one at a time by adding rows to reviewer_scope and eval cases for that unit; watch its approval rate for two weeks before the next.", "从一个业务单元扩展到整个企业：一次接入一个单元，方法是在 reviewer_scope 中添加记录，并为该单元添加评估用例；观察它两周的批准率，再接入下一个。"),
          t("Raising autonomy is the largest scaling lever, and it is earned: level 3 for one exception class below an amount, after a quarter with zero unsafe errors and an approval rate at the human agreement rate, written into contract.yml and approved by its owner.", "提高自主等级是最大的扩展杠杆，而且必须靠证据挣来：在一个季度内不安全错误为零、批准率达到人与人一致率之后，才对某一类低于某个金额的异常开放第 3 级，并写入 contract.yml，经其负责人批准。"),
        ],
        challenge: [
          { q: t("Can we skip load testing and just buy provisioned throughput?", "能不能跳过负载测试，直接买预置吞吐量？"), a: t("You can, and you will size it wrong. The knee is often the app or a tool, not the model, and then reserved capacity is money spent on the wrong layer.", "可以，但你一定会买错规格。拐点往往出在 App 或某个工具上，而不是模型；那样的话，预留的容量就是花在了错误的层上。") },
        ],
      },
      {
        id: "operate",
        title: t("Operate: rollback per layer, upgrades, retention, the autonomy review", "运维：按层回滚、升级、保留期、自主等级评审"),
        local: t("A rollback for each layer, a model upgrade procedure, retention rules from the contract, and a quarterly autonomy review.", "每一层的回滚方法、模型升级流程、来自契约的保留规则，以及每季度的自主等级评审。"),
        links: ["self-evolving.rollback", "ops.backup", "ops.change", "self-evolving.limits"],
        after: ["observe", "scale"],
        components: ["bundle", "queue", "uc"],
        why: t(
          "Something will go wrong at 4 p.m. on the last day of the month. Each layer has its own rollback that takes minutes and does not touch the others: prompt (move an alias), code (redeploy the previous tag), data (Delta restore), queue (Lakebase branch), autonomy (one line in the contract). Knowing them in advance is what makes it safe to ship weekly.",
          "月底最后一天下午四点，总会出点什么问题。每一层都有自己的回滚方法，只需几分钟，而且不影响其他层：提示词（移动别名）、代码（重新部署上一个标签）、数据（Delta 恢复）、队列（Lakebase 分支）、自主等级（契约中的一行）。事先掌握这些，才能放心地每周发布。",
        ),
        what: t(
          "The commands for each rollback, the model upgrade path (a merge request that changes agent_model and must pass the gate), retention enforcement for traces and proposals, and the quarterly review that decides whether any exception class moves up an autonomy level.",
          "每种回滚的具体命令、模型升级路径（修改 agent_model 并必须通过门槛的合并请求）、追踪和提议的保留期执行，以及决定是否有某类异常可以提升自主等级的季度评审。",
        ),
        how: [
          t("Rehearse each rollback once in staging and write the time it took in the runbook.", "在预发环境把每种回滚都演练一次，并把所用时间写进运行手册。"),
          t("Subscribe to the supported-models page; any model with a retirement date gets a merge request a month ahead.", "订阅支持模型页面；任何有下线日期的模型，都要提前一个月提交合并请求。"),
          t("Quarterly: new eval version from the last quarter, human agreement sample, autonomy review with the owner.", "每季度：用上个季度的数据生成新的评估版本、做一次人工一致性抽样，并与负责人一起做自主等级评审。"),
        ],
        code: [{ lang: "bash", file: "rollbacks", text: `# prompt: move the alias back (seconds, no deploy)
python -c "import mlflow; mlflow.genai.set_prompt_alias(name='fin_prd.ai.spend_agent_instructions', alias='production', version=7)"

# code: redeploy the previous release tag through the pipeline (GitLab: run pipeline on tag v1.8.2), or
git checkout v1.8.2 && databricks bundle deploy -t prd && databricks bundle run agent -t prd

# data: restore a table to before a bad pipeline update
databricks sql query --warehouse-id <id> "RESTORE TABLE fin_prd.ai.invoice_fields TO TIMESTAMP AS OF '2026-10-30T15:00:00'"

# queue: inspect or recover from a point in time with a Lakebase branch (console: Branches > Create from point in time)

# autonomy: lower the level in contract.yml, merge; the gate and the agent read it on the next deploy

# stop everything that writes proposals, now (reviewers keep working on what is queued)
databricks jobs list --name spend-exceptions-orchestrator   # then: databricks jobs update <job_id> with pause_status PAUSED` }],
        interpret: [
          t("A rollback that takes longer than its rehearsal time is an incident in itself: write down why.", "如果一次回滚比演练时用的时间长，这本身就是一起事故：记下原因。"),
          t("The autonomy review is a decision with evidence: unsafe errors (must be zero), approval rate against human agreement, volume, and the owner's signature. Without all four, the level stays.", "自主等级评审是一个基于证据的决定：不安全错误（必须为零）、与人工一致率相比的批准率、处理量，以及负责人的签字。四项缺一，等级就保持不变。"),
        ],
        trouble: [
          { s: t("RESTORE breaks the pipeline", "RESTORE 导致 pipeline 出错"), c: t("Restoring a pipeline-managed streaming table moves it behind its checkpoint.", "恢复由 pipeline 管理的流式表，会让它落后于其 checkpoint。"), f: t("For streaming tables, prefer a full refresh of that table in a budgeted window; RESTORE is for tables you own.", "对于流式表，优先在有预算的时间窗口内对该表做全量刷新；RESTORE 适用于你自己拥有的表。") },
          { s: t("A model retires before the upgrade passes the gate", "模型在升级通过门槛之前就下线了"), c: t("The upgrade started too late.", "升级启动得太晚了。"), f: t("Start a month ahead; if the new model fails the gate, escalate everything (level 0) rather than ship an unmeasured model.", "提前一个月开始；如果新模型过不了门槛，就把所有事项都升级给人处理（第 0 级），而不是上线一个未经衡量的模型。") },
        ],
        done: t("Every rollback has been rehearsed with a recorded time, and the first quarterly review is on the calendar with its four inputs.", "每种回滚都已演练并记录了时间，第一次季度评审已排进日程，并准备好了四项输入。"),
        unconfirmed: t("`databricks sql query` as a CLI subcommand is illustrative; run RESTORE from the SQL editor if your CLI version lacks it. Pausing a job is shown as the update you would apply; the UI pause button is equivalent.", "`databricks sql query` 这个 CLI 子命令只是示意；如果你的 CLI 版本没有它，就在 SQL 编辑器中执行 RESTORE。暂停 job 展示的是你需要做的更新；界面上的暂停按钮效果相同。"),
        scale: [
          t("With many workflows, the rollbacks become a platform runbook with the same five layers for every agent. That uniformity is what lets a small platform team run twenty of them.", "工作流很多时，这些回滚方法就成为一份平台运行手册，每个智能体都是同样的五层。正是这种一致性，让一个小型平台团队能运行二十个这样的工作流。"),
        ],
        challenge: [
          { q: t("Where is the kill switch?", "紧急停止开关在哪里？"), a: t("Pausing the orchestrator stops new proposals in one action; reviewers can keep working what is queued, and nothing pays without them. Because the agent never writes to the system of record, stopping it never leaves a half-done payment.", "暂停编排 job，一个操作就能停止产生新提议；审核人员可以继续处理已在队列中的事项，而没有他们任何款项都付不出去。因为智能体从不写入记录系统，停止它永远不会留下做到一半的付款。") },
        ],
      },
    ],
  },
];
