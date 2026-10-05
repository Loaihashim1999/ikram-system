# AI Team Workflow

How the Software Engineering AI Agents deliver work on **Ikram System**.

## When to use

Use this workflow for features, multi-file bugs, schema changes, permission work, and UI+API changes.

Skip it for typos, one-line fixes, or pure Q&A.

## Phases

```text
Request
  → PM / Analyst (brief + rules)
  → Architect (design)
  → Database (if needed)
  → Backend ∥ Frontend
  → Security
  → QA
  → Review
  → PR + CI
```

Machine-readable definition: `feature.yml`.

### 1. Product & analysis

- `@pm` writes goal, acceptance criteria, out-of-scope
- `@analyst` documents current vs desired behavior, permissions, edge cases

**Exit:** agreed acceptance criteria

### 2. Design

- `@architect` produces approach, files, API contract, risks
- `@database` joins if migrations/data model change

**Exit:** ordered implementation slices

### 3. Implementation

- `@backend` implements API + PHPUnit
- `@frontend` implements UI + Vitest/Playwright pieces
- Parallelize only when file scopes do not conflict

**Exit:** working change on a feature branch

### 4. Hardening

- `@security` reviews authZ, uploads, PII, IDOR
- `@qa` executes test plan and records command output
- `@devops` only if workflows/deploy config changed

**Exit:** Critical/High security issues resolved; tests green (or blockers listed)

### 5. Review & merge

- `@review` fills verdict against the PR template
- Open/update PR with `.github/pull_request_template.md`
- Ensure GitHub Actions (`ci.yml`, `feature.yml`) pass

## Definition of done

- [ ] Acceptance criteria met
- [ ] Permissions enforced on API (and reflected in UI)
- [ ] Migrations/models aligned when schema changed
- [ ] Tests added/updated with evidence
- [ ] PR template complete
- [ ] No secrets committed

## Example prompt

```text
@team Run the AI team workflow for:
Add organization search on the Daily Beneficiaries list,
including API filter, UI control, permission check, and tests.
```
