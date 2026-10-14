import { t } from "@/lib/types";
import type { Stage } from "./types";

const K = "native/contract-triage/overlay/";

export const stage1: Stage = {
  id: "s1",
  n: "1",
  title: t("Stage 1: public data foundation on Databricks", "第 1 阶段：在 Databricks 上打好公共数据基础"),
  dates: t("Oct. 19 to 25 · about 22 hours", "10 月 19 日至 25 日 · 约 22 小时"),
  goal: t(
    "Turn the public sources into governed Delta tables in Unity Catalog: bronze as landed, silver one row per award, gold the views the tools read, refreshed by a job and checked for quality. The same SQL files run on your laptop in DuckDB and on Databricks in Spark, so you can predict a job's result before you run it, and a judge can rebuild the tables without a workspace.",
    "把公共数据源变成 Unity Catalog 中受治理的 Delta 表：bronze 保持原样，silver 每个合同一行，gold 是工具读取的视图，由 job 刷新并做质量检查。同一套 SQL 文件既在笔记本上用 DuckDB 运行，也在 Databricks 上用 Spark 运行，所以运行 job 之前你就能预知结果，评委也无需工作区就能重建这些表。",
  ),
  steps: [
    {
      id: "rename",
      bp: "1.1",
      title: t("Rename the package and push", "重命名包并推送"),
      what: t("example_server becomes contract_triage across src, tests, pyproject, main.py, Dockerfile, manifest.yaml, server.json and deploy/databricks/app.yaml, in one commit, with CI green.", "example_server 在 src、tests、pyproject、main.py、Dockerfile、manifest.yaml、server.json 和 deploy/databricks/app.yaml 中统一改为 contract_triage，一次提交完成，CI 为绿色。"),
      why: t("Judges read names first, and the rename touches files that every later step edits; doing it before any server code exists makes it a pure find-and-replace that the template's own tests can verify. Use `git grep`, not `grep -r`: uv writes an editable-install file under the old name into .venv, which is not source.", "评委最先看的是命名，而且改名会涉及后面每一步都要编辑的文件；在还没有任何服务器代码时做，它就只是纯粹的查找替换，模板自带的测试就能验证。用 `git grep` 而不是 `grep -r`：uv 会在 .venv 中写一个旧名字的可编辑安装文件，它不是源码。"),
      how: [
        { t: t("Run the kit's rename on a clean tree. It does git mv, replaces both spellings in every tracked text file, and refreshes uv.lock.", "在干净的工作树上运行工具包的改名脚本。它执行 git mv，在每个受跟踪的文本文件中替换两种写法，并刷新 uv.lock。"), c: [{ w: "repo", code: `git status --short          # must print nothing
bash scripts/rename_package.sh` }] },
        { t: t("Test, commit, push, and watch CI.", "测试、提交、推送，并观察 CI。"), c: [{ w: "repo", code: `uv sync --group dev && uv run pytest tests/ -q
git add -A && git commit -m "Rename example_server to contract_triage" && git push
gh run watch` }] },
      ],
      files: [K + "scripts/rename_package.sh"],
      test: [{ w: "repo", code: `git grep -i example_server -- ':!uv.lock' ':!scripts/rename_package.sh' | wc -l`, expect: t("0, then 26 passed, then a green CI run.", "0，然后 26 passed，然后是绿色的 CI 运行。") }],
      replay: ["rename"],
      trouble: [
        { s: t("commit or stash your changes first", "commit or stash your changes first"), c: t("The tree has uncommitted edits; the script refuses so a rename never mixes with other work.", "工作树有未提交的修改；脚本拒绝执行，以免改名和其他改动混在一起。"), f: t("Commit or `git stash`, then rerun.", "提交或执行 `git stash`，再重新运行。") },
        { s: t("CI fails on ruff format", "CI 在 ruff format 上失败"), c: t("A file you edited by hand is not formatted.", "你手工编辑过的文件没有格式化。"), f: t("`uv run ruff format .`, commit, push.", "执行 `uv run ruff format .`，提交并推送。") },
      ],
      done: t("The grep is empty and CI is green.", "grep 结果为空，CI 为绿色。"),
      after: ["template-local"],
      ran: "replayed",
      hours: 1,
    },
    {
      id: "laptop-pipeline",
      bp: "1.2L",
      title: t("Run the whole pipeline on your laptop first", "先在笔记本上跑通整个流水线"),
      what: t("bronze, silver, gold, the data quality checks and a snapshot, built in DuckDB from the synthetic fixture and then from real GSA archive files.", "在 DuckDB 中用合成样例、再用真实的 GSA 归档文件，构建 bronze、silver、gold、数据质量检查和快照。"),
      why: t("scripts/local_pipeline.py executes the same sql/*.sql files and the same checks as the Databricks notebooks. A wrong join shows up here in seconds, with no warehouse cost, and the files it downloads are exactly what you upload to the volume if egress is blocked. It also proves the SQL runs on two engines, which is what keeps the keyless judge path honest.", "scripts/local_pipeline.py 执行与 Databricks notebook 完全相同的 sql/*.sql 文件和同样的检查。错误的关联在这里几秒钟就能暴露，不花 warehouse 费用；它下载的文件，正是出网受限时你要上传到 volume 的文件。它还证明这套 SQL 能在两个引擎上运行，这保证了评委无需密钥的路径是可信的。"),
      how: [
        { t: t("Synthetic fixture first: 17 actions, 11 awards, every expected value known. The DuckDB file stays out of git.", "先用合成样例：17 条动作、11 个合同，每个预期值都已知。DuckDB 文件不进入 git。"), c: [{ w: "repo", code: `grep -qx '*.duckdb' .gitignore || echo '*.duckdb' >> .gitignore
uv run --with duckdb python scripts/local_pipeline.py --csv tests/fixtures/usas_tx.csv \\
  --sam-json tests/fixtures/sam_closed.json --data-date 2026-10-06 \\
  --out /tmp/triage-snap --db /tmp/triage-fixture.duckdb` }] },
        { t: t("Then real data. List the GSA files, download one year to start (each year is one or more GB), and build.", "然后用真实数据。列出 GSA 文件，先下载一年（每年一个或多个 GB），再构建。"), c: [{ w: "repo", code: `python3 scripts/fetch_usaspending.py --agency 047 --fy 2022-2026 --list
python3 scripts/fetch_usaspending.py --agency 047 --fy 2026 --out ~/data/usas
uv run --with duckdb python scripts/local_pipeline.py --csv ~/data/usas --db local.duckdb --out /tmp/triage-snap-gsa` }] },
      ],
      files: [K + "scripts/local_pipeline.py", K + "scripts/fetch_usaspending.py", K + "pipelines/common.py"],
      test: [{ w: "repo", expect: t("Fixture: 17 bronze rows, 11 silver awards, 5 ending, 5 closeout rows, every dq line pass or info, agreement 0.6667, exit code 0. Real files: row counts in the thousands, awards_with_end_date at or above 0.95. A fail line exits 1 and names the check.", "合成样例：17 行 bronze、11 个 silver 合同、5 条即将到期、5 条结案候选，每条 dq 结果都是 pass 或 info，一致率 0.6667，退出码 0。真实文件：行数以千计，awards_with_end_date 不低于 0.95。出现 fail 行时退出码为 1，并写明是哪项检查。") }],
      replay: ["local-pipeline", "local-pipeline-real"],
      trouble: [
        { s: t("Binder Error: column not found", "Binder Error: column not found"), c: t("A CSV lacks one of the 36 bronze columns: it is not a contracts archive (an assistance file, or a custom download).", "某个 CSV 缺少 36 个 bronze 列之一：它不是合同归档（可能是资助类文件或自定义下载）。"), f: t("Use *_Contracts_Full_* files only; fetch_usaspending.py picks them for you.", "只用 *_Contracts_Full_* 文件；fetch_usaspending.py 会替你挑选。") },
        { s: t("fetch_usaspending.py: URLError", "fetch_usaspending.py：URLError"), c: t("A proxy or VPN blocks api.usaspending.gov.", "代理或 VPN 拦截了 api.usaspending.gov。"), f: t("Try off VPN, or download the zips in a browser from usaspending.gov > Download Center > Award Data Archive into ~/data/usas.", "关掉 VPN 再试，或者在浏览器中从 usaspending.gov > Download Center > Award Data Archive 下载 zip 到 ~/data/usas。") },
      ],
      done: t("Both runs exit 0.", "两次运行都以 0 退出。"),
      after: ["uc-egress"],
      ran: "replayed",
      hours: 2,
      unconfirmed: t("The replay ran on a 12,000-row sample of the DoD (097) FY2026 archive from the AI_DATA drive; no GSA file was downloaded here. The finding it produced is real: of 11,976 DoD awards, 11,149 ended without a K action, and only 89 of those had $250,000 or more obligated. Small purchases are rarely closed with a K action, which is why the closeout tool has a min_obligation filter.", "回放使用的是 AI_DATA 盘上 DoD（097）FY2026 归档的 12,000 行样本；这里没有下载 GSA 文件。它得出的发现是真实的：11,976 个 DoD 合同中，11,149 个结束时没有 K 动作，其中只有 89 个的已承付金额在 25 万美元及以上。小额采购很少用 K 动作结案，所以结案工具设有 min_obligation 过滤。"),
    },
    {
      id: "bronze-usas",
      bp: "1.2",
      title: t("Land the USAspending archive in bronze on Databricks", "在 Databricks 上把 USAspending 归档落到 bronze"),
      what: t("bronze_usas_contract_tx: every GSA (047) contract action for FY2022 to FY2026, all values as text, with _source_file and _loaded_at, plus the data date in meta_freshness.", "bronze_usas_contract_tx：GSA（047）2022 至 2026 财年的每条合同动作，所有值都以文本保存，带 _source_file 和 _loaded_at，并在 meta_freshness 中记录数据日期。"),
      why: t("Bulk files are the only public source with every action, which the option, funding and closeout logic needs. Text columns mean one bad date cannot fail the load; typing happens in silver with TRY_CAST. The archive is split into numbered CSVs (_1.csv, _2.csv) inside each zip, and descriptions contain line breaks, so the reader uses multiLine and the count check uses Python's csv module, not `wc -l`.", "批量文件是唯一包含每条动作的公共数据源，期权、拨款和结案逻辑都需要它。用文本列保存，一个错误的日期就不会让加载失败；类型转换放在 silver 中用 TRY_CAST 完成。每个 zip 里的归档被拆成编号的 CSV（_1.csv、_2.csv），描述字段中含有换行，所以读取时用 multiLine，计数检查用 Python 的 csv 模块而不是 `wc -l`。"),
      how: [
        { t: t("If egress works: open pipelines/01_bronze_usaspending, set catalog, mode download, and Run all. The first run downloads several GB.", "如果能出网：打开 pipelines/01_bronze_usaspending，设置 catalog，mode 选 download，然后 Run all。第一次运行会下载数 GB。"), c: [{ w: "dbx-nb", code: "pipelines/01_bronze_usaspending | catalog = <your catalog> | agency = 047 | fy_from = 2022 | fy_to = 2026\nmode = download | verify_counts = yes (first run) | Run all" }] },
        { t: t("If egress is blocked: upload the zips you downloaded in 1.2L, then run with mode volume.", "如果出网受限：上传你在 1.2L 中下载的 zip，然后用 mode volume 运行。"), c: [{ w: "repo", code: `python3 scripts/fetch_usaspending.py --agency 047 --fy 2022-2026 --out ~/data/usas
databricks fs mkdir "dbfs:/Volumes/$CATALOG/contract_triage/raw/usas" -p "$PROFILE"
for f in ~/data/usas/*.zip; do databricks fs cp "$f" "dbfs:/Volumes/$CATALOG/contract_triage/raw/usas/" --overwrite -p "$PROFILE"; done` }] },
      ],
      files: [K + "pipelines/01_bronze_usaspending.py"],
      test: [{ w: "dbx-sql", code: `SELECT _source_file, COUNT(*) FROM <your_catalog>.contract_triage.bronze_usas_contract_tx GROUP BY 1 ORDER BY 1;
SELECT * FROM <your_catalog>.contract_triage.meta_freshness;`, expect: t("One row per CSV part for every fiscal year 2022 to 2026, and a data_date equal to the newest archive's date. With verify_counts = yes the notebook prints OK for every file (CSV records equal table rows).", "2022 至 2026 每个财年的每个 CSV 分片各一行，data_date 等于最新归档的日期。verify_counts = yes 时，notebook 对每个文件都输出 OK（CSV 记录数等于表行数）。") }],
      trouble: [
        { s: t("StopIteration in download_archives", "download_archives 中出现 StopIteration"), c: t("list_agencies returned no row with toptier_code 047.", "list_agencies 没有返回 toptier_code 为 047 的行。"), f: t("Run `python3 scripts/fetch_usaspending.py --list` on the laptop; if it works there, egress from the workspace is filtered: use mode volume.", "在笔记本上运行 `python3 scripts/fetch_usaspending.py --list`；如果在那里能成功，说明工作区出网被过滤：改用 mode volume。") },
        { s: t("A file shows BAD in verify_counts", "verify_counts 中某个文件显示 BAD"), c: t("A partial download or an unescaped quote.", "下载不完整，或引号未转义。"), f: t("Delete that zip and its csv folder in the volume, rerun; the download skips files with the right size.", "删除 volume 中该 zip 及其 csv 文件夹，重新运行；下载时会跳过大小正确的文件。") },
      ],
      done: t("bronze holds every fiscal year and the counts match.", "bronze 包含每个财年，计数一致。"),
      after: ["laptop-pipeline", "office-hours-1"],
      ran: "you",
      unconfirmed: t("Not run on Databricks for this page. The list_agencies and list_monthly_files calls are the ones your own collector on the AI_DATA drive uses every night; `_metadata.file_path` is the Unity Catalog way to get the source file name.", "本页没有在 Databricks 上运行过。list_agencies 和 list_monthly_files 这两个调用，与你 AI_DATA 盘上的采集程序每晚使用的相同；`_metadata.file_path` 是 Unity Catalog 中获取源文件名的方式。"),
      hours: 4,
    },
    {
      id: "bronze-sam",
      bp: "1.3",
      title: t("Land SAM.gov closeout records in bronze", "把 SAM.gov 结案记录落到 bronze"),
      what: t("A secret scope holding your SAM.gov key, and bronze_sam_awards: SAM.gov records with closedStatus = Yes for contracting department 4700, signed FY2022 to FY2026.", "一个保存 SAM.gov 密钥的 secret scope，以及 bronze_sam_awards：合同部门 4700、签订于 2022 至 2026 财年、closedStatus = Yes 的 SAM.gov 记录。"),
      why: t("The closeout logic needs only one fact from SAM.gov: is this award closed. Asking for closed records alone keeps the pull to a few hundred calls, inside a 1,000-a-day key, instead of every modification of every award. The key is read with dbutils.secrets.get and never printed. Because only closed records load, the blueprint's \"award count within 5 percent\" check becomes \"closed PIIDs found in USAspending\", which 1.6 measures.", "结案逻辑只需要 SAM.gov 的一个事实：这个合同是否已结案。只请求已结案记录，调用次数就控制在几百次以内，不超过每天 1,000 次的额度，而不必拉取每个合同的每次修改。密钥用 dbutils.secrets.get 读取，从不打印。由于只加载已结案记录，蓝图中 “合同数相差在 5% 以内” 的检查改为 “已结案 PIID 能在 USAspending 中找到”，由第 1.6 步度量。"),
      how: [
        { t: t("Store the key in a secret scope from your .env.", "从 .env 中把密钥存入 secret scope。"), c: [{ w: "repo", code: `databricks secrets create-scope contract-triage -p "$PROFILE"
set -a; source .env; set +a
databricks secrets put-secret contract-triage sam_api_key --string-value "$SAM_API_KEY" -p "$PROFILE"
databricks secrets list-secrets contract-triage -p "$PROFILE"` }] },
        { t: t("Run the notebook in page mode (300 calls at most).", "以 page 模式运行 notebook（最多 300 次调用）。"), c: [{ w: "dbx-nb", code: "pipelines/02_bronze_sam | catalog = <your catalog> | department_code = 4700\nsigned_from = 10/01/2021 | signed_to = 09/30/2026 | mode = page | max_calls = 300 | Run all" }] },
      ],
      files: [K + "pipelines/02_bronze_sam.py"],
      test: [{ w: "dbx-sql", code: `USE CATALOG <your_catalog>; USE SCHEMA contract_triage;
SELECT COUNT(*) AS rows, COUNT(DISTINCT piid) AS piids FROM bronze_sam_awards;
-- ten random closed PIIDs, and whether USAspending has them
SELECT s.piid, COUNT(b.award_id_piid) > 0 AS in_usaspending
FROM (SELECT DISTINCT piid FROM bronze_sam_awards ORDER BY rand() LIMIT 10) s
LEFT JOIN bronze_usas_contract_tx b ON b.award_id_piid = s.piid GROUP BY s.piid;`, expect: t("The notebook's last line shows \"N of M closed records in K calls\" with N equal to M, and K well under 300. In the SQL, most of the ten random PIIDs show in_usaspending = true.", "notebook 最后一行显示 “N of M closed records in K calls”，N 等于 M，K 远小于 300。SQL 中，十个随机 PIID 大多显示 in_usaspending = true。") }],
      trouble: [
        { s: t("HTTP 429 or the call count stops at max_calls", "HTTP 429，或调用次数停在 max_calls"), c: t("Your key is on the 10-a-day tier, or the department has more closed records than 300 pages hold.", "你的密钥是每天 10 次的档位，或者该部门的已结案记录超过 300 页。"), f: t("Check the tier (0.5). Narrow signed_from to FY2024, or try mode extract, which asks for one file.", "检查档位（0.5）。把 signed_from 缩小到 2024 财年，或改用 mode extract，它只请求一个文件。") },
        { s: t("Secret does not exist", "Secret does not exist"), c: t("Scope or key name differs from contract-triage / sam_api_key.", "scope 或 key 名称与 contract-triage / sam_api_key 不一致。"), f: t("`databricks secrets list-secrets contract-triage -p \"$PROFILE\"` must list sam_api_key.", "`databricks secrets list-secrets contract-triage -p \"$PROFILE\"` 必须列出 sam_api_key。") },
      ],
      done: t("bronze_sam_awards loads, and closed PIIDs are found in USAspending.", "bronze_sam_awards 已加载，已结案的 PIID 能在 USAspending 中找到。"),
      after: ["bronze-usas", "keys"],
      ran: "you",
      unconfirmed: t("Field paths (contractId.piid, awardDetails.transactionData.closedStatus and closedDate, awardDetails.dates.*) are from the open.gsa.gov Contract Awards page read Oct. 13; the contracting office path is not on that page, so the parser tries two. Extract mode's response format was not documented there; page mode is the default for that reason.", "字段路径（contractId.piid、awardDetails.transactionData.closedStatus 和 closedDate、awardDetails.dates.*）来自 10 月 13 日阅读的 open.gsa.gov Contract Awards 页面；该页没有写合同办公室的路径，所以解析器尝试两种写法。extract 模式的响应格式在那里没有说明；因此默认使用 page 模式。"),
      hours: 3,
    },
    {
      id: "silver",
      bp: "1.4",
      title: t("Build silver: one row per award", "构建 silver：每个合同一行"),
      what: t("silver_contract_tx (typed actions) and silver_awards (one row per contract_award_unique_key) with end dates from the latest action, summed obligations, counts of G, C, K and termination actions, and the SAM.gov closeout joined on PIID plus parent IDV.", "silver_contract_tx（已转换类型的动作）和 silver_awards（每个 contract_award_unique_key 一行）：结束日期取自最新动作，已承付金额求和，统计 G、C、K 和终止类动作的次数，并按 PIID 加上级 IDV 关联 SAM.gov 的结案信息。"),
      why: t("Tools ask about awards, not actions. The join uses the parent IDV as well as the PIID because two task orders under different IDVs can share a PIID; the fixture has exactly that case and the test proves the order is not closed by its neighbor's SAM.gov record. Base awards carry an empty action_type_code in the real archive, so silver turns empty codes into NULL rather than inventing a type.", "工具问的是合同，而不是动作。关联时同时使用上级 IDV 和 PIID，因为不同 IDV 下的两个任务订单可能共用一个 PIID；合成样例正好包含这种情况，测试证明该订单不会因为邻居的 SAM.gov 记录而被误判为已结案。真实归档中基础合同的 action_type_code 为空，所以 silver 把空代码转为 NULL，而不是臆造一个类型。"),
      how: [{ t: t("Run the silver and gold notebook (it runs the six SQL files in order).", "运行 silver 和 gold 的 notebook（它按顺序运行六个 SQL 文件）。"), c: [{ w: "dbx-nb", code: "pipelines/03_silver_gold | catalog = <your catalog> | Run all" }] }],
      files: [K + "sql/silver_contract_tx.sql", K + "sql/silver_awards.sql", K + "pipelines/03_silver_gold.py"],
      test: [
        { w: "dbx-nb", expect: t("The last cell shows 47QFLA20C0002 with current_end 2025-08-05 and obligations 195552467.34, the values the USAspending API showed on Oct. 11.", "最后一个单元格显示 47QFLA20C0002，current_end 为 2025-08-05，obligations 为 195552467.34，与 10 月 11 日 USAspending API 显示的数值一致。") },
        { w: "dbx-sql", code: `SELECT COUNT(*) - COUNT(DISTINCT award_key) AS duplicates FROM <your_catalog>.contract_triage.silver_awards;`, expect: t("0.", "0。") },
      ],
      replay: ["tests"],
      trouble: [
        { s: t("47QFLA20C0002 shows another end date", "47QFLA20C0002 显示了另一个结束日期"), c: t("A newer archive has a later modification. The blueprint's value is from Oct. 11.", "更新的归档中有更晚的修改。蓝图中的数值来自 10 月 11 日。"), f: t("Trace it with scripts/hand_check.py (2.7); if the latest action says so, the new value is right.", "用 scripts/hand_check.py（2.7）追溯；如果最新动作就是这样写的，新数值就是对的。") },
        { s: t("Duplicates above 0", "重复数大于 0"), c: t("Two vintages of one fiscal year were loaded (dq check duplicate_transaction_keys fails too).", "同一财年的两个版本都被加载了（dq 检查 duplicate_transaction_keys 也会失败）。"), f: t("Keep one zip per year in the volume; the notebook keeps the newest per year.", "volume 中每年只保留一个 zip；notebook 会保留每年最新的那个。") },
      ],
      done: t("One row per award; the check award matches.", "每个合同一行；核对用的合同数值一致。"),
      after: ["bronze-sam"],
      ran: "you",
      hours: 3,
    },
    {
      id: "gold",
      bp: "1.5",
      title: t("Build the gold views", "构建 gold 视图"),
      what: t("Four views the tools read directly: gold_offices, gold_contracts_ending, gold_closeout_candidates, gold_vendor_share (with each vendor's share and the office-year HHI).", "工具直接读取的四个视图：gold_offices、gold_contracts_ending、gold_closeout_candidates、gold_vendor_share（含每个供应商的份额和办公室年度 HHI）。"),
      why: t("Business rules live in reviewed SQL, so tool code stays thin and testable. Windows are measured from the data date, not today, so an answer and the eval set stay the same from one day to the next. Shares count vendors with positive net obligations, so a deobligation cannot produce a negative share. No date arithmetic sits in the SQL: DuckDB and Spark disagree on it, and the tools compute day counts in Python.", "业务规则放在经过审查的 SQL 中，工具代码因此保持精简、易于测试。时间窗口从数据日期而不是今天算起，所以答案和评估集不会每天变化。份额只计算净承付金额为正的供应商，因此撤销承付不会产生负份额。SQL 中没有日期运算：DuckDB 和 Spark 对此的写法不同，天数由工具在 Python 中计算。"),
      how: [{ t: t("Already built by 03_silver_gold. Check one office's HHI by hand: export its FY2025 shares and square them in a spreadsheet.", "03_silver_gold 已经建好了。手工核对一个办公室的 HHI：导出它 2025 财年的份额，在电子表格中平方求和。"), c: [{ w: "dbx-sql", code: `SELECT recipient_uei, obligations, share, hhi
FROM <your_catalog>.contract_triage.gold_vendor_share
WHERE awarding_office_code = '<office>' AND fiscal_year = 2025
ORDER BY obligations DESC;
-- spreadsheet: =SUMPRODUCT((100*C2:C999)^2) must equal the hhi column` }] }],
      files: [K + "sql/gold_offices.sql", K + "sql/gold_contracts_ending.sql", K + "sql/gold_closeout_candidates.sql", K + "sql/gold_vendor_share.sql"],
      test: [{ w: "dbx-sql", code: `USE CATALOG <your_catalog>; USE SCHEMA contract_triage;
SELECT 'ending' v, COUNT(*) FROM gold_contracts_ending UNION ALL
SELECT 'closeout', COUNT(*) FROM gold_closeout_candidates UNION ALL
SELECT 'vendor', COUNT(*) FROM gold_vendor_share UNION ALL
SELECT 'offices', COUNT(*) FROM gold_offices;`, expect: t("Four non-zero counts, and the spreadsheet HHI equals the view's. On the fixture the same check is a test: HHI 5071.4 for office TSTA01 in FY2025 (89/159 and 70/159 of 1,590,000).", "四个非零计数，电子表格算出的 HHI 与视图一致。在合成样例上，同样的检查是一个测试：TSTA01 办公室 2025 财年的 HHI 为 5071.4（1,590,000 中的 89/159 和 70/159）。") }],
      replay: ["tests"],
      trouble: [{ s: t("gold_contracts_ending is empty", "gold_contracts_ending 为空"), c: t("meta_freshness has no row, so the data date is NULL and every comparison is false.", "meta_freshness 没有行，数据日期为 NULL，所有比较都为假。"), f: t("Rerun 01_bronze_usaspending; it writes the data date at the end.", "重新运行 01_bronze_usaspending；它会在最后写入数据日期。") }],
      done: t("Each view returns rows, and one HHI matches a hand calculation.", "每个视图都有返回行，并且有一个 HHI 与手工计算一致。"),
      after: ["silver"],
      ran: "you",
      hours: 3,
    },
    {
      id: "dq",
      bp: "1.6",
      title: t("Write the data quality checks", "编写数据质量检查"),
      what: t("dq_results: one row per check per run, with value, threshold, comparator and result. The job task fails if any check fails.", "dq_results：每次运行、每项检查一行，包含数值、阈值、比较方式和结果。只要有一项检查失败，job 任务就失败。"),
      why: t("Public data has gaps, and measured gaps become honest limits in the evaluation document. A failing check stops the job before the app reads bad tables. The agreement between K closeouts and SAM.gov closedStatus is recorded as a finding, not a gate: if the two signals disagree, that disagreement is itself a strong evaluation story.", "公共数据存在缺口，量化后的缺口会成为评估文档中如实陈述的局限。检查失败会让 job 在应用读到坏表之前就停下。K 结案与 SAM.gov closedStatus 的一致率作为一项发现记录，而不是关卡：如果两个信号不一致，这种不一致本身就是一个很有说服力的评估故事。"),
      how: [{ t: t("Run the notebook.", "运行 notebook。"), c: [{ w: "dbx-nb", code: "pipelines/05_dq | catalog = <your catalog> | agency = 047 | api_fiscal_year = 2025 | Run all" }] }],
      files: [K + "pipelines/05_dq.py"],
      test: [
        { w: "dbx-sql", code: `SELECT check_name, value, threshold, comparator, result FROM <your_catalog>.contract_triage.dq_results
WHERE run_id = (SELECT max_by(run_id, checked_at) FROM <your_catalog>.contract_triage.dq_results);`, expect: t("Seven rows: pass for end date and office code coverage (0.95 or more), duplicates 0, closed SAM.gov PIIDs matched, the FY2025 total within 1 percent of the API, and an info row with the K versus SAM.gov agreement.", "七行：结束日期和办公室代码覆盖率为 pass（不低于 0.95），重复为 0，已结案的 SAM.gov PIID 能匹配上，2025 财年总额与 API 相差在 1% 以内，以及一行 info 记录 K 与 SAM.gov 的一致率。") },
        { w: "repo", code: `uv run pytest tests/test_pipeline.py -q`, expect: t("Passes, including test_duplicate_check_fails_on_broken_input: a deliberately broken input fails the duplicate check.", "通过，其中包括 test_duplicate_check_fails_on_broken_input：故意构造的错误输入会让重复检查失败。") },
      ],
      replay: ["local-pipeline"],
      trouble: [{ s: t("fy2025_obligations_vs_api fails by a wide margin", "fy2025_obligations_vs_api 差距很大"), c: t("The API endpoint may count by funding agency, or include IDVs, while silver counts awarding actions.", "API 端点可能按出资机构统计，或包含 IDV，而 silver 统计的是授予动作。"), f: t("Record the difference and its cause in docs/decisions.md; a known, explained gap is a stated limit, not a bug.", "在 docs/decisions.md 中记录差异及原因；已知且有解释的差距是陈述的局限，不是缺陷。") }],
      done: t("Every check writes a row; the broken-input test passes.", "每项检查都写入一行；错误输入测试通过。"),
      after: ["gold"],
      ran: "you",
      unconfirmed: t("Whether /api/v2/agency/047/obligations_by_award_category/ counts by awarding or funding agency was not confirmed; treat the first result as a calibration.", "未确认 /api/v2/agency/047/obligations_by_award_category/ 是按授予机构还是出资机构统计；把第一次结果当作校准。"),
      hours: 3,
    },
    {
      id: "job",
      bp: "1.7",
      title: t("Learn: schedule it as a Lakeflow Job", "学习：把它编排成 Lakeflow Job"),
      what: t("Job contract-triage-refresh: setup, bronze USAspending and bronze SAM.gov in parallel, then silver and gold, then data quality; monthly schedule, created from a JSON file in the repo.", "Job contract-triage-refresh：setup，然后 bronze USAspending 和 bronze SAM.gov 并行，接着 silver 和 gold，最后数据质量；按月调度，由仓库中的 JSON 文件创建。"),
      why: t("A scheduled, idempotent refresh is the path from prototype to maintained service, which serves mission alignment. Defining the job in a file, rendered with your names, means it is reviewed in git and can be recreated in any workspace with one command. It runs the notebooks from your Git folder, so a `repos update` is how new code reaches the job.", "可调度、幂等的刷新是从原型走向持续维护服务的路径，体现了与使命的契合。用文件定义 job，并填入你的名字，它就能在 git 中审查，并用一条命令在任何工作区重建。它运行的是 Git 文件夹中的 notebook，因此新代码通过 `repos update` 进入 job。"),
      how: [
        { t: t("Render and create the job (USAS_MODE is download, or volume if egress is blocked).", "生成并创建 job（USAS_MODE 为 download；出网受限时为 volume）。"), c: [{ w: "repo", code: `USAS_MODE=download python3 scripts/render.py pipelines/job.template.json > /tmp/job.json
JOB_ID=$(databricks jobs create --json @/tmp/job.json -p "$PROFILE" -o json | jq -r .job_id)
echo "export JOB_ID=$JOB_ID" >> ~/.contract-triage.env && echo "$JOB_ID"` }] },
        { t: t("Run it and wait (run-now waits for the result by default).", "运行并等待（run-now 默认会等待结果）。"), c: [{ w: "repo", code: `databricks jobs run-now "$JOB_ID" -p "$PROFILE" -o json | jq -r '.state.result_state, .run_page_url'` }] },
      ],
      files: [K + "pipelines/job.template.json"],
      test: [{ w: "repo", code: `databricks jobs run-now "$JOB_ID" -p "$PROFILE" -o json | jq -r .state.result_state
# then compare counts with the first run (they must be equal):
# SELECT COUNT(*) FROM <your_catalog>.contract_triage.silver_awards;`, expect: t("SUCCESS twice, and the same silver_awards count after the second run: the refresh is idempotent. The schedule is created paused; unpause it in the Jobs UI once the gate passes.", "两次都是 SUCCESS，第二次运行后 silver_awards 计数不变：刷新是幂等的。调度创建时处于暂停状态；关卡通过后在 Jobs 界面中取消暂停。") }],
      trouble: [
        { s: t("set these first: GIT_FOLDER, CATALOG", "set these first: GIT_FOLDER, CATALOG"), c: t("The session file was not loaded in this terminal.", "这个终端没有加载会话文件。"), f: t("`source ~/.contract-triage.env` and render again.", "执行 `source ~/.contract-triage.env` 后重新生成。") },
        { s: t("Task fails: notebook not found", "任务失败：notebook not found"), c: t("The Git folder does not have the notebooks yet.", "Git 文件夹中还没有这些 notebook。"), f: t("`databricks repos update \"$GIT_FOLDER\" --branch main -p \"$PROFILE\"`.", "执行 `databricks repos update \"$GIT_FOLDER\" --branch main -p \"$PROFILE\"`。") },
      ],
      done: t("Two clean runs with equal counts.", "两次干净的运行，计数一致。"),
      after: ["dq"],
      ran: "you",
      unconfirmed: t("Tasks without a cluster spec run on serverless compute when serverless jobs are enabled in the workspace; if creation fails asking for compute, ask which cluster policy participants use.", "当工作区启用了 serverless job 时，没有集群配置的任务会在 serverless 计算上运行；如果创建时报错要求指定计算资源，请询问参赛者应使用哪个集群策略。"),
      hours: 2,
    },
    {
      id: "pilots",
      bp: "1.8",
      title: t("Pick the pilot offices and measure the closeout signal", "选定试点办公室并度量结案信号"),
      what: t("Two or three office codes in docs/scope.md and in OFFICES, and the K versus SAM.gov agreement rate recorded.", "在 docs/scope.md 和 OFFICES 中写入两三个办公室代码，并记录 K 与 SAM.gov 的一致率。"),
      why: t("A fixed scope makes the tests, the snapshot and the demo repeatable. Offices with 200 to 2,000 awards and a mix of ending, ended and closed awards exercise every tool. The agreement rate decides how the closeout tool explains itself.", "固定的范围让测试、快照和演示都可重复。拥有 200 到 2,000 个合同、且同时包含即将到期、已到期和已结案合同的办公室，能覆盖每个工具。一致率决定结案工具如何解释自己。"),
      how: [{ t: t("Query candidates, choose, and write them down. GSA FAS AAS Region 5 (47QFLA) is a known candidate.", "查询候选办公室，做出选择并记下来。GSA FAS AAS Region 5（47QFLA）是一个已知的候选。"), c: [
        { w: "dbx-sql", code: `SELECT awarding_office_code, awarding_office_name, award_count, open_count, ended_count, closed_count
FROM <your_catalog>.contract_triage.gold_offices
WHERE award_count BETWEEN 200 AND 2000 AND open_count >= 5 AND ended_count >= 5 AND closed_count >= 5
ORDER BY award_count DESC LIMIT 20;` },
        { w: "repo", code: `cp "$KIT/docs/scope.md" docs/ && open -e docs/scope.md ~/.contract-triage.env
git add docs/scope.md && git commit -m "Scope: pilot offices" && git push` },
      ] }],
      files: [K + "docs/scope.md"],
      test: [{ w: "dbx-sql", code: `SELECT awarding_office_code,
  (SELECT COUNT(*) FROM <your_catalog>.contract_triage.gold_contracts_ending e WHERE e.awarding_office_code = o.awarding_office_code) AS ending,
  (SELECT COUNT(*) FROM <your_catalog>.contract_triage.gold_closeout_candidates c WHERE c.awarding_office_code = o.awarding_office_code) AS closeout,
  (SELECT COUNT(DISTINCT fiscal_year) FROM <your_catalog>.contract_triage.gold_vendor_share v WHERE v.awarding_office_code = o.awarding_office_code) AS years
FROM <your_catalog>.contract_triage.gold_offices o WHERE awarding_office_code IN ('<code1>', '<code2>');`, expect: t("Each chosen office has at least five rows in every gold view.", "每个选定的办公室在每个 gold 视图中至少有五行。") }],
      trouble: [{ s: t("No office meets every bound", "没有办公室满足全部条件"), c: t("SAM.gov closed records are few, so closed_count is low everywhere.", "SAM.gov 已结案记录很少，所以各处的 closed_count 都偏低。"), f: t("Drop the closed_count bound and say so in docs/scope.md.", "去掉 closed_count 条件，并在 docs/scope.md 中写明。") }],
      done: t("Offices chosen; agreement rate written in scope.md.", "办公室已选定；一致率已写入 scope.md。"),
      after: ["job"],
      ran: "you",
      hours: 1,
    },
    {
      id: "snapshot",
      bp: "1.9",
      title: t("Export the keyless snapshot", "导出无需密钥的快照"),
      what: t("Parquet copies of the gold views and silver_awards for the pilot offices, plus data_date.json, committed under src/contract_triage/data/.", "试点办公室的 gold 视图和 silver_awards 的 Parquet 副本，以及 data_date.json，提交到 src/contract_triage/data/ 下。"),
      why: t("A judge must be able to clone and call every table tool with no Databricks login and no API key. The snapshot backend reads these files with DuckDB through the same queries the warehouse runs, so the keyless path and the deployed path agree, and step 3.3 proves it with a parity test.", "评委必须能在没有 Databricks 登录、没有 API 密钥的情况下克隆仓库并调用每个表类工具。快照后端用 DuckDB 读取这些文件，执行与 warehouse 相同的查询，所以无密钥路径和已部署路径的结果一致，第 3.3 步用一致性测试证明这一点。"),
      how: [
        { t: t("Export on Databricks, then copy to the laptop.", "在 Databricks 上导出，再复制到笔记本。"), c: [
          { w: "dbx-nb", code: "pipelines/06_export_snapshot | catalog = <your catalog> | offices = <code1>,<code2> | Run all" },
          { w: "repo", code: `mkdir -p src/contract_triage/data
for f in gold_offices gold_contracts_ending gold_closeout_candidates gold_vendor_share silver_awards meta_freshness; do
  databricks fs cp "dbfs:/Volumes/$CATALOG/contract_triage/raw/snapshot/$f.parquet" src/contract_triage/data/ --overwrite -p "$PROFILE"
done
databricks fs cp "dbfs:/Volumes/$CATALOG/contract_triage/raw/snapshot/data_date.json" src/contract_triage/data/ --overwrite -p "$PROFILE"
ls -la src/contract_triage/data` },
        ] },
        { t: t("No workspace yet? Build the same files on the laptop from the archives you downloaded.", "还没有工作区？用你下载的归档在笔记本上生成同样的文件。"), c: [{ w: "repo", code: `uv run --with duckdb python scripts/local_pipeline.py --csv ~/data/usas --offices "$OFFICES" --db local.duckdb` }] },
      ],
      files: [K + "pipelines/06_export_snapshot.py"],
      test: [{ w: "repo", code: `du -sh src/contract_triage/data && cat src/contract_triage/data/data_date.json
git add src/contract_triage/data && git commit -m "Snapshot of gold views for the pilot offices" && git push`, expect: t("Under 50 MB, the data date you expect, and (after stage 2) `uv run python scripts/call_tool.py --list` works with no .env at all.", "小于 50 MB，数据日期符合预期，并且（第 2 阶段之后）`uv run python scripts/call_tool.py --list` 在完全没有 .env 的情况下也能运行。") }],
      replay: ["snapshot"],
      trouble: [{ s: t("Snapshot over 50 MB", "快照超过 50 MB"), c: t("An office with many awards, or silver_awards for all offices.", "某个办公室合同太多，或导出了所有办公室的 silver_awards。"), f: t("Narrow the office list; the notebook filters every table that has awarding_office_code.", "缩小办公室列表；notebook 会过滤所有带 awarding_office_code 的表。") }],
      done: t("The snapshot is committed and small.", "快照已提交且体积小。"),
      after: ["pilots"],
      ran: "replayed",
      hours: 1,
    },
    {
      id: "sources",
      bp: "1.10",
      title: t("Record dataset provenance from Data.gov", "从 Data.gov 记录数据集来源"),
      what: t("src/contract_triage/data/sources.json: each public dataset with its Data.gov v4 identifier, publisher, link and last harvested date, served as the contracts://sources resource.", "src/contract_triage/data/sources.json：每个公共数据集及其 Data.gov v4 标识、发布方、链接和最近采集日期，并作为 contracts://sources 资源提供。"),
      why: t("It lets the agent cite where every number comes from, and it ties the entry to Data.gov as the event intends. The old CKAN API returned 404 on Oct. 13; v4 at api.gsa.gov needs the api.data.gov key from 0.5.", "它让智能体能说明每个数字的出处，也按活动的意图把作品与 Data.gov 联系起来。旧的 CKAN API 在 10 月 13 日返回 404；api.gsa.gov 上的 v4 需要第 0.5 步获得的 api.data.gov 密钥。"),
      how: [{ t: t("Copy the seed file, fill it from Data.gov, commit. (After stage 2 the seed is already in place.)", "复制种子文件，用 Data.gov 填充，然后提交。（第 2 阶段之后种子文件已经就位。）"), c: [{ w: "repo", code: `mkdir -p src/contract_triage/data && cp -n "$KIT/src/contract_triage/data/sources.json" src/contract_triage/data/
set -a; source .env; set +a
python3 scripts/datagov_sources.py           # look first
python3 scripts/datagov_sources.py --write
git add src/contract_triage/data/sources.json && git commit -m "Dataset provenance from Data.gov v4" && git push` }] }],
      files: [K + "src/contract_triage/data/sources.json", K + "scripts/datagov_sources.py"],
      test: [{ w: "repo", code: `jq -r '.sources[].link' src/contract_triage/data/sources.json | while read u; do printf "%s %s\\n" "$(curl -s -o /dev/null -w '%{http_code}' -L "$u")" "$u"; done`, expect: t("200 for every link. A source with no Data.gov record keeps its link and an empty identifier; say so in the README.", "每个链接都返回 200。没有 Data.gov 记录的数据源保留链接、标识留空；在 README 中说明。") }],
      trouble: [{ s: t("429 OVER_RATE_LIMIT", "429 OVER_RATE_LIMIT"), c: t("DEMO_KEY or a key used heavily this hour.", "使用了 DEMO_KEY，或这个小时内密钥用得太多。"), f: t("Use your own key; the block lifts after one hour.", "使用你自己的密钥；一小时后解除限制。") }],
      done: t("sources.json lists every source in this guide's source table.", "sources.json 列出了本指南数据源表中的每个来源。"),
      after: ["keys"],
      ran: "you",
      hours: 1,
    },
  ],
  gate: {
    id: "g1",
    title: t("Gate G1 (Sun. Oct. 25)", "G1 关卡（10 月 25 日周日）"),
    rows: [
      { check: t("Gold views populated for pilot offices", "试点办公室的 gold 视图已有数据"), pass: t("Five or more rows in each view per office (1.8 query)", "每个办公室在每个视图中五行以上（1.8 的查询）"), fail: t("Narrow to one office and FY2024 to 2026", "缩小到一个办公室和 2024 至 2026 财年") },
      { check: t("Data quality", "数据质量"), pass: t("End date and office code 0.95 or more; no duplicates", "结束日期和办公室代码不低于 0.95；无重复"), fail: t("Fix silver; rerun", "修复 silver；重新运行") },
      { check: t("Closeout signals", "结案信号"), pass: t("Agreement measured in dq_results", "一致率已记录在 dq_results 中"), fail: t("Use K only and state the limit", "只用 K，并说明这一局限") },
      { check: t("Job", "Job"), pass: t("Two SUCCESS runs with equal counts", "两次 SUCCESS 运行，计数一致"), fail: t("Run the notebooks by hand; note it", "手工运行 notebook；记录下来"), cmd: `databricks jobs list-runs --job-id "$JOB_ID" -p "$PROFILE" -o json | jq -r '.[].state.result_state' | head -2` },
    ],
  },
};
