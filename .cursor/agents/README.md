# Ikram Engineering AI Team

Specialist Cursor agents for this repo. Always-on routing and standards live in `.cursor/rules/`.

The **engineering lead** (`@team`, مهندس إداري لإدارة الفرق) coordinates the team. Mention `@team` for a full delivery, or mention one role when you already know the owner.

## Invoke the team

1. Open Agent chat in Cursor on this repo.
2. For a complete delivery, paste:

```text
@team Run the engineering team for: <goal>
```

3. For one role, mention it directly (`@frontend`, `@security`, …).

Human pipeline: `AI_TEAM_WORKFLOW.md`. Machine pipeline: `feature.yml`.

## First-class roles

| Invoke | English | Arabic | File |
|--------|---------|--------|------|
| `@team` | Engineering lead / team admin | مهندس إداري لإدارة الفرق | `team.md` |
| `@frontend` | UI / frontend engineer | واجهات | `frontend.md` |
| `@qa` | Test / QA engineer | اختبار | `qa.md` |
| `@backend` | Program / backend engineer | برمجة | `backend.md` |
| `@devops` | Systems / DevOps engineer | مهندس نظم | `devops.md` |
| `@security` | Security engineer | أمن | `security.md` |
| `@database` | Database engineer | قاعدة بيانات | `database.md` |
| `@review` | Code reviewer (code and files) | مراجعة كود وملفات | `review.md` |

### How the lead routes

| Situation | Lead assigns |
|-----------|----------------|
| Screens, forms, RTL, client behavior | `@frontend` (واجهات) |
| Proving the change with tests | `@qa` (اختبار) |
| Laravel API, services, validation | `@backend` (برمجة) |
| CI, Docker, deploy, runtime | `@devops` (مهندس نظم) |
| Auth, permissions, uploads, PII, secrets | `@security` (أمن) |
| Migrations, indexes, data integrity | `@database` (قاعدة بيانات) |
| Diff, stray files, merge verdict | `@review` (مراجعة كود وملفات) |

Security, database, and code review are first-class. The lead records **N/A** with a reason when a change truly does not need one of them. Code review still runs before a PR. Security stays on whenever auth, permissions, uploads, PII, exports, or public routes change. Database stays on whenever the data model changes.

## Supporting specialists

These stay in the pack because they make the first-class roles faster and safer.

| Invoke | Role | File | Use when |
|--------|------|------|----------|
| `@pm` | Product manager | `pm.md` | Scope, acceptance criteria, prioritization |
| `@analyst` | Business analyst | `analyst.md` | Domain rules, edge cases, permissions |
| `@architect` | Software architect | `architect.md` | Design, boundaries, API contracts |

## Related files

| Path | Purpose |
|------|---------|
| `.cursor/rules/00-team-orchestrator.mdc` | Routing |
| `.cursor/rules/01-engineering-standards.mdc` | Coding standards |
| `.cursor/rules/02-github-workflow.mdc` | GitHub / PR process |
| `.cursor/rules/03-project-context.mdc` | Ikram domain context |
| `.cursor/agents/feature.yml` | Feature pipeline definition |
| `.cursor/agents/AI_TEAM_WORKFLOW.md` | Human-readable workflow |
| `.github/pull_request_template.md` | PR template |
| `.github/workflows/feature.yml` | CI checklist for feature PRs |

## Examples

```text
@team Run the engineering team for:
Add organization search on the Daily Beneficiaries list,
including API filter, UI control, permission check, and tests.
```

```text
@security Review the new upload endpoint for authZ, file type, and PII.
@database Review the migration and indexes for that search filter.
@review Review the diff and confirm no stray files before merge.
```
