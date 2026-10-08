# Agent Build Tutor

A step-by-step playbook for building an enterprise agent stack, drawn from a working local build.
Next.js and TypeScript for the site, Python for the tutor API and for the job that keeps the site current.

## What is here

| Path | What it does |
|---|---|
| `labs/` | A small, complete agent stack, one folder per module. Runs offline against a fake model, or against your model when `LAB_BASE_URL` is set |
| `content/modules/` | The 15 lessons, in English and Chinese. Each step names what it uses, what it produces, and which lab file it shows |
| `content/platforms/` | Step-by-step guides for six platforms, written from vendor documentation and not executed |
| `content/lab-output.json` | What each lab printed. Written by `python3 -m labs.run_all`. Lessons show it as recorded output |
| `lib/audit.ts`, `/audit` | Build-time self-audit. A broken step link, a missing translation, or a quoted number the labs did not print fails the build |
| `app/`, `components/` | The site: map, lessons, playbook with progress, platform guides, live feed, tutor chat, language toggle |
| `content/live/manifest.json` | The sanitized snapshot of the local build. Written by the sync job |
| `api/tutor.py`, `api/live.py` | Tutor chat (local model first, then cloud) and local-build status |
| `sync/` | Runs on the build machine. Scans, scrubs, checks for leaks, writes the manifest, pushes |

## Run the labs

```bash
python3 -m labs.run_all            # every lab, offline, about 20 seconds; rewrites content/lab-output.json
pip install mcp                    # needed by lab 6 (MCP); lab 14 needs langgraph langchain-openai openai-agents
export LAB_BASE_URL=http://127.0.0.1:11434/v1 LAB_MODEL=<tag>   # use a real model
```

Run `labs.run_all` before every push if you changed a lab. The build then verifies the lessons against the new output.

## Run it locally

```bash
npm install
npm run dev:api     # terminal 1: Python functions on :5328
npm run dev         # terminal 2: site on :3000
```

## Deploy

Import the repository in Vercel. The framework is detected as Next.js and `api/*.py` deploy as Python functions.
Set the variables in `.env.example` under Project > Settings > Environment Variables.

## Keep it current

On the build machine, from this folder:

```bash
python3 sync/test_scrub.py          # redaction tests
python3 sync/sync.py --dry-run      # see what would be published, and what was dropped
python3 sync/sync.py --push         # write the snapshot, commit, push
bash sync/install_schedule.sh       # run it every 30 minutes
```

`sync/config.json` holds the denylist and the replacement terms. Everything under the build folder is
eligible unless excluded there. Databases, keys, env files, logs and JSON data are excluded in code.

## Add or change a lesson

Edit a file in `content/modules/`. Every string is `t("English", "中文")`. A step's `needs` links it to earlier
steps as `"<module>.<step>"`, and `lab` points at a file (and optional `# region:`) under `labs/`.
`npm run build` runs the audit and tells you what is missing.
