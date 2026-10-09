import { t } from "@/lib/types";
import type { Phase } from "@/content/databricks/types";

const K = "native/databricks/";

/** Phases 1 to 3: frame and govern, data, document AI. */
export const phases1: Phase[] = [
  {
    id: "frame",
    title: t("Frame and govern", "定框架与治理"),
    goal: t(
      "Decide what the workflow decides, who is accountable, where the code lives and who may touch which data, before any data moves. Most enterprise agent projects that stall do so here: no written decision, no owner, credentials pasted into CI, one catalog for everything. These four steps cost a few days and remove the reasons a security review or an auditor would stop you later.",
      "在任何数据流动之前，先确定这个工作流要做什么决策、由谁负责、代码放在哪里、谁可以碰哪些数据。大多数停滞的企业级智能体项目都卡在这里：没有书面的决策定义，没有负责人，凭证直接贴进 CI，所有东西都放在一个 catalog 里。这四步只花几天，却能消除日后安全审查或审计人员叫停你的那些理由。",
    ),
    steps: [
      {
        id: "contract",
        title: t("Write the workflow contract", "写下工作流契约"),
        local: t("contract.yml: the decision, the allowed actions, the autonomy level, and the release thresholds, in one reviewed file.", "contract.yml：决策、允许的动作、自主等级和发布门槛，都写在一个经过审查的文件里。"),
        links: ["evaluation.frozen", "guardrails.check", "self-evolving.preconditions"],
        after: [],
        components: ["gitlab"],
        why: t(
          "An agent with no written decision grows until it does everything badly. The contract fixes four things everyone argues about later: what the agent decides (one resolution per match exception), what it may do (propose, never pay), how much autonomy it has (level 2: act with approval), and what number makes a release acceptable. Code reads its thresholds from this file, so a business owner changes a tolerance in one reviewed line, and CI rejects a contract that contradicts itself.",
          "没有书面决策定义的智能体会不断膨胀，直到什么都做不好。契约固定了日后大家都会争论的四件事：智能体决定什么（每个匹配异常给出一个处置建议），它可以做什么（只提议，绝不付款），它有多大的自主权（第 2 级：经批准后执行），以及什么样的数字才算可以发布。代码从这个文件读取门槛值，所以业务负责人只需在一行经过审查的配置里修改容差，而 CI 会拒绝自相矛盾的契约。",
        ),
        what: t(
          "contract.yml names the workflow, its owner, the decision, four allowed actions, autonomy level 2, the write boundary (review_queue only), the two-person rule above 25,000, five success metrics, one catalog per environment, and retention. contract.py validates it: escalate must always be allowed, level 2 may write only to the queue, grounded figures must be 1.0, and each environment needs its own catalog.",
          "contract.yml 写明了工作流名称、负责人、决策内容、四个允许的动作、自主等级 2、写入边界（只能写 review_queue）、超过 25,000 的双人复核规则、五项成功指标、每个环境一个 catalog，以及保留期限。contract.py 负责校验：escalate 必须始终允许，第 2 级只能写入队列，有据数字比例必须为 1.0，每个环境必须有自己的 catalog。",
        ),
        how: [
          t("Copy contract.yml and replace the decision, owner and thresholds with your workflow's. Keep the shape.", "复制 contract.yml，把决策、负责人和门槛值换成你自己工作流的内容。保持结构不变。"),
          t("Get the business owner to sign the success metrics in the merge request. A threshold nobody owns is moved the first time it fails.", "让业务负责人在合并请求里签字确认成功指标。没人负责的门槛，第一次没达标就会被挪走。"),
          t("Run `python3 src/common/contract.py`. CI runs the same check on every merge request.", "运行 `python3 src/common/contract.py`。CI 在每个合并请求上都会执行同样的检查。"),
        ],
        files: [K + "contract.yml", K + "src/common/contract.py"],
        interpret: [
          t("`contract ok` means the file is internally consistent. It does not mean the thresholds are right; only the eval in step [[evalset]] can say whether 0.85 is achievable.", "`contract ok` 说明文件内部一致。它不代表门槛值是对的；只有第 [[evalset]] 步的评估才能告诉你 0.85 是否可以达到。"),
          t("A problem line such as `grounded_figures_min below 1.0 means shipping invented numbers on purpose` is the check refusing a business decision nobody should make by accident.", "像 `grounded_figures_min below 1.0 means shipping invented numbers on purpose` 这样的提示，是检查在拒绝一个任何人都不该无意中做出的业务决定。"),
        ],
        trouble: [
          { s: t("The owner will not commit to numbers", "负责人不肯给出具体数字"), c: t("There is no baseline yet, so any number feels like a guess.", "还没有基线，所以任何数字都像是猜测。"), f: t("Measure today's manual process first: how long a reviewer takes per exception and how often a second reviewer disagrees. Set the agent's bar relative to that.", "先测量当前人工流程：审核人员处理一个异常要多久，第二位审核人员不同意的频率有多高。以此为参照设定智能体的标准。") },
          { s: t("Scope keeps growing in review", "评审中范围不断扩大"), c: t("Every stakeholder adds an action.", "每个干系人都要加一个动作。"), f: t("New actions go into the next contract version with their own eval cases. A step that cannot point to a line of this file is out of scope.", "新动作放进下一个契约版本，并配上各自的评估用例。指不到本文件某一行的步骤就属于范围之外。") },
        ],
        done: t("contract.yml is merged with the owner's approval, and the validator passes in CI.", "contract.yml 已在负责人批准后合并，校验器在 CI 中通过。"),
        scale: [
          t("One contract per workflow. When you add a second workflow (say, vendor onboarding), it gets its own contract, catalog schemas and eval set, and reuses the platform pieces. That is how ten workflows stay governable.", "每个工作流一份契约。增加第二个工作流（比如供应商准入）时，它有自己的契约、catalog schema 和评估集，并复用平台层的组件。这样十个工作流也能保持可治理。"),
        ],
        challenge: [
          { q: t("Why level 2 and not straight to automation, if the agent is accurate?", "如果智能体足够准确，为什么停在第 2 级，而不直接自动化？"), a: t("Accuracy on last quarter is not accountability today. Level 2 produces the evidence for level 3: thousands of human decisions labelled against the agent's proposals, with the unsafe-error count at zero. The contract lets you raise the level per exception type later, for example price variances under 500, without touching the rest.", "上个季度的准确率不等于今天的责任归属。第 2 级为第 3 级积累证据：成千上万条针对智能体提议的人工决定标签，并且不安全错误数为零。契约允许你日后按异常类型逐步提高等级，例如低于 500 的价格差异，而不影响其他部分。") },
          { q: t("Who signs off a change to a threshold?", "谁来批准门槛值的修改？"), a: t("The owner named in the contract, in the merge request that changes it. GitLab CODEOWNERS on contract.yml makes that approval mandatory.", "契约中指定的负责人，在修改它的合并请求中批准。对 contract.yml 设置 GitLab CODEOWNERS，可以让这项批准成为强制要求。") },
        ],
      },
      {
        id: "repo",
        title: t("Set up the GitLab repository and the bundle", "建立 GitLab 仓库和 bundle"),
        local: t("One repository with the bundle (databricks.yml), pipelines, src, app, agent, tests, and the CI file.", "一个仓库，包含 bundle（databricks.yml）、pipeline、src、app、agent、测试和 CI 文件。"),
        links: ["ops.change", "ops.inventory"],
        after: ["contract"],
        components: ["gitlab", "bundle"],
        why: t(
          "If a resource can be created by clicking, it will be, and staging will drift from production in ways nobody can list. A bundle declares every Databricks resource of the workflow (pipeline, jobs, apps, experiment) in git, with one target per environment. GitLab then becomes the only way anything reaches staging or production, and the merge request history is the change log an auditor asks for.",
          "只要资源能通过点击创建，就一定会有人去点，预发环境就会以没人说得清的方式偏离生产环境。bundle 在 git 中声明工作流的每个 Databricks 资源（pipeline、job、app、实验），每个环境一个 target。这样 GitLab 就成为任何东西进入预发或生产的唯一途径，而合并请求的历史就是审计人员要的变更日志。",
        ),
        what: t(
          "databricks.yml declares the bundle, its variables, a workload tag applied to every resource (for cost attribution), and three targets: dev in development mode, stg and prd in production mode with a service principal as run_as. resources/*.yml hold the pipeline, jobs and apps.",
          "databricks.yml 声明 bundle、它的变量、一个应用到所有资源上的 workload 标签（用于成本归属），以及三个 target：开发模式的 dev，和以服务主体为 run_as、处于生产模式的 stg 与 prd。resources/*.yml 存放 pipeline、job 和 app。",
        ),
        how: [
          t("Create the GitLab project. Protect `main` (merge only through merge requests, at least one approval, pipeline must pass) and `release` (maintainers only, fast-forward from main).", "创建 GitLab 项目。保护 `main` 分支（只能通过合并请求合入，至少一人批准，流水线必须通过）和 `release` 分支（只有维护者，从 main fast-forward）。"),
          t("Add CODEOWNERS: finance operations owns contract.yml and the policy tables; the platform team owns databricks.yml and .gitlab-ci.yml.", "添加 CODEOWNERS：财务运营负责 contract.yml 和政策表；平台团队负责 databricks.yml 和 .gitlab-ci.yml。"),
          t("Copy the native/databricks/ tree as the repository root. Fill the workspace hosts and warehouse ids per target.", "把 native/databricks/ 目录树复制为仓库根目录。按 target 填写工作区地址和 warehouse id。"),
          t("For interactive development, connect the repository as a Git folder in the dev workspace (Settings > Linked accounts, a GitLab project access token). People work in Git folders; only CI deploys.", "为了交互式开发，把仓库作为 Git 文件夹接入开发工作区（Settings > Linked accounts，使用 GitLab 项目访问令牌）。人在 Git 文件夹里工作；只有 CI 负责部署。"),
          t("`databricks bundle validate -t dev` from your laptop to see the resolved configuration.", "在你的笔记本上执行 `databricks bundle validate -t dev`，查看解析后的配置。"),
        ],
        files: [K + "databricks.yml", K + ".gitignore"],
        code: [{ lang: "text", text: `spend-exceptions/                     the repository root
  contract.yml                        step 1, owned by finance operations
  databricks.yml  resources/*.yml     the bundle: every Databricks resource
  .gitlab-ci.yml                      step 18
  setup/                              one-time account and workspace setup (steps 3, 4, 14)
  pipelines/                          Lakeflow pipeline sources (steps 5, 6, 8, 9)
  semantics/                          metric view and comments (step 7)
  src/                                tools, agent, evals, monitoring, ops, scale (steps 10 to 21)
  app/                                the reviewer app (step 15)
  agent/                              the vendored agent app template (step 14)
  tests/                              unit tests CI runs on every merge request
  CODEOWNERS` }],
        interpret: [
          t("`bundle validate` prints the resolved configuration. Check that every resource name in dev starts with your `[dev <user>]` prefix: that is development mode keeping your experiments apart from everyone else's.", "`bundle validate` 会打印解析后的配置。检查 dev 中每个资源名是否都带有 `[dev <user>]` 前缀：这是开发模式在把你的实验与其他人的隔开。"),
          t("In stg and prd there is no prefix and run_as is a service principal. If validate complains about run_as, production mode is doing its job: production resources must not run as a person.", "在 stg 和 prd 中没有前缀，run_as 是服务主体。如果 validate 对 run_as 报错，说明生产模式在尽职：生产资源不能以个人身份运行。"),
        ],
        trouble: [
          { s: t("validate: workspace host is required", "validate 报：需要工作区地址"), c: t("The target has no host and the CLI has no default profile.", "target 里没有 host，CLI 也没有默认 profile。"), f: t("Set workspace.host per target, as in the file. CI sets DATABRICKS_HOST per GitLab environment.", "像文件里那样为每个 target 设置 workspace.host。CI 会按 GitLab 环境设置 DATABRICKS_HOST。") },
          { s: t("Two engineers overwrite each other's dev deployment", "两位工程师互相覆盖了对方的开发部署"), c: t("Both deployed the dev target as the same identity, for example a shared service principal.", "两人都以同一个身份部署了 dev target，例如共用了一个服务主体。"), f: t("Deploy dev from your own login: development mode prefixes every resource with your name. CI never deploys dev.", "用你自己的登录身份部署 dev：开发模式会给每个资源加上你的名字作为前缀。CI 从不部署 dev。") },
        ],
        done: t("The repository exists with protected main and CODEOWNERS, and `bundle validate` passes for all three targets.", "仓库已建立，main 受保护且配置了 CODEOWNERS，三个 target 的 `bundle validate` 都能通过。"),
        unconfirmed: t("The `presets.tags` key that applies a tag to every resource is from the bundle settings reference as recalled, not a page read for this guide; confirm it with `bundle validate` output.", "把标签应用到所有资源上的 `presets.tags` 键来自对 bundle 设置参考的记忆，并非本指南阅读过的页面；请用 `bundle validate` 的输出确认。"),
        scale: [
          t("One repository per workflow keeps ownership and release cadence separate. Shared code (the Lakebase pool, the guard) moves to an internal Python package with its own version once a third workflow needs it.", "每个工作流一个仓库，使所有权和发布节奏彼此独立。当第三个工作流也需要共享代码（Lakebase 连接池、护栏）时，把它们移到一个有独立版本的内部 Python 包中。"),
          t("Workspaces: start with one workspace per environment. Unity Catalog is account-level, so the same catalog names can be bound to the right workspaces as you add regions or business units.", "工作区：先从每个环境一个工作区开始。Unity Catalog 是账号级的，所以在增加区域或业务单元时，可以把同样的 catalog 名绑定到相应的工作区。"),
        ],
        challenge: [
          { q: t("Why not let analysts edit jobs in the UI and export them later?", "为什么不让分析师在界面里编辑 job，之后再导出？"), a: t("Because \"later\" is when production and git disagree and nobody knows which is right. `databricks bundle generate` exists to import an existing resource once; after that, git is the source and the UI is read-only for production.", "因为“之后”恰恰是生产环境和 git 不一致、没人知道哪个才对的时候。`databricks bundle generate` 用来一次性导入已有资源；在那之后，git 是唯一来源，生产环境的界面只读。") },
        ],
      },
      {
        id: "identity",
        title: t("Environments and identities: OIDC federation from GitLab", "环境与身份：来自 GitLab 的 OIDC 联合"),
        local: t("Three catalogs; two CI service principals (staging trusts main, production trusts release); no CI access to dev at all.", "三个 catalog；两个 CI 服务主体（预发信任 main，生产信任 release）；CI 对 dev 完全没有访问权限。"),
        links: ["api-gateway.keys", "api-gateway.issue"],
        after: ["repo"],
        components: ["gitlab", "uc"],
        why: t(
          "A long-lived token in a CI variable is the most common way a data platform is breached: anyone who can edit the pipeline file can print it. With workload identity federation, GitLab signs a short-lived token for each job, and Databricks exchanges it only if the token's subject matches the policy exactly. The subject names the project and the branch, so the policy is the boundary: the staging principal trusts main, the production principal trusts release (a protected branch only maintainers can merge to), and a merge-request pipeline gets no Databricks access at all. That holds even if someone edits .gitlab-ci.yml in their branch, because Databricks, not the CI file, decides.",
          "CI 变量里的长期令牌是数据平台被攻破最常见的方式：任何能编辑流水线文件的人都能把它打印出来。使用工作负载身份联合时，GitLab 为每个作业签发一个短期令牌，只有当令牌的 subject 与策略完全一致时，Databricks 才会兑换它。subject 写明了项目和分支，所以策略本身就是边界：预发服务主体信任 main，生产服务主体信任 release（只有维护者能合入的受保护分支），而合并请求流水线完全无法访问 Databricks。即使有人在自己的分支里修改了 .gitlab-ci.yml，这一点依然成立，因为做决定的是 Databricks，而不是 CI 文件。",
        ),
        what: t(
          "Creates a staging and a production service principal in the account, each with a federation policy: issuer = your GitLab instance, audience = your Databricks account id, subject = project_path:<group>/<project>:ref_type:branch:ref:main (staging) or :ref:release (production). Prints each principal's application id, the non-secret DATABRICKS_CLIENT_ID for that GitLab environment. Dev has no CI principal: engineers deploy dev from their own login, in development mode. It also creates a runtime principal per environment (spend-jobs-stg, spend-jobs-prd) with no federation policy at all: jobs and the pipeline run as it (bundle run_as), so the identity that can change code is never the identity that reads finance data, and nothing outside Databricks can become the runtime principal.",
          "在账号中创建预发和生产两个服务主体，每个都带有联合策略：issuer = 你的 GitLab 实例，audience = 你的 Databricks 账号 id，subject = project_path:<group>/<project>:ref_type:branch:ref:main（预发）或 :ref:release（生产）。脚本会打印每个主体的 application id，即对应 GitLab 环境里非机密的 DATABRICKS_CLIENT_ID。dev 没有 CI 服务主体：工程师用自己的登录身份、以开发模式部署 dev。脚本还为每个环境创建一个运行时服务主体（spend-jobs-stg、spend-jobs-prd），它完全没有联合策略：job 和 pipeline 以它的身份运行（bundle run_as），所以能改代码的身份永远不是读取财务数据的身份，Databricks 之外也没有任何东西能变成这个运行时主体。",
        ),
        how: [
          t("Log in to the account console with the CLI (`databricks auth login --host <accounts host> --account-id <id> --profile acct`).", "用 CLI 登录账号控制台（`databricks auth login --host <accounts host> --account-id <id> --profile acct`）。"),
          t("Run the script with PROJECT_PATH (group/project) and ACCOUNT_ID. For self-managed GitLab, set GITLAB_ISSUER to its URL.", "带上 PROJECT_PATH（group/project）和 ACCOUNT_ID 运行脚本。若是自建 GitLab，把 GITLAB_ISSUER 设为它的 URL。"),
          t("In GitLab: protect main and release (merge by maintainers only), set the merge method to fast-forward so release receives main's gated commit unchanged, and create environments staging and production with the variables the script lists. Protect production with required approvers.", "在 GitLab 中：保护 main 和 release（只有维护者能合入），把合并方式设为 fast-forward，使 release 原样接收 main 上通过门槛的提交；创建 staging 和 production 两个环境，并设置脚本列出的变量。为 production 设置保护和必需的审批人。"),
          t("Add each principal to its workspace with only the permissions its deploys need.", "把每个服务主体加入对应的工作区，只给它部署所需的权限。"),
          t("Prove the boundary: a job with `databricks current-user me` on a feature branch must fail for both principals, on main must succeed only for staging, and on release only for production.", "验证边界：在功能分支上运行 `databricks current-user me` 的作业，对两个主体都必须失败；在 main 上只有预发能成功；在 release 上只有生产能成功。"),
        ],
        files: [K + "setup/01_envs_federation.sh"],
        code: [{ lang: "yaml", file: ".gitlab-ci.yml (the part that authenticates)", text: `variables:
  DATABRICKS_AUTH_TYPE: env-oidc        # the CLI and SDK exchange the GitLab token themselves
.databricks:
  id_tokens:
    DATABRICKS_OIDC_TOKEN:
      aud: $DATABRICKS_ACCOUNT_ID       # must equal the audience in the federation policy` }],
        interpret: [
          t("`databricks current-user me` printing the principal's application id means the exchange worked. An error naming the subject means the token's sub claim did not match: compare the job's ref with the policy's subject, character for character. The match is exact; there are no wildcards.", "`databricks current-user me` 打印出服务主体的 application id，说明兑换成功。如果报错中提到 subject，说明令牌的 sub 声明与策略不匹配：逐字比较作业的分支与策略中的 subject。匹配是完全精确的，没有通配符。"),
          t("The negative tests matter more than the positive ones. If a feature-branch job, or a main job, can authenticate as the production principal, stop and fix the policy before anything else.", "反向测试比正向测试更重要。如果功能分支或 main 上的作业能以生产服务主体身份认证通过，就先停下来修好策略，再做别的。"),
        ],
        trouble: [
          { s: t("invalid audience", "invalid audience"), c: t("The aud in id_tokens differs from the policy's audiences.", "id_tokens 中的 aud 与策略中的 audiences 不一致。"), f: t("Use the Databricks account id in both places, as the vendor page recommends.", "按照厂商页面的建议，两处都使用 Databricks 账号 id。") },
          { s: t("The release pipeline cannot verify the gate", "release 流水线无法验证门槛"), c: t("release received a merge commit, so its sha differs from the gated commit on main.", "release 收到的是一个合并提交，因此它的 sha 与 main 上通过门槛的提交不同。"), f: t("Use fast-forward merges from main into release; release must point at the exact commit the gate passed.", "从 main 到 release 使用 fast-forward 合并；release 必须指向门槛通过的那个确切提交。") },
          { s: t("A fork's merge request deployed to staging", "一个 fork 的合并请求部署到了预发"), c: t("A maintainer chose \"Run pipeline in the parent project\" for it. That runs the fork's .gitlab-ci.yml under the parent's project path, on the fork's branch name; a fork branch named main matches the staging subject.", "有维护者为它选择了“Run pipeline in the parent project”。这会在父项目路径下、以 fork 的分支名运行 fork 的 .gitlab-ci.yml；名为 main 的 fork 分支就能匹配预发的 subject。"), f: t("Never run a fork's pipeline in the parent project without reading its .gitlab-ci.yml diff; better, turn the option off for this project. The federation policy cannot tell the two apart.", "绝不要在没读过 .gitlab-ci.yml 改动的情况下，在父项目中运行 fork 的流水线；更好的做法是为这个项目关闭该选项。联合策略无法区分这两种情况。") },
          { s: t("The CLI ignores the token", "CLI 没有使用这个令牌"), c: t("DATABRICKS_AUTH_TYPE is not env-oidc, or a leftover DATABRICKS_TOKEN variable takes precedence.", "DATABRICKS_AUTH_TYPE 不是 env-oidc，或者残留的 DATABRICKS_TOKEN 变量优先级更高。"), f: t("Delete every DATABRICKS_TOKEN variable from GitLab. There should be no secret left to find.", "从 GitLab 中删除所有 DATABRICKS_TOKEN 变量。不应再留下任何可被发现的机密。") },
        ],
        done: t("CI authenticates to staging only from main and to production only from release, with no stored secret, and the negative tests fail as they should.", "CI 只能从 main 认证到预发、只能从 release 认证到生产，不需要任何存储的机密，并且反向测试都如预期失败。"),
        unconfirmed: t("The vendor example shows an issuer with a group path; GitLab's own OIDC issuer is the instance URL, used here. Exact subject matching is as stated on the federation policy page.", "厂商示例中的 issuer 带有 group 路径；GitLab 自己的 OIDC issuer 是实例 URL，这里使用的就是它。subject 精确匹配的说法来自联合策略页面。"),
        scale: [
          t("More workflows: one principal per workflow per environment, not one per environment for everything. Blast radius stays one workflow.", "工作流增多时：每个工作流在每个环境各一个服务主体，而不是每个环境一个主体管所有工作流。这样影响范围始终只限于一个工作流。"),
        ],
        challenge: [
          { q: t("Why not one service principal for all environments, it is simpler?", "所有环境用一个服务主体不是更简单吗？"), a: t("Then staging's permissions are production's, and the branch restriction cannot exist. Two principals cost two lines in the script; the separation is the control.", "那样的话，预发的权限就等于生产的权限，分支限制也就无从谈起。两个服务主体只多两行脚本；这种分离本身就是控制措施。") },
          { q: t("Why a separate runtime principal, when the CI principal already exists?", "既然已经有 CI 服务主体，为什么还要单独的运行时服务主体？"), a: t("The CI principal is whoever controls main for a few minutes; the runtime principal reads every invoice, every night. If one identity did both, any merged change could exfiltrate data at deploy time. Split, a malicious deploy can still change code, but that code then runs as a principal whose grants are fixed in governance SQL, and CI needs the Service Principal User role only to set run_as.", "CI 服务主体代表的是在几分钟内控制 main 的人；运行时服务主体则每晚读取每一张发票。如果一个身份兼做两件事，任何合入的变更都可能在部署时把数据带走。分开之后，恶意部署仍能改代码，但代码运行时用的是一个授权固定在治理 SQL 里的主体；CI 只需要 Service Principal User 角色来设置 run_as。") },
          { q: t("Why does a merge request get no Databricks access, not even to dev?", "为什么合并请求连 dev 都不能访问？"), a: t("Because an MR pipeline runs code from an unreviewed branch. Federation subjects match exactly, so a principal that trusted every branch would need a wildcard that does not exist. Tests run without a workspace, and each engineer deploys dev as themselves, which also keeps their experiments apart.", "因为合并请求流水线运行的是未经审查分支上的代码。联合策略的 subject 是精确匹配的，要让一个服务主体信任所有分支，就需要通配符，而通配符并不存在。测试无需工作区即可运行，每位工程师以自己的身份部署 dev，这也让各自的实验互不干扰。") },
        ],
      },
      {
        id: "governance",
        title: t("Unity Catalog layout, grants, tags and ABAC policies", "Unity Catalog 布局、授权、标签和 ABAC 策略"),
        local: t("Schemas per layer, volumes for landing, groups for engineers, reviewers, auditors, a bank-account mask, and a business-unit row filter.", "按层划分的 schema、用于落地的 volume、工程师/审核人员/审计人员三个用户组、银行账号掩码，以及按业务单元的行过滤。"),
        links: ["state.schema", "memory.partition", "evaluation.seal"],
        after: ["identity"],
        components: ["uc"],
        why: t(
          "The agent must see exactly what the person it works for may see, and nothing more. Writing that rule into agent code means writing it again in the app, the dashboard and every notebook, and one of them will be wrong. Unity Catalog applies it once, at the data: a column tagged as a bank account is masked for everyone except auditors, and a table tagged with a business unit column is filtered to the reviewer's units, for every query from every tool, including the agent's.",
          "智能体能看到的，必须恰好是它所服务的那个人有权看到的，一点不多。把这条规则写进智能体代码，就得在 App、仪表盘和每个 notebook 里再写一遍，而其中总会有一处写错。Unity Catalog 在数据层只应用一次：标记为银行账号的列，除审计人员外对所有人都做掩码；带有业务单元列标签的表，会被过滤为审核人员负责的单元。对来自任何工具的每一个查询都是如此，包括智能体的查询。",
        ),
        what: t(
          "Creates the catalog with schemas landing, bronze, silver, gold, ai, tools, governance, evals and ops; volumes for ERP extracts, invoice PDFs, policy documents and artifacts; grants per group and for the agent and jobs principals; a masking function and a row-scope function in the governance schema (never exposed as tools); and two ABAC policies that attach to governed tags rather than to named tables, applied to reviewers and to the agent alike.",
          "创建 catalog 及其下的 landing、bronze、silver、gold、ai、tools、governance、evals、ops 这些 schema；用于 ERP 抽取文件、发票 PDF、政策文档和产出物的 volume；按用户组以及为智能体和 job 服务主体设置的授权；放在 governance schema 中（绝不作为工具暴露）的一个掩码函数和一个行范围函数；以及两条挂在受治理标签上、而非指定表上的 ABAC 策略，对审核人员和智能体同样适用。",
        ),
        how: [
          t("Create groups fin-engineers, fin-reviewers, fin-auditors and fin-agents in the account (the agent app's principal goes in fin-agents); create governed tag keys pii and scope in Catalog Explorer.", "在账号中创建 fin-engineers、fin-reviewers、fin-auditors 和 fin-agents 四个用户组（智能体 App 的服务主体放进 fin-agents）；在 Catalog Explorer 中创建受治理标签键 pii 和 scope。"),
          t("Run the file as is in dev; for stg and prd run `python src/common/apply_sql.py --file setup/02_governance.sql --catalog fin_stg --warehouse-id <id>`, which substitutes the catalog. Replace the <...-application-id> placeholders first.", "在 dev 中直接运行这个文件；对于 stg 和 prd，运行 `python src/common/apply_sql.py --file setup/02_governance.sql --catalog fin_stg --warehouse-id <id>`，它会替换 catalog 名。先替换好 <...-application-id> 占位符。"),
          t("After step [[quality]] creates the tables, run the two commented ALTER ... SET TAGS lines. The policies apply from that moment.", "在第 [[quality]] 步创建好表之后，运行两行被注释掉的 ALTER ... SET TAGS 语句。策略从那一刻起生效。"),
          t("Test as a reviewer of one unit: a SELECT on gold.open_exceptions must return only that unit, and silver.vendors.bank_account must show ****1234.", "以只负责一个单元的审核人员身份测试：对 gold.open_exceptions 的 SELECT 只能返回该单元的数据，silver.vendors.bank_account 必须显示为 ****1234。"),
        ],
        files: [K + "setup/02_governance.sql"],
        interpret: [
          t("A reviewer who sees another unit's rows means the row filter did not attach: check that the column carries the tag `scope = business_unit` and that the user is in fin-reviewers (the policy's TO clause).", "如果审核人员看到了其他单元的行，说明行过滤没有挂上：检查该列是否带有标签 `scope = business_unit`，以及该用户是否属于 fin-reviewers（策略的 TO 子句）。"),
          t("SHOW GRANTS on evals must show SELECT for engineers and no MODIFY. That is the seal on the exam from module 11, as a grant.", "对 evals 执行 SHOW GRANTS，应显示工程师只有 SELECT，没有 MODIFY。这就是第 11 模块中考题封存的授权形式。"),
        ],
        trouble: [
          { s: t("CREATE POLICY fails: tag not found", "CREATE POLICY 失败：找不到标签"), c: t("Governed tag keys must exist before a policy can match them.", "受治理标签键必须先存在，策略才能匹配它们。"), f: t("Create pii and scope under Govern > Governed Tags, then rerun.", "在 Govern > Governed Tags 下创建 pii 和 scope，然后重跑。") },
          { s: t("The row filter makes queries slow", "行过滤让查询变慢"), c: t("The filter function runs a subquery against reviewer_scope for every row.", "过滤函数对每一行都要对 reviewer_scope 执行子查询。"), f: t("Keep reviewer_scope small and clustered by reviewer; check the query profile. For very large tables, filter on a group membership instead of a mapping table.", "让 reviewer_scope 保持很小并按 reviewer 聚簇；查看查询概况。对于非常大的表，改为按用户组成员资格过滤，而不是用映射表。") },
          { s: t("The agent sees nothing", "智能体什么都看不到"), c: t("The agent's principal is in fin-agents, so the row filter applies, and it has no row in reviewer_scope.", "智能体的服务主体在 fin-agents 中，所以行过滤对它生效，而它在 reviewer_scope 中没有记录。"), f: t("Give it one reviewer_scope row per unit it triages, including UNASSIGNED for documents that match no invoice. Never add it to fin-auditors to make the problem go away.", "为它负责分诊的每个单元添加一条 reviewer_scope 记录，包括用于匹配不到发票的文档的 UNASSIGNED。绝不要为了省事把它加进 fin-auditors。") },
          { s: t("Someone replaced the mask function", "有人替换了掩码函数"), c: t("Policy functions lived in a schema others could write to.", "策略函数放在了其他人可以写入的 schema 里。"), f: t("Keep them in the governance schema, owned by catalog-admins, with no grant to anyone else. Never grant CREATE FUNCTION on the catalog: Unity Catalog privileges only add up, so a catalog grant reaches governance and no REVOKE on the schema can take it back. Grant CI per schema, as the file shows, and read SHOW GRANTS ON SCHEMA governance after every change.", "把它们放在由 catalog-admins 拥有、不对任何其他人授权的 governance schema 中。绝不要在 catalog 上授予 CREATE FUNCTION：Unity Catalog 的权限只会叠加，catalog 级授权会覆盖到 governance，schema 上的任何 REVOKE 都收不回来。像文件中那样按 schema 给 CI 授权，并在每次变更后查看 SHOW GRANTS ON SCHEMA governance。") },
          { s: t("Exceptions in UNASSIGNED, or a new unit, wait for ever", "UNASSIGNED 或新单元中的异常一直无人处理"), c: t("Nobody, or not the agent, has a reviewer_scope row for that unit, so the row filter hides it from everyone who could act.", "没有人（或者智能体）在 reviewer_scope 中拥有该单元的记录，于是行过滤把它对所有能处理的人都隐藏了。"), f: t("Every unit needs a human reviewer row and an agent row; UNASSIGNED goes to accounts-payable intake. Step [[observe]] query 6 lists units that reach nobody; alert when it returns any row.", "每个单元都需要一条人工审核人员记录和一条智能体记录；UNASSIGNED 交给应付账款受理团队。第 [[observe]] 步的查询 6 会列出无人负责的单元；只要返回任何一行就告警。") },
        ],
        done: t("A one-unit reviewer sees one unit, bank accounts are masked for non-auditors, and engineers cannot write to evals.", "只负责一个单元的审核人员只能看到这一个单元，非审计人员看到的银行账号都被掩码，工程师无法写入 evals。"),
        unconfirmed: t("A row filter function that queries a mapping table is a documented pattern for per-table row filters; that it behaves the same inside an ABAC policy was not confirmed on the tutorial page read.", "让行过滤函数查询映射表，是针对单表行过滤的文档化用法；本指南阅读的教程页面没有确认它在 ABAC 策略中是否表现相同。"),
        scale: [
          t("ABAC scales with tags, not tables: a new business unit is a row in reviewer_scope, a new sensitive column is a tag. Nobody edits a policy for either.", "ABAC 随标签扩展，而不是随表扩展：新增业务单元只是 reviewer_scope 中的一行，新增敏感列只是一个标签。两种情况都不需要修改策略。"),
          t("Across many workspaces, the catalog is bound to the workspaces that may use it; prod data is never visible from a dev workspace.", "在多个工作区之间，catalog 只绑定到可以使用它的工作区；生产数据永远不会在开发工作区中可见。"),
        ],
        challenge: [
          { q: t("Why filter in Unity Catalog when the app could filter in its own query?", "App 自己在查询里过滤不就行了，为什么要在 Unity Catalog 里过滤？"), a: t("Because the agent, Genie, a dashboard and a notebook all read the same tables. A filter in the app protects one door. A policy on the data protects all of them, and an auditor can read it in one place.", "因为智能体、Genie、仪表盘和 notebook 读的都是同一批表。App 里的过滤只守住一扇门，数据上的策略守住所有的门，而且审计人员只需在一个地方就能看到它。") },
        ],
      },
    ],
  },
  {
    id: "data",
    title: t("Data: ingest, quality, semantics", "数据：摄取、质量、语义"),
    goal: t(
      "An agent's answers are only as good as the tables under it. This phase turns raw ERP extracts and PDFs into one governed work list, with every bad row's fate written next to the rule that caught it, and one definition of each business number. Everything here is plain Databricks data engineering, and that is the point: the AI parts later inherit its lineage, quality metrics and permissions for free.",
      "智能体回答的质量，取决于它底下那些表的质量。这个阶段把原始 ERP 抽取文件和 PDF 变成一份受治理的工作清单：每条坏数据的去向都写在抓住它的规则旁边，每个业务数字都只有一个定义。这里全是常规的 Databricks 数据工程，而这正是关键：后面的 AI 部分会免费继承它的血缘、质量指标和权限。",
    ),
    steps: [
      {
        id: "ingest",
        title: t("Bronze: land ERP extracts and invoice PDFs incrementally", "Bronze：增量落地 ERP 抽取文件和发票 PDF"),
        local: t("Five streaming tables in bronze, fed by Auto Loader from the landing volumes.", "bronze 中的五张流式表，由 Auto Loader 从落地 volume 读取数据。"),
        links: ["knowledge.intake", "state.cursor", "knowledge.validate"],
        after: ["governance"],
        components: ["erp", "docs", "pipeline"],
        why: t(
          "Every number the agent states must trace back to a file that arrived on a known day. Bronze keeps each record as landed, with its source file and arrival time, and never rewrites it. Auto Loader tracks which files it has read, so a rerun reads only new files and a failed run resumes where it stopped: the cursor lesson from module 4, provided by the platform.",
          "智能体说出的每个数字，都必须能追溯到某天到达的某个文件。Bronze 按到达时的样子保存每条记录，附上来源文件和到达时间，并且从不改写。Auto Loader 会记录哪些文件已经读过，所以重跑只读新文件，失败的运行会从中断处继续：这就是第 4 模块讲的游标，现在由平台提供。",
        ),
        what: t(
          "bronze.py defines bronze.invoices, purchase_orders, receipts and vendors from JSON extracts, and bronze.invoice_docs from PDFs as binary. New source columns go to _rescued_data instead of failing the run.",
          "bronze.py 从 JSON 抽取文件定义了 bronze.invoices、purchase_orders、receipts 和 vendors，并把 PDF 以二进制形式定义为 bronze.invoice_docs。源数据新增的列会进入 _rescued_data，而不会让运行失败。",
        ),
        how: [
          t("Agree a landing contract with the ERP team: one folder per entity under /Volumes/<catalog>/landing/erp/, JSON lines, full or incremental extracts with an updated timestamp.", "与 ERP 团队约定落地规范：在 /Volumes/<catalog>/landing/erp/ 下每个实体一个目录，JSON lines 格式，全量或增量抽取都要带更新时间戳。"),
          t("If your ERP has a Lakeflow Connect managed connector, use it instead of file extracts; it lands the same bronze tables with less code to own.", "如果你的 ERP 有 Lakeflow Connect 托管连接器，就用它代替文件抽取；它落地的是同样的 bronze 表，你需要维护的代码更少。"),
          t("Deploy the pipeline with the bundle and run it once from the Pipelines UI to see the graph.", "用 bundle 部署 pipeline，并从 Pipelines 界面运行一次，查看依赖图。"),
        ],
        files: [K + "pipelines/bronze.py", K + "resources/pipeline.yml"],
        interpret: [
          t("Each bronze table's row count should equal the records in the files landed so far. A count that doubles on rerun means something bypassed Auto Loader (a manual COPY or a reset checkpoint).", "每张 bronze 表的行数应等于目前已落地文件中的记录数。如果重跑后行数翻倍，说明有东西绕过了 Auto Loader（手动 COPY 或重置了 checkpoint）。"),
          t("A non-empty _rescued_data column is the ERP changing its extract without telling you. Read it weekly; it is cheaper than a broken month-end.", "_rescued_data 列不为空，说明 ERP 在没通知你的情况下改了抽取格式。每周看一次；这比月末结账出问题便宜得多。"),
        ],
        trouble: [
          { s: t("Pipeline fails: cannot read landing_root", "pipeline 失败：无法读取 landing_root"), c: t("The configuration key is missing, or the pipeline's run-as identity has no READ VOLUME.", "缺少该配置键，或者 pipeline 的运行身份没有 READ VOLUME 权限。"), f: t("Check resources/pipeline.yml configuration and grant READ VOLUME on landing to the deploying principal.", "检查 resources/pipeline.yml 中的 configuration，并给部署用的服务主体授予 landing 上的 READ VOLUME。") },
          { s: t("Types change between files (amount as string, then number)", "不同文件之间类型变了（amount 先是字符串，后来是数字）"), c: t("Schema inference sees different files differently.", "schema 推断对不同文件得出不同结果。"), f: t("Cast explicitly in silver (step [[quality]] does). Bronze stays as landed by design.", "在 silver 中显式转换类型（第 [[quality]] 步就是这样做的）。Bronze 按设计保持原样。") },
        ],
        done: t("New files in the landing volume appear in bronze on the next pipeline update, once each, with source file and arrival time.", "落地 volume 中的新文件会在下一次 pipeline 更新时出现在 bronze 中，每个只出现一次，并带有来源文件和到达时间。"),
        unconfirmed: t("Publishing to several schemas from one pipeline by qualified name (bronze.invoices) and the `from pyspark import pipelines as dp` import are the current pipeline conventions as understood; the expectations page used `dp` without showing its import.", "在一个 pipeline 中按限定名（bronze.invoices）发布到多个 schema，以及 `from pyspark import pipelines as dp` 这个导入方式，是目前理解的 pipeline 惯例；期望规则页面使用了 `dp`，但没有展示它的导入语句。"),
        scale: [
          t("Auto Loader in file-notification mode instead of directory listing when a folder holds millions of files; listing cost grows with the folder, notifications do not.", "当一个目录里有上百万个文件时，让 Auto Loader 使用文件通知模式而不是目录列举；列举成本随目录增长，通知模式则不会。"),
          t("At high volume, switch the orchestrator from file-arrival to a schedule (every 15 minutes): one pipeline update per batch, not per file.", "在高数据量下，把编排从文件到达触发改为定时（每 15 分钟）：每批一次 pipeline 更新，而不是每个文件一次。"),
        ],
        challenge: [
          { q: t("Why keep bronze at all, if silver has the clean data?", "既然 silver 有干净的数据，为什么还要保留 bronze？"), a: t("Because silver's rules will change, and when they do you rebuild silver from bronze. Without bronze, a bug in a cast is permanent. It is also the first link of the audit trail.", "因为 silver 的规则会变，而规则变了就要从 bronze 重建 silver。没有 bronze，一个类型转换的 bug 就是永久性的。它也是审计链条的第一环。") },
        ],
      },
      {
        id: "quality",
        title: t("Silver and gold: expectations and the three-way match", "Silver 与 gold：期望规则与三单匹配"),
        local: t("Typed, deduplicated silver tables with expectations; gold.match_exceptions with stable exception ids.", "带有期望规则、类型规范且去重的 silver 表；带稳定异常 id 的 gold.match_exceptions。"),
        links: ["knowledge.validate", "state.merge", "tools-mcp.design"],
        after: ["ingest"],
        components: ["pipeline"],
        why: t(
          "This is the business logic, so it must be readable by the finance team, not only by engineers. SQL with expectations does that: each rule says what it checks and what happens to a bad row. The choice is a business decision written beside the rule: an invoice with no vendor stops the update (FAIL), because a payment pipeline that silently drops an invoice is worse than one that stops; a row with no id is dropped and counted. The exception id is a hash of invoice and type, so a re-run never creates a second exception for the same problem.",
          "这是业务逻辑，所以它必须让财务团队也看得懂，而不只是工程师。带期望规则的 SQL 做到了这一点：每条规则都说明它检查什么，以及坏数据会怎样处理。这个选择是写在规则旁边的业务决定：没有供应商的发票会让更新停止（FAIL），因为悄悄丢掉一张发票的付款流水线，比停下来的更糟；没有 id 的行会被丢弃并计数。异常 id 是发票号和类型的哈希，所以重跑永远不会为同一个问题生成第二个异常。",
        ),
        what: t(
          "Four silver materialized views keep the latest version of each record with explicit types and expectations, and the first arrival time of each invoice. gold.match_exceptions matches cumulatively per purchase order (a PO billed in three partial invoices is fine until the invoices together exceed it) and emits five exception types: no_po, no_receipt, price_variance, quantity_variance and duplicate_suspect, with tolerances from pipeline configuration. detected_at is the invoice's first arrival, so backlog age is real.",
          "四个 silver 物化视图以显式类型和期望规则保留每条记录的最新版本，以及每张发票的首次到达时间。gold.match_exceptions 按采购订单累计匹配（一张采购单分三张部分发票开票是正常的，直到发票合计超过它为止），输出五种异常类型：no_po、no_receipt、price_variance、quantity_variance 和 duplicate_suspect，容差取自 pipeline 配置。detected_at 是发票的首次到达时间，所以积压时长是真实的。",
        ),
        how: [
          t("Review the tolerances (2% or 50, whichever is larger) with finance and set them in resources/pipeline.yml.", "与财务一起审核容差（2% 或 50，取较大者），并在 resources/pipeline.yml 中设置。"),
          t("Run the pipeline and open the Data quality tab: each expectation shows rows passed, dropped or warned.", "运行 pipeline，打开 Data quality 标签页：每条期望规则都会显示通过、丢弃或告警的行数。"),
          t("Hand-check twenty exceptions with an AP clerk before anything automated reads this table.", "在任何自动化程序读取这张表之前，先和一位应付账款人员手工核对二十条异常。"),
          t("Tag business_unit on gold.match_exceptions (step [[governance]]) so the row filter applies.", "在 gold.match_exceptions 的 business_unit 列上打标签（第 [[governance]] 步），让行过滤生效。"),
        ],
        files: [K + "pipelines/silver_gold.sql"],
        interpret: [
          t("Exception counts by type are the first sanity check. Duplicate suspects at 10% of invoices means the rule is too loose (same vendor and amount within 7 days catches recurring monthly fees); at 0% on a large book it is probably broken.", "按类型统计的异常数是第一道合理性检查。如果重复嫌疑占发票的 10%，说明规则太宽（同一供应商、同一金额、7 天内，会把每月固定费用也抓进来）；如果在大量发票上为 0%，很可能是规则坏了。"),
          t("A FAIL UPDATE on has_vendor stops the whole update: nothing downstream sees partial data. Fix the source and rerun; do not change the rule to WARN under pressure.", "has_vendor 上的 FAIL UPDATE 会停止整次更新：下游不会看到不完整的数据。修正源数据后重跑；不要在压力下把规则改成 WARN。"),
        ],
        trouble: [
          { s: t("Exception ids change between runs", "异常 id 在两次运行之间变了"), c: t("The id included a timestamp or a non-deterministic column.", "id 中包含了时间戳或不确定的列。"), f: t("Hash only invoice_id and exception_type, as the file does. Anything else breaks the link to past decisions.", "只对 invoice_id 和 exception_type 做哈希，就像文件里那样。加入任何其他内容都会切断与历史决定的关联。") },
          { s: t("Every partial invoice is flagged as a price variance", "每张部分发票都被标为价格差异"), c: t("Each invoice was compared with the whole PO.", "每张发票都被拿去和整张采购单比较。"), f: t("Compare invoiced-to-date per PO, as the file does; only the invoice that pushes the total over the PO is an exception.", "像文件中那样按采购单比较累计开票金额；只有让总额超过采购单的那张发票才算异常。") },
          { s: t("Parameter ${tolerance_pct} appears literally", "参数 ${tolerance_pct} 原样出现在 SQL 里"), c: t("The configuration key is not set on the pipeline.", "pipeline 上没有设置该配置键。"), f: t("Set it in resources/pipeline.yml configuration and redeploy.", "在 resources/pipeline.yml 的 configuration 中设置，然后重新部署。") },
        ],
        done: t("Twenty hand-checked exceptions agree with an AP clerk's judgment, and the Data quality tab shows every expectation's counts.", "二十条手工核对的异常与应付账款人员的判断一致，Data quality 标签页显示了每条期望规则的计数。"),
        scale: [
          t("Materialized views refresh incrementally where they can on serverless pipelines. When the invoice table reaches hundreds of millions of rows, add liquid clustering on (business_unit, invoice_date) and check the refresh plan in the pipeline event log.", "在 serverless pipeline 上，物化视图会尽可能增量刷新。当发票表达到数亿行时，在 (business_unit, invoice_date) 上加 liquid clustering，并在 pipeline 事件日志里检查刷新计划。"),
          t("The duplicate self-join is the expensive part. Bound it by date window and vendor; it already is, keep it that way.", "重复检测的自连接是最贵的部分。用日期窗口和供应商来限定它；现在已经限定了，保持这样。"),
        ],
        challenge: [
          { q: t("Why detect exceptions with rules and not ask the model?", "为什么用规则来识别异常，而不是问模型？"), a: t("A three-way match is arithmetic. Rules are exact, free, explainable to an auditor, and identical on every run. The model is spent where judgment is needed: deciding what to do about the exception, with evidence.", "三单匹配是算术。规则精确、免费、可以向审计人员解释，而且每次运行结果完全一样。模型的力气要花在需要判断的地方：凭证据决定如何处理这个异常。") },
        ],
      },
      {
        id: "semantics",
        title: t("The semantic layer: a metric view and real comments", "语义层：指标视图和真正有用的注释"),
        local: t("gold.exception_metrics: one governed definition of open exceptions, exposure and variance.", "gold.exception_metrics：未结异常、敞口和差异的唯一受治理定义。"),
        links: ["rag-graph.authority", "skills.write"],
        after: ["quality"],
        components: ["metric"],
        why: t(
          "\"Open exposure\" will be computed by the CFO's dashboard, by Genie, and by the agent's rationale. If it is defined three times it will be three numbers, and the agent will be blamed for the difference. A metric view makes the definition a governed object that all three query. Comments matter for the same reason: Genie and the agent choose columns by reading them.",
          "“未结敞口”会由 CFO 的仪表盘、Genie 和智能体的理由各算一遍。如果定义了三次，就会出现三个数字，而差异会被归咎于智能体。指标视图把这个定义变成一个受治理的对象，三者都查询它。注释重要也是出于同样的原因：Genie 和智能体是通过阅读注释来选择列的。",
        ),
        what: t(
          "Creates a metric view over gold.open_exceptions with three dimensions and three measures, shows the MEASURE() query, and checks what Genie will read with DESCRIBE TABLE EXTENDED.",
          "在 gold.open_exceptions 上创建一个指标视图，包含三个维度和三个度量，展示 MEASURE() 查询，并用 DESCRIBE TABLE EXTENDED 检查 Genie 将会读到什么。",
        ),
        how: [
          t("Agree each measure's definition with finance in the merge request, in plain words in the comment field.", "在合并请求中与财务确认每个度量的定义，并用通俗的话写进 comment 字段。"),
          t("Run the file in the SQL editor (it is not part of the pipeline: it reads the pipeline's tables).", "在 SQL 编辑器中运行这个文件（它不属于 pipeline：它读取 pipeline 的表）。"),
          t("Point the AI/BI dashboard and the Genie space (step [[genie]]) at the metric view, not at the raw table.", "让 AI/BI 仪表盘和 Genie space（第 [[genie]] 步）指向指标视图，而不是原始表。"),
        ],
        files: [K + "semantics/metric_view.sql"],
        interpret: [
          t("The MEASURE() query's totals must equal a hand SUM over the same filter. If they differ, a measure expression is wrong, and it is wrong everywhere at once, which is also how you fix it everywhere at once.", "MEASURE() 查询的合计必须等于同样过滤条件下手工 SUM 的结果。如果不一致，说明某个度量表达式错了，而且它在所有地方同时错；这也意味着修正它也能一次改好所有地方。"),
          t("In DESCRIBE TABLE EXTENDED, every column the agent uses should have a comment that states units and meaning. An empty comment is a future wrong answer.", "在 DESCRIBE TABLE EXTENDED 中，智能体会用到的每一列都应该有说明单位和含义的注释。空注释就是未来的错误答案。"),
        ],
        trouble: [
          { s: t("CREATE VIEW ... WITH METRICS fails", "CREATE VIEW ... WITH METRICS 失败"), c: t("The warehouse or runtime is too old for metric views, or the YAML is not indented.", "warehouse 或运行时版本太旧，不支持指标视图；或者 YAML 没有缩进。"), f: t("Use a current serverless SQL warehouse; validate the YAML block separately.", "使用当前的 serverless SQL warehouse；单独校验 YAML 块。") },
          { s: t("Currencies are summed together", "不同币种被加在了一起"), c: t("Open Exposure sums invoice_amount across currencies.", "Open Exposure 跨币种汇总了 invoice_amount。"), f: t("Either add currency as a dimension and never total across it, or convert in silver with a governed rate table. Decide before the first dashboard ships.", "要么把币种作为维度并且绝不跨币种汇总，要么在 silver 中用受治理的汇率表做换算。在第一个仪表盘上线前就要决定。") },
        ],
        done: t("Dashboard, Genie and a hand query return the same exposure for the same filter.", "对于同样的过滤条件，仪表盘、Genie 和手工查询返回相同的敞口数字。"),
        unconfirmed: t("The vendor's example uses `fields:` in metric view YAML version 1.1 and says the editor generates the equivalent `dimensions:`; this file uses `dimensions:`.", "厂商示例在指标视图 YAML 1.1 版本中使用 `fields:`，并说明编辑器会生成等价的 `dimensions:`；本文件使用 `dimensions:`。"),
        scale: [
          t("Metric views are the contract between data and every consumer. When a second workflow needs exposure, it queries this view; it does not copy the SQL.", "指标视图是数据与所有使用方之间的契约。当第二个工作流需要敞口数字时，它查询这个视图，而不是复制 SQL。"),
        ],
        challenge: [
          { q: t("Is a semantic layer over-engineering for one workflow?", "只有一个工作流，搞语义层是不是过度设计？"), a: t("It is one file. The alternative is the first meeting where the agent's number differs from the dashboard's, which ends trust in the agent for reasons that have nothing to do with the agent.", "它只是一个文件。不这样做的代价是：第一次开会时，智能体给的数字和仪表盘上的不一样，于是大家对智能体失去信任，而原因跟智能体本身毫无关系。") },
        ],
      },
    ],
  },
  {
    id: "docai",
    title: t("Document AI in the pipeline", "pipeline 中的文档 AI"),
    goal: t(
      "The invoice PDF is evidence the ERP record can be checked against. AI Functions run inside the pipeline as SQL, once per document, governed and billed like the rest of the pipeline. Every model output carries a confidence score, and the rule is the same as for people: low confidence or disagreement with the system of record goes to a human, never to a silent correction.",
      "发票 PDF 是可以用来核对 ERP 记录的证据。AI Functions 以 SQL 形式在 pipeline 内运行，每份文档只处理一次，与 pipeline 的其他部分一样受治理、一样计费。每个模型输出都带有置信度分数，规则和对人的要求一样：置信度低或与记录系统不一致时，交给人处理，绝不悄悄纠正。",
    ),
    steps: [
      {
        id: "parse",
        title: t("Parse and extract invoice fields, then check them against the ERP", "解析并抽取发票字段，再与 ERP 核对"),
        local: t("ai.invoice_parsed, ai.invoice_fields with confidence and citations, gold.document_checks, and gold.open_exceptions.", "ai.invoice_parsed、带置信度和引用的 ai.invoice_fields、gold.document_checks，以及 gold.open_exceptions。"),
        links: ["knowledge.validate", "rag-graph.chunk", "guardrails.check"],
        after: ["quality"],
        components: ["aifn", "docs"],
        why: t(
          "An ERP record can be keyed wrong; the PDF the vendor sent is the original. Parsing it with ai_parse_document and extracting fields with ai_extract turns the PDF into numbers that can be compared. These run in streaming tables on purpose: a streaming table processes each document once, while a materialized view may recompute everything, and an AI Function in a full recompute is billed again for every document it already read. On a million invoices that is the whole budget.",
          "ERP 记录可能录错；供应商寄来的 PDF 才是原件。用 ai_parse_document 解析，再用 ai_extract 抽取字段，就能把 PDF 变成可以比对的数字。这些处理特意放在流式表里：流式表对每份文档只处理一次，而物化视图可能会全部重算，一次全量重算中的 AI Function 会对已经读过的每份文档再计一次费。一百万张发票，这就是全部预算。",
        ),
        what: t(
          "ai.invoice_parsed holds the parsed document per PDF. ai.invoice_fields extracts invoice id, vendor, PO number, total, currency and date with an advanced schema, confidence scores and citations. gold.document_checks keeps the latest document per invoice and sets mismatch when the totals differ, the currency differs, the amount's confidence is below 0.8, any value is missing (NULL counts as a mismatch: \"could not tell\" is not \"agrees\"), or the PDF matches no ERP invoice at all (business unit UNASSIGNED). gold.open_exceptions unions match exceptions and document mismatches into the agent's work list.",
          "ai.invoice_parsed 保存每个 PDF 的解析结果。ai.invoice_fields 使用高级 schema 抽取发票号、供应商、采购单号、总额、币种和日期，并附带置信度分数和引用。gold.document_checks 为每张发票保留最新的文档，并在以下情况把 mismatch 设为真：总额不同、币种不同、金额置信度低于 0.8、任何值缺失（NULL 视为不一致：“看不出来”不等于“一致”），或者 PDF 根本匹配不到任何 ERP 发票（业务单元记为 UNASSIGNED）。gold.open_exceptions 把匹配异常和文档不一致合并为智能体的工作清单。",
        ),
        how: [
          t("Start with 200 real invoices in a dev catalog. Run the pipeline and read the extracted fields beside the PDFs.", "在开发 catalog 中先用 200 张真实发票。运行 pipeline，把抽取出的字段与 PDF 对照阅读。"),
          t("Tune the schema descriptions and the instructions option until the totals agree on at least 98% of the sample. Descriptions are prompts.", "调整 schema 中的描述和 instructions 选项，直到样本中至少 98% 的总额一致。描述就是提示词。"),
          t("Pick the confidence cut from data (the classifier_check helper in step [[classify]] works for any score), not from a guess.", "根据数据选择置信度阈值（第 [[classify]] 步中的 classifier_check 辅助函数适用于任何分数），而不是靠猜。"),
          t("For no-code iteration on the schema, Agent Bricks Information Extraction maps to the same ai_extract function.", "如果想无代码地迭代 schema，Agent Bricks 的 Information Extraction 对应的是同一个 ai_extract 函数。"),
        ],
        files: [K + "pipelines/enrich.sql"],
        interpret: [
          t("`fields:error_message IS NULL` failing (the extracted expectation) means a document could not be read: scanned at low resolution, password protected, or not an invoice. These belong in a manual queue, not in a retry loop.", "`fields:error_message IS NULL`（即 extracted 期望规则）不通过，说明某份文档无法读取：扫描分辨率太低、有密码保护，或者根本不是发票。这些应该进入人工队列，而不是重试循环。"),
          t("The mismatch rate on clean data should be low single digits. Above that, look at which field disagrees: total_amount disagreements with matching invoice ids are usually tax-inclusive versus tax-exclusive totals, a schema description problem.", "在干净数据上，不一致率应该在个位数的低端。超过这个水平时，看看是哪个字段不一致：发票号相同而 total_amount 不一致，通常是含税与不含税总额的问题，属于 schema 描述的问题。"),
          t("Cost appears under the AI_FUNCTIONS product in system.billing.usage. Divide by documents processed: that is your cost per invoice for extraction, a number the business case needs.", "费用会出现在 system.billing.usage 的 AI_FUNCTIONS 产品下。用它除以处理的文档数，就得到每张发票的抽取成本，这是业务论证需要的数字。"),
        ],
        trouble: [
          { s: t("The bill is far above estimate", "账单远超预估"), c: t("AI Functions ran in a materialized view and recomputed, or the pipeline was fully refreshed.", "AI Functions 跑在物化视图里并发生了重算，或者 pipeline 被全量刷新了。"), f: t("Keep AI Functions in streaming tables, and treat a full refresh of ai.* as a budgeted event that needs approval.", "把 AI Functions 放在流式表中，并把 ai.* 的全量刷新视为一次需要审批的预算事项。") },
          { s: t("AI Functions are not available", "AI Functions 不可用"), c: t("Classic SQL warehouses do not support them, and the runtime must be 15.4 LTS or above.", "Classic SQL warehouse 不支持它们，运行时必须是 15.4 LTS 或以上。"), f: t("Run on serverless pipelines and serverless SQL warehouses.", "在 serverless pipeline 和 serverless SQL warehouse 上运行。") },
          { s: t("Join to silver finds nothing", "与 silver 的关联什么也找不到"), c: t("The extracted invoice id has a prefix or spacing the ERP does not.", "抽取出的发票号带有 ERP 中没有的前缀或空格。"), f: t("Normalize both sides (upper, strip non-alphanumerics) in the join, and say so in the column comment.", "在关联时对两边都做规范化（转大写、去掉非字母数字字符），并在列注释中写明。") },
        ],
        done: t("On a 200-invoice sample, at least 98% of totals agree with the ERP, and every disagreement appears in gold.open_exceptions as doc_mismatch.", "在 200 张发票的样本上，至少 98% 的总额与 ERP 一致，每个不一致都以 doc_mismatch 出现在 gold.open_exceptions 中。"),
        unconfirmed: t("The advanced ai_extract schema is written as an object of field definitions with type, description and enum labels, following the vendor page's description; check the exact shape on the ai_extract reference before the first run. The variant paths (fields:response.total_amount.value) follow the documented return structure.", "高级 ai_extract schema 按厂商页面的描述，写成由字段定义（type、description、enum labels）组成的对象；首次运行前请在 ai_extract 参考页上核对确切结构。variant 路径（fields:response.total_amount.value）遵循文档中的返回结构。"),
        scale: [
          t("The vendor page advises submitting the full dataset in one query rather than small batches: AI Functions parallelize and retry internally. Do not wrap them in your own batching loop.", "厂商页面建议把整个数据集放在一个查询里提交，而不是拆成小批：AI Functions 会在内部并行和重试。不要在外面再包一层自己的分批循环。"),
          t("Backfills of historical invoices: run them as a separate, budgeted pipeline update, off-hours, after the sample has proven the schema.", "历史发票的回填：在样本验证过 schema 之后，作为单独的、有预算的 pipeline 更新，在非高峰时段运行。"),
        ],
        challenge: [
          { q: t("Why not let the agent read the PDF itself when it needs to?", "为什么不让智能体在需要时自己去读 PDF？"), a: t("Because then each triage pays to read the document again, the result is not stored, and nobody can query \"how many invoices disagree with the ERP\". Extraction is data engineering: do it once, store it, govern it.", "因为那样每次分诊都要为再读一遍文档付费，结果不会被保存，也没人能查询“有多少张发票与 ERP 不一致”。抽取属于数据工程：做一次、存下来、纳入治理。") },
        ],
      },
      {
        id: "classify",
        title: t("Classify spend categories, and measure the classifier per class", "对支出类别分类，并逐类衡量分类器"),
        local: t("ai.invoice_category with confidence and rationale, and a per-class precision and recall gate.", "带置信度和理由的 ai.invoice_category，以及逐类的精确率与召回率门槛。"),
        links: ["skills.match", "multi-agent.calibrate", "evaluation.score"],
        after: ["parse"],
        components: ["aifn"],
        why: t(
          "Different policies govern travel, software and professional services, so the agent must know the category before it searches policy. ai_classify does that with labels you describe. But an overall accuracy hides the class that matters: if travel is 5% of invoices and is wrong half the time, accuracy is still 97% and every travel invoice is checked against the wrong policy. So the gate is per class, on enough labelled examples, with a confidence cut below which a person decides.",
          "差旅、软件和专业服务受不同政策约束，所以智能体在检索政策之前必须先知道类别。ai_classify 用你描述的标签来完成分类。但总体准确率会掩盖真正要紧的类别：如果差旅只占发票的 5%，却有一半分错，总体准确率仍有 97%，而每张差旅发票都会对照错误的政策检查。所以门槛是逐类的，基于足够数量的标注样本，并设一个置信度阈值，低于它就由人来决定。",
        ),
        what: t(
          "The pipeline classifies each invoice line description into five categories with confidence and rationale. classifier_check.py computes per-class precision and recall against labels a person wrote, fails any class below 0.85 or with fewer than 30 labels, and finds the confidence cut that reaches 95% precision.",
          "pipeline 把每条发票行描述分到五个类别之一，并附带置信度和理由。classifier_check.py 对照人工编写的标签计算每个类别的精确率和召回率：任何类别低于 0.85 或标签少于 30 条都判为不通过，并找出能达到 95% 精确率的置信度阈值。",
        ),
        how: [
          t("Have an AP clerk label 300 invoice lines into evals.category_labels, at least 30 per category.", "请一位应付账款人员把 300 条发票行标注到 evals.category_labels 中，每个类别至少 30 条。"),
          t("Run the SQL in the file's docstring and feed the rows to per_class(), gate() and confidence_cut().", "运行文件文档字符串中的 SQL，把结果行传给 per_class()、gate() 和 confidence_cut()。"),
          t("Improve label descriptions (they are the prompt) until the gate passes; then route predictions below the cut to a person.", "改进标签描述（它们就是提示词），直到通过门槛；然后把低于阈值的预测交给人处理。"),
        ],
        files: [K + "src/evals/classifier_check.py"],
        code: [{ lang: "python", text: `from evals.classifier_check import per_class, gate, confidence_cut
rows = spark.sql(QUERY).toPandas().to_dict("records")   # QUERY from the docstring
stats = per_class(rows)
print(stats)              # {'software': {'precision': 0.93, 'recall': 0.88, 'support': 64}, ...}
print(gate(stats))        # [] means usable
print(confidence_cut(rows, 0.95))   # e.g. 0.72: below this, a person decides` }],
        interpret: [
          t("A class with high precision and low recall is being swallowed by a neighbour: look at which class its examples were predicted as, and sharpen both descriptions.", "精确率高而召回率低的类别正在被相邻类别“吞掉”：看看它的样本被预测成了哪个类别，然后把两个类别的描述都写得更清楚。"),
          t("`only 4 labelled examples` is a failure, not a pass. A perfect score on four examples proves nothing.", "`only 4 labelled examples` 是不通过，不是通过。四个样本上的满分什么也证明不了。"),
          t("The cut tells you the automation rate: the share of rows above it is what the agent gets without a person.", "阈值告诉你自动化率：高于阈值的行所占的比例，就是智能体无需人工就能拿到的部分。"),
        ],
        trouble: [
          { s: t("One category absorbs everything ambiguous", "一个类别吞掉了所有模糊的样本"), c: t("Its description is the broadest (\"goods\" covers almost anything physical).", "它的描述最宽泛（“goods”几乎涵盖一切实物）。"), f: t("Narrow its description, or add an \"other\" label routed to a person, and re-measure; never tune labels on the evaluation sample itself.", "收窄它的描述，或者增加一个交给人处理的“other”标签，然后重新衡量；绝不要在评估样本本身上调标签。") },
          { s: t("Rationales cite words not in the description", "理由中引用了描述里没有的词"), c: t("The model filled in from general knowledge.", "模型用常识补全了内容。"), f: t("Treat rationales as hints for reviewers, never as evidence. The category is the output; the confidence decides who acts.", "把理由当作给审核人员的提示，绝不能当作证据。类别才是输出；置信度决定由谁来处理。") },
        ],
        done: t("Every category passes the per-class gate on at least 30 labels, and the confidence cut is written in the step's merge request.", "每个类别都在至少 30 条标签上通过逐类门槛，置信度阈值写在这一步的合并请求里。"),
        scale: [
          t("Relabel a fresh sample each quarter. Vendors and spend change; a classifier measured once drifts silently.", "每个季度重新标注一批新样本。供应商和支出结构会变；只测量过一次的分类器会悄悄漂移。"),
        ],
        challenge: [
          { q: t("Could the agent classify in its own prompt instead?", "能不能让智能体在自己的提示词里顺便分类？"), a: t("It could, and then the category would be invisible, unmeasured and paid for on every triage. As a column it is measured once, queryable, and reused by dashboards and policy routing alike.", "可以，但那样类别就不可见、没有被衡量，而且每次分诊都要付费。作为一列数据，它只需衡量一次，可以查询，并被仪表盘和政策路由共同复用。") },
        ],
      },
    ],
  },
];
