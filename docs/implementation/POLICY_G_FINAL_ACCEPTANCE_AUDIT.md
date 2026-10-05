# POLICY-G Final Acceptance Contract Audit

Date: 2026-09-23  
Scope: final acceptance of POLICY-A through POLICY-F only. Phase 2C and later roadmap work remain out of scope.

## Contract map

| Policy | Implementation authority | API and permissions | Automated / PostgreSQL evidence | Browser evidence |
|---|---|---|---|---|
| A | `BeneficiaryPolicyVersionService`, configuration validator, immutable policy/evaluation models | version list/history/create/update/clone/approve/publish/retire; `view`, `edit_draft`, `approve`, `publish`, `retire` | `BeneficiaryPolicyEngineTest`; `BeneficiaryPolicyEnginePostgresTest` validates JSONB, FKs, CHECK/unique backstops and rollback | policy settings gates |
| B | `FinancialCalculationService::calculatePolicyFinancials`, eligibility and financial evaluation services | single evaluation endpoint; independent `evaluate` permission | `PolicyBFinancialCalculationTest`, `PolicyBEvaluationAndEligibilityTest`, `PolicyBPostgresTest` | policy settings gate |
| C | income-category, scoring, exception and outcome services; income and score categories remain separate | evaluation pipeline under `evaluate` | `PolicyCIncomeCategoriesTest`, `PolicyCScoringAndCategoriesTest`, `PolicyCExceptionsSnapshotAuthTest`, `PolicyCPostgresTest` | policy settings gate |
| D | document verification, medical evidence, social assessment and approval services; decisions append to history | evaluation-scoped review/document/medical/social/approve/reject endpoints; five independent D permissions | `PolicyDDocumentWorkflowTest`, `PolicyDPermissionsTest`, `PolicyDAuditLogTest`, `PolicyDPostgresTest`, `PolicyDIntegrationPostgresTest` | `policyd-review-gate.mjs` |
| E | run ledger, simulation, execution, registration integration and immutable re-evaluation services | run create/status/items/simulate/approve/execute/retry/cancel; view/simulate/apply/execute permissions | E1–E4 feature suites; E1–E4 PostgreSQL suites; real duplicate-execution concurrency harness | `policye-application-gate.mjs` |
| F | unified permanent/daily query in `BeneficiaryController`; domains and inventories remain separate | unified list/export; tab-aware domain `view`/`export` permissions | `PolicyFUnifiedBeneficiaryTest`, `PolicyFPostgresTest` | `policyf-unified-gate.mjs` |

## Acceptance gaps identified before production changes

1. POLICY-F workbook tests cover pagination-independent filtered export and safe headers, but do not yet prove formula-prefix neutralization for user-controlled cells or all three export tabs.
2. Existing D/E/F browser gates prove desktop behavior and local-only networking; 360/390/430 responsive execution is not yet consolidated.
3. Authorization is covered within phase suites, but final acceptance needs a consolidated executed matrix and explicit evaluation/run cross-resource checks.
4. Final PostgreSQL evidence is split across policy suites and must be rerun fresh together with both existing real concurrency harnesses.
5. `IMPLEMENTATION_ROADMAP.md` still contains an older stop-point paragraph that says POLICY-E–G are not started. ADR-007 and the master design require reconciliation after acceptance.

## Change rule

POLICY-G adds no feature. Production changes are permitted only for defects reproduced by the acceptance checks above. Existing A–F calculations, resident semantics, evaluation/decision history, support/delivery behavior and inventory boundaries remain fixed.
