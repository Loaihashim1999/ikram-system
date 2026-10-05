# EKRAM Quality Gates and Registered Requirements

Source: [Canonical EKRAM charter](EKRAM_SKILLS_AND_AGENTS.md). The charter remains authoritative; existing repository safety rules still apply. This document does not authorize later phases or production actions.

# 7. Current Registered E2E Requirements

## E2E-006 — SMS Delivery Failure

### Symptom
SMS is not proven operational in production.

### Required proof
`UI/API → communication record → queue → provider → authorized TEST phone → provider/delivery status`

### Production E2E phone
Only:
- `0574917155`
- or `+966574917155` if E.164 is required

---

## E2E-007 — Driver Link / Driver Portal Failure

### Symptom
Driver link is reported not working and the driver page does not appear correctly.

### Required proof
`distribution → driver assignment → signed link → SMS → clean browser → assigned beneficiary list → verification code → Delivered → supervisor view → delivery proof document`

Driver page must display, for the assigned driver only:
- beneficiary names
- phone numbers
- addresses
- task/reference numbers
- support types
- statuses
- confirmation action/code

---

# 8. Quality Gates

## Architecture Gate
- domain boundaries documented
- direct handover != home delivery
- driver != normal user

## Security Gate
- no permission weakening
- IDOR/nested-resource checks
- signed driver link scoped
- no secret leakage

## Data Gate
- migrations safe
- historical references preserved
- inventory never negative
- idempotent receipt/delivery

## Backend Gate
- targeted tests pass
- full backend regression passes

## Frontend Gate
- targeted tests pass
- full frontend regression passes
- stable typing/focus
- correct permission visibility
- clear validation errors

## PostgreSQL Gate
- guarded PostgreSQL regression passes

## Browser Gate
- Chrome PASS
- Edge PASS

## E2E Gate
- beneficiary full journey
- policy/support
- direct handover
- home delivery
- SMS
- driver portal
- receipt
- notifications
- documents
- cleanup

## Release Gate
No READY if:
- any unresolved Critical/High
- unexplained 5xx
- broken SMS/driver workflow
- test data cleanup failed
- Chrome or Edge critical journey fails

---

# 9. Definition of Done

EKRAM may be declared ready for controlled deployment only when:

1. Policy works end-to-end.
2. Beneficiary detail/actions are complete.
3. Beneficiary cannot become final without explicit confirmation.
4. Safe archive/delete works.
5. Support can be submitted from beneficiary.
6. Direct handover and home delivery are separate.
7. Home delivery includes driver registration, driver list, assignment counts, delivered/in-progress/remaining metrics.
8. Driver portal lists assigned beneficiaries with phone, address, task number, support type, status.
9. Driver confirms each delivery using the verification/receipt code.
10. Successful driver confirmation appears to authorized supervisors with beneficiary, address, support type, driver details, and delivery date.
11. A delivery-proof document is generated.
12. Repeated confirmation is idempotent.
13. Drivers do not require normal application accounts.
14. SMS works through the defined provider-state chain.
15. Notifications cover the defined domains.
16. Notification click opens the correct target.
17. Generated PDFs use association branding.
18. Excel exports contain complete matching data.
19. Raw technical codes are not exposed in normal UI/reports.
20. Backend/page/API authorization is aligned.
21. Backend regression passes.
22. Frontend regression passes.
23. PostgreSQL regression passes.
24. Chrome E2E passes.
25. Edge E2E passes.
26. Test-data cleanup passes.
27. No unresolved Critical/High finding remains.

---
