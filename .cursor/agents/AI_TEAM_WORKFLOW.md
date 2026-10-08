# AI Team Workflow

How the Ikram engineering AI team delivers work. The **engineering lead** (`@team`, مهندس إداري لإدارة الفرق) owns this workflow and routes every phase.

## When to use

Use this workflow for features, multi-file bugs, schema changes, permission work, security-sensitive changes, and UI+API changes.

Skip it for typos, one-line fixes, or pure Q&A. The lead may still send a one-line fix to `@review` (مراجعة كود وملفات) before a PR.

## Who is on the team

First-class roles:

| Invoke | Role |
|--------|------|
| `@team` | Engineering lead / team admin (مهندس إداري لإدارة الفرق) |
| `@frontend` | UI / frontend engineer (واجهات) |
| `@qa` | Test / QA engineer (اختبار) |
| `@backend` | Program / backend engineer (برمجة) |
| `@devops` | Systems / DevOps engineer (مهندس نظم) |
| `@security` | Security engineer (أمن) |
| `@database` | Database engineer (قاعدة بيانات) |
| `@review` | Code reviewer for code and files (مراجعة كود وملفات) |

Supporting specialists the lead may call: `@pm`, `@analyst`, `@architect`.

## Phases

```text
Request
  → Engineering lead assigns roles
  → PM / Analyst (brief + rules)
  → Architect (design)
  → Database (قاعدة بيانات) when data changes
  → Backend (برمجة) ∥ Frontend (واجهات)
  → Security (أمن)
  → QA (اختبار)
  → DevOps (مهندس نظم) when delivery/runtime changes
  → Code review (مراجعة كود وملفات)
  → PR + CI
```

Machine-readable definition: `feature.yml`.

### 0. Engineering lead

`@team` restates the goal and fills role assignments. Each first-class role is **assigned** or **N/A** with a reason.

**Exit:** a status board with owners

### 1. Product and analysis

- `@pm` writes goal, acceptance criteria, out-of-scope
- `@analyst` documents current vs desired behavior, permissions, edge cases

**Exit:** agreed acceptance criteria

### 2. Design

- `@architect` produces approach, files, API contract, risks
- `@database` (قاعدة بيانات) joins when migrations or the data model change

**Exit:** ordered implementation slices

### 3. Implementation

- `@backend` (برمجة) implements API + PHPUnit
- `@frontend` (واجهات) implements UI + Vitest/Playwright pieces
- Parallelize only when file scopes do not conflict

**Exit:** working change on a feature branch

### 4. Hardening

- `@security` (أمن) reviews authZ, uploads, PII, IDOR. Required when auth, permissions, uploads, exports, PII, or public routes change.
- `@qa` (اختبار) executes the test plan and records command output.
- `@devops` (مهندس نظم) when workflows, Docker, deploy, env, or runtime config change.

**Exit:** Critical/High security issues resolved; tests green (or blockers listed)

### 5. Review and merge

- `@review` (مراجعة كود وملفات) reviews the diff and the files, then fills a verdict against the PR template
- Open or update the PR with `.github/pull_request_template.md`
- Ensure GitHub Actions (`ci.yml`, `feature.yml`) pass

**Exit:** review verdict and a PR whose checklist matches the roles that actually ran

## Definition of done

- [ ] Acceptance criteria met
- [ ] Engineering lead recorded an assignment or N/A for each first-class role
- [ ] Permissions enforced on API (and reflected in UI)
- [ ] Migrations/models aligned when schema changed (`@database`)
- [ ] Security findings addressed or explicitly accepted (`@security`)
- [ ] Tests added/updated with evidence (`@qa`)
- [ ] Code and files reviewed (`@review`)
- [ ] PR template complete
- [ ] No secrets committed

## Example prompt

```text
@team Run the engineering team for:
Add organization search on the Daily Beneficiaries list,
including API filter, UI control, permission check, and tests.
```

The lead should assign `@analyst` or `@architect` as needed, `@database` if the filter needs an index or column, `@backend`, `@frontend`, `@security` for the permission check, `@qa`, and `@review`. `@devops` is N/A unless CI or runtime config changes.
