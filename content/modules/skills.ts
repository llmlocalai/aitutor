import { t, type Module } from "@/lib/types";

export const skills: Module = {
  id: "skills",
  n: 8,
  layer: 5,
  title: t("Skills", "技能（Skills）"),
  short: t(
    "Instruction files loaded on demand, so routing knowledge costs nothing until it is needed.",
    "按需加载的指令文件，路由知识在用到之前不占任何开销。",
  ),
  what: t(
    "A skill is a Markdown file with a one-line description and a body of instructions for one class of task. A router matches a request to at most one skill, and the harness injects its body into the prompt.",
    "技能是一个 Markdown 文件，包含一行描述和针对某一类任务的指令正文。路由器把请求匹配到至多一个技能，由 Harness 把正文注入提示词。",
  ),
  why: t(
    "A base prompt that holds every rule is paid for on every turn and gets ignored. Skills keep the base short and load detail only when relevant. They also carry routing: which tool answers which kind of question.",
    "把所有规则都塞进基础提示词，每一轮都要付费，而且会被模型忽略。技能让基础部分保持简短，只在相关时加载细节。它还承载路由知识：哪类问题该用哪个工具。",
  ),
  how: [
    t("Each file has frontmatter with a description, then the body.", "每个文件以带 description 的 frontmatter 开头，后面是正文。"),
    t("A routing file lists real requests each skill should handle, and a `_none` list of requests that need no skill.", "路由文件列出每个技能应处理的真实请求，以及一个 `_none` 列表，存放不需要任何技能的请求。"),
    t("The router embeds the request and compares it with the examples. The best skill must beat `_none` by a margin.", "路由器把请求向量化，与示例比较。得分最高的技能必须比 `_none` 高出一定幅度才生效。"),
    t("The same files can be linked into a coding agent's skills folder, so one edit changes both surfaces.", "同一批文件可以链接到编程智能体的 skills 目录，改一处两边同时生效。"),
  ],
  prereqs: [
    {
      id: "harness",
      why: t("A skill is text injected during prompt composition. Without that step there is nowhere to load it.", "技能是在组装提示词时注入的文本。没有那一步，它就无处加载。"),
      stub: t("Paste the skill body into the system prompt by hand.", "手动把技能正文粘贴进系统提示词。"),
    },
  ],
  inBuild: [
    { path: "apps/agent-server/skills/loader.py", role: t("Parse, match, and return skills.", "解析、匹配并返回技能。") },
    { path: "apps/agent-server/skills/routing.json", role: t("Routing exemplars per skill.", "每个技能的路由示例。") },
    { path: "apps/agent-server/skills/*.md", role: t("The skills.", "技能文件。") },
    { path: ".claude/skills/", role: t("Links to the same files for the coding agent.", "供编程智能体使用的、指向同一批文件的链接。") },
  ],
  flow: {
    caption: t("How a request gets its skill", "一个请求如何获得它的技能"),
    stages: [
      { label: t("User text", "用户文本"), detail: t("The latest user message.", "最新的一条用户消息。"), kind: "input" },
      { label: t("Embed", "向量化"), detail: t("Once per request.", "每个请求一次。"), kind: "model" },
      { label: t("Compare with examples", "与示例比较"), detail: t("Best similarity per skill, and for `_none`.", "每个技能取最高相似度，`_none` 同样计算。"), kind: "check" },
      { label: t("Margin test", "幅度检验"), detail: t("The best skill must beat `_none` by a margin, or nothing loads.", "最高分的技能必须超过 `_none` 一定幅度，否则不加载任何技能。"), kind: "check" },
      { label: t("Inject", "注入"), detail: t("The body is appended to the system prompt under a heading.", "正文附加到系统提示词的一个标题之下。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "write",
      title: t("Write one skill from a real failure", "从一次真实的失败出发写一个技能"),
      why: t("A skill encodes a correction. Start from a request the agent handled badly in the harness logs, so every line has a reason.", "技能是把一次纠正固化下来。从 Harness 日志里智能体处理得不好的请求入手，这样每一行都有来由。"),
      do: [
        t("Open the request log. Find a class of question that went wrong.", "打开请求日志，找出一类处理出错的问题。"),
        t("Write the frontmatter: one line describing which requests this skill is for.", "写 frontmatter：一行文字描述这个技能适用于哪些请求。"),
        t("Write the body as short imperative lines: which tool, in what order, what never to say.", "正文用简短的祈使句：用哪个工具、按什么顺序、哪些话绝不能说。"),
      ],
      lab: { file: "labs/m08_skills/skills/expense-investigation.md" },
      verify: t("Each line of the body traces to something that went wrong once.", "正文的每一行都能追溯到曾经出过的某个问题。"),
      needs: [{ step: "harness.run", what: t("the request log that shows what went wrong", "显示出错情况的请求日志") }],
      produces: t("A skill file: description plus body.", "一个技能文件：描述加正文。"),
    },
    {
      id: "load",
      title: t("Load skill files", "加载技能文件"),
      why: t("Parsing comes before matching. Keep it trivial so a skill stays a file anyone can edit.", "先解析，再匹配。解析要足够简单，让技能始终只是一个人人都能编辑的文件。"),
      do: [
        t("Read every Markdown file in the folder.", "读取目录下的每个 Markdown 文件。"),
        t("Split frontmatter from body. Keep name, description, body.", "把 frontmatter 和正文分开。保留名称、描述、正文。"),
      ],
      lab: { file: "labs/m08_skills/loader.py", region: "load" },
      run: "python3 -m labs.m08_skills.demo",
      output: "m08.demo",
      pick: ["1 "],
      verify: t("Both skills load with their descriptions.", "两个技能都连同描述一起加载成功。"),
      needs: [{ step: "skills.write", what: t("skill files to parse", "待解析的技能文件") }],
      produces: t("`load_skills()`: a dict of skills by name.", "`load_skills()`：按名称索引的技能字典。"),
    },
    {
      id: "exemplars",
      title: t("Write routing examples, including a list for no skill", "编写路由示例，包括“不需要技能”的列表"),
      why: t("Examples are written before the matcher because the matcher is only as good as they are. The `_none` list is what stops small talk from loading the least-bad skill.", "先写示例再写匹配器，因为匹配器的效果完全取决于示例。`_none` 列表的作用是防止闲聊时加载“最不差”的那个技能。"),
      do: [
        t("For each skill, write five real requests it should handle.", "为每个技能写五条它应该处理的真实请求。"),
        t("Under `_none`, write requests that need no skill: greetings, thanks, off-topic.", "在 `_none` 下写不需要技能的请求：问候、感谢、跑题内容。"),
        t("Keep this file apart from any eval set. Add a line whenever a real request is misrouted.", "这个文件要和评估集分开保存。每当有真实请求被路由错，就加一行。"),
      ],
      lab: { file: "labs/m08_skills/routing.json" },
      verify: t("No example line also appears in an eval file.", "任何示例行都没有同时出现在评估文件里。"),
      needs: [{ step: "skills.load", what: t("the skill names to route to", "要路由到的技能名") }],
      produces: t("`routing.json`: examples per skill and for `_none`.", "`routing.json`：每个技能和 `_none` 的示例。"),
    },
    {
      id: "match",
      title: t("Match a request to at most one skill", "把请求匹配到至多一个技能"),
      why: t("Matching needs skills and examples. It returns one skill or nothing, because stacking skills dilutes each and raises prompt cost.", "匹配需要技能和示例都就绪。它只返回一个技能或空，因为叠加多个技能会相互稀释，还会增加提示词开销。"),
      do: [
        t("Embed every example once at start.", "启动时把所有示例向量化一次。"),
        t("For a request, take the best similarity per skill and for `_none`.", "对一个请求，分别取每个技能和 `_none` 的最高相似度。"),
        t("Return the best skill only if it beats `_none` by the margin and clears a floor.", "只有当最高分的技能超过 `_none` 一定幅度、并且高于最低门槛时才返回它。"),
      ],
      lab: { file: "labs/m08_skills/loader.py", region: "match" },
      output: "m08.demo",
      pick: ["2 "],
      verify: t("The greeting routes to no skill. The spending question routes to the expense skill.", "问候语没有匹配到任何技能。关于支出的问题匹配到报销技能。"),
      needs: [
        { step: "skills.exemplars", what: t("the examples to compare with", "用于比较的示例") },
        { step: "inference.client", what: t("embed()", "embed()") },
      ],
      produces: t("`Router.match()`: text to one skill or None.", "`Router.match()`：输入文本，返回一个技能或 None。"),
    },
    {
      id: "inject",
      title: t("Plug the router into the harness", "把路由器接入 Harness"),
      why: t("This is the join. The harness already has the plug point, so this step is one argument.", "这是两个模块的连接点。Harness 已经留好了接入点，所以这一步只是传一个参数。"),
      do: [
        t("Pass `router.match` as the `skills` argument when you create the agent.", "创建智能体时，把 `router.match` 作为 `skills` 参数传入。"),
        t("Compare prompt length with and without a matched skill.", "对比匹配到技能和没匹配到时的提示词长度。"),
        t("Check the request log now records the skill name.", "确认请求日志现在记录了技能名。"),
      ],
      code: { lang: "python", text: `from labs.m08_skills.loader import Router

router = Router()
agent = Agent(registry, skills=router.match)     # the only change to the harness call` },
      output: "m08.demo",
      pick: ["3 ", "4 ", "5 "],
      verify: t("A matched request has a longer prompt ending in the skill's last line. An unmatched one has the base prompt only.", "匹配到技能的请求，提示词更长，并以技能的最后一行结尾。没匹配到的只有基础提示词。"),
      needs: [
        { step: "skills.match", what: t("Router.match", "Router.match") },
        { step: "harness.compose", what: t("the skills plug point", "技能接入点") },
      ],
      produces: t("An agent whose instructions depend on the request.", "指令随请求而变的智能体。"),
    },
    {
      id: "share",
      title: t("Share the same files with a coding agent", "让编程智能体共用同一批文件"),
      why: t("Once skills are plain files they can serve more than one harness. Do it after the router works so you know the files are sound.", "技能既然是普通文件，就能服务多个 Harness。等路由器跑通、确认文件没问题之后再做这一步。"),
      do: [
        t("Create a folder per skill in the coding agent's skills directory.", "在编程智能体的 skills 目录下，为每个技能建一个文件夹。"),
        t("Link the file as that folder's SKILL.md.", "把技能文件链接为该文件夹下的 SKILL.md。"),
        t("Remember that an edit now changes both agents.", "记住：现在改一次文件，两个智能体都会受影响。"),
      ],
      code: { lang: "bash", text: `mkdir -p .claude/skills/expense-investigation
ln -s "$PWD/labs/m08_skills/skills/expense-investigation.md" .claude/skills/expense-investigation/SKILL.md` },
      codeNote: t("Some agents require a `name:` line in the frontmatter as well. Check the current format for the agent you use.", "有些智能体还要求 frontmatter 里有 `name:` 一行。请查看你所用智能体当前的格式要求。"),
      verify: t("The coding agent lists the skill.", "编程智能体列出了这个技能。"),
      needs: [{ step: "skills.inject", what: t("skills known to work", "确认可用的技能") }],
      produces: t("One source of instructions for two surfaces.", "两个入口共用的同一份指令来源。"),
      notExecuted: true,
    },
    {
      id: "evaluate",
      title: t("Score routing with examples the router never saw", "用路由器没见过的例子给路由打分"),
      why: t("It is last because it needs the router, and it belongs with the evaluation module's sealed sets. Routing is a separate layer, so it gets its own number.", "它排在最后，因为需要路由器已就绪，而且要和评估模块的封存集放在一起。路由是独立的一层，所以要有自己的指标。"),
      do: [
        t("Write a gold file of requests with the skill each should get, including `none`.", "写一个标准文件，列出请求及其应得的技能，包括 `none`。"),
        t("Seal it with the other eval files.", "把它和其他评估文件一起封存。"),
        t("Report accuracy and list every misrouted request.", "报告准确率，并列出每一条被路由错的请求。"),
        t("Fix a miss by adding a new exemplar in different words to routing.json. Never copy the gold request itself, or the eval stops measuring routing.", "修正误判的办法是在 routing.json 里用不同的说法加一条新示例。绝不要把金标准里的请求原样抄过去，否则评估就不再衡量路由了。"),
      ],
      lab: { file: "labs/m08_skills/route_eval.py", region: "route-eval" },
      run: "python3 -m labs.m08_skills.route_eval",
      output: "m08.eval",
      verify: t("On 12 unseen requests the lab router scores 0.667 and names its 4 misses. That is the starting number to improve, with gold and exemplars kept apart.", "在 12 条没见过的请求上，lab 路由器得分 0.667，并列出了 4 条误判。这是要改进的起点，金标准和示例始终分开。"),
      needs: [
        { step: "skills.match", what: t("the router to score", "要评分的路由器") },
        { step: "evaluation.seal", what: t("the sealing mechanism", "封存机制") },
      ],
      produces: t("A routing accuracy number that moves when exemplars change.", "一个会随示例变化而变化的路由准确率。"),
    },
  ],
  together: [
    { with: "harness", how: t("The harness calls the router during prompt composition and logs the skill name.", "Harness 在组装提示词时调用路由器，并记录技能名。") },
    { with: "guardrails", how: t("The guard treats turns with a data skill as data turns and judges them strictly.", "护栏把加载了数据类技能的轮次视为数据轮次，并从严判断。") },
    { with: "self-evolving", how: t("Learned rules are appended the same way a skill is: as text in the prompt, gated by evals.", "学到的规则与技能的接入方式相同：作为提示词里的文本，并由评估把关。") },
    { with: "multi-agent", how: t("A worker's narrow instructions are a skill that is always on for that worker.", "子智能体的专门指令，相当于对它始终生效的技能。") },
  ],
  failures: [
    {
      when: "2026-09",
      title: t("Keyword overlap picked the wrong skill", "关键词重合选错了技能"),
      what: t("Matching on words shared with the description routed requests by vocabulary and missed paraphrases.", "靠与描述的词汇重合来匹配，结果是按用词路由，换个说法就匹配不上。"),
      fix: t("Route by natural-language examples, with descriptions as a fallback.", "改为按自然语言示例路由，描述只作为兜底。"),
      lesson: t("Route on what people ask, in their words.", "按人们实际提问的方式、用他们的原话来做路由。"),
    },
    {
      when: "2026-09",
      title: t("Every request loaded some skill", "每个请求都加载了某个技能"),
      what: t("With no examples of requests that need nothing, the closest skill always won.", "由于没有“什么都不需要”的示例，总是由最接近的技能胜出。"),
      fix: t("A `_none` list and a margin the winner must clear.", "增加 `_none` 列表，并要求胜出者必须超过一定幅度。"),
      lesson: t("A classifier needs examples of the empty class.", "分类器需要“空类别”的示例。"),
    },
  ],
  portability: {
    databricks: t("No native skill format. Store skill files in a volume and load them in your agent code, or register prompts in the prompt registry.", "没有原生的技能格式。把技能文件存在 volume 里，由智能体代码加载；或者在 prompt registry 里登记提示词。"),
    watsonx: t("Agent instructions and per-agent guidelines play this role. Narrow collaborator agents are the platform's way to scope instructions.", "智能体的 instructions 和各自的 guidelines 起到这个作用。平台用职责单一的协作智能体来限定指令范围。"),
    codex: t("Skills are supported as folders with a SKILL.md. The lab skill bodies move over with small edits.", "支持技能，形式是带 SKILL.md 的文件夹。lab 的技能正文稍作修改即可迁移。"),
    cursor: t("Rules files scoped by path or description, plus skills. The description line does the same matching job.", "有按路径或描述限定范围的规则文件，也有技能。描述那一行承担同样的匹配作用。"),
    claude: t("Native. A folder per skill with a SKILL.md whose description decides when it loads.", "原生支持。每个技能一个文件夹，内含 SKILL.md，由其中的描述决定何时加载。"),
    other: t("Markdown files and a short loader. Fully portable.", "Markdown 文件加一个简短的加载器。完全可移植。"),
  },
  checks: [
    {
      q: t("Why at most one skill per request?", "为什么每个请求最多一个技能？"),
      a: t("A skill is a narrow instruction set. Stacking several dilutes each and raises prompt cost on every turn.", "技能是一组专门的指令。叠加多个会相互稀释，并且每一轮的提示词开销都会增加。"),
    },
    {
      q: t("What is the difference between a skill and a tool?", "技能和工具有什么区别？"),
      a: t("A tool does something and returns data. A skill tells the model how to approach a class of task, including which tools to use and in what order.", "工具执行某个操作并返回数据。技能告诉模型如何处理某一类任务，包括用哪些工具、按什么顺序。"),
    },
    {
      q: t("Why keep routing examples and routing gold in separate files?", "为什么路由示例和路由标准集要放在不同文件？"),
      a: t("The router matches against the examples. If gold items are in that file, the eval measures lookup of known strings and stops measuring routing.", "路由器是对着示例做匹配的。如果标准集的条目也在里面，评估测的就变成了“查找已知字符串”，而不再是路由能力。"),
    },
    {
      q: t("What does the `_none` list do?", "`_none` 列表起什么作用？"),
      a: t("It competes like a skill. A greeting is closer to `_none` than to any skill, so nothing loads. Without it the nearest skill always wins.", "它像技能一样参与竞争。问候语离 `_none` 比离任何技能都近，于是不加载任何技能。没有它，最接近的技能总会胜出。"),
    },
  ],
  terms: [
    { term: t("Frontmatter", "Frontmatter"), def: t("The block between `---` lines at the top of a file that holds metadata.", "文件顶部两行 `---` 之间存放元数据的部分。") },
    { term: t("Exemplar", "示例"), def: t("A real request stored as an example of what a skill should handle.", "作为“该技能应处理的请求”样例而保存的真实请求。") },
    { term: t("Margin", "幅度"), def: t("How much the best skill must beat `_none` by.", "得分最高的技能必须超过 `_none` 多少。") },
  ],
};
