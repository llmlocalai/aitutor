---
name: expense-policy
description: The expense policy limits and how to apply them to one expense. Use when a question asks whether an expense is allowed, over a limit, reimbursable, needs approval, or should be flagged. Do not use for totals, lookups or arithmetic that involve no policy rule.
---
# Expense policy

Step 7 example skill. The figures below are the whole policy; do not apply rules that are not here.

## Rules
1. Meals: at most 75.00 per person per meal, tax and tip included. Report the amount over the limit.
2. Alcohol is not reimbursable. An expense whose note or vendor shows alcohol (drinks, cocktails, a bar) breaks this rule even when it is under the meal limit.
3. Any single expense over 500.00 needs manager approval before payment. It is not a violation; say it needs approval.
4. Duplicates: two expenses with the same employee, vendor, date and amount. The later id is the duplicate.
5. Software: annual seats are allowed; no limit applies.

## How to apply
- Fetch the expense with get_expense first, so the amount and note are the stored ones.
- Name the rule by its number, for example "rule 2 (alcohol)".
- If an expense breaks a rule and the user asked what to do, recommend a flag and read skills/flag-for-review before calling flag_expense.
- If no rule applies, say the expense is within policy. Do not invent a stricter rule.
