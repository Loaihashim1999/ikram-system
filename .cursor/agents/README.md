# Software Engineering AI Agents — Ikram System

This folder defines the specialist agents for Cursor. Always-on routing and standards live in `.cursor/rules/`.

## Quick start

1. Open Agent chat in Cursor on this repo.
2. Mention a specialist (`@pm`, `@backend`, …) **or** ask the main agent to run the team pipeline.
3. For a full feature, say: “Run the AI team workflow for: \<goal\>” (see `AI_TEAM_WORKFLOW.md`).

## Agents

| File | Role |
|------|------|
| `team.md` | End-to-end coordinator |
| `pm.md` | Product scope & acceptance |
| `analyst.md` | Domain rules & edge cases |
| `architect.md` | Technical design |
| `database.md` | Schema & migrations |
| `backend.md` | Laravel API |
| `frontend.md` | React UI |
| `devops.md` | CI/CD & deploy |
| `security.md` | Security review |
| `qa.md` | Test evidence |
| `review.md` | PR / merge gate |

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
