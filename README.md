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

## The console

Six views, each answering one question a consultant actually asks. The run is held in
server memory and streamed over SSE, so every tab shows the same live state and a browser
reload re-attaches to the run instead of losing it.

| Tab | What it answers |
| --- | --- |
| **Overview** | Where is the run, and does anything need me right now? |
| **Mapping** | What did the agent do with every source column, and how sure was it? |
| **People** | What does each person look like after merging — and what did they look like in the file? |
| **Decisions** | What is genuinely ambiguous, with enough context to settle it in one glance? |
| **Darwinbox** | What actually landed in the target, and what failed? |
| **Activity** | The full run record, filterable and downloadable. |

## Demo script

1. Click **Run sample**. Overview shows the five-step pipeline and the three files it received.
2. Open **Mapping** while it works: 27 columns applied on the model's confidence, 7 leftover columns ignored, 1 close call held back.
3. Settle the column decision (`Role_or_Dept` is the usual one) on **Overview** or **Decisions**. Row migration starts only after this — the stepper will not move past *Map columns* until it is answered.
4. Watch the agent repair Maya Joshi's mangled email (`maya.joshi at contract dot northwind dot com`) on its second attempt instead of asking.
5. Resolve the three that failed twice: Meera's `Q3 2019` hire date, Karan's missing last name, Wei Chen's missing email. Type `sometime in 2019` into Meera's first — the agent validates your answer the same way it validates its own and refuses it on the card.
6. Open **Darwinbox**: 27 written, 1 simulated 503 for Samir Khan. Hit **Retry** and it becomes 28. **Roll back this run** empties the tenant again.
7. On **People**, open anyone to see which file and row each value came from, the original next to the migrated value, and that person's audit trail.

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
| `src/components/job/JobProvider.tsx` | One SSE subscription shared by every tab, and reload recovery |
| `src/components/job/DecisionCard.tsx` | An escalation with enough context to resolve in one glance |
| `WRITEUP.md` | Why the line is drawn there |

## Target schema

Darwinbox employee fields (`data/schema/employee.json`):

- First Name, Last Name, Email
- Address, Job Title, Department, Work Location
- Hire Date (DD/MM/YYYY), Phone Number, Date of Birth (DD/MM/YYYY)
- Legacy System ID (mapped from the source HRIS)
- Target ID (assigned by Darwinbox on insert, not mapped from source)
