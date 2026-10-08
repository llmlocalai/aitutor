import { t, type Module } from "@/lib/types";

export const ops: Module = {
  id: "ops",
  n: 15,
  layer: 6,
  title: t("Operations and deployment", "运维与部署"),
  short: t(
    "Supervision, scheduling, logs, backups, and recovery, so the system runs when nobody is watching.",
    "进程守护、调度、日志、备份和恢复，让系统在没人盯着的时候也能运行。",
  ),
  what: t(
    "Operations covers how services start and restart, how background work yields to live traffic, how you see what is up, and how data is backed up and restored.",
    "运维涵盖：服务如何启动和重启、后台任务如何给实时流量让路、如何查看哪些服务在运行，以及数据如何备份和恢复。",
  ),
  why: t(
    "An agent that works in a terminal session and dies on reboot is a demo. Most of the reference build's lost time came from operational causes: a stripped service environment, a noisy probe, single-writer stores, backups on the volume they protected.",
    "只能在终端会话里运行、一重启就挂掉的智能体只是个演示。参考系统损失的大部分时间都源于运维问题：服务启动环境被精简、探针产生大量噪音、单写入方存储、备份放在它要保护的同一个卷上。",
  ),
  how: [
    t("Every long-running service is under the OS supervisor with keep-alive and absolute paths.", "每个长期运行的服务都交给操作系统的进程守护来管理，开启自动重启，并使用绝对路径。"),
    t("A status command probes every service and prints one screen.", "一条状态命令探测所有服务，并输出一屏结果。"),
    t("A busy marker tells background jobs that a live request is in flight. The scheduler checks it between units of work.", "忙碌标记告诉后台任务有实时请求正在处理。调度器在每个工作单元之间检查它。"),
    t("Backups copy what cannot be reproduced, and a restore test runs after every backup.", "备份只复制无法重新生成的东西，并且每次备份后都运行恢复测试。"),
  ],
  prereqs: [
    {
      id: "inference",
      why: t("The engine is the first service to supervise, and its memory limits decide what may run at the same time.", "引擎是第一个需要守护的服务，它的内存上限决定了哪些东西可以同时运行。"),
      stub: t("Start services by hand in terminal tabs.", "在终端标签页里手动启动服务。"),
    },
    {
      id: "harness",
      why: t("The agent server is the main service. Its health path and busy marker are what the supervisor and scheduler read.", "智能体服务是主服务。守护进程和调度器读取的正是它的健康检查路径和忙碌标记。"),
      stub: t("Supervise the engine alone.", "只守护引擎。"),
    },
    {
      id: "evaluation",
      why: t("Scheduled evals and the daily report are how you learn that a change made things worse.", "定时评估和每日报告，是你得知某次改动让情况变糟的途径。"),
      stub: t("A manual smoke test after each change.", "每次改动之后手动做一次冒烟测试。"),
    },
  ],
  inBuild: [
    { path: "Install-Autostart.command", role: t("Installs supervised services.", "安装受守护的服务。") },
    { path: "Check-All-LLM-Status.command", role: t("One-screen status of every service and model.", "一屏显示所有服务和模型的状态。") },
    { path: "apps/agent-server/nightly/scheduler.py", role: t("Duty cycle and preemption.", "占空比控制和抢占。") },
    { path: "apps/ops/pg_backup.sh", role: t("Database backup, with a restore test beside it.", "数据库备份，旁边配有恢复测试。") },
    { path: "SOP-LLM-OPERATIONS.md", role: t("Operating procedures.", "操作规程。") },
  ],
  flow: {
    caption: t("A background unit of work meets a live request", "后台工作单元遇上实时请求"),
    stages: [
      { label: t("Window opens", "时间窗开启"), detail: t("The scheduler starts at a set hour with a list of small units.", "调度器在设定的时刻启动，带着一串小的工作单元。"), kind: "input" },
      { label: t("Busy?", "忙吗？"), detail: t("Before each unit, check the marker file.", "每个单元开始前，检查标记文件。"), kind: "check" },
      { label: t("Wait", "等待"), detail: t("A live request holds the marker until its answer is fully sent.", "实时请求在回答完全发出之前一直持有标记。"), kind: "check" },
      { label: t("Run one unit", "运行一个单元"), detail: t("Small enough to finish in seconds.", "足够小，几秒内就能完成。"), kind: "tool" },
      { label: t("Budget", "预算"), detail: t("Stop when the duty share or the window is used up.", "占空比或时间窗用完时停止。"), kind: "check" },
      { label: t("Report", "报告"), detail: t("What ran, what waited, what was skipped.", "运行了什么、等待了什么、跳过了什么。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "inventory",
      title: t("List every service, its port, and its interpreter", "列出每个服务、它的端口和解释器"),
      why: t("You cannot supervise what you have not listed. The list also exposes two services sharing a port or needing different environments.", "没列出来的东西无法守护。这份清单还能暴露两个服务共用端口或需要不同运行环境的情况。"),
      do: [
        t("For each long-running process write: name, port, the absolute path of its interpreter, its working directory, its log file.", "为每个长期运行的进程写下：名称、端口、解释器的绝对路径、工作目录、日志文件。"),
        t("Note which virtual environment each uses. A service started with the wrong one fails at launch.", "注明每个服务使用哪个虚拟环境。用错环境启动的服务会在启动时失败。"),
      ],
      verify: t("Every port in use on the machine is on the list.", "机器上每个正在使用的端口都在清单上。"),
      needs: [
        { step: "inference.engine", what: t("the engine process", "引擎进程") },
        { step: "api-gateway.handler", what: t("the gateway process", "网关进程") },
      ],
      produces: t("A service inventory.", "一份服务清单。"),
    },
    {
      id: "supervise",
      title: t("Put each service under the supervisor", "把每个服务交给守护进程"),
      why: t("Supervision is the first operational step because everything after it assumes services come back by themselves.", "守护是运维的第一步，因为之后的一切都默认服务会自己恢复。"),
      do: [
        t("Write one unit file per service from the inventory.", "根据清单为每个服务写一个单元文件。"),
        t("Use absolute paths everywhere. The supervisor starts with a minimal PATH and no shell profile.", "所有地方都用绝对路径。守护进程启动时 PATH 很精简，也不会加载 shell 配置。"),
        t("Turn on keep-alive and run-at-load.", "开启自动重启和开机自启。"),
        t("Kill the process and confirm it restarts.", "杀掉进程，确认它自动重启。"),
      ],
      lab: { file: "labs/m15_ops/units/com.example.agent-server.plist" },
      codeNote: t("The Linux equivalents are in the same folder: a systemd service and a timer.", "Linux 下的对应文件在同一目录：一个 systemd service 和一个 timer。"),
      verify: t("After `kill`, the service is back within seconds, and after a reboot every service is up.", "执行 `kill` 之后服务在几秒内恢复；重启机器后所有服务都在运行。"),
      needs: [{ step: "ops.inventory", what: t("paths, ports, and environments", "路径、端口和运行环境") }],
      produces: t("Services that survive crashes and reboots.", "能扛住崩溃和重启的服务。"),
      notExecuted: true,
    },
    {
      id: "status",
      title: t("Write one status command", "写一条状态命令"),
      why: t("After supervision, you need to see state in one place. This is also what the watchdog calls.", "有了守护之后，你需要在一个地方看到全部状态。看门狗调用的也是它。"),
      do: [
        t("Probe each service's unauthenticated health path with a short timeout.", "用较短的超时探测每个服务的无认证健康检查路径。"),
        t("Print one line per service: up or down, and the reason.", "每个服务输出一行：在线或离线，以及原因。"),
        t("Never send a key from the probe. Liveness needs none.", "探针里绝不发送密钥。存活检查不需要它。"),
      ],
      lab: { file: "labs/m15_ops/status.py", region: "status" },
      run: "python3 -m labs.m15_ops.demo",
      output: "m15.demo",
      pick: ["1 "],
      verify: t("The running gateway shows UP and the unreachable address shows DOWN with a reason.", "运行中的网关显示 UP，无法访问的地址显示 DOWN 并附原因。"),
      needs: [{ step: "api-gateway.handler", what: t("the unauthenticated health path", "无认证的健康检查路径") }],
      produces: t("`report()`: the daily driver.", "`report()`：日常最常用的命令。"),
    },
    {
      id: "busy",
      title: t("Add the busy marker to the server", "给服务加上忙碌标记"),
      why: t("The marker has to exist before any background job, because it is the only way a job learns that a user is waiting.", "在任何后台任务出现之前，这个标记就得存在，因为它是任务得知“有用户在等”的唯一途径。"),
      do: [
        t("Wrap every live request in a context manager that creates a file and removes it afterward.", "用一个上下文管理器包裹每个实时请求：开始时创建文件，结束后删除。"),
        t("Hold it for the whole streamed answer, not only until the first token.", "在整个流式回答期间都要持有它，而不是只到第一个 token。"),
        t("Treat a marker older than a few minutes as left by a crash.", "把存在超过几分钟的标记视为崩溃遗留的。"),
      ],
      lab: { file: "labs/m15_ops/scheduler.py", region: "busy" },
      verify: t("The file exists during a request and is gone after it.", "请求期间文件存在，请求结束后文件消失。"),
      needs: [{ step: "harness.run", what: t("the request path to wrap", "要包裹的请求路径") }],
      produces: t("`busy()` and `is_busy()`.", "`busy()` 和 `is_busy()`。"),
    },
    {
      id: "scheduler",
      title: t("Schedule background work with preemption and a duty cycle", "用抢占和占空比来调度后台任务"),
      why: t("It needs the marker. It is what lets evals and the learning loop share one machine with live users.", "它依赖忙碌标记。正是它让评估和学习循环能与在线用户共用一台机器。"),
      do: [
        t("Break every job into units that finish in seconds.", "把每个任务拆成几秒内就能完成的单元。"),
        t("Before each unit: wait while the marker is present.", "每个单元开始前：只要标记存在就等待。"),
        t("Stop starting units when the duty share of the window is spent, or the window has closed.", "当时间窗内的占空比用完或时间窗关闭时，不再启动新单元。"),
        t("Log what ran, waited, and was skipped.", "记录哪些运行了、哪些等待了、哪些被跳过。"),
      ],
      lab: { file: "labs/m15_ops/scheduler.py", region: "scheduler" },
      output: "m15.demo",
      pick: ["2 ", "3 "],
      verify: t("All units run, with a pause while the live request held the marker. With a 50 percent duty the last units are skipped.", "所有单元都运行了，实时请求持有标记期间有一次暂停。占空比为 50% 时，最后几个单元被跳过。"),
      needs: [{ step: "ops.busy", what: t("is_busy()", "is_busy()") }],
      produces: t("`run_window()`: used to run evals and the nightly loop.", "`run_window()`：用来运行评估和夜间循环。"),
    },
    {
      id: "backup",
      title: t("Back up what cannot be reproduced, and test the restore", "备份无法重新生成的东西，并测试恢复"),
      why: t("Backups come once there is state worth keeping. The restore test is part of the same step because an untested backup is a hope.", "有了值得保留的状态，就该做备份。恢复测试属于同一步，因为没有测试过的备份只是一种希望。"),
      do: [
        t("List what is irreplaceable: databases, keys, prompts, skills, eval sets, scripts.", "列出不可替代的东西：数据库、密钥、提示词、技能、评估集、脚本。"),
        t("Skip what can be downloaded again: model weights, source documents.", "跳过可以重新下载的东西：模型权重、原始文档。"),
        t("Use the database's online backup so a copy taken during writes is consistent.", "使用数据库的在线备份功能，保证写入过程中取得的副本是一致的。"),
        t("After each backup: open it, run an integrity check, compare row counts with the live database.", "每次备份之后：打开它，运行完整性检查，把行数与在线数据库比较。"),
        t("Send one encrypted copy off the machine.", "把一份加密副本发送到机器之外。"),
      ],
      lab: { file: "labs/m15_ops/backup.py", region: "backup" },
      output: "m15.demo",
      pick: ["4 "],
      verify: t("The restore test reports integrity True and matching counts.", "恢复测试报告完整性为 True，行数一致。"),
      needs: [
        { step: "state.schema", what: t("the tables to count", "要统计行数的表") },
        { step: "api-gateway.keys", what: t("the key store, which is irreplaceable", "密钥库，它是不可替代的") },
      ],
      produces: t("`backup()` and `restore_test()`.", "`backup()` 和 `restore_test()`。"),
    },
    {
      id: "logs",
      title: t("Rotate logs and keep signal apart from noise", "轮转日志，并把信号与噪音分开"),
      why: t("Other jobs read your logs: self-observation reads them every night. Noise in a log that a job reads is how a signal stops being seen.", "别的任务会读你的日志：自我观察每晚都读。任务要读的日志里混进噪音，信号就会被淹没。"),
      do: [
        t("Keep structured request and tool logs in their own files, apart from server output.", "把结构化的请求日志和工具日志放在独立的文件里，与服务输出分开。"),
        t("Rotate by size or date on a schedule.", "按大小或日期定时轮转。"),
        t("When a probe or a test fills a log, fix the probe. Do not filter the log.", "当某个探针或测试把日志刷满时，修的是探针，而不是去过滤日志。"),
      ],
      code: { lang: "bash", file: "on your machine (Linux)", text: `# /etc/logrotate.d/agent
/srv/agent/logs/*.log /srv/agent/logs/*.jsonl {
  daily
  rotate 14
  compress
  missingok
  copytruncate
}` },
      codeNote: t("With copytruncate a job that tracks a byte offset must reset its cursor when the file shrinks.", "使用 copytruncate 时，按字节偏移量跟踪的任务必须在文件变小时重置游标。"),
      lab: { file: "labs/m15_ops/logs.py", region: "rotate" },
      run: "python3 -m labs.m15_ops.logs",
      output: "m15.logs",
      verify: t("After rotation the fixed cursor reads the 3 new lines and the naive cursor reads none. The tool log holds only tool calls, and its files stay bounded.", "轮转之后，修正后的游标读到 3 行新内容，而原始游标一行也读不到。工具日志里只有工具调用，文件大小始终有上限。"),
      needs: [
        { step: "harness.run", what: t("the two structured logs", "两份结构化日志") },
        { step: "state.cursor", what: t("cursors that must survive rotation", "需要在轮转后依然有效的游标") },
      ],
      produces: t("Logs that stay readable by people and by jobs.", "人和任务都能持续读懂的日志。"),
    },
    {
      id: "nightly",
      title: t("Wire the nightly window", "把夜间时间窗串起来"),
      why: t("This joins operations to evaluation and self-evolution. It is last among the runtime steps because it schedules everything built before it.", "这一步把运维与评估、自进化连在一起。它在运行时步骤里排最后，因为它调度的是之前搭建的一切。"),
      do: [
        t("Create a timer that opens the window at a quiet hour.", "创建一个定时器，在空闲时段开启时间窗。"),
        t("In the window run, in order: backup, retrieval eval, the learning loop in report mode, the agent eval weekly.", "在时间窗内按顺序运行：备份、检索评估、报告模式的学习循环、每周一次的智能体评估。"),
        t("Write one report with a line per job: latest value, previous value, anything skipped.", "生成一份报告，每个任务一行：最新值、上一次的值、被跳过的内容。"),
      ],
      lab: { file: "labs/m15_ops/units/agent-nightly.timer" },
      verify: t("The morning report exists, and every job appears in it as ran, waited, or skipped.", "早上的报告已生成，每个任务都以“已运行、等待过、被跳过”之一出现在其中。"),
      needs: [
        { step: "ops.scheduler", what: t("run_window()", "run_window()") },
        { step: "ops.backup", what: t("the backup unit", "备份单元") },
        { step: "evaluation.variants", what: t("the retrieval eval unit", "检索评估单元") },
        { step: "self-evolving.nightly", what: t("the learning loop unit", "学习循环单元") },
      ],
      produces: t("A system that measures and maintains itself every night.", "一个每晚自我测量、自我维护的系统。"),
      notExecuted: true,
    },
    {
      id: "change",
      title: t("Adopt a change discipline", "建立改动纪律"),
      why: t("Last, because it governs every change you make from now on to all fifteen modules.", "放在最后，因为从现在起你对全部十五个模块的每次改动都受它约束。"),
      do: [
        t("Before editing a running file, save a dated copy beside it.", "编辑正在运行的文件之前，在旁边保存一份带日期的副本。"),
        t("One change per commit. Write the commit subject as what was learned.", "每次提交只做一个改动。提交标题写的是学到了什么。"),
        t("Put new behavior behind a flag, run the eval both ways, then change the default.", "新行为放在开关后面，开和关各跑一次评估，再改默认值。"),
        t("After a deploy, run the status command and the smoke questions.", "部署之后，运行状态命令和冒烟问题。"),
      ],
      verify: t("For your last change you can show the flag, the two eval lines, and the commit.", "对你最近的一次改动，你能拿出开关、两行评估结果和对应的提交。"),
      needs: [
        { step: "evaluation.variants", what: t("flags and the history file", "开关和历史文件") },
        { step: "ops.status", what: t("the post-deploy check", "部署后的检查") },
      ],
      produces: t("A history in which every change has a reason and a measurement.", "一份历史记录，其中每次改动都有理由和测量结果。"),
      notExecuted: true,
    },
  ],
  together: [
    { with: "api-gateway", how: t("The watchdog probes the gateway's liveness path. Keys are in the backup set.", "看门狗探测网关的存活检查路径。密钥在备份范围内。") },
    { with: "evaluation", how: t("Evals are units in the nightly window and lines in the daily report.", "评估是夜间时间窗里的工作单元，也是每日报告里的若干行。") },
    { with: "self-evolving", how: t("The learning loop runs through the scheduler and pauses for live requests.", "学习循环通过调度器运行，遇到实时请求时暂停。") },
    { with: "inference", how: t("Background jobs that load a model compete for resident slots, so the window is at a quiet hour.", "需要加载模型的后台任务会争抢驻留名额，所以时间窗设在空闲时段。") },
  ],
  failures: [
    {
      when: "2026-07",
      title: t("A service that ran by hand and failed under the supervisor", "手动能跑、交给守护进程就失败的服务"),
      what: t("The supervisor's minimal PATH hid a binary, and a unit pointed at the wrong virtual environment.", "守护进程精简的 PATH 让某个可执行文件找不到，另一个单元文件指向了错误的虚拟环境。"),
      fix: t("Absolute paths in every unit, and the interpreter path recorded in the inventory.", "所有单元文件都用绝对路径，并在清单里记录解释器路径。"),
      lesson: t("The supervisor's environment is not your shell's.", "守护进程的运行环境和你的 shell 不是一回事。"),
    },
    {
      when: "2026-08",
      title: t("Backups on the volume they protected", "备份放在它要保护的那个卷上"),
      what: t("Backups covered accidental deletion and would not have survived a drive failure.", "这样的备份能应对误删，却扛不住磁盘损坏。"),
      fix: t("An encrypted offsite copy on a schedule, and a restore test.", "定时生成加密的异地副本，并做恢复测试。"),
      lesson: t("Name the failure each backup protects against.", "每一份备份防的是哪种故障，要明确写出来。"),
    },
    {
      when: "2026-10",
      title: t("The learner ran through a chat answer", "学习任务在聊天回答期间照常运行"),
      what: t("The busy marker was released when the response started, so background work resumed while tokens were still streaming.", "忙碌标记在响应开始时就被释放了，于是 token 还在流式输出时后台任务就恢复了。"),
      fix: t("Hold the marker until the streamed response finishes.", "把标记一直持有到流式响应结束。"),
      lesson: t("Busy means until the user has the whole answer.", "“忙”的意思是：直到用户拿到完整的回答为止。"),
    },
    {
      when: "2026-10",
      title: t("A helper process that grew to 71 GB", "一个辅助进程涨到了 71 GB"),
      what: t("A reranker's buffer cache grew without bound and took memory from the models.", "某个重排模型的缓冲区缓存无限增长，占用了模型所需的内存。"),
      fix: t("Cap and release the cache, and include process memory in the status command.", "给缓存设上限并定期释放，同时在状态命令里加入进程内存。"),
      lesson: t("Every process on the machine is part of the memory budget.", "机器上的每个进程都属于内存预算的一部分。"),
    },
  ],
  portability: {
    databricks: t(
      "Agent Runtime, Jobs, and Apps are supervised by the platform. You own versions, permissions, cost alerts, and promotion between workspaces with asset bundles.",
      "Agent Runtime、Jobs 和 Apps 由平台负责守护。你负责的是版本、权限、成本告警，以及用 asset bundle 在工作区之间做发布。",
    ),
    watsonx: t("The platform runs the services. You own environments, deployment spaces, and promotion between them.", "服务由平台运行。你负责的是环境、deployment space 以及它们之间的发布。"),
    codex: t("Operations here means CI: headless runs, sandbox settings, and secrets handling for the agent.", "这里的运维指的是 CI：无界面运行、沙箱设置以及智能体的密钥管理。"),
    cursor: t("Same: team rules in the repo, background agent settings, and secrets.", "同理：仓库里的团队规则、后台智能体的设置和密钥。"),
    claude: t("Headless runs in CI, managed settings, and permission policies. A service built on the SDK is operated like any other service.", "CI 中的无界面运行、集中管理的设置和权限策略。基于 SDK 构建的服务，运维方式与其他服务一样。"),
    other: t("systemd units and timers in place of launchd. The lab's scheduler, status, and backup code is plain Python.", "用 systemd 的 unit 和 timer 代替 launchd。lab 的调度器、状态检查和备份代码都是纯 Python。"),
  },
  checks: [
    {
      q: t("Which files do you back up, and which do you not?", "哪些文件要备份，哪些不用？"),
      a: t("Back up what cannot be reproduced: databases, keys, prompts, skills, eval sets, scripts. Skip model weights and source documents that can be downloaded again.", "备份无法重新生成的东西：数据库、密钥、提示词、技能、评估集、脚本。跳过可以重新下载的模型权重和原始文档。"),
    },
    {
      q: t("A service runs fine by hand and fails under the supervisor. What is the usual cause?", "一个服务手动运行正常，交给守护进程就失败。通常是什么原因？"),
      a: t("Environment. The supervisor starts with a minimal PATH and no shell profile, so a binary or virtual environment is not found. Use absolute paths in the unit.", "运行环境。守护进程启动时 PATH 很精简、不加载 shell 配置，所以找不到某个可执行文件或虚拟环境。在单元文件里使用绝对路径。"),
    },
    {
      q: t("Why does the busy marker come before the scheduler?", "为什么忙碌标记要先于调度器？"),
      a: t("The scheduler's only way to know a user is waiting is the marker. Without it, a background job and a chat compete for the same model and the user loses.", "调度器得知有用户在等的唯一途径就是这个标记。没有它，后台任务和聊天会争抢同一个模型，吃亏的是用户。"),
    },
    {
      q: t("What happens in the nightly window, in what order, and why that order?", "夜间时间窗里发生什么？按什么顺序？为什么？"),
      a: t("Backup first, so a bad night can be undone. Then the retrieval eval, which is cheap and tells you whether search still works. Then the learning loop in report mode. The agent eval runs weekly because it is the most expensive.", "先备份，这样出了问题可以撤销。然后是检索评估，它便宜，能告诉你检索是否还正常。接着是报告模式的学习循环。智能体评估每周运行一次，因为它开销最大。"),
    },
  ],
  terms: [
    { term: t("Supervisor", "进程守护"), def: t("The OS service that starts processes and restarts them when they exit.", "操作系统中负责启动进程、并在其退出后重启的服务。") },
    { term: t("Duty cycle", "占空比"), def: t("The share of a window background work may use.", "后台任务在时间窗内可以占用的比例。") },
    { term: t("Preemption", "抢占"), def: t("Pausing background work when live work arrives.", "实时任务到来时暂停后台任务。") },
    { term: t("Restore test", "恢复测试"), def: t("Opening a backup and checking it, on a schedule.", "定期打开备份并对其进行检查。") },
  ],
};
