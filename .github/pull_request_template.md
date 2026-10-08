## Summary

<!-- What changed and why (1–3 sentences). -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Tests only
- [ ] Docs / AI agents
- [ ] CI / DevOps
- [ ] Security hardening

## First-class roles

The engineering lead (مهندس إداري) assigns each role or marks N/A.

- [ ] Engineering lead / team admin — `@team` (مهندس إداري لإدارة الفرق)
- [ ] UI / frontend — `@frontend` (واجهات) or N/A
- [ ] Test / QA — `@qa` (اختبار) or N/A
- [ ] Program / backend — `@backend` (برمجة) or N/A
- [ ] Systems / DevOps — `@devops` (مهندس نظم) or N/A
- [ ] Security — `@security` (أمن) or N/A
- [ ] Database — `@database` (قاعدة بيانات) or N/A
- [ ] Code review (code and files) — `@review` (مراجعة كود وملفات)

## AI team phases completed

- [ ] Engineering lead role assignments
- [ ] PM / Analyst brief
- [ ] Architect design (or N/A — trivial)
- [ ] Database / migrations (قاعدة بيانات) (or N/A)
- [ ] Backend (برمجة)
- [ ] Frontend (واجهات) (or N/A)
- [ ] Security review (أمن) (or N/A)
- [ ] QA evidence (اختبار)
- [ ] Systems / DevOps (مهندس نظم) (or N/A)
- [ ] Code and file review (مراجعة كود وملفات)

## Acceptance criteria

<!-- Checklist from the PM brief. -->

- [ ]

## Test plan & evidence

```bash
# Commands run (replace with actual):
php artisan test
cd frontend && npm test -- --run
# npm run test:browser
```

| Suite | Result |
|-------|--------|
| PHPUnit | |
| Vitest | |
| Playwright | |
| CI | |

## Security / permissions

- [ ] AuthZ checked on new/changed write paths
- [ ] Uploads / imports validated (or N/A)
- [ ] No secrets committed
- [ ] PII logging minimized

## Screenshots / recordings

<!-- Required for user-visible UI changes. -->

## Risk & rollback

<!-- What could break? How to revert? -->

## Checklist

- [ ] Diff is focused (no unrelated refactors)
- [ ] Changed files belong in the paths they occupy
- [ ] Migrations included if schema changed
- [ ] Docs / agent files updated if workflow changed
