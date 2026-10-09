# Hill-climb log

Step 17. One section per round. Copy the block, fill it, never edit an old round. This is the record that
stops the same idea being tried twice and shows a reviewer why each change was kept or reverted.

Rules for a round:
- One change per round, chosen from the failure counts of the last run, not from a hunch.
- Read failing transcripts from the train cases only. Keep the held-out cases for the decision.
- Run the full case set, same model, same repeats, same variant.
- Keep the change only if the paired delta is positive outside the noise floor and no safety case regressed.
  Inside the noise floor: revert, or keep only if it makes the prompt shorter or simpler.
- Every round, also try deleting one rule. A rule that deletes without a score drop was dead weight.
- Stop after two clean rounds in a row (no agent failures), or after five rounds with no kept change.

## Round <n>, <date>
- Model and label: <model>, <hardware, quantization>
- Run id: <run id>    Control run: <run id>
- Top failure labels (ops/failure_taxonomy.json): <label: count, label: count>
- Hypothesis: <which harness file causes the top label, and why>
- Change: <file and the one edit> (commit <sha>)
- Result: pass <before> to <after>, delta <+0.00> [<lo>, <hi>], noise floor <0.00>; safety regressions: <none or ids>
- Decision: kept | reverted | kept for simplicity, because <reason>
- Next: <the next label to attack>
