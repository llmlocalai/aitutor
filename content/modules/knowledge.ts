import { t, type Module } from "@/lib/types";

export const knowledge: Module = {
  id: "knowledge",
  n: 3,
  layer: 0,
  title: t("Knowledge management", "知识管理"),
  short: t(
    "Collect, validate, name, tier, and retire documents before any index sees them.",
    "在任何索引接触文档之前，先完成收集、校验、命名、分级和退役。",
  ),
  what: t(
    "Knowledge management is the pipeline and the rules that decide what enters the knowledge bank: where documents come from, how they are validated and filed, which are authoritative, and when a document is retired.",
    "知识管理是一套流程和规则，决定什么能进入知识库：文档从哪里来、如何校验和归档、哪些是权威来源、何时让一份文档退役。",
  ),
  why: t(
    "Retrieval ranks whatever it is given. The reference build's own guide calls this work 90 percent librarianship and 10 percent technology. Folder taxonomy, file names, and pruning duplicates moved quality more than any algorithm change.",
    "检索只会对给它的内容排序。参考系统自己的指南把这项工作称为 90% 的图书管理加 10% 的技术。目录分类、文件命名和清理重复，对质量的提升超过任何算法改动。",
  ),
  how: [
    t("New files land in an inbox. A validation step checks type by content and rejects error pages saved as documents.", "新文件先进入收件箱。校验步骤按内容检查文件类型，拒绝被保存成文档的错误页面。"),
    t("A ledger records every file with its content hash, authority tier, and status. Re-scans skip unchanged files.", "台账记录每个文件的内容哈希、权威等级和状态。重复扫描时跳过未变化的文件。"),
    t("Path rules assign each source a tier. Primary rules outrank guides, which outrank commentary.", "路径规则为每个来源分配等级。正式规定高于指南，指南高于评论。"),
    t("A retired file stays in the ledger with a reason. The index skips it.", "退役的文件仍留在台账里并注明原因，索引会跳过它。"),
  ],
  prereqs: [],
  inBuild: [
    { path: "KNOWLEDGE_MANAGEMENT_GUIDE.md", role: t("The three-tier plan: vector search, curated wiki, graph.", "三层规划：向量检索、人工整理的 wiki、图。") },
    { path: "knowledge-bank/_inbox/", role: t("Drop zone for new files.", "新文件的投放区。") },
    { path: "knowledge-bank/source_authority.json", role: t("Path rules for authority tiers.", "权威等级的路径规则。") },
    { path: "apps/llm-wiki/llm_wiki.py", role: t("Drafts one page per concept for human review.", "为每个概念起草一页，交人工审核。") },
  ],
  flow: {
    caption: t("From a downloaded file to something the index may read", "从下载的文件到索引可以读取的内容"),
    stages: [
      { label: t("Inbox", "收件箱"), detail: t("Every new file starts here. Nothing is indexed from the inbox.", "所有新文件从这里开始。收件箱里的内容不会被索引。"), kind: "input" },
      { label: t("Validate", "校验"), detail: t("Leading bytes must match the extension. Empty files and HTML saved as text are rejected.", "文件头字节必须与扩展名匹配。空文件和被存成文本的 HTML 会被拒绝。"), kind: "check" },
      { label: t("File", "归档"), detail: t("Move into the collection folder that matches its kind.", "移入与其类别对应的集合目录。"), kind: "store" },
      { label: t("Ledger row", "写入台账"), detail: t("Hash, tier, kind, status. One row per file.", "哈希、等级、类别、状态。每个文件一行。"), kind: "store" },
      { label: t("Retire when superseded", "被取代时退役"), detail: t("Status changes and a reason is recorded. The row stays.", "状态改变并记录原因。这一行保留。"), kind: "check" },
      { label: t("Hand to the index", "交给索引"), detail: t("Only rows with status filed are indexed.", "只有状态为 filed 的行会被索引。"), kind: "output" },
    ],
  },
  steps: [
    {
      id: "taxonomy",
      title: t("Fix the folder taxonomy and file names", "确定目录分类和文件命名"),
      why: t("Path is the first signal every later step uses: the tier rules match on it, and search results cite it. It cannot be added afterward without re-filing everything.", "路径是后续每一步都会用到的第一个信号：等级规则靠它匹配，检索结果引用它。事后再补就得把所有文件重新归档。"),
      do: [
        t("Create one folder per collection. A collection is a body of documents that should never mix with another in an answer.", "每个集合建一个目录。集合是一批文档，在同一个回答里不应与其他集合混用。"),
        t("Inside it, create one folder per kind of authority: `policy/`, `guides/`, `memos/`.", "在集合内，按权威类别各建一个目录：`policy/`、`guides/`、`memos/`。"),
        t("Name files for what they are and when they apply. Avoid `final_v2`.", "文件名要说明内容和适用时间。不要用 `final_v2` 这类名字。"),
      ],
      code: { lang: "text", text: `bank/
  policy/   travel-policy.md            the rule itself        tier 1
  guides/   traveler-quick-guide.md     explains the rule      tier 2
  memos/    2026-lodging-memo.md        commentary             tier 3
inbox/      everything new lands here first` },
      verify: t("For any file you can tell its authority from its path alone.", "仅凭路径，你就能判断任何文件的权威程度。"),
      produces: t("A folder layout whose paths carry meaning.", "一个路径本身带有含义的目录结构。"),
    },
    {
      id: "validate",
      title: t("Validate files by content", "按内容校验文件"),
      why: t("It comes before filing because a bad file that reaches the bank will be chunked, embedded, and returned with confidence. On the reference build 15 files named .pdf were HTML error pages that passed a size check.", "它排在归档之前，因为坏文件一旦进入知识库，就会被切块、向量化，并被自信地返回。参考系统里有 15 个 .pdf 文件其实是 HTML 错误页，它们通过了文件大小检查。"),
      do: [
        t("For binary types, compare the leading bytes with the expected signature.", "对二进制类型，比较文件头字节与预期的签名。"),
        t("For text types, reject files that start with an HTML tag.", "对文本类型，拒绝以 HTML 标签开头的文件。"),
        t("Return the reason as a string. It goes into the ledger.", "把拒绝原因以字符串返回，它会写进台账。"),
      ],
      lab: { file: "labs/m03_knowledge/ledger.py", region: "validate" },
      verify: t("A file that is an HTML page with a .pdf name is rejected with a reason.", "一个名为 .pdf 但实际是 HTML 页面的文件被拒绝，并给出原因。"),
      produces: t("`validate()`: None when good, a reason when not.", "`validate()`：正常返回 None，异常返回原因。"),
    },
    {
      id: "tiers",
      title: t("Write the authority rules", "编写权威等级规则"),
      why: t("Tiers depend on the taxonomy and are needed by the ledger, so they sit between the two. Retrieval later uses the tier as a small ranking bonus and to choose between duplicate passages.", "等级依赖目录分类，又是台账需要的字段，所以排在两者之间。之后检索会用等级做小幅排序加分，并在重复段落中做选择。"),
      do: [
        t("Write rules as path patterns, first match wins.", "把规则写成路径模式，先匹配到的生效。"),
        t("Give anything unmatched the lowest tier. Unknown sources must not outrank known ones.", "未匹配到的一律给最低等级。来源不明的文档不能排在已知来源前面。"),
      ],
      lab: { file: "labs/m03_knowledge/ledger.py", region: "tiers" },
      verify: t("`authority('policy/x.md')` is tier 1 and `authority('downloads/x.md')` is tier 3.", "`authority('policy/x.md')` 是 1 级，`authority('downloads/x.md')` 是 3 级。"),
      needs: [{ step: "knowledge.taxonomy", what: t("folder names to match on", "用于匹配的目录名") }],
      produces: t("`authority()`: path to tier and kind.", "`authority()`：由路径得到等级和类别。"),
    },
    {
      id: "ledger",
      title: t("Create the ledger", "建立台账"),
      why: t("The ledger is the single record of what exists. Indexing, retirement, and audits all read it, so it has to exist before any of them.", "台账是“有哪些文档”的唯一记录。索引、退役和审计都读它，所以必须先于它们存在。"),
      do: [
        t("One row per file, keyed by collection and path.", "每个文件一行，以集合和路径为主键。"),
        t("Store the SHA-256 of the content. `record()` returns `unchanged` when the hash matches.", "保存内容的 SHA-256。哈希一致时 `record()` 返回 `unchanged`。"),
        t("Store status as one of: filed, indexed, retired, rejected.", "状态取值为：filed、indexed、retired、rejected。"),
      ],
      lab: { file: "labs/m03_knowledge/ledger.py", region: "ledger" },
      verify: t("Scanning the same folder twice reports every file as unchanged the second time.", "对同一目录扫描两次，第二次所有文件都显示未变化。"),
      needs: [{ step: "knowledge.tiers", what: t("tier and kind for each row", "每一行的等级和类别") }],
      produces: t("`Ledger`: the list the indexer reads.", "`Ledger`：索引程序读取的清单。"),
    },
    {
      id: "intake",
      title: t("Run intake: scan the bank and process the inbox", "执行入库：扫描知识库并处理收件箱"),
      why: t("This is the first step that uses all three earlier pieces together. It is also the routine you will repeat every week.", "这是第一个同时用到前面三个部件的步骤，也是你以后每周要重复的例行操作。"),
      do: [
        t("Run the demo. It scans the sample bank twice, then processes three inbox files.", "运行 demo。它先扫描样例知识库两次，再处理收件箱里的三个文件。"),
        t("Read the inbox lines: one file is rejected, two are filed.", "看收件箱那几行：一个文件被拒绝，两个被归档。"),
        t("Read the ledger: every file has a tier, a kind, and a status.", "看台账：每个文件都有等级、类别和状态。"),
      ],
      lab: { file: "labs/m03_knowledge/ledger.py", region: "intake" },
      run: "python3 -m labs.m03_knowledge.demo",
      output: "m03.demo",
      verify: t("The fake PDF is rejected for wrong leading bytes and the second scan reports 3 unchanged.", "假 PDF 因文件头不符被拒绝；第二次扫描显示 3 个未变化。"),
      needs: [
        { step: "knowledge.validate", what: t("validate()", "validate()") },
        { step: "knowledge.ledger", what: t("Ledger.record()", "Ledger.record()") },
      ],
      produces: t("A bank folder and a ledger that agree with each other.", "内容一致的知识库目录和台账。"),
    },
    {
      id: "retire",
      title: t("Retire, do not delete", "退役，而不是删除"),
      why: t("Retirement needs ledger rows to act on. Keeping the row lets the system explain why a passage vanished and recognize the same file if it is downloaded again.", "退役需要台账里已有记录。保留这一行，系统就能解释某段内容为什么消失，并在同一文件被再次下载时认出它。"),
      do: [
        t("Call `retire()` with a reason when a file is superseded, duplicated, or off topic.", "文件被取代、重复或跑题时，调用 `retire()` 并写明原因。"),
        t("Leave the file on disk or move it to an archive folder. The ledger status is what the index obeys.", "文件可以留在磁盘上，或移到归档目录。索引只认台账里的状态。"),
      ],
      code: { lang: "python", text: `ledger.retire("POLICY", "guides/vendor-rates.pdf", "placeholder file, superseded")` },
      verify: t("The retired file appears in the ledger with its reason and is absent from the next index run.", "退役文件在台账里带着原因出现，并且不会出现在下一次索引中。"),
      needs: [{ step: "knowledge.intake", what: t("ledger rows to change", "要修改的台账记录") }],
      produces: t("A status the indexer and the learner both respect.", "一个索引程序和学习任务都会遵守的状态。"),
    },
    {
      id: "collect",
      title: t("Add collectors with a relevance filter", "加入带相关性过滤的采集器"),
      why: t("Automation comes after the manual path works, because a collector only feeds the inbox. Without a filter it fills the bank with off-topic documents that then compete in retrieval.", "自动化要等手工流程跑通之后再做，因为采集器只是往收件箱送文件。没有过滤的话，它会把跑题的文档塞满知识库，然后在检索中抢位置。"),
      do: [
        t("For each feed, write the terms that make an item relevant.", "为每个信息源写下判断条目是否相关的关键词。"),
        t("Match broad terms on the title only. Match specific names on title and summary.", "宽泛的词只匹配标题。具体的名称可以匹配标题和摘要。"),
        t("Download matches into the inbox. Intake does the rest.", "把匹配到的条目下载到收件箱。其余交给入库流程。"),
      ],
      code: { lang: "python", text: `def relevant(item: dict, broad: set, specific: set) -> bool:
    title = item["title"].lower()
    text = title + " " + item.get("summary", "").lower()
    return any(w in title for w in broad) or any(w in text for w in specific)` },
      verify: t("A week of collected items contains nothing you would retire on sight.", "一周采集到的条目里，没有你一眼就想退役的内容。"),
      needs: [{ step: "knowledge.intake", what: t("the inbox routine that receives downloads", "接收下载文件的收件箱流程") }],
      produces: t("A scheduled source of new files, already filtered.", "一个定时运行、已经过滤的新文件来源。"),
      notExecuted: true,
    },
    {
      id: "wiki",
      title: t("Add a curated tier for judgment", "为经验判断增加一个人工整理层"),
      why: t("It is last because it is built from the bank. Source documents state rules. They do not contain your judgment about how the rules apply, and that is often what a question needs.", "它排在最后，因为它是从知识库里提炼出来的。原始文档陈述规则，但不包含你对规则如何适用的判断，而问题往往需要的正是这个。"),
      do: [
        t("For any concept you have explained twice, have a model draft a one-page note from the sources.", "凡是你解释过两次的概念，就让模型根据原始文档起草一页说明。"),
        t("Review it yourself. Only reviewed pages move into the bank, in their own folder and tier.", "由你亲自审核。只有审核过的页面才进入知识库，放在单独的目录和等级下。"),
        t("Date each page with when it was last verified.", "在每一页上注明最近一次核实的日期。"),
      ],
      verify: t("Every curated page names its sources and has a verified date.", "每一页整理内容都注明了来源和核实日期。"),
      needs: [{ step: "knowledge.intake", what: t("source documents to distill", "用于提炼的原始文档") }],
      produces: t("Reviewed concept pages that retrieval can return ahead of raw text.", "经过审核的概念页，检索时可以排在原文之前返回。"),
      notExecuted: true,
    },
  ],
  together: [
    { with: "rag-graph", how: t("The indexer reads the ledger. Tier and path become ranking signals.", "索引程序读取台账。等级和路径成为排序信号。") },
    { with: "evaluation", how: t("Held-out chunks are sampled from what was ingested. Retired files leave the gold set's pool.", "留出的文本块从已入库的内容中抽样。退役文件会从评估集的候选池中移除。") },
    { with: "self-evolving", how: t("The learner's reading queue is ordered by tier, and it skips retired files.", "学习任务的阅读队列按等级排序，并跳过退役文件。") },
    { with: "ops", how: t("Collectors and the weekly intake run on a schedule.", "采集器和每周入库按计划运行。") },
  ],
  failures: [
    {
      when: "2026-07",
      title: t("HTML error pages saved as PDFs", "HTML 错误页被存成了 PDF"),
      what: t("A size check let 15 files through that were error pages with a .pdf extension.", "文件大小检查放过了 15 个扩展名为 .pdf 的错误页面。"),
      fix: t("Check leading bytes for every binary type.", "对每种二进制类型都检查文件头字节。"),
      lesson: t("Validate what a file is, never what it is called.", "校验文件的真实内容，而不是它的名字。"),
    },
    {
      when: "2026-08",
      title: t("A 56 GB table corpus in a document folder", "文档目录里放了 56 GB 的表格数据"),
      what: t("Spending records sat in the document bank as CSV files. The ingester skipped them, so none of it was searchable, and chunking it would have produced nonsense.", "支出记录以 CSV 形式放在文档库里。入库程序跳过了它们，所以完全无法检索；如果硬去切块，只会产生无意义的内容。"),
      fix: t("Load tabular data into a query engine and expose query tools.", "把表格数据加载进查询引擎，并提供查询工具。"),
      lesson: t("Documents are retrieved. Records are queried. Decide which one you have.", "文档靠检索，记录靠查询。先判断你手里的是哪一种。"),
    },
    {
      when: "2026-10",
      title: t("One regulation stored three times", "同一份规章被存了三遍"),
      what: t("The same document existed as per-volume files and two full copies. Search results filled with one paragraph repeated.", "同一份文档既有分卷文件，又有两份完整副本。检索结果里全是同一段话的重复。"),
      fix: t("Retire duplicate copies in the ledger and collapse identical passages at query time.", "在台账里退役重复副本，并在查询时合并相同段落。"),
      lesson: t("Duplicates are a curation problem first and a ranking problem second.", "重复首先是整理问题，其次才是排序问题。"),
    },
  ],
  portability: {
    databricks: t("Land raw files in a Unity Catalog volume. Use a Lakeflow pipeline for validation and chunk tables. The ledger is a Delta table, and tier is a column.", "把原始文件放进 Unity Catalog volume。用 Lakeflow 流水线做校验并生成文本块表。台账是一张 Delta 表，等级是其中一列。"),
    watsonx: t("Store documents in watsonx.data or object storage and register them as knowledge sources. Keep the ledger and tier rules as your own tables.", "把文档存到 watsonx.data 或对象存储，并注册为知识来源。台账和等级规则仍用你自己的表维护。"),
    codex: t("Not provided. Keep the bank as a repo or bucket with the same ledger, and let agents reach it through a search tool.", "平台不提供。把知识库放在代码仓库或存储桶里，配同样的台账，让智能体通过检索工具访问。"),
    cursor: t("Not provided. Same approach: your pipeline, your ledger, exposed through a tool.", "平台不提供。做法相同：你自己的流程和台账，通过工具暴露出去。"),
    claude: t("Not provided by the coding agent. Project knowledge features hold small document sets. A large bank still needs this pipeline.", "编程智能体不提供这一层。项目知识功能只适合少量文档，大型知识库仍需要这套流程。"),
    other: t("Folders, a hash ledger, and a rules file work on any filesystem. The lab uses only the standard library.", "目录、哈希台账和规则文件在任何文件系统上都能用。lab 只用了标准库。"),
  },
  checks: [
    {
      q: t("Why keep retired files in the ledger?", "为什么要把退役文件留在台账里？"),
      a: t("So the system can explain why a passage no longer appears, and so a re-download of the same file is recognized and skipped.", "这样系统能解释某段内容为什么不再出现，而且同一文件被再次下载时能被认出并跳过。"),
    },
    {
      q: t("A folder holds 56 GB of CSV files. Should it be chunked and embedded?", "一个目录里有 56 GB 的 CSV 文件。应该切块并向量化吗？"),
      a: t("No. Tabular records are an analysis corpus. Load them into a query engine and expose query tools. Chunking rows into passages produces confident nonsense.", "不应该。表格记录是用来分析的数据。应该加载进查询引擎并提供查询工具。把数据行切成段落只会产生看似可信的胡话。"),
    },
    {
      q: t("Why do tier rules come before the ledger and after the taxonomy?", "为什么等级规则排在目录分类之后、台账之前？"),
      a: t("Rules match on folder names, so the folders must exist. The ledger stores a tier per row, so the rule must exist when the row is written.", "规则靠目录名匹配，所以目录必须先有。台账每一行都要存等级，所以写入时规则必须已经存在。"),
    },
    {
      q: t("What can you build with this module alone, before any model exists?", "在没有任何模型的情况下，仅凭这个模块能做成什么？"),
      a: t("All of it. Nothing here calls a model. That is why it is a starting point on the map.", "全部。这里没有任何一步调用模型。这也是它在地图上是起点的原因。"),
    },
  ],
  terms: [
    { term: t("Collection", "集合"), def: t("A body of documents indexed and searched as one unit, kept apart from other collections.", "作为一个整体被索引和检索的一批文档，与其他集合相互隔离。") },
    { term: t("Ledger", "台账"), def: t("The table with one row per file: hash, tier, status.", "每个文件一行的表：哈希、等级、状态。") },
    { term: t("Authority tier", "权威等级"), def: t("A trust level assigned by path rule. Tier 1 is the rule itself.", "按路径规则分配的可信度等级。1 级是规定本身。") },
  ],
};
