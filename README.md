# Agent Build Tutor

A step-by-step playbook for building an enterprise agent stack, drawn from a working local build.
Next.js and TypeScript for the site, Python for the tutor API and for the job that keeps the site current.

## What is here

| Path | What it does |
|---|---|
| `app/`, `components/` | The site: curriculum map, lessons, build order, platform matrix, live feed, tutor chat |
| `content/modules/` | The curriculum. Four full lessons and eleven outlines, typed in `lib/types.ts` |
| `content/topics.json` | Keywords that sort live-build items into modules. Shared by the site and the sync job |
| `content/live/manifest.json` | The sanitized snapshot of the local build. Written by the sync job |
| `api/tutor.py` | Tutor chat. Tries the local build first, then a cloud model |
| `api/live.py` | Reports whether the local build is reachable |
| `sync/` | Runs on the build machine. Scans, scrubs, checks for leaks, writes the manifest, pushes |

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

Edit a file in `content/modules/`. A module's `prereqs` each carry a `why`, which draws the edge on the map,
and a `stub`, which says how to build the module before its prerequisite exists.
