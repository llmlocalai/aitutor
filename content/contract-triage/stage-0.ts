import { t } from "@/lib/types";
import type { Stage } from "./types";

const K = "native/contract-triage/overlay/";

/** Setup (before the blueprint's stage 0) and stage 0: learn and set up. */
export const stagesA: Stage[] = [
  {
    id: "setup",
    n: "S",
    title: t("Set up your Mac, this kit, and GitHub", "准备 Mac、本工具包和 GitHub"),
    dates: t("Before Oct. 13 · about 1 hour", "10 月 13 日之前 · 约 1 小时"),
    goal: t(
      "Every later step assumes four things: the command-line tools are installed, the kit files are on disk, one file holds the names you reuse (repo path, profile, catalog), and GitHub knows who you are. Doing these once, first, means a failure later is about the step, not about your machine.",
      "后面的每一步都假定四件事：命令行工具已安装，工具包文件已在本地，一个文件里存着反复用到的名字（仓库路径、profile、catalog），GitHub 已认识你。先一次性做好，之后出错就只和那一步有关，而不是机器的问题。",
    ),
    steps: [
      {
        id: "tools",
        bp: "S1",
        title: t("Install the command-line tools", "安装命令行工具"),
        what: t("Homebrew, git, the GitHub CLI (gh), uv with Python 3.11, Node (for the MCP Inspector), jq, and the Databricks CLI 0.205 or later.", "Homebrew、git、GitHub CLI（gh）、带 Python 3.11 的 uv、Node（MCP Inspector 需要）、jq，以及 0.205 或更高版本的 Databricks CLI。"),
        why: t("The template locks Python 3.11 and uses uv for every install; the deploy script needs the Databricks CLI 0.205+ and jq; the Inspector runs through npx. On Windows, do all of this inside WSL2 Ubuntu: the deploy and eval scripts are bash.", "模板锁定 Python 3.11，所有安装都用 uv；部署脚本需要 Databricks CLI 0.205+ 和 jq；Inspector 通过 npx 运行。在 Windows 上，请在 WSL2 Ubuntu 里完成这一切：部署和评估脚本都是 bash。"),
        how: [
          { t: t("Install Homebrew if `brew --version` fails.", "如果 `brew --version` 失败，先安装 Homebrew。"), c: [{ w: "mac", code: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` }] },
          { t: t("Install the tools and Python 3.11.", "安装这些工具和 Python 3.11。"), c: [{ w: "mac", code: `brew install git gh uv node jq
brew tap databricks/tap && brew install databricks
uv python install 3.11` }] },
        ],
        test: [{ w: "mac", code: `git --version; gh --version | head -1; uv --version; uv python find 3.11
node --version; jq --version; databricks --version`, expect: t("Seven version lines, no \"command not found\". The Databricks line reads v0.205.0 or higher. The full check, with pass or fail per tool, is scripts/verify_env.sh in the next step.", "七行版本信息，没有 “command not found”。Databricks 那行为 v0.205.0 或更高。逐项判断通过与否的完整检查是下一步的 scripts/verify_env.sh。") }],
        trouble: [
          { s: t("databricks: command not found after brew install", "brew 安装后 databricks: command not found"), c: t("An old pip package named databricks-cli shadows the new CLI, or the brew bin folder is not on PATH.", "旧的 pip 包 databricks-cli 遮住了新 CLI，或 brew 的 bin 目录不在 PATH 中。"), f: t("`pip uninstall databricks-cli`, then open a new terminal. `which databricks` should print /opt/homebrew/bin/databricks.", "执行 `pip uninstall databricks-cli`，然后打开新终端。`which databricks` 应输出 /opt/homebrew/bin/databricks。") },
        ],
        done: t("All seven tools print versions.", "七个工具都能输出版本。"),
        after: [],
        ran: "you",
        hours: 0.3,
      },
      {
        id: "kit",
        bp: "S2",
        title: t("Get the kit and write your session file", "取得工具包并写好会话文件"),
        what: t("This guide's repository on disk (the kit is native/contract-triage/overlay), and ~/.contract-triage.env with the names every step uses, loaded in every new terminal.", "本指南的仓库放到本地（工具包在 native/contract-triage/overlay），以及写有各步所用名字的 ~/.contract-triage.env，并让每个新终端自动加载。"),
        why: t("Copy-paste only works if every block uses the same names. Putting them in one file means a block like `databricks apps get \"$APP_NAME\" -p \"$PROFILE\"` runs unchanged for you, and when office hours tell you the catalog name, you change one line instead of forty commands.", "只有每个代码块都用同样的名字，复制粘贴才能直接用。把名字放进一个文件，像 `databricks apps get \"$APP_NAME\" -p \"$PROFILE\"` 这样的块对你就能原样运行；答疑时得知 catalog 名后，你只改一行，而不是四十条命令。"),
        how: [
          { t: t("On the Mac Studio, the repository is already on the AI_DATA drive. Anywhere else, clone it.", "在 Mac Studio 上，仓库已在 AI_DATA 盘上。在其他机器上，先克隆。"), c: [{ w: "mac", code: `# Mac Studio:
export AITUTOR=/Volumes/AI_DATA/git/aitutor
# any other machine:
mkdir -p ~/code && git clone https://github.com/llmlocalai/aitutor ~/code/aitutor && export AITUTOR=~/code/aitutor
ls "$AITUTOR/native/contract-triage/overlay"` }] },
          { t: t("Copy the session template, then edit the values in angle brackets. Leave CATALOG and WAREHOUSE_ID as placeholders until office hours (step 0.10) answer them. If you use the Mac Studio copy, set AITUTOR to /Volumes/AI_DATA/git/aitutor in the file.", "复制会话模板，然后修改尖括号中的值。CATALOG 和 WAREHOUSE_ID 先保留占位符，等答疑（第 0.10 步）给出答案再填。如果用的是 Mac Studio 上的副本，把文件中的 AITUTOR 设为 /Volumes/AI_DATA/git/aitutor。"), c: [{ w: "mac", code: `cp "$AITUTOR/native/contract-triage/overlay/scripts/session.env.template" ~/.contract-triage.env
open -e ~/.contract-triage.env      # or: nano ~/.contract-triage.env` }] },
          { t: t("Load it in every new terminal.", "让每个新终端都加载它。"), c: [{ w: "mac", code: `grep -q contract-triage.env ~/.zshrc || echo 'source ~/.contract-triage.env' >> ~/.zshrc
source ~/.contract-triage.env` }] },
        ],
        files: [K + "scripts/session.env.template"],
        test: [{ w: "mac", code: `source ~/.contract-triage.env && echo "$REPO | $KIT | $APP_NAME" && bash "$KIT/scripts/verify_env.sh"`, expect: t("The three names print with no angle brackets in REPO and KIT, and verify_env ends with ENVIRONMENT OK, except the gh auth line, which the next step fixes.", "三个名字都打印出来，REPO 和 KIT 中没有尖括号；verify_env 以 ENVIRONMENT OK 结尾，只有 gh auth 那行例外，下一步会解决。") }],
        trouble: [
          { s: t("verify_env says the session file is missing", "verify_env 说会话文件不存在"), c: t("The copy went to another folder, or the file name lost its leading dot.", "复制到了别的目录，或文件名丢了开头的点。"), f: t("`ls -la ~ | grep contract` must show .contract-triage.env.", "`ls -la ~ | grep contract` 必须能看到 .contract-triage.env。") },
        ],
        done: t("A new terminal knows $REPO, $KIT and $APP_NAME.", "新开的终端认识 $REPO、$KIT 和 $APP_NAME。"),
        after: ["tools"],
        ran: "you",
        hours: 0.2,
      },
      {
        id: "github",
        bp: "S3",
        title: t("Connect the Mac to GitHub", "把 Mac 连接到 GitHub"),
        what: t("gh signed in over HTTPS, git using gh's credentials, and your name and email on every commit.", "gh 通过 HTTPS 登录，git 使用 gh 的凭证，每次提交都带上你的姓名和邮箱。"),
        why: t("Step 0.3 creates your repo with one gh command, and CI status in stages 2 and 6 is read with gh. HTTPS through gh avoids SSH keys entirely, which also works on a managed laptop.", "第 0.3 步用一条 gh 命令创建仓库，第 2 和第 6 阶段用 gh 读取 CI 状态。通过 gh 走 HTTPS 完全不需要 SSH 密钥，在受管理的笔记本上也能用。"),
        how: [
          { t: t("Sign in. Choose GitHub.com, HTTPS, and log in with a web browser.", "登录。选择 GitHub.com、HTTPS，用浏览器登录。"), c: [{ w: "mac", code: `gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git` }] },
          { t: t("Set the commit identity. Use the email GitHub shows for you, or its noreply address if you keep your email private.", "设置提交身份。用 GitHub 上显示的邮箱；如果邮箱设为私密，就用它的 noreply 地址。"), c: [{ w: "mac", code: `git config --global user.name "Peter Shang"
git config --global user.email "<your GitHub email or noreply address>"
git config --global init.defaultBranch main` }] },
        ],
        test: [{ w: "mac", code: `gh auth status && gh api user -q .login && git config user.email`, expect: t("\"Logged in to github.com\", then your login (it must equal $GH_USER in the session file), then your email.", "先是 “Logged in to github.com”，然后是你的登录名（必须与会话文件中的 $GH_USER 相同），最后是邮箱。") }],
        trouble: [
          { s: t("git push asks for a password", "git push 要求输入密码"), c: t("git is not using gh's credential helper.", "git 没有使用 gh 的凭证助手。"), f: t("Run `gh auth setup-git` again; `git config --global credential.helper` should not be empty.", "再运行一次 `gh auth setup-git`；`git config --global credential.helper` 不应为空。") },
        ],
        done: t("gh auth status is green and your login matches $GH_USER.", "gh auth status 正常，登录名与 $GH_USER 一致。"),
        after: ["kit"],
        ran: "you",
        hours: 0.2,
      },
    ],
  },
  {
    id: "s0",
    n: "0",
    title: t("Stage 0: learn and set up", "第 0 阶段：学习与准备"),
    dates: t("Oct. 13 to 18 · about 16 hours", "10 月 13 日至 18 日 · 约 16 小时"),
    goal: t(
      "Stage 0 ends with every account, key and platform path proven by a real call: a repo from the template running locally, both API keys returning 200, the untouched template live as a Databricks App, the repo linked into the workspace as a Git folder, and a schema and volume you can write to. Each unknown found here costs an hour; found in November it costs a week.",
      "第 0 阶段结束时，每个账号、密钥和平台路径都要经过真实调用的验证：用模板建的仓库在本地运行，两个 API 密钥都返回 200，未改动的模板作为 Databricks App 上线，仓库作为 Git 文件夹接入工作区，以及一个你能写入的 schema 和 volume。在这里发现一个未知问题只花一小时；到 11 月才发现要花一周。",
    ),
    steps: [
      {
        id: "clearance",
        bp: "0.1",
        title: t("Ask for employer clearance", "申请雇主许可"),
        what: t("A written OK from your supervisor to build and publish this as a personal-capacity entry.", "主管书面同意你以个人身份构建并公开发布这个参赛作品。"),
        why: t("You work at OUSD(C) and the repo will be public with your name on it. Until the reply arrives, the repo you create in 0.3 stays private, which costs nothing because GitHub Actions and Databricks Git folders work the same on a private repo.", "你在 OUSD(C) 工作，仓库将公开并署上你的名字。在回复之前，第 0.3 步创建的仓库保持私有；这没有代价，因为 GitHub Actions 和 Databricks Git 文件夹对私有仓库同样可用。"),
        how: [{ t: t("Send a short email. Ask about building and publishing both, and whether you may name your office.", "发一封简短的邮件。同时询问构建和发布两件事，以及能否写明你的办公室。"), c: [{ w: "email", label: "email", code: `Subject: Request: personal-capacity entry in GSA's public MCP hackathon

I'd like to enter GSA's MCP Server and AI Agent Government Hackathon (Oct. 19 to Dec. 16) in a personal capacity.
- Public data only (USAspending, SAM.gov, Data.gov). No DoD systems or internal data.
- Personal time and equipment, unless you approve otherwise.
- The code would be published in a public GitHub repository under my name.
May I (1) build it, (2) publish it, and (3) name my office in the write-up?` }] }],
        test: [{ w: "mac", code: `ls ~/code/clearance/`, expect: t("The saved reply (PDF or .eml) is there, and it answers build and publish.", "保存的回复（PDF 或 .eml）在那里，并且回答了构建和发布两件事。") }],
        trouble: [{ s: t("No reply by gate G0", "到 G0 关卡还没有回复"), c: t("Approvals take time.", "审批需要时间。"), f: t("Keep going with the repo private. Step 6.6 makes it public only after the reply.", "继续推进，仓库保持私有。第 6.6 步要等收到回复后才公开。") }],
        done: t("Reply saved in ~/code/clearance/.", "回复已保存在 ~/code/clearance/。"),
        after: [],
        ran: "you",
        hours: 0.2,
      },
      {
        id: "gsa-questions",
        bp: "0.2",
        title: t("Ask GSA the open rule questions", "向 GSA 询问未明确的规则"),
        what: t("One email to mcp@gsa.gov with four questions, answers logged in docs/decisions.md.", "给 mcp@gsa.gov 发一封包含四个问题的邮件，答复记录在 docs/decisions.md。"),
        why: t("The deadline, a second server or agent, synthetic eval records, and the catalog each change a later step: the deadline moves stage 6, the synthetic answer turns the injection rows of 4.2 on or off, and the catalog fills $CATALOG.", "截止日期、第二个服务器或智能体、合成评估记录和 catalog，每一项都会改变后面的某一步：截止日期决定第 6 阶段的时间，合成记录的答复决定第 4.2 步注入用例的开关，catalog 则填入 $CATALOG。"),
        how: [{ t: t("Send it now; the log file arrives with the kit in step 0.4.", "现在就发；日志文件会在第 0.4 步随工具包一起放进仓库。"), c: [{ w: "email", label: "to mcp@gsa.gov", code: `Subject: Four rule questions from a participant

1. When is the submission deadline?
2. May one repository hold the judged MCP server plus a small agent workflow and a scheduled job?
3. May the evaluation include clearly labeled synthetic records (for prompt-injection and decoy tests)?
4. Which Unity Catalog catalog should participants use, and may we create schemas, volumes and tables in it?` }] }],
        test: [{ w: "repo", code: `grep -c "pending" docs/decisions.md`, expect: t("After step 0.4 copies the log: a number above 0 until answers arrive; each answer replaces one \"pending\". No answer by Oct. 25 means: plan for one server and Nov. 30.", "第 0.4 步复制日志后：在收到答复前是一个大于 0 的数；每个答复替换一个 “pending”。到 10 月 25 日仍无答复，就按一个服务器、11 月 30 日截止来计划。") }],
        trouble: [{ s: t("An answer contradicts this guide", "答复与本指南矛盾"), c: t("Rules change during an event.", "活动期间规则会变。"), f: t("The answer wins. Log it, then change the affected step; the risk table at the bottom names each fallback.", "以答复为准。记录下来，再修改受影响的步骤；页面底部的风险表列出了每种后备方案。") }],
        done: t("Email sent.", "邮件已发送。"),
        after: [],
        ran: "you",
        hours: 0.2,
      },
      {
        id: "template-repo",
        bp: "0.3a",
        title: t("Create your repo from the GSA template", "用 GSA 模板创建你的仓库"),
        what: t("A private GitHub repo $GH_USER/contract-triage-mcp made from GSA-TTS/mcp-hackathon-template, cloned to $REPO, with its CI run visible.", "一个由 GSA-TTS/mcp-hackathon-template 生成的私有 GitHub 仓库 $GH_USER/contract-triage-mcp，克隆到 $REPO，并能看到它的 CI 运行。"),
        why: t("The event requires a repo from this template. \"Use this template\" (or its gh equivalent) copies the files without the template's history, so your repo starts clean, and its CI workflow (lint, format, tests) runs on every push from the first commit. This is the GitHub half of the link; step 0.7b adds the Databricks half.", "活动要求使用这个模板建仓库。“Use this template”（或对应的 gh 命令）只复制文件、不带模板的历史，因此仓库从干净状态开始，它的 CI 工作流（lint、格式、测试）从第一次提交起每次推送都会运行。这是连接的 GitHub 一侧；第 0.7b 步补上 Databricks 一侧。"),
        how: [
          { t: t("Create and clone in one command. Private until clearance.", "一条命令创建并克隆。在获得许可前保持私有。"), c: [{ w: "mac", code: `mkdir -p ~/code && cd ~/code
gh repo create "$REPO_NAME" --template GSA-TTS/mcp-hackathon-template --private --clone
cd "$REPO" && git log --oneline -1 && ls` }] },
          { t: t("Or in the browser: open github.com/GSA-TTS/mcp-hackathon-template, Use this template, Create a new repository, name contract-triage-mcp, Private; then `git clone https://github.com/$GH_USER/contract-triage-mcp ~/code/contract-triage-mcp`.", "或者在浏览器中：打开 github.com/GSA-TTS/mcp-hackathon-template，Use this template，Create a new repository，名称 contract-triage-mcp，Private；然后执行 `git clone https://github.com/$GH_USER/contract-triage-mcp ~/code/contract-triage-mcp`。") },
          { t: t("Install the kit's secret guard as a git hook, so a key can never be committed by accident.", "把工具包里的密钥防护装成 git hook，这样密钥永远不会被误提交。"), c: [{ w: "repo", code: `cp "$KIT/scripts/hooks/pre-commit" .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` }] },
        ],
        files: [K + "scripts/hooks/pre-commit"],
        test: [{ w: "repo", code: `gh repo view --json visibility,isTemplate -q '.visibility' && gh run list --limit 1`, expect: t("PRIVATE, then one CI run (it may still be in progress). Open it with `gh run watch` and wait for a green check: the untouched template passes its own lint and tests.", "先输出 PRIVATE，然后是一次 CI 运行（可能仍在进行中）。用 `gh run watch` 打开并等待绿色对勾：未改动的模板能通过自己的 lint 和测试。") }],
        replay: ["clone"],
        trouble: [
          { s: t("warning: You appear to have cloned an empty repository", "warning: You appear to have cloned an empty repository"), c: t("gh cloned before GitHub finished copying the template files.", "gh 在 GitHub 复制完模板文件之前就克隆了。"), f: t("Wait ten seconds, then `cd \"$REPO\" && git pull origin main`.", "等十秒，然后执行 `cd \"$REPO\" && git pull origin main`。") },
          { s: t("No CI run is listed", "没有列出任何 CI 运行"), c: t("Actions are disabled for new repos in your account settings.", "账号设置中对新仓库禁用了 Actions。"), f: t("Repo Settings > Actions > General > Allow all actions; then push any commit.", "仓库 Settings > Actions > General > Allow all actions；然后推送任意一个提交。") },
        ],
        done: t("$REPO exists, is private, and CI ran green.", "$REPO 已存在、为私有，CI 运行为绿色。"),
        after: ["github", "clearance"],
        ran: "replayed",
        hours: 0.3,
      },
      {
        id: "template-local",
        bp: "0.3b",
        title: t("Learn: run and extend the template locally", "学习：在本地运行并扩展模板"),
        what: t("The template's tests passing on your Mac, the server open in the MCP Inspector, and one tool of your own (echo_office) on a learning branch.", "模板的测试在你的 Mac 上通过，服务器在 MCP Inspector 中打开，以及在学习分支上一个你自己写的工具（echo_office）。"),
        why: t("Before designing five tools you need the basics in your hands: a tool is a function the model may call, a resource is data the client can read without a call, a prompt is a packaged instruction the user picks. stdio is how a local client launches the server; HTTP is how Databricks serves it. The echo tool lives on a branch you never merge, so main stays the template until the rename in 1.1.", "设计五个工具之前，先亲手掌握基础：tool 是模型可以调用的函数，resource 是客户端无需调用就能读取的数据，prompt 是用户选择的打包好的指令。stdio 是本地客户端启动服务器的方式；HTTP 是 Databricks 提供服务的方式。echo 工具放在一个永不合并的分支上，因此在第 1.1 步改名之前，main 一直保持为模板原样。"),
        how: [
          { t: t("Install and test, exactly as the template README says.", "完全按模板 README 安装并测试。"), c: [{ w: "repo", code: `cp .env.example .env
uv sync --group dev
uv run pytest tests/ -v` }] },
          { t: t("Open the Inspector. It opens a browser tab; click Connect, then Tools > List Tools, and run example_search_datasets.", "打开 Inspector。它会打开一个浏览器标签页；点击 Connect，再点 Tools > List Tools，运行 example_search_datasets。"), c: [{ w: "repo", code: `npx @modelcontextprotocol/inspector uv run python main.py` }] },
          { t: t("Add a tool of your own, one file per tool, read only, on a branch.", "在分支上加一个你自己的工具：一个文件一个工具，只读。"), c: [{ w: "repo", code: `git switch -c learn/echo-office
cat > src/example_server/tools/echo_office.py <<'EOF'
from typing import Annotated

from fastmcp import FastMCP
from pydantic import Field


def register(mcp: FastMCP) -> None:
    @mcp.tool(name="echo_office", annotations={"readOnlyHint": True})
    async def echo_office(
        name: Annotated[str, Field(description="An office name.")],
    ) -> dict:
        """Echo an office name back. A learning tool; it reads nothing."""
        return {"office": name.strip().upper()}
EOF
perl -0pi -e 's/from example_server.tools import example_tool\\n/from example_server.tools import echo_office, example_tool\\n/; s/    example_tool.register\\(mcp\\)\\n/    example_tool.register(mcp)\\n    echo_office.register(mcp)\\n/' src/example_server/tools/__init__.py
git diff --stat` }] },
          { t: t("Keep it on the branch and go back to main.", "把它留在分支上，回到 main。"), c: [{ w: "repo", code: `git add -A && git commit -m "learn: echo_office" && git switch main` }] },
        ],
        test: [{ w: "repo", code: `git switch learn/echo-office
uv run python -c "import asyncio; from fastmcp import Client; from example_server.app import mcp
async def m():
    async with Client(mcp) as c:
        print(sorted(t.name for t in await c.list_tools()))
        print((await c.call_tool('echo_office', {'name': ' region 5 aas '})).structured_content)
asyncio.run(m())"
git switch main`, expect: t("26 template tests pass. The check prints ['echo_office', 'example_search_datasets'] and {'office': 'REGION 5 AAS'}; the Inspector shows the same two tools. Then say in one sentence each what a tool, a resource and a prompt are.", "模板的 26 个测试通过。检查输出 ['echo_office', 'example_search_datasets'] 和 {'office': 'REGION 5 AAS'}；Inspector 中显示同样的两个工具。然后各用一句话说出 tool、resource 和 prompt 是什么。") }],
        replay: ["template-run", "echo-tool"],
        trouble: [
          { s: t("The Inspector says connection error", "Inspector 显示连接错误"), c: t("It was started outside the repo, so `uv run` found no project.", "它是在仓库之外启动的，所以 `uv run` 找不到项目。"), f: t("Start it from $REPO. The transport in the Inspector must be STDIO.", "在 $REPO 中启动。Inspector 中的 transport 必须是 STDIO。") },
          { s: t("`uv sync` downloads a different Python", "`uv sync` 下载了别的 Python 版本"), c: t("Expected: .python-version pins 3.11 and uv fetches it.", "这是预期行为：.python-version 锁定 3.11，uv 会自动获取。"), f: t("Nothing to fix.", "无需处理。") },
        ],
        done: t("Tests pass, the Inspector lists and calls your tool, and main is still the template.", "测试通过，Inspector 能列出并调用你的工具，main 仍是模板原样。"),
        after: ["template-repo"],
        ran: "replayed",
        hours: 2,
      },
      {
        id: "skills",
        bp: "0.4",
        title: t("Learn: read the template's two agent skills", "学习：阅读模板里的两个 agent skill"),
        what: t("docs/design-rules.md: one line per GSA design rule, and where this repo follows it. Also the decisions log from step 0.2.", "docs/design-rules.md：每条 GSA 设计规则一行，写明本仓库在哪里遵循它。另外还有第 0.2 步的决策日志。"),
        why: t(".agents/skills/mcp-builder and mcp-eval are GSA's own rules for tool naming, response shape, pagination, errors, and the 10-question evaluation.xml. Judges read your work against them, so each rule should point at a file you can show.", ".agents/skills/mcp-builder 和 mcp-eval 是 GSA 自己关于工具命名、返回结构、分页、错误处理和 10 题 evaluation.xml 的规则。评委会对照它们审视你的作品，因此每条规则都应指向一个你能展示的文件。"),
        how: [
          { t: t("Read the four files.", "阅读这四个文件。"), c: [{ w: "repo", code: `ls .agents/skills/mcp-builder .agents/skills/mcp-builder/references .agents/skills/mcp-eval
less .agents/skills/mcp-builder/SKILL.md        # q to quit
less .agents/skills/mcp-builder/references/mcp_best_practices.md
less .agents/skills/mcp-builder/references/python_mcp_server.md
less .agents/skills/mcp-builder/references/evaluation.md` }] },
          { t: t("Copy the kit's starting table and the decisions log, then add any rule you found that the table lacks.", "复制工具包中的初始表格和决策日志，再补上你发现而表格中没有的规则。"), c: [{ w: "repo", code: `mkdir -p docs && cp "$KIT/docs/design-rules.md" "$KIT/docs/decisions.md" docs/
git add docs && git commit -m "docs: design rules and decisions log" && git push` }] },
        ],
        files: [K + "docs/design-rules.md", K + "docs/decisions.md"],
        test: [{ w: "repo", code: `grep -c '^| ' docs/design-rules.md`, expect: t("At least 9 (a header plus 8 rules). Every rule must match an item in stage 2, which the right column names.", "至少为 9（一行表头加 8 条规则）。每条规则都必须对应第 2 阶段中的某项，右列写明了对应位置。") }],
        trouble: [{ s: t("The skill names a rule this guide breaks", "skill 中有一条规则被本指南违反"), c: t("The guide may be wrong.", "可能是本指南错了。"), f: t("Follow the skill, and note the change in docs/decisions.md.", "按 skill 做，并在 docs/decisions.md 中记录改动。") }],
        done: t("docs/design-rules.md is committed.", "docs/design-rules.md 已提交。"),
        after: ["template-local"],
        ran: "you",
        hours: 2,
      },
      {
        id: "keys",
        bp: "0.5",
        title: t("Get the two public API keys and prove them", "获取两个公共 API 密钥并验证"),
        what: t("A SAM.gov public API key and an api.data.gov key in the repo's .env (git-ignored), the kit's scripts in the repo, and one 200 from each API.", "把 SAM.gov 公共 API 密钥和 api.data.gov 密钥写入仓库的 .env（已被 git 忽略），把工具包的脚本放进仓库，并让每个 API 各返回一次 200。"),
        why: t("SAM.gov carries closedStatus, the official closeout signal; Data.gov v4 needs a key for the provenance step. You must request both yourself. Proving them now, with the rate-limit headers in view, tells you whether the 1,000-a-day federal tier is what you got.", "SAM.gov 提供 closedStatus，也就是官方的结案信号；Data.gov v4 在数据来源一步需要密钥。两者都必须你本人申请。现在就验证，并查看限流响应头，就能知道你拿到的是否是每天 1,000 次的联邦用户额度。"),
        how: [
          { t: t("SAM.gov: sign in at sam.gov, open your profile (sam.gov/profile/details), and reveal the Public API Key with the one-time code they email you.", "SAM.gov：在 sam.gov 登录，打开个人资料页（sam.gov/profile/details），用邮件收到的一次性验证码显示 Public API Key。"), c: [{ w: "browser", code: "https://sam.gov/profile/details" }] },
          { t: t("api.data.gov: sign up with your email; the key arrives on the page and by email.", "api.data.gov：用邮箱注册；密钥会显示在页面上并发到邮箱。"), c: [{ w: "browser", code: "https://api.data.gov/signup/" }] },
          { t: t("Put the kit's scripts and the new .env lines into the repo. Then paste both keys after the = signs in .env (not .env.example).", "把工具包的脚本和新的 .env 配置行放进仓库。然后把两个密钥粘贴到 .env（不是 .env.example）中的等号后面。"), c: [{ w: "repo", code: `mkdir -p scripts && cp -R "$KIT/scripts/." scripts/
cat "$KIT/env.example.addition" >> .env.example
cat "$KIT/env.example.addition" >> .env
open -e .env
git add scripts .env.example && git commit -m "Add setup scripts and API key settings" && git push` }] },
        ],
        files: [K + "scripts/probe_apis.py", K + "env.example.addition"],
        test: [{ w: "repo", code: `set -a; source .env; set +a; python3 scripts/probe_apis.py`, expect: t("Three lines with 200 and ALL OK. The SAM.gov line shows totalRecords for 47QFLA20C0002; the Data.gov line shows X-RateLimit-Limit=1000. If SAM.gov's daily limit header reads 10, your account has no federal role: see the risk table, row 5.", "三行都是 200，最后是 ALL OK。SAM.gov 那行显示 47QFLA20C0002 的 totalRecords；Data.gov 那行显示 X-RateLimit-Limit=1000。如果 SAM.gov 的每日限额头显示 10，说明你的账号没有联邦角色：见风险表第 5 行。") }],
        replay: ["scripts"],
        trouble: [
          { s: t("SAM.gov 403 or API_KEY_INVALID", "SAM.gov 返回 403 或 API_KEY_INVALID"), c: t("The key was copied with a space, or it is a system-account key used as personal.", "密钥复制时带了空格，或者把系统账号密钥当作个人密钥使用。"), f: t("Reveal it again on the profile page; keys expire after 90 days, so note the date in docs/decisions.md.", "在个人资料页重新显示；密钥 90 天后过期，把日期记在 docs/decisions.md 中。") },
          { s: t("The commit is refused by pre-commit", "提交被 pre-commit 拒绝"), c: t("The hook found a key value or a .env file in the staged changes. That is the hook working.", "hook 在暂存的改动中发现了密钥值或 .env 文件。这说明 hook 在正常工作。"), f: t("`git restore --staged .env`, then commit again.", "执行 `git restore --staged .env`，然后再提交。") },
        ],
        done: t("probe_apis.py prints ALL OK.", "probe_apis.py 输出 ALL OK。"),
        after: ["template-repo"],
        ran: "you",
        hours: 0.5,
      },
      {
        id: "reference",
        bp: "0.6",
        title: t("Learn: study GSA's deployed reference", "学习：研究 GSA 已部署的参考实现"),
        what: t("docs/reference-notes.md: how mcp-server-cdc-places and agent-cdc-places work, three things to copy, one to do differently.", "docs/reference-notes.md：mcp-server-cdc-places 和 agent-cdc-places 如何工作，三处可借鉴，一处要做得不同。"),
        why: t("It is the pattern GSA expects on this platform: a server, an agent, and an eval. Reading its logs and agent prompt now shows you what a working app's logs look like before you need to debug your own.", "这是 GSA 期望在这个平台上看到的模式：一个服务器、一个智能体和一次评估。现在就读它的日志和智能体提示词，在需要调试自己的应用之前，你就知道一个正常应用的日志长什么样。"),
        how: [
          { t: t("Compute > Apps > mcp-server-cdc-places: read Overview (URL, service principal, resources), Deployments (source path), and Logs.", "Compute > Apps > mcp-server-cdc-places：阅读 Overview（URL、服务主体、资源）、Deployments（源码路径）和 Logs。") , c: [{ w: "dbx-ui", code: "Compute > Apps > mcp-server-cdc-places > Overview | Deployments | Logs" }] },
          { t: t("Open the agent-cdc-places folder and read its tool list and system prompt.", "打开 agent-cdc-places 文件夹，阅读它的工具列表和系统提示词。"), c: [{ w: "dbx-ui", code: "Workspace > search: agent-cdc-places > agent_server/agent.py" }] },
          { t: t("Write the notes file.", "写好笔记文件。"), c: [{ w: "repo", code: `cat > docs/reference-notes.md <<'EOF'
# GSA reference: mcp-server-cdc-places
- How its tools call CDC data:
- What its eval measured:
- Copy 1:
- Copy 2:
- Copy 3:
- Do differently:
EOF
open -e docs/reference-notes.md` }] },
        ],
        test: [{ w: "repo", code: `grep -cE '^- .+: .+' docs/reference-notes.md`, expect: t("6: every line has an answer after its colon.", "6：每一行冒号后都有答案。") }],
        trouble: [{ s: t("You cannot see the app", "看不到这个应用"), c: t("You lack CAN_VIEW on it.", "你没有它的 CAN_VIEW 权限。"), f: t("Ask in Databricks office hours (0.10).", "在 Databricks 答疑时间（0.10）提问。") }],
        done: t("Notes committed.", "笔记已提交。"),
        after: ["template-local"],
        ran: "you",
        hours: 1.5,
      },
      {
        id: "sandbox",
        bp: "0.7",
        title: t("Log in to Databricks and deploy the untouched template", "登录 Databricks 并部署未改动的模板"),
        what: t("A CLI profile for the workspace, and a throwaway app mcp-server-pshang-sandbox running the template, reachable with a token and attached in Playground.", "一个工作区的 CLI profile，以及一个运行模板的一次性应用 mcp-server-pshang-sandbox，可以用令牌访问，并已在 Playground 中挂载。"),
        why: t("CLI login, profile names, app creation and the deploy script are the four places a first deploy fails. Hitting them with the template, whose code is known good, means any failure is platform setup, and you fix it in October. The app name starts with mcp- because Playground only lists apps named that way.", "CLI 登录、profile 名称、应用创建和部署脚本，是首次部署最容易失败的四个地方。用代码确定没问题的模板去碰它们，任何失败都只可能是平台配置，你在十月就能修好。应用名以 mcp- 开头，因为 Playground 只列出这样命名的应用。"),
        how: [
          { t: t("Log in. When it asks for a profile name, type a short one (for example gsa) and put it in PROFILE in ~/.contract-triage.env. The default is the host name, not DEFAULT.", "登录。提示输入 profile 名称时，输入一个简短的名字（例如 gsa），并写入 ~/.contract-triage.env 的 PROFILE。默认值是主机名，而不是 DEFAULT。"), c: [{ w: "mac", code: `databricks auth login --host "$DATABRICKS_HOST"
databricks auth profiles
source ~/.contract-triage.env && databricks current-user me -p "$PROFILE" -o json | jq -r .userName` }] },
          { t: t("Write the deploy settings from the kit's template (no secrets in it), then deploy. The first build takes a few minutes.", "用工具包的模板生成部署设置（里面没有机密），然后部署。第一次构建需要几分钟。"), c: [{ w: "repo", code: `mkdir -p deploy/databricks
APP_NAME="$SANDBOX_APP" python3 "$KIT/scripts/render.py" "$KIT/deploy/databricks/env.template" > deploy/databricks/.env
cat deploy/databricks/.env
set -a; source deploy/databricks/.env; set +a
bash deploy/databricks/deploy-databricks-app.sh` }] },
          { t: t("In Playground, pick any chat model, open Tools, add the app as an MCP server, and ask \"Use example_search_datasets to search for transportation\".", "在 Playground 中选任一聊天模型，打开 Tools，把这个应用作为 MCP 服务器加入，然后问 “Use example_search_datasets to search for transportation”。"), c: [{ w: "playground", code: "Playground > model > Tools > + Add tool > MCP Servers > Custom MCP server > mcp-server-pshang-sandbox" }] },
        ],
        files: [K + "deploy/databricks/env.template", K + "scripts/render.py"],
        test: [{ w: "repo", code: `URL=$(databricks apps get "$SANDBOX_APP" -p "$PROFILE" -o json | jq -r .url)
databricks apps get "$SANDBOX_APP" -p "$PROFILE" -o json | jq '{app: .app_status.state, compute: .compute_status.state}'
DATABRICKS_TOKEN="$(databricks auth token -p "$PROFILE" -o json | jq -r .access_token)" bash deploy/databricks/smoke-test.sh "$URL"`, expect: t("app RUNNING and compute ACTIVE, then \"PASS: health check 200\", and a /mcp reply (a \"Missing session ID\" JSON-RPC error is fine: it proves the transport is reachable). Playground shows the example tool call. You can find the app logs at Compute > Apps > the app > Logs.", "app 为 RUNNING、compute 为 ACTIVE，然后是 “PASS: health check 200”，以及 /mcp 的响应（出现 “Missing session ID” 的 JSON-RPC 错误也没关系：说明传输层可达）。Playground 中显示示例工具调用。应用日志在 Compute > Apps > 该应用 > Logs。") }],
        trouble: [
          { s: t("FATAL: not authenticated", "FATAL: not authenticated"), c: t("DATABRICKS_CONFIG_PROFILE in deploy/databricks/.env does not match a profile name.", "deploy/databricks/.env 中的 DATABRICKS_CONFIG_PROFILE 与任何 profile 名称都不匹配。"), f: t("`databricks auth profiles`, fix PROFILE in ~/.contract-triage.env, render the .env again.", "执行 `databricks auth profiles`，修正 ~/.contract-triage.env 中的 PROFILE，再重新生成 .env。") },
          { s: t("apps create fails with a feature error", "apps create 报功能不可用"), c: t("Apps are not enabled for you in this workspace.", "这个工作区没有为你启用 Apps。"), f: t("Bring the error to office hours (gate G0's fallback).", "把错误带到答疑时间（G0 关卡的后备方案）。") },
          { s: t("smoke test prints 302 or 401", "冒烟测试输出 302 或 401"), c: t("No token was sent: private apps redirect to login.", "没有发送令牌：私有应用会重定向到登录页。"), f: t("Run it exactly as shown, with DATABRICKS_TOKEN set.", "完全按所示方式运行，并设置 DATABRICKS_TOKEN。") },
        ],
        done: t("The sandbox app is RUNNING, the smoke test passes, and Playground called its tool.", "沙盒应用为 RUNNING，冒烟测试通过，Playground 调用了它的工具。"),
        after: ["template-local"],
        ran: "you",
        unconfirmed: t("The jq paths .app_status.state and .compute_status.state follow the Apps API as documented; if your CLI prints other names, `databricks apps get \"$SANDBOX_APP\" -p \"$PROFILE\" -o json | jq` shows them.", "jq 路径 .app_status.state 和 .compute_status.state 依据 Apps API 文档；如果你的 CLI 输出的字段名不同，`databricks apps get \"$SANDBOX_APP\" -p \"$PROFILE\" -o json | jq` 会显示它们。"),
        hours: 2,
      },
      {
        id: "git-folder",
        bp: "0.7b",
        title: t("Link the repo into Databricks as a Git folder", "把仓库作为 Git 文件夹接入 Databricks"),
        what: t("A Git folder at $GIT_FOLDER that tracks your GitHub repo, and a GitHub credential in Databricks so it can pull a private repo.", "在 $GIT_FOLDER 有一个跟踪你 GitHub 仓库的 Git 文件夹，并在 Databricks 中保存 GitHub 凭证，以便拉取私有仓库。"),
        why: t("This is the other direction of the link. Code is written on the Mac and pushed to GitHub; the Git folder pulls it into the workspace, where notebooks and the job run it. You can also edit in the Git folder and commit back to GitHub from Databricks, but keep one rule: edit in one place at a time, and pull before you start.", "这是连接的另一个方向。代码在 Mac 上编写并推送到 GitHub；Git 文件夹把它拉进工作区，由 notebook 和 job 运行。你也可以在 Git 文件夹中编辑并从 Databricks 提交回 GitHub，但要守一条规则：同一时间只在一个地方编辑，开始前先拉取。"),
        how: [
          { t: t("Create a fine-grained GitHub token for this one repo with Contents: Read and write.", "为这一个仓库创建一个细粒度的 GitHub 令牌，权限为 Contents: Read and write。"), c: [{ w: "github", code: "github.com > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token\n  Repository access: Only select repositories > contract-triage-mcp\n  Permissions: Contents = Read and write" }] },
          { t: t("Give it to Databricks (or use Settings > Linked accounts > Git integration in the UI), then create the Git folder.", "把它交给 Databricks（也可以在界面的 Settings > Linked accounts > Git integration 中设置），然后创建 Git 文件夹。"), c: [{ w: "mac", code: `databricks git-credentials create gitHub --git-username "$GH_USER" --personal-access-token "<the token>" -p "$PROFILE"
databricks repos create "https://github.com/$GH_USER/$REPO_NAME" gitHub --path "$GIT_FOLDER" -p "$PROFILE"` }] },
          { t: t("From now on, after every `git push` that a notebook or job needs, pull the Git folder.", "从现在起，每次 `git push` 之后，只要 notebook 或 job 需要这些改动，就拉取 Git 文件夹。"), c: [{ w: "mac", code: `databricks repos update "$GIT_FOLDER" --branch main -p "$PROFILE"` }] },
        ],
        test: [{ w: "mac", code: `databricks workspace list "$GIT_FOLDER" -p "$PROFILE" | head`, expect: t("The repo's top level: README.md, main.py, src, tests, deploy, docs, scripts. After a later push plus repos update, new folders appear here.", "仓库的顶层内容：README.md、main.py、src、tests、deploy、docs、scripts。之后每次推送并执行 repos update，新的文件夹都会出现在这里。") }],
        trouble: [
          { s: t("repos create: authentication failed", "repos create：认证失败"), c: t("The token cannot read this repo (wrong repo selected, or expired).", "令牌无法读取这个仓库（选错了仓库，或已过期）。"), f: t("Regenerate it for contract-triage-mcp; `databricks git-credentials list -p \"$PROFILE\"` shows the stored one; update with `git-credentials update`.", "为 contract-triage-mcp 重新生成；`databricks git-credentials list -p \"$PROFILE\"` 显示已保存的凭证；用 `git-credentials update` 更新。") },
          { s: t("repos update: conflict", "repos update：冲突"), c: t("Someone edited files in the Git folder in the UI.", "有人在界面中编辑了 Git 文件夹里的文件。"), f: t("Commit or discard those edits in the Git folder UI first; then update.", "先在 Git 文件夹界面中提交或丢弃这些修改，再更新。") },
        ],
        done: t("The Git folder lists your repo's files.", "Git 文件夹能列出仓库文件。"),
        after: ["sandbox"],
        ran: "you",
        unconfirmed: t("`databricks repos update` with a workspace path (rather than a numeric repo id) is accepted by recent CLI versions; if yours wants an id, get it with `databricks workspace get-status \"$GIT_FOLDER\" -p \"$PROFILE\" -o json | jq .object_id`.", "较新的 CLI 版本中 `databricks repos update` 接受工作区路径（而非数字 repo id）；如果你的版本要求 id，用 `databricks workspace get-status \"$GIT_FOLDER\" -p \"$PROFILE\" -o json | jq .object_id` 获取。"),
        hours: 0.5,
      },
      {
        id: "uc-egress",
        bp: "0.8",
        title: t("Learn: Unity Catalog, volumes and Delta, plus the egress test", "学习：Unity Catalog、volume 与 Delta，以及出网测试"),
        what: t("The schema contract_triage with its volume and empty tables, one small Delta table built from a CSV, and a yes or no for whether workspace compute reaches the public federal sites.", "建好 contract_triage schema 及其 volume 和空表，用一个 CSV 建一张小 Delta 表，并明确工作区计算能否访问公共联邦网站。"),
        why: t("Stage 1 rests on two unknowns: whether you may create objects in the catalog, and whether serverless compute has internet egress. If egress fails, every download moves to the laptop (fetch_usaspending.py, then databricks fs cp). Learning the three pieces here, on a 17-row file, keeps stage 1 about the data.", "第 1 阶段依赖两个未知数：你能否在 catalog 中创建对象，以及 serverless 计算能否出网。如果出网失败，所有下载都改在笔记本上完成（fetch_usaspending.py，再用 databricks fs cp）。在这里用一个 17 行的文件学会这三样东西，第 1 阶段就能专注于数据本身。"),
        how: [
          { t: t("Put the SQL and the notebooks in the repo, push, and pull the Git folder.", "把 SQL 和 notebook 放进仓库，推送，然后拉取 Git 文件夹。"), c: [{ w: "repo", code: `cp -R "$KIT/sql" "$KIT/pipelines" .
mkdir -p tests/fixtures && cp "$KIT"/tests/fixtures/* tests/fixtures/
git add sql pipelines tests/fixtures && git commit -m "Add pipeline notebooks and SQL" && git push
databricks repos update "$GIT_FOLDER" --branch main -p "$PROFILE"` }] },
          { t: t("Open $GIT_FOLDER/pipelines/00_setup, attach Serverless, set the catalog widget to $CATALOG, Run all.", "打开 $GIT_FOLDER/pipelines/00_setup，挂载 Serverless，把 catalog 小部件设为 $CATALOG，点击 Run all。"), c: [{ w: "dbx-nb", code: "Workspace > Users > <you> > contract-triage-mcp > pipelines > 00_setup\nConnect: Serverless | widget catalog = <your catalog> | Run all" }] },
          { t: t("Copy the 17-row synthetic CSV into the volume and make a Delta table from it.", "把 17 行的合成 CSV 复制到 volume，并用它建一张 Delta 表。"), c: [
            { w: "repo", code: `databricks fs mkdir "dbfs:/Volumes/$CATALOG/contract_triage/raw/learn" -p "$PROFILE"
databricks fs cp tests/fixtures/usas_tx.csv "dbfs:/Volumes/$CATALOG/contract_triage/raw/learn/usas_tx.csv" -p "$PROFILE"` },
            { w: "dbx-sql", code: `USE CATALOG <your_catalog>;
CREATE OR REPLACE TABLE contract_triage.learn_fixture AS
SELECT * FROM read_files('/Volumes/<your_catalog>/contract_triage/raw/learn/usas_tx.csv',
                         format => 'csv', header => true);
SELECT COUNT(*) FROM contract_triage.learn_fixture;
DESCRIBE HISTORY contract_triage.learn_fixture;` },
          ] },
        ],
        files: [K + "sql/ddl.sql", K + "pipelines/00_setup.py"],
        test: [
          { w: "dbx-nb", expect: t("The notebook lists the tables bronze_sam_awards, dq_results, meta_freshness, worklist_decisions, worklist_items and the volume raw, then one line per site. \"reachable, HTTP 200\" (or 401/403 for SAM.gov without a key) means egress works; \"NOT reachable\" means use the laptop path in 1.2 and 1.3.", "notebook 列出表 bronze_sam_awards、dq_results、meta_freshness、worklist_decisions、worklist_items 和 volume raw，然后每个网站一行。“reachable, HTTP 200”（SAM.gov 无密钥时为 401/403）表示可以出网；“NOT reachable” 表示在 1.2 和 1.3 中改用笔记本路径。") },
          { w: "repo", code: `python3 -c "import csv; print(sum(1 for _ in csv.reader(open('tests/fixtures/usas_tx.csv'))) - 1)"`, expect: t("17, and the SQL editor's COUNT(*) is also 17. DESCRIBE HISTORY shows version 0, CREATE OR REPLACE TABLE AS SELECT: that is Delta.", "17，SQL 编辑器中的 COUNT(*) 也是 17。DESCRIBE HISTORY 显示 version 0、CREATE OR REPLACE TABLE AS SELECT：这就是 Delta。") },
        ],
        trouble: [
          { s: t("PERMISSION_DENIED on CREATE SCHEMA", "CREATE SCHEMA 时 PERMISSION_DENIED"), c: t("You may not create schemas in that catalog.", "你无权在该 catalog 中创建 schema。"), f: t("Ask which catalog to use (0.10). Fallback from the risk table: keep Parquet inside the app and skip the job.", "询问应使用哪个 catalog（0.10）。风险表中的后备方案：把 Parquet 放在应用内部，跳过 job。") },
          { s: t("ModuleNotFoundError: common", "ModuleNotFoundError: common"), c: t("The notebook was imported alone, not opened from the Git folder, so pipelines/ is not its working directory.", "notebook 是单独导入的，而不是从 Git 文件夹中打开的，所以 pipelines/ 不是它的工作目录。"), f: t("Open it from $GIT_FOLDER/pipelines.", "从 $GIT_FOLDER/pipelines 中打开。") },
        ],
        done: t("A Delta table exists, and you know whether egress works.", "已有一张 Delta 表，并且清楚能否出网。"),
        after: ["git-folder"],
        ran: "you",
        hours: 2,
      },
      {
        id: "openapi",
        bp: "0.9",
        title: t("Learn (optional): try the OpenAPI MCP template", "学习（可选）：试用 OpenAPI MCP 模板"),
        what: t("A disposable server from Databricks' \"MCP Server (OpenAPI)\" template against one USAspending endpoint, called once in Playground, then deleted.", "用 Databricks 的 “MCP Server (OpenAPI)” 模板针对一个 USAspending 端点建一个一次性服务器，在 Playground 中调用一次，然后删除。"),
        why: t("In an hour it shows what a thin wrapper is: one tool per REST call, and the user still joins, filters and ranks by hand. That contrast is the argument for five goal-level tools, and judges mark thin wrappers down. Do not submit it.", "一小时就能看清什么是薄封装：一个 REST 调用对应一个工具，用户仍要手工关联、筛选和排序。这种对比正是五个目标级工具的理由，评委也会给薄封装扣分。不要提交它。"),
        how: [{ t: t("Create it, call it, write two sentences, delete it.", "创建、调用、写两句话、删除。"), c: [{ w: "dbx-ui", code: "AI Gateway > MCPs > + MCP > Build a new MCP server > MCP Server (OpenAPI)\n  spec: https://api.usaspending.gov  (one endpoint, e.g. /api/v2/references/toptier_agencies/)\nPlayground > attach it > ask one question\nCompute > Apps > the new app > Delete" }] }],
        test: [{ w: "repo", code: `grep -A2 "OpenAPI" docs/reference-notes.md`, expect: t("Two sentences on what a user still does by hand with it.", "两句话，说明用户用它时还要手工做什么。") }],
        trouble: [{ s: t("The template is not listed", "列表中没有这个模板"), c: t("Unity Gateway MCP templates are not enabled here.", "这里没有启用 Unity Gateway MCP 模板。"), f: t("Skip the step; it is optional.", "跳过这一步；它是可选的。") }],
        done: t("Called once and deleted.", "调用过一次并已删除。"),
        after: ["sandbox"],
        ran: "you",
        hours: 1,
      },
      {
        id: "office-hours-1",
        bp: "0.10",
        title: t("Databricks office hours (Wed. Oct. 14, 2 p.m.)", "Databricks 答疑时间（10 月 14 日周三下午 2 点）"),
        what: t("A yes, no or workaround for each of eight questions, logged; CATALOG and WAREHOUSE_ID filled in ~/.contract-triage.env.", "八个问题各得到 “可以”、“不行” 或变通办法并记录下来；在 ~/.contract-triage.env 中填好 CATALOG 和 WAREHOUSE_ID。"),
        why: t("Admin rights, catalog, jobs, egress, secrets and model names decide stages 1, 3 and 4. Every \"no\" gets its fallback from the risk table today, not when the step fails.", "管理员权限、catalog、job、出网、secret 和模型名称决定第 1、3、4 阶段。每个 “不行” 今天就从风险表中选好后备方案，而不是等到那一步失败时。"),
        how: [{ t: t("Bring these questions.", "带上这些问题。"), c: [{ w: "meeting", code: `1. Which catalog should participants use; may we create schemas, volumes, tables in it?
2. Can serverless notebooks and jobs reach files.usaspending.gov and api.sam.gov?
3. May participants create and schedule Lakeflow Jobs?
4. May participants create secret scopes; can an app read a secret through valueFrom?
5. Which SQL warehouse may an app attach; can we grant its service principal SELECT?
6. Do participants have workspace admin for setup-eval-sp.sh? If not, the supported eval path?
7. Which Unity Gateway model names for the agent and for MLflow judges?
8. Is the Unity Gateway beta (system.ai.dbsql) enabled; is Genie One available?` }] },
          { t: t("Log each answer and fill the two names.", "记录每个答复并填好这两个名字。"), c: [{ w: "repo", code: `open -e docs/decisions.md ~/.contract-triage.env
git add docs/decisions.md && git commit -m "Log office hours answers" && git push` }] }],
        test: [{ w: "mac", code: `source ~/.contract-triage.env && echo "$CATALOG $WAREHOUSE_ID" && databricks warehouses get "$WAREHOUSE_ID" -p "$PROFILE" -o json | jq -r '.name, .state'`, expect: t("Your catalog and warehouse id with no angle brackets, then the warehouse name and its state (RUNNING or STOPPED; both are fine).", "你的 catalog 和 warehouse id，没有尖括号；然后是 warehouse 名称及其状态（RUNNING 或 STOPPED 都可以）。") }],
        trouble: [{ s: t("An answer is \"we'll get back to you\"", "答复是 “稍后回复你”"), c: t("Common for admin questions.", "管理员相关问题常见。"), f: t("Pick the fallback now; switch back if a yes arrives.", "现在就选好后备方案；如果之后得到 “可以” 再切回来。") }],
        done: t("Eight answers logged.", "八个答复已记录。"),
        after: ["uc-egress"],
        ran: "you",
        hours: 1,
      },
    ],
    gate: {
      id: "g0",
      title: t("Gate G0 (Sun. Oct. 18)", "G0 关卡（10 月 18 日周日）"),
      rows: [
        { check: t("Keys work", "密钥可用"), pass: t("probe_apis.py prints ALL OK", "probe_apis.py 输出 ALL OK"), fail: t("Use USAspending only; drop closedStatus", "只用 USAspending；放弃 closedStatus"), cmd: "set -a; source .env; set +a; python3 scripts/probe_apis.py" },
        { check: t("Template deploys", "模板可部署"), pass: t("Sandbox app RUNNING; Playground calls it", "沙盒应用为 RUNNING；Playground 能调用"), fail: t("Bring logs to Databricks office hours Oct. 21", "把日志带到 10 月 21 日的 Databricks 答疑"), cmd: `databricks apps get "$SANDBOX_APP" -p "$PROFILE" -o json | jq -r .app_status.state` },
        { check: t("Can create schema and volume", "能创建 schema 和 volume"), pass: t("00_setup lists the tables and the volume", "00_setup 列出表和 volume"), fail: t("Use the catalog GSA names; else keep Parquet in the app", "使用 GSA 指定的 catalog；否则把 Parquet 放在应用内"), cmd: `databricks schemas get "$CATALOG.contract_triage" -p "$PROFILE" -o json | jq -r .full_name` },
        { check: t("Workspace egress", "工作区出网"), pass: t("00_setup prints reachable for all four sites", "00_setup 对四个网站都输出 reachable"), fail: t("Download on the laptop, upload to the volume", "在笔记本上下载，上传到 volume") },
        { check: t("Clearance", "许可"), pass: t("Reply saved", "回复已保存"), fail: t("Keep the repo private", "仓库保持私有"), cmd: "gh repo view --json visibility -q .visibility" },
      ],
    },
  },
];
