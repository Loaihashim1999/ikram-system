# AGENTS.md — IKRAM System

## Scope
Work only on the task explicitly requested.
Do not continue into later phases unless the user explicitly authorizes them.

## Repository
Project root: `C:\laragon\www\ikram-system`

Before editing, confirm the repository root and current branch.
The working tree may intentionally contain uncommitted verified work.

## Context efficiency
Minimize token/context usage.

- Inspect only files directly relevant to the current task.
- Search first; open only matching files needed to make a decision.
- Do not recursively read the whole repository.
- Do not reread unchanged files unless necessary.
- Do not dump large files, full logs, or full diffs into chat.
- Summarize findings and show only relevant error lines.
- Use existing project documentation instead of restating project history.
- Read phase-specific docs only when the current task requires them.

Useful references when relevant:
- `docs/implementation/IMPLEMENTATION_ROADMAP.md`
- `docs/architecture/TO_BE_MASTER_DESIGN.md`
- `docs/architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md`

## Architecture rules
- PostgreSQL is authoritative.
- Backend is authoritative for financial calculations, policy evaluation, permissions, inventory, support/delivery transitions, and receipt verification.
- Reuse existing services; do not create parallel business logic.
- Preserve immutable historical policy evaluations and decisions.
- Keep Daily Beneficiary Inventory independent from General Warehouse.
- Extend existing `NotificationService`; do not replace it.
- Keep `FinancialCalculationService` as the single authoritative financial calculator.
- Do not restore deprecated policy logic into runtime use.

## Policy engine
When working on Beneficiary Policy:
- Income category and score category are separate concepts.
- Citizen policy must not be silently applied to residents.
- Residents keep their existing behavior unless explicitly changed by an approved task.
- Do not overwrite historical evaluation snapshots.
- A new re-evaluation creates a new evaluation record.
- Do not auto-copy an old approval/rejection into a new evaluation.
- Simulation must never create real policy evaluations or final decisions unless the task explicitly concerns execution rather than simulation.

## Database safety
Never access production, operational, or Aiven databases.

Use the existing local guarded PostgreSQL QA environment only when the task requires PostgreSQL verification.

Do not print database passwords, tokens, secrets, or `.env` contents.

## Git safety
Do not run destructive or broad Git commands.

Never run:
- `git clean`
- `git reset --hard`
- `git checkout .`
- `git restore .`
- broad checkout/restore/reset operations

Do not commit, push, merge, rebase, switch branches, or deploy unless explicitly asked.

Preserve unrelated user changes.

## Testing strategy
During implementation:
1. Run the smallest relevant targeted tests.
2. Fix failures.
3. Re-run targeted tests.
4. Run the full regression suite once near completion.
5. Run PostgreSQL QA only when database-specific behavior needs verification.
6. Run frontend test/lint/build only when frontend code is affected, or for final acceptance.

Do not paste full successful logs.
Report:
- command
- passed/failed/skipped counts
- assertion count when available
- only relevant failure lines

## Frontend
Follow existing React/Vite patterns.
Do not create duplicate admin workflows.
Backend permissions remain authoritative even when UI controls are hidden.

## Security
- Never expose secrets or credentials.
- Do not weaken authorization to make tests pass.
- Do not treat `404` as proof of authorization.
- Avoid logging national IDs, IBANs, document contents, passwords, tokens, or medical file contents.
- Use sanitized audit details.

## Deliverables
For implementation tasks:
- make the smallest safe change
- keep unrelated files untouched
- update only documentation relevant to the task
- provide concise evidence of tests run
- clearly state unresolved blockers

## Final response style
Keep the final report concise.

Use this structure when useful:
- Changes
- Tests
- Risks / blockers
- Verdict

Do not repeat the full project history.

## EKRAM agentic engineering charter
Before architectural work, read [EKRAM Skills & Agents](docs/agentic/EKRAM_SKILLS_AND_AGENTS.md).
- Respect A0 file ownership and execution waves within the explicitly authorized task.
- Preserve existing reviewed IKR/E2E fixes and backend authorization.
- Use the companion [file ownership](docs/agentic/EKRAM-FILE-OWNERSHIP.md), [execution order](docs/agentic/EKRAM-EXECUTION-ORDER.md), and [quality gates](docs/agentic/EKRAM-QUALITY-GATES.md) documents.
- The charter describes target architecture and required evidence; it does not establish that fixes or release gates have passed.
- Existing repository scope, database, and Git safety rules remain in force. Production E2E details are reference requirements, not permission to access production or send SMS. Deployment requires a later explicitly authorized task.
