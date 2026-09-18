# Approach

This is a supervised implementation agent. OpenRouter does the mapping work a consultant used to do in Excel, and the UI only interrupts when the agent cannot defend a write into Darwinbox on its own.

The run is deliberately staged: files and columns first, rows second. Nothing is migrated until the column mapping is settled, because a wrong mapping is not one bad record — it is the same bad record 27 times.

## What the agent owns

For each source file it takes the column names, the target schema, and a random sample of 20–50 rows, and asks OpenRouter to map every column. A mapping is applied when confidence is ≥ 80% **or** when the winning field beats the runner-up by a clear margin, including `ignore` for leftover columns like bank account and worker type. It then asks the model to type each mapped column, and infers date order from the values when the model is unsure rather than asking.

Cleanup is deterministic, not AI, and runs per row: casing, whitespace, email normalization, phone formatting, department synonyms, and date parsing driven by the column's inferred order. Identity is resolved on email first, then legacy ID. Exact duplicates are dropped, near-duplicate values merged, and a disagreement on an optional field keeps the first value and logs it instead of stopping the run.

## Where the line is

Two ideas decide everything: is the agent choosing between two plausible answers, and would being wrong be silent?

A column is escalated only when two target fields are genuinely competing — `Role_or_Dept` could be Department or Job Title, and picking wrong quietly corrupts every row in the file. `work_email → Email` at 97% pages nobody.

A record is escalated only after failing twice. The first attempt is per-row cleanup. If that fails, a second pass looks across every source row that merged into the person and retries other date orders, so a date the payroll file wrote as MDY or a last name present only in the contractors file gets fixed without human time. Only a field that survives both passes — `Q3 2019`, a single-token name, a missing required email — reaches the queue, because the only remaining options are to invent data or to ask.

I did not use AI per row. It costs more, gives inconsistent answers on identical inputs, and cannot be audited. Deciding the rule once per column and applying it deterministically to every row is both cheaper and defensible.

## Delta on top of what AI does

The model only proposes mappings and column types. Everything that makes the result safe is mine: the confidence-and-gap gate, auto-ignoring leftover columns, the mapping-before-rows staging, deterministic cleanup, identity reconciliation and conflict detection, the second-attempt repair pass, validation, and the per-row audit trail that records the source row, the mappings applied, each merge, the human decision, and the resulting target ID.

The human is not trusted blindly either. A correction is validated exactly like an agent-derived value, so a consultant cannot resolve a hire-date escalation by typing "sometime in 2019". The escalation stays open with the reason shown.

## What I would build next

Cache consultant resolutions as few-shot examples so the next client's file escalates less. Stream token-level mapping so the console updates per column. Replace the in-memory target with an idempotent API and support a true delta run against the next export instead of a fresh migration.
