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

## AI team phases completed

- [ ] PM / Analyst brief
- [ ] Architect design (or N/A — trivial)
- [ ] Database / migrations (or N/A)
- [ ] Backend
- [ ] Frontend (or N/A)
- [ ] Security review (or N/A)
- [ ] QA evidence
- [ ] Review verdict

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
- [ ] Migrations included if schema changed
- [ ] Docs / agent files updated if workflow changed
