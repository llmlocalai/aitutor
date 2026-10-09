# AGENTS.md (scope: this folder and everything below it; a deeper AGENTS.md overrides this one)

Step 8. Project instructions for any coding agent working on this harness (Codex, Claude Code, Gemini CLI
and Cursor all read a file like this; name it as your tool expects, or symlink). Keep it under 32 KiB, the
default size Codex loads. Everything here is a fact a new session cannot derive in a few tool calls.

## Project in one paragraph
An expense desk agent. The system prompt is rendered from prompts/core.md by runtime/assemble.py; tools are
in tools/tools.json; skills in skills/<name>/SKILL.md; the tool tiers in ../contract.yml.

## Commands (copy exactly)
- Render the prompt for a model family: `python3 ../runtime/assemble.py --family qwen`
- Lint every harness file: `python3 ../lint/harness_lint.py .`
- Unit tests: `python3 -m unittest discover -s ../tests`
- Baselines (no model): `python3 ../evals/run_eval.py --agent oracle` then `--agent null`
- Full eval: `python3 ../evals/run_eval.py --base-url <url> --model <name> --family <family> --variants all`

## Definition of done
A change is done when the linter reports no errors, the unit tests pass, the oracle still scores 1.0,
and the eval on the target model is not worse than the last release (ops/release_gate.py says PASS).

## Conventions
- Prompt content changes go in prompts/core.md, never in a family-specific copy.
- Every rule line carries `why:` and `caps:` parts; the linter rejects a rule without a reason.
- A new tool needs a tier in contract.yml before it works (the gate denies unknown tools).
- A new skill needs evals/triggers.json with at least four near-miss negatives.

## Boundaries
- Do not edit evals/cases.json to make a run pass. Add a case for a new behavior; change a case only
  when its expectation is wrong, in its own commit with the reason.
- Ask first: changing a tool tier, raising a budget in contract.yml, deleting a case.
- Never put a real key in any file. The runner reads keys from an environment variable named by --api-key-env.

## Known pitfalls
- Ollama truncates a long prompt silently when the context length is small; run probe/probe.py first.
- Results from one model do not transfer to another; rerun the structure experiment per model.
