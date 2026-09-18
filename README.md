# Migration Agent

Human-supervised employee migration from messy HR exports into a mock Darwinbox tenant.

OpenRouter is the mapper. The agent sends source column names, the Darwinbox target schema, and 20–50 random rows, then applies a mapping when the model is at least **80%** sure or when one target field clearly beats the runner-up. Close calls go to a consultant. The same model then types each column (email, date order, enum, id) and that structure drives deterministic cleanup.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- OpenRouter chat completions (`OPENROUTER_MODEL`, default `openai/gpt-4o-mini`)
- SheetJS (`xlsx`) for Excel ingest
- In-memory job store + SSE for the live view
- In-memory mock Darwinbox API (`/api/target/employees`)

## Setup

```bash
cd migration-agent
npm install
cp .env.example .env.local
# set OPENROUTER_API_KEY (required)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How a run works

The agent runs in two stages, and it will not touch a single row until the column mapping is settled.

**Stage 1 — files and columns**

1. Ingest CSV/Excel files and acknowledge each one by name and row count (sample set: `legacy_hr.csv`, `payroll.xlsx`, `contractors.csv`).
2. For each file, sample 20–50 rows and send columns + samples + the target schema (`data/schema/employee.json`) to OpenRouter.
3. Auto-apply mappings at ≥ 80% confidence or with a clear winner. Auto-ignore leftover columns (notes, bank account, worker type). Queue only the genuine close calls.
4. Pause. Rows wait here until every mapping decision is resolved.

**Stage 2 — rows**

5. Ask OpenRouter for each mapped column's structure type, inferring date order from the values when the model is unsure.
6. Clean, reconcile by email then legacy ID, and validate.
7. Any value that fails cleanup gets a **second attempt** (`src/lib/agent/repair.ts`) that looks across every source row for the person and retries other date orders. Only a field that fails twice is escalated.
8. Push to the mock API. Retry failures. Roll back the tenant if needed.

Corrections typed by the consultant are validated the same way the agent validates itself — a hire date that is not a date, or an email that is not an email, is rejected with a reason rather than written to the tenant. The mock API keys on email, so re-running the same export updates people instead of failing on duplicates.

## Demo script

1. Click **Run sample**. The header confirms the files it received.
2. Watch **Live activity** while OpenRouter maps columns, and **Column mapping** fill in on the left.
3. Resolve the mapping queue item (`Role_or_Dept` is the usual one). Row migration starts only after this.
4. Watch the agent repair Maya Joshi's mangled email (`maya.joshi at contract dot northwind dot com`) on its second attempt instead of asking.
5. Resolve the three that failed twice: Meera's `Q3 2019` hire date, Karan's missing last name, Wei Chen's missing email. Try typing something invalid first — the agent refuses it.
6. The agent pushes. Use **Retry** for Samir Khan's simulated 503, and **Rollback** to undo the tenant.
7. Click any person to see that row's audit trail: source row, mappings applied, merges, your decision, and the target ID.

## Where to review agent handling

| File | What to read |
| --- | --- |
| `src/lib/agent/policy.ts` | The 80% + gap line, in one place |
| `src/lib/agent/llm.ts` | OpenRouter prompts and sampling |
| `src/lib/agent/mapping.ts` | Apply vs escalate |
| `src/lib/agent/repair.ts` | The second attempt before escalating |
| `src/lib/agent/reconcile.ts` | Identity merge and conflict detection |
| `src/lib/agent/engine.ts` | Two-stage pipeline, push, retry, rollback |
| `src/lib/agent/audit.ts` | Per-row audit trail |
| `WRITEUP.md` | Why the line is drawn there |

## Target schema

Darwinbox employee fields (`data/schema/employee.json`):

- First Name, Last Name, Email
- Address, Job Title, Department, Work Location
- Hire Date (DD/MM/YYYY), Phone Number, Date of Birth (DD/MM/YYYY)
- Legacy System ID (mapped from the source HRIS)
- Target ID (assigned by Darwinbox on insert, not mapped from source)
