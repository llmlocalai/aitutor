import type { Module } from "@/lib/types";

export const evaluation: Module = {
  id: "evaluation",
  title: "Evaluation",
  short: "Sealed test sets, layered metrics, and enough repeats to trust a difference.",
  layer: 4,
  depth: "deep",
  what:
    "Evaluation is the set of fixed questions, expected results, and scoring scripts that tell you whether a change made the system better. This module builds a sealed baseline, a retrieval gold set, routing and chat evals, a claim-fidelity check, and a history file that every run appends to.",
  why:
    "Agent systems change daily and fail quietly. Without numbers, each change is judged by the last conversation someone remembers. With a learning loop the risk is higher: a loop that can influence its own test will raise its score without learning anything.",
  how: [
    "Each layer gets its own eval so a failure can be located. Retrieval is scored without the chat model. Skill routing is scored without retrieval. The full agent is scored end to end.",
    "Test material is sealed before any learning job runs. Held-out chunks are excluded from study. Human-written questions are copied to a read-only folder.",
    "Each run appends one line to a history file with the configuration that produced it. Variants are selected by environment flags, so the same script compares old and new behavior.",
    "Results are read with their sample size. A difference smaller than the run-to-run spread is reported as no difference.",
  ],
  prereqs: [
    {
      id: "rag-graph",
      why: "The retrieval eval calls the search tool and scores what it returns. Gold questions are generated from indexed chunks, so the index has to exist.",
      stub: "Score a hard-coded list of results. You can build and test the metric code with no search at all.",
    },
    {
      id: "harness",
      why: "End-to-end evals send requests through the agent and read its logs. The log formats are defined by the harness.",
      stub: "Evaluate a bare model endpoint. The scripts are the same and the target URL differs.",
    },
    {
      id: "knowledge",
      why: "Held-out material is selected from the corpus. You cannot seal chunks that have not been ingested.",
      stub: "Twenty hand-written questions with expected answers.",
    },
  ],
  inBuild: [
    { path: "apps/agent-server/nightly/seal_evals.py", role: "Creates the frozen question set and the held-out chunk manifest." },
    { path: "apps/agent-server/nightly/retrieval_eval.py", role: "Builds the retrieval gold set and scores hit@k, near, doc, and MRR." },
    { path: "apps/agent-server/nightly/skill_eval.py", role: "Scores skill routing against a gold set kept separate from routing exemplars." },
    { path: "apps/agent-server/nightly/chat_eval.py", role: "Multi-turn conversations through the full agent." },
    { path: "apps/agent-server/nightly/stream_eval.py", role: "The same questions through the streaming path, repeated." },
    { path: "apps/agent-server/nightly/claim_fidelity.py", role: "Samples served claims and checks each against its cited passage." },
    { path: "apps/agent-server/nightly/quiz_runner.py", role: "Baseline versus with-knowledge arms on one question set." },
    { path: "evals/", role: "Gold sets, sealed material, run outputs, and history files." },
  ],
  flow: {
    caption: "From a proposed change to a decision",
    stages: [
      { label: "Seal", detail: "Done once, before learning. Frozen questions and held-out chunks become read-only.", kind: "store" },
      { label: "Baseline run", detail: "Score the current system. Repeat enough to know the spread.", kind: "check" },
      { label: "Change behind a flag", detail: "New behavior is selectable by an environment variable.", kind: "input" },
      { label: "Variant run", detail: "Same script, same gold set, flag on.", kind: "check" },
      { label: "Compare with noise", detail: "Is the difference larger than the spread between repeats?", kind: "check" },
      { label: "Append history", detail: "One JSON line per run with metrics and configuration.", kind: "store" },
      { label: "Decide", detail: "Make it the default, keep it off, or collect more data.", kind: "output" },
    ],
  },
  steps: [
    {
      title: "Seal the test material before anything learns",
      why: "This is first because it cannot be done afterward. Once a learning job has read a chunk or seen a question, that item no longer measures generalization.",
      body: [
        "Copy every human-written question and every historical result into a frozen folder. Results captured before any learning existed are your only true pre-learning baseline.",
        "Sample chunks from the index into a held-out manifest. The learner must treat the manifest as an exclusion list.",
        "Make the files read-only. The defense is structural. A prompt asking the loop not to look is not a defense.",
      ],
      code: {
        lang: "bash",
        text: `python3 nightly/seal_evals.py
chmod -R a-w evals/frozen
ls -l evals/frozen        # every file -r--r--r--`,
      },
      verify: "A write to the frozen folder fails, and the learner's queue contains no held-out chunk id.",
    },
    {
      title: "Run a human-written baseline",
      why: "You need one number that predates your own tooling. It anchors everything measured later.",
      body: [
        "Write ten to twenty real questions per collection with the answer and the source you expect.",
        "Run them and grade by hand once. On the reference build the first run was 13 pass and 7 fail out of 20.",
        "Add a question each time the system fumbles a real request.",
      ],
      verify: "You have a dated results file and can name which questions fail.",
    },
    {
      title: "Build a retrieval gold set",
      why: "Retrieval is scored before end-to-end quality because it is deterministic, fast, and the most common root cause. It also needs no judge.",
      body: [
        "Sample chunks: held-out first, a few per document at most, primary sources only, prose of moderate length.",
        "Have a small model write one question that the chunk answers, in its own words. Drop any question that copies a six-word run from the chunk, since that tests string matching.",
        "Keep 100 and make the file read-only. Build separate sets for question types you care about, such as citation and definition questions.",
      ],
      code: {
        lang: "python",
        text: `def copies_passage(question: str, passage: str, n: int = 6) -> bool:
    q = question.lower().split()
    p = " ".join(passage.lower().split())
    return any(" ".join(q[i:i + n]) in p for i in range(len(q) - n + 1))`,
      },
      verify: "The gold file has 100 items, each with a question and the exact chunk id that answers it.",
    },
    {
      title: "Score retrieval with rank metrics",
      why: "Metric code follows the gold set because the metric definitions depend on what the gold item identifies: a chunk, its neighbors, and its document.",
      body: [
        "For each question take the top ten results and compute the metrics below. Average across the set.",
        "Report several. Exact-chunk hit rate is strict. Document-level hit rate shows whether you are in the right place and chunked badly.",
      ],
      code: {
        lang: "python",
        text: `def score(gold_id: str, results: list[str]) -> dict:
    doc = gold_id.rsplit("::", 1)[0]
    idx = int(gold_id.rsplit("::", 1)[1])
    near = {f"{doc}::{idx + d}" for d in (-1, 0, 1)}
    rank = results.index(gold_id) + 1 if gold_id in results else 0
    return {
        "hit@1":  int(rank == 1),
        "hit@5":  int(0 < rank <= 5),
        "hit@10": int(0 < rank <= 10),
        "near@10": int(any(r in near for r in results[:10])),
        "doc@10":  int(any(r.startswith(doc + "::") for r in results[:10])),
        "mrr": 1 / rank if rank else 0.0,
    }`,
      },
      verify: "A recent reference run on a citation gold set of 60: hit@1 0.52, hit@5 0.78, hit@10 0.85, doc@10 0.93, MRR 0.64, median 1.9 seconds.",
    },
    {
      title: "Compare variants with flags and a history file",
      why: "This needs a stable baseline metric to compare against. It is the mechanism that turns every later change into an experiment.",
      body: [
        "Give each behavior change an environment flag. Run the eval with the flag off and on.",
        "Append one line per run with timestamp, variant name, sample size, metrics, and the flags in effect.",
        "Keep a change only if the metric moves. The reranker, dedup, and definition edges on the reference build were each decided this way.",
      ],
      code: {
        lang: "bash",
        text: `python3 nightly/retrieval_eval.py --run
python3 nightly/retrieval_eval.py --run --variant rerank
tail -n 2 evals/retrieval/history.jsonl`,
      },
      verify: "Two adjacent history lines differ only in variant and metrics.",
    },
    {
      title: "Evaluate routing with examples the router never saw",
      why: "Routing is a separate layer between request and retrieval. Scoring it alone tells you whether a bad answer started with the wrong skill.",
      body: [
        "Keep two files: exemplars the router matches against, and a gold set used only for scoring.",
        "When a real request is routed wrong, add a line to the exemplars. Never copy gold items into exemplars.",
      ],
      verify: "Routing accuracy is reported on the gold set, with a list of the misrouted requests.",
    },
    {
      title: "Evaluate the full agent, more than once",
      why: "End-to-end evals come after the layer evals so that when the full score drops you already know which layer to check.",
      body: [
        "Send multi-turn conversations through the real endpoint, both streaming and non-streaming. The two paths have different code and have failed differently.",
        "Run each question several times. One failure in six runs is a real defect that a single run usually misses.",
        "Check mechanical properties with code: was a data tool called, do the figures match the tool output. Use a model judge only for what code cannot check.",
      ],
      verify: "Each question has a pass rate across repeats, and failures link to request ids in the tool log.",
    },
    {
      title: "Use model judges with two votes and calibration",
      why: "Judges are needed for free-text fidelity, and they are also models with their own errors. They come late because you calibrate them against the deterministic checks you already have.",
      body: [
        "For claim fidelity, sample served claims and ask a stronger model whether the cited passage supports each one.",
        "Use two independent votes. Remove a claim from service only when it fails both. An omission alone keeps the claim.",
        "Review a sample of judge decisions by hand. On the reference build, judges rejected correct claims because an organization had two official names. The judge prompt was corrected and the rejected claims were rechecked.",
      ],
      verify: "You can state the judge's agreement rate with your own labels on a sample of at least 50.",
    },
    {
      title: "Read results with their sample size",
      why: "This is the discipline that makes the previous steps worth doing. It comes last because you need several instruments before you can see them disagree.",
      body: [
        "The reference build once measured 93.3 percent with learned knowledge against 70.0 percent without, on 30 items, in one run.",
        "A 75-item set then ran seven times in both arms. The means were 61.9 and 61.6 out of 75. The difference was 0.3 items, inside run-to-run noise, and negative twice.",
        "Both results are recorded. Neither is quoted as the system's accuracy until the two instruments are reconciled.",
      ],
      verify: "Every reported improvement names the set, its size, the number of runs, and the spread.",
    },
    {
      title: "Schedule the evals and print one line each in the daily report",
      why: "Automation comes after the evals are trusted. Scheduling an eval you do not believe produces a dashboard nobody reads.",
      body: [
        "Run retrieval and routing evals nightly, claim fidelity weekly. Pause them while a user request is in flight.",
        "Mine the logs for mechanically checkable failures. An empty result that returns rows when one filter is relaxed is a labeled example produced with no human.",
      ],
      verify: "The daily report shows each eval's latest value beside its previous value.",
    },
  ],
  together: [
    { with: "self-evolving", how: "The learner is allowed to change knowledge. Sealed evals are what stop it from grading itself." },
    { with: "guardrails", how: "Each guard rule started as an eval failure, and each has a regression test." },
    { with: "ops", how: "Evals run from the scheduler, yield to live traffic, and write into the daily report." },
    { with: "rag-graph", how: "Ranking changes ship behind flags and are kept or dropped on the retrieval history." },
  ],
  failures: [
    {
      when: "2026-09",
      title: "Two instruments disagreed about the main result",
      what: "A 30-item single run showed a 23-point gain from learned knowledge. A 75-item set over seven runs showed 0.3 items.",
      fix: "Stop quoting either number. Record both with sample sizes and investigate the difference.",
      lesson: "A single run on a small set is an anecdote with a decimal point.",
    },
    {
      when: "2026-10",
      title: "A failure that appeared once in six runs",
      what: "A spending question was answered from a web search one time in six, with the data tools never called. Every figure matched the web result, so the guard passed.",
      fix: "Repeat stream evals. Add a wrong-source rule for data turns.",
      lesson: "Intermittent failures need repeats to see and a rule about sources to stop.",
    },
    {
      when: "2026-10",
      title: "Judges rejected correct claims",
      what: "Claim judges treated two names for one organization as different entities and voted against true claims.",
      fix: "State the equivalence in the judge prompt and recheck every claim rejected for that reason.",
      lesson: "Audit the judge. Its errors are systematic and silent.",
    },
    {
      when: "2026-08",
      title: "No number moved when search broke",
      what: "The only eval measured answers from a small model. A chunking or ranking change could degrade search with no visible signal.",
      fix: "A dedicated retrieval eval with a sealed gold set.",
      lesson: "Give each layer its own measurement.",
    },
  ],
  portability: {
    databricks:
      "MLflow evaluation runs scorers and judges over an evaluation dataset stored in Unity Catalog, and traces link each score to the run that produced it. Your gold sets become tables. Sealing becomes table permissions. The metric code in this module can be registered as custom scorers.",
    watsonx:
      "watsonx.governance evaluates and monitors deployed models and agents, and the Orchestrate ADK includes an evaluation framework for agent trajectories. Keep your own gold sets and feed them in. The sample-size discipline is unchanged.",
    codex:
      "Use the provider's evals tooling or plain scripts. Codex can run your eval scripts headless as part of a change, which makes eval a gate in the coding loop.",
    cursor:
      "Evals are scripts in your repo. A rule or hook can require the retrieval eval to pass before a change to ranking code is accepted.",
    claude:
      "Run eval scripts through the coding agent, or score plugin and skill behavior with its eval commands. Keep gold files out of the agent's writable paths.",
    other:
      "The eval scripts are Python and JSON files. They move with the repo. Rebuild the gold set only if the corpus changed.",
  },
  checks: [
    {
      q: "Why must sealing happen before the learning loop runs, and why is a prompt not enough?",
      a: "A loop optimizes whatever is measurable. If it can select or phrase its own test, the score climbs while nothing is learned. An instruction can be ignored. A file the loop cannot read or write cannot be.",
    },
    {
      q: "Your end-to-end score dropped. In what order do you check, and why?",
      a: "Retrieval eval, then routing eval, then the guard logs, then the model. That order goes from deterministic and cheap to stochastic and expensive, and it follows the direction data flows.",
    },
    {
      q: "A change improves a 30-item set by 7 points in one run. What do you say?",
      a: "That it is not yet known. Seven points on 30 items is about two questions. Run it several times, report the spread, and use a larger set if the spread is that wide.",
    },
    {
      q: "Why keep routing exemplars and routing gold in separate files?",
      a: "The router matches requests against exemplars. If the gold items are in that file, the eval measures lookup of known strings and stops measuring routing.",
    },
    {
      q: "What could you evaluate if you had only a model endpoint and no agent?",
      a: "Everything in the scoring scripts. Point them at the endpoint. You would learn the unaided baseline, which is the number the agent has to beat.",
    },
  ],
  terms: [
    { term: "Held-out", def: "Material excluded from learning so it can test generalization." },
    { term: "MRR", def: "Mean reciprocal rank. The average of 1/rank of the correct item, zero if absent." },
    { term: "Variant", def: "A named configuration of flags evaluated against the same gold set." },
    { term: "Calibration", def: "Measuring how often a judge agrees with trusted labels." },
  ],
};
