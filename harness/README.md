# Harness kit

The files behind the /harness page: a complete, small harness around any LLM, the evals that measure it,
and the structure experiment that tells you which prompt and skill layout works best for your model.
Python 3.10+, standard library only. Nothing here needs a model except `evals/run_eval.py --agent model`
and `probe/probe.py`.

```
contract.yml                 what the agent is for, tool tiers, budgets, release thresholds   (step 1)
probe/probe.py               what an endpoint can do: tools, parallel calls, replay fields, context  (2)
template/                    copy this folder to start a harness                               (3)
  prompts/core.md            one source for the system prompt                                  (4)
  prompts/families.yml       per-model rendering and call settings                          (2, 4)
  tools/tools.json           tool schemas                                                      (5)
  skills/<name>/SKILL.md     skills, with evals/triggers.json                                  (7)
  AGENTS.md                  project instructions for coding agents                            (8)
  agents/*.md                subagent definitions                                              (9)
  memory/                    memory file, rules, handoff shape                                (10)
runtime/                     assemble.py (4), loop.py (6), skills.py (7), gate.py (11)
lint/                        rules.json and harness_lint.py, shared with the page's checker
evals/                       world, cases, graders, baselines, variants, runner, report    (14 to 17)
ops/                         release gate and failure taxonomy                                (18)
corpus/measure.py            the corpus measurements the page cites
tests/                       unit tests, including oracle and null baselines
check.py                     compiles, parses, tests and lints everything; --write records it
```

First run, no model needed:

```
python3 harness/check.py
python3 harness/evals/run_eval.py --agent oracle --variants all     # must be 1.000 everywhere
python3 harness/evals/run_eval.py --agent null                      # must be near 0
```

Then with a model (a local one stays on your machine):

```
python3 harness/probe/probe.py --base-url http://localhost:11434/v1 --model <name>
python3 harness/evals/run_eval.py --base-url http://localhost:11434/v1 --model <name> --family qwen \
    --variants all --repeats 3 --label "<hardware, quantization>" --write
```

A hosted model through its own API shape (the key is read from the environment variable you name):

```
python3 harness/evals/run_eval.py --api anthropic --model <model id> --family claude --api-key-env ANTHROPIC_API_KEY
python3 harness/evals/run_eval.py --api responses --base-url https://api.openai.com/v1 --model <model id> \
    --family gpt --api-key-env OPENAI_API_KEY
```

The control is `family-default`, the family's own settings; every other variant changes one setting on
top of it. Read failures in `evals/out/<run>/traces/`, tune on `--split train`, confirm on `--split test`,
and compare a candidate with `ops/release_gate.py` before it replaces what you ship.
