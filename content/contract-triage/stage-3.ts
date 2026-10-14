import { t } from "@/lib/types";
import type { Stage } from "./types";

const K = "native/contract-triage/overlay/";

export const stage3: Stage = {
  id: "s3",
  n: "3",
  title: t("Stage 3: deploy on Databricks Apps and connect a model", "第 3 阶段：部署到 Databricks Apps 并接入模型"),
  dates: t("Nov. 3 to 8 · about 16 hours", "11 月 3 日至 8 日 · 约 16 小时"),
  goal: t(
    "mcp-server-contract-triage on Databricks, reading the gold views through a SQL warehouse as its own service principal, with the SAM.gov key arriving from a secret. Then a model chosen in Playground, an exported agent for the eval, and one call from outside the workspace.",
    "mcp-server-contract-triage 运行在 Databricks 上，以自己的服务主体身份通过 SQL warehouse 读取 gold 视图，SAM.gov 密钥来自 secret。然后在 Playground 中选定模型，导出供评估使用的智能体，并从工作区外部完成一次调用。",
  ),
  steps: [
    {
      id: "app-config",
      bp: "3.1",
      title: t("Configure the app", "配置应用"),
      what: t("deploy/databricks/app.yaml rendered for your catalog, the app created, and two app resources attached: the SQL warehouse (key sql_warehouse, Can use) and the secret (key sam_api_key, Can read).", "为你的 catalog 生成 deploy/databricks/app.yaml，创建应用，并挂载两个应用资源：SQL warehouse（键 sql_warehouse，Can use）和 secret（键 sam_api_key，Can read）。"),
      why: t("The app must find the warehouse and the key without either sitting in source. valueFrom names a resource key, and Databricks injects the warehouse id and the decrypted secret as environment variables at start. The names in app.yaml and the resource keys you type in the UI must be identical, which is the most common reason a first deploy starts but every tool fails.", "应用必须能找到 warehouse 和密钥，而两者都不能出现在源码中。valueFrom 指向一个资源键，Databricks 在启动时把 warehouse id 和解密后的 secret 作为环境变量注入。app.yaml 中的名字与你在界面中输入的资源键必须完全一致，这是首次部署能启动、但每个工具都失败的最常见原因。"),
      how: [
        { t: t("Render app.yaml and the deploy settings for the real app, and create the app.", "为正式应用生成 app.yaml 和部署设置，并创建应用。"), c: [{ w: "repo", code: `python3 scripts/render.py "$KIT/deploy/databricks/app.template.yaml" > deploy/databricks/app.yaml
python3 scripts/render.py "$KIT/deploy/databricks/env.template" > deploy/databricks/.env
grep -A1 valueFrom deploy/databricks/app.yaml
databricks apps get "$APP_NAME" -p "$PROFILE" >/dev/null 2>&1 || databricks apps create "$APP_NAME" -p "$PROFILE"
git add deploy/databricks/app.yaml requirements.txt pyproject.toml && git commit -m "App config for Databricks" && git push` }] },
        { t: t("Attach the two resources. The resource key fields must read exactly sql_warehouse and sam_api_key.", "挂载两个资源。资源键字段必须严格写成 sql_warehouse 和 sam_api_key。"), c: [{ w: "dbx-ui", code: "Compute > Apps > mcp-server-contract-triage > Edit > Configure > App resources > + Add resource\n  1. SQL warehouse: <your warehouse> | Permission: Can use | Resource key: sql_warehouse\n  2. Secret: scope contract-triage, key sam_api_key | Permission: Can read | Resource key: sam_api_key\nSave" }] },
      ],
      files: [K + "deploy/databricks/app.template.yaml"],
      test: [{ w: "repo", code: `databricks apps get "$APP_NAME" -p "$PROFILE" -o json | jq '[.resources[] | {name, type: (keys - ["name","description"])[0]}]'`, expect: t("Two resources named sql_warehouse and sam_api_key. The /health check with a token comes in 3.3, after the deploy.", "两个资源，名为 sql_warehouse 和 sam_api_key。带令牌的 /health 检查在部署后的第 3.3 步进行。") }],
      trouble: [{ s: t("set these first: CATALOG", "set these first: CATALOG"), c: t("CATALOG is still a placeholder in the session file.", "会话文件中的 CATALOG 仍是占位符。"), f: t("Fill it (0.10) and render again.", "填好（0.10）后重新生成。") }],
      done: t("app.yaml is committed and both resources are attached.", "app.yaml 已提交，两个资源都已挂载。"),
      after: ["apply-server", "bronze-sam", "sandbox"],
      ran: "you",
      unconfirmed: t("Adding resources from the CLI (`databricks apps update --json`) was not confirmed against a page; the UI path above is the documented one.", "通过 CLI（`databricks apps update --json`）添加资源的方式没有对照文档确认；上面的界面操作是文档中的方式。"),
      hours: 2,
    },
    {
      id: "grants",
      bp: "3.2",
      title: t("Grant the app's service principal read access", "授予应用服务主体读权限"),
      what: t("USE CATALOG, USE SCHEMA and SELECT on <catalog>.contract_triage for the app's service principal, and nothing else.", "为应用的服务主体授予 <catalog>.contract_triage 上的 USE CATALOG、USE SCHEMA 和 SELECT 权限，此外不授予任何权限。"),
      why: t("The app queries as itself, not as you. Read-only grants are what make the tools' readOnlyHint true at the data layer, not just a label. The principal gets nothing on contract_triage_eval, the schema that holds the answer key in stage 4, so the server cannot see the answers it is graded against.", "应用以自己的身份查询，而不是以你的身份。只读授权让工具的 readOnlyHint 在数据层真正成立，而不只是一个标签。这个主体在 contract_triage_eval（第 4 阶段存放答案键的 schema）上没有任何权限，所以服务器看不到用来给它打分的答案。"),
      how: [
        { t: t("Get the principal, render the grants, and run them in the SQL editor as the catalog or schema owner.", "获取服务主体，生成授权语句，以 catalog 或 schema 所有者身份在 SQL 编辑器中运行。"), c: [{ w: "repo", code: `export APP_SP=$(databricks apps get "$APP_NAME" -p "$PROFILE" -o json | jq -r .service_principal_client_id)
echo "export APP_SP=$APP_SP" >> ~/.contract-triage.env
python3 scripts/render.py sql/grants.template.sql` }] },
        { t: t("Paste the three GRANT lines into the SQL editor and run them.", "把三行 GRANT 粘贴到 SQL 编辑器中运行。"), c: [{ w: "dbx-sql", code: "-- the three GRANT statements printed above" }] },
      ],
      files: [K + "sql/grants.template.sql"],
      test: [{ w: "dbx-sql", code: `SHOW GRANTS ON SCHEMA <your_catalog>.contract_triage;`, expect: t("The app's principal (its application id) with USE SCHEMA and SELECT only: no MODIFY, no CREATE TABLE, no ALL PRIVILEGES. A tool call from the deployed app returning gold rows (3.3) proves the read side.", "应用的服务主体（其 application id）只有 USE SCHEMA 和 SELECT：没有 MODIFY、没有 CREATE TABLE、没有 ALL PRIVILEGES。第 3.3 步中已部署应用的工具调用返回 gold 行，即证明了读权限。") }],
      trouble: [{ s: t("PERMISSION_DENIED when granting", "授权时 PERMISSION_DENIED"), c: t("You do not own the catalog.", "你不是该 catalog 的所有者。"), f: t("Send the rendered lines to the catalog owner (office hours). Fallback: DATA_BACKEND=snapshot in app.yaml.", "把生成的语句发给 catalog 所有者（答疑时）。后备方案：在 app.yaml 中设 DATA_BACKEND=snapshot。") }],
      done: t("The principal can read and cannot write.", "服务主体能读、不能写。"),
      after: ["app-config"],
      ran: "you",
      hours: 1,
    },
    {
      id: "deploy",
      bp: "3.3",
      title: t("Deploy, smoke test, and prove parity", "部署、冒烟测试并证明一致性"),
      what: t("The app RUNNING, the template's smoke test passing, and the parity script showing the deployed tables and the committed snapshot return the same award keys for a pilot office.", "应用为 RUNNING，模板的冒烟测试通过，一致性脚本显示：对一个试点办公室，已部署的数据表与已提交的快照返回相同的合同键。"),
      why: t("Playground recognizes only apps whose name starts with mcp-. Parity is the claim that a judge on the keyless path sees the same answers as the deployed app; testing it per office turns the claim into a check that fails loudly when the snapshot goes stale after a refresh.", "Playground 只识别名字以 mcp- 开头的应用。一致性是这样一个主张：走无密钥路径的评委看到的答案与已部署应用相同；按办公室测试，就把这个主张变成一项检查，快照在刷新后过期时会明确报错。"),
      how: [{ t: t("Deploy with the template's script, then test.", "用模板的脚本部署，然后测试。"), c: [{ w: "repo", code: `set -a; source deploy/databricks/.env; set +a
bash deploy/databricks/deploy-databricks-app.sh
export APP_URL=$(databricks apps get "$APP_NAME" -p "$PROFILE" -o json | jq -r .url)
echo "export APP_URL=$APP_URL" >> ~/.contract-triage.env` }] }],
      files: [K + "scripts/parity.py", K + "scripts/call_tool.py"],
      test: [{ w: "repo", code: `TOKEN="$(databricks auth token -p "$PROFILE" -o json | jq -r .access_token)"
DATABRICKS_TOKEN="$TOKEN" bash deploy/databricks/smoke-test.sh "$APP_URL"
uv run python scripts/call_tool.py --url "$APP_URL/mcp" --token "$TOKEN" --resource contracts://freshness
uv run python scripts/parity.py --office "$(echo "$OFFICES" | cut -d, -f1)" --url "$APP_URL/mcp" --token "$TOKEN"`, expect: t("PASS: health check 200 with a body containing \"backend\": \"databricks\"; freshness shows backend databricks and your data date; parity prints SAME for both list tools.", "PASS: health check 200，响应体中含 \"backend\": \"databricks\"；freshness 显示 backend databricks 和你的数据日期；一致性脚本对两个列表工具都输出 SAME。") }],
      trouble: [
        { s: t("App starts, every tool returns an error", "应用能启动，但每个工具都报错"), c: t("A resource key does not match valueFrom, or the grants are missing; the app logs say which.", "某个资源键与 valueFrom 不一致，或缺少授权；应用日志会说明是哪一个。"), f: t("Compute > Apps > the app > Logs. Fix the key name or rerun 3.2.", "查看 Compute > Apps > 该应用 > Logs。修正键名或重新执行 3.2。") },
        { s: t("parity prints DIFF", "一致性脚本输出 DIFF"), c: t("The snapshot predates the last job run.", "快照早于上一次 job 运行。"), f: t("Re-export (1.9), commit, redeploy.", "重新导出（1.9）、提交、重新部署。") },
        { s: t("ModuleNotFoundError: databricks", "ModuleNotFoundError: databricks"), c: t("requirements.txt lacks the connector; Apps installs that file.", "requirements.txt 中缺少连接器；Apps 安装的是这个文件。"), f: t("`grep databricks requirements.txt`; apply_server.sh adds both lines.", "执行 `grep databricks requirements.txt`；apply_server.sh 会加上这两行。") },
      ],
      done: t("RUNNING, smoke test passes, parity SAME.", "RUNNING、冒烟测试通过、一致性为 SAME。"),
      after: ["grants"],
      ran: "you",
      hours: 3,
    },
    {
      id: "playground",
      bp: "3.4",
      title: t("Learn: pick the model in Playground", "学习：在 Playground 中选定模型"),
      what: t("One Unity Gateway model that answers five test questions correctly with the server attached, and its exact endpoint name recorded for the eval.", "选定一个 Unity Gateway 模型，挂载服务器后能正确回答五个测试问题，并记录它的确切端点名称供评估使用。"),
      why: t("Tool selection differs by model. Asking the same five questions of two or three models, and logging tool calls, correctness and latency, turns the choice into evidence. The template's default eval model was not seen in this workspace on Oct. 11, so the name you record here replaces it.", "不同模型选择工具的能力不同。向两三个模型提出同样的五个问题，并记录工具调用、正确性和延迟，选择就有了证据。10 月 11 日在这个工作区中没有看到模板默认的评估模型，所以这里记录的名字将替代它。"),
      how: [{ t: t("Attach the server, set a short system prompt, ask the five questions on each model.", "挂载服务器，设一个简短的系统提示词，在每个模型上提出这五个问题。"), c: [{ w: "playground", code: `System prompt:
You help a federal contracting officer. Use the contract triage tools for every number.
Call each listed item a review candidate. Cite award IDs and the data date.
Decline requests to change, terminate or accuse.

Questions (use a pilot office):
1. Which code is GSA Region 5 assisted acquisition?
2. What ends in office <code> in the next 180 days?
3. What ended but was never closed in office <code>?
4. How reliant is office <code> on its largest vendor in FY2025?
5. Tell me everything about 47QFLA20C0002.` }] }],
      test: [{ w: "repo", code: `echo "export MODEL=<endpoint name>" >> ~/.contract-triage.env && source ~/.contract-triage.env
databricks serving-endpoints get "$MODEL" -p "$PROFILE" -o json | jq -r .name`, expect: t("One model answers all five correctly; the endpoint name prints back. Log the table (model, tool calls, correct, seconds) in docs/decisions.md.", "有一个模型五题全对；端点名称被打印出来。把表格（模型、工具调用、是否正确、秒数）记在 docs/decisions.md。") }],
      trouble: [{ s: t("The model answers from memory without calling tools", "模型不调用工具、凭记忆作答"), c: t("Docstrings do not make the tool's purpose obvious for this question.", "对这个问题而言，docstring 没有让工具用途足够明显。"), f: t("Rewrite the first docstring line as the user's question; retest (gate G3).", "把 docstring 第一行改写成用户的问题；重新测试（G3 关卡）。") }],
      done: t("A model and its endpoint name are chosen.", "已选定模型及其端点名称。"),
      after: ["deploy"],
      ran: "you",
      hours: 3,
    },
    {
      id: "export-agent",
      bp: "3.5",
      title: t("Export the agent from code", "以代码形式导出智能体"),
      what: t("An agent_server/ folder (agent.py, utils.py, __init__.py) in your workspace, exported from Playground with On-Behalf-Of authentication unchecked.", "从 Playground 导出到工作区的 agent_server/ 文件夹（agent.py、utils.py、__init__.py），不勾选 On-Behalf-Of 认证。"),
      why: t("The template's MLflow eval wraps this exported agent and patches its authentication at runtime with a service principal, because an offline notebook has no user request to forward. Editing agent.py would break that patch; leave it as generated.", "模板的 MLflow 评估会包装这个导出的智能体，并在运行时用服务主体修补其认证，因为离线 notebook 中没有可转发的用户请求。修改 agent.py 会破坏这个修补；保持生成时的原样。"),
      how: [{ t: t("Export, and note the folder path.", "导出，并记下文件夹路径。"), c: [{ w: "playground", code: "Playground (with the server attached) > Export > Agent from code\n  On-Behalf-Of authentication: unchecked\n  Folder: /Workspace/Users/<you>/contract-triage-agent" }] }],
      test: [{ w: "mac", code: `echo "export AGENT_FOLDER=/Workspace/Users/$DBX_USER/contract-triage-agent" >> ~/.contract-triage.env && source ~/.contract-triage.env
databricks workspace list "$AGENT_FOLDER/agent_server" -p "$PROFILE"`, expect: t("agent.py, utils.py and __init__.py.", "agent.py、utils.py 和 __init__.py。") }],
      trouble: [{ s: t("No Export button", "没有 Export 按钮"), c: t("The Playground session has no tools attached, or export is not enabled.", "Playground 会话没有挂载工具，或未启用导出。"), f: t("Attach the server first; else use the Phoenix harness (4.6).", "先挂载服务器；否则使用 Phoenix 评估框架（4.6）。") }],
      done: t("The folder exists with the three files.", "文件夹存在，含这三个文件。"),
      after: ["playground"],
      ran: "you",
      hours: 1,
    },
    {
      id: "outside-client",
      bp: "3.6",
      title: t("Connect from an outside client", "从外部客户端连接"),
      what: t("One tool call from outside the workspace to $APP_URL/mcp with a bearer token: Claude Code, the MCP Inspector, or call_tool.py.", "从工作区外部携带 bearer 令牌对 $APP_URL/mcp 完成一次工具调用：使用 Claude Code、MCP Inspector 或 call_tool.py。"),
      why: t("It shows the server is a reusable building block beyond Databricks, which supports the deck's framing. Databricks Apps put workspace OAuth in front of /mcp, so every client sends Authorization: Bearer <token>; tokens from `databricks auth token` are short-lived, so regenerate one before a demo.", "它展示了服务器是可在 Databricks 之外复用的构件，支撑了演示稿的叙述。Databricks Apps 在 /mcp 前面加了工作区 OAuth，所以每个客户端都要发送 Authorization: Bearer <token>；`databricks auth token` 生成的令牌有效期很短，演示前要重新生成。"),
      how: [{ t: t("Pick one client.", "任选一个客户端。"), c: [
        { w: "repo", code: `TOKEN="$(databricks auth token -p "$PROFILE" -o json | jq -r .access_token)"
# Claude Code:
claude mcp add --transport http contract-triage "$APP_URL/mcp" --header "Authorization: Bearer $TOKEN"
# MCP Inspector: Transport Streamable HTTP, URL $APP_URL/mcp, header Authorization = Bearer <token>
npx @modelcontextprotocol/inspector` },
      ] }],
      test: [{ w: "repo", code: `uv run python scripts/call_tool.py --url "$APP_URL/mcp" --token "$TOKEN" contracts_find_office '{"query": "region 5"}'`, expect: t("Matches from the live tables. Take a screenshot for the deck.", "来自实时数据表的匹配结果。截图留作演示稿使用。") }],
      trouble: [{ s: t("401 after a while", "过一会儿出现 401"), c: t("The token expired.", "令牌已过期。"), f: t("Run the TOKEN line again.", "重新运行 TOKEN 那一行。") }],
      done: t("One call from outside works.", "一次外部调用成功。"),
      after: ["deploy"],
      ran: "you",
      hours: 1,
    },
    {
      id: "checkin",
      bp: "3.7",
      title: t("Present at the halfway check-in (Tue. Nov. 3, 12:30 p.m.)", "在中期检查中展示（11 月 3 日周二中午 12:30）"),
      what: t("Three minutes: data foundation, tools, first Playground results; feedback logged.", "三分钟：数据基础、工具、Playground 的初步结果；记录反馈。"),
      why: t("Organizer feedback arrives while there is time to act on it. Ask the deadline and the multi-server question again if still open.", "组织方的反馈来得及据此行动。如果截止日期和多服务器问题仍未明确，再问一次。"),
      how: [{ t: t("Show the dq_results, one tool call, one Playground answer.", "展示 dq_results、一次工具调用、一个 Playground 回答。") }],
      test: [{ w: "repo", code: `grep -n "2026-11-03" docs/decisions.md`, expect: t("A line with the feedback.", "一行反馈记录。") }],
      trouble: [{ s: t("Not ready to demo", "还没准备好演示"), c: t("Stage 3 is not done yet on Nov. 3.", "11 月 3 日时第 3 阶段还没完成。"), f: t("Show the local server and dq_results; that is the foundation.", "展示本地服务器和 dq_results；这就是基础。") }],
      done: t("Feedback logged.", "反馈已记录。"),
      after: ["table-tools"],
      ran: "you",
      hours: 1,
    },
  ],
  gate: {
    id: "g3",
    title: t("Gate G3 (Sun. Nov. 8)", "G3 关卡（11 月 8 日周日）"),
    rows: [
      { check: t("Deployed app reads gold views", "已部署应用能读取 gold 视图"), pass: t("freshness shows backend databricks; parity SAME", "freshness 显示 backend databricks；一致性为 SAME"), fail: t("Set DATA_BACKEND=snapshot in app.yaml and continue", "在 app.yaml 中设 DATA_BACKEND=snapshot 并继续") },
      { check: t("Playground, five questions", "Playground，五个问题"), pass: t("5 of 5 on one model", "一个模型五题全对"), fail: t("Rewrite docstrings; retest", "改写 docstring；重新测试") },
      { check: t("Agent exported", "智能体已导出"), pass: t("Folder exists", "文件夹存在"), fail: t("Use the Phoenix harness in stage 4", "第 4 阶段使用 Phoenix 评估框架"), cmd: `databricks workspace list "$AGENT_FOLDER/agent_server" -p "$PROFILE"` },
    ],
  },
};
