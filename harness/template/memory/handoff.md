---
name: handoff
description: The fixed shape of a compaction or handoff summary, so a fresh context can continue without guessing.
---
# Handoff summary

Step 10. When the context is compacted or work moves to a new session, write these sections in this order.
Fill every one; write "none" rather than skipping. Quote the user's constraints word for word.

1. Request and intent: what the user asked, in their words, and what done means.
2. Constraints: approvals given or refused, things the user said never to do.
3. Current state: what is finished, with ids and figures confirmed by tools.
4. Decisions made and why.
5. Errors met and how each was resolved.
6. Open risks.
7. Pending work, in order, and the one next step.
8. Remaining-work line, machine-checkable:
   {"total": 0, "completed": 0, "remaining": 0, "remaining_ids": []}
