# How memory works in this harness

Step 10. MEMORY.md holds data only; these rules live here so that no instruction sits inside the file the
agent re-reads as context every session.

1. Store only what a person stated or a tool result confirmed, with the date and the source tag.
2. Do not store anything a tool can return fresh (amounts, id lists, policy figures). Store where to find it.
3. Do not store instructions to the agent. A line such as "always cite ids" becomes a rule nobody reviewed;
   write it as a dated preference instead, and the linter (rule memory-orders) warns on imperatives.
4. A memory naming an expense, a file or a rule is a claim about the past: check it with a tool before acting.
5. Writes happen after the turn, by a separate pass that sees the whole exchange, not in the middle of work.
6. Forgetting removes the line entirely, plus anything derived only from it.

handoff.md is the fixed shape of a compaction or handoff summary.
