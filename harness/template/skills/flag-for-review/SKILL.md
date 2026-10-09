---
name: flag-for-review
description: How to propose a policy flag on an expense with flag_expense, including the approval step. Use when the user asks to flag, report or mark an expense, or when expense-policy recommends a flag. Do not use to decide whether a rule is broken; that is expense-policy.
---
# Flag an expense for review

Step 7 example skill.

1. Confirm the facts with get_expense. If the id is not found, stop and say so.
2. Write the reason as one sentence that names the rule and the evidence, for example "Duplicate of E-1006: same vendor, date and amount."
3. Call flag_expense once per expense. Never call it twice for the same id in one conversation.
4. If it returns needs_confirmation, tell the user the id and the reason, and ask "Shall I flag it?". Do not say it was flagged.
5. If it returns flagged, say it is flagged and waiting for a reviewer. Do not say it was rejected, paid or removed.
