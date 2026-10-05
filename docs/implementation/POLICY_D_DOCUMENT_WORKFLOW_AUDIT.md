# POLICY-D DOCUMENT & WORKFLOW AUDIT — 2026-09-22

Audit completed before any schema/workflow change (POLICY-D0 mandate).

## 1. Beneficiary model (app/Models/Beneficiary.php)
- Fields include identity, address, family fields, financial, image URLs, health flags.
- No structured assessment/evaluation link (other than policy_evaluation FK implied by service, not direct model relationship shown).
- No `service_area` DB column (only `city`/`district`/`street` + `national_address_image_url` document).
- No `landlord` relation column.
- No `disability_percentage` column (only boolean `has_special_needs`/`is_special_needs`).
- Image URLs store document paths (`national_id_image_url`, `rental_contract_image_url`, etc.). Actual files stored in `public/beneficiaries` via `Storage::disk('public')`.
- Migration: original `beneficiaries` table; later extensions (`policy_b_financial_eligibility_extension.php`) added `social_insurance_amount`, `other_income_amount`, `monthly_rent_direct_input`, `beneficiary_type`/`status` fields.

Audit decision: POLICY-D must add assessment/research/workflow models, not replace beneficiary structure. Existing image URLs remain; new structured verification results and assessment tables added separately.

## 2. Dependent model (app/Models/Dependent.php)
- Fields: `beneficiary_id`, `name`, `relationship`, `date_of_birth`, `is_active`.
- `scopeActive()` filters on `is_active`.
- No health/disability fields; no document verification fields.
- Migration: `2026_08_03_191821_create_dependents_table.php` and `2026_08_13_010100_create_dependents_table.php` (duplicate/revised); `scopeActive` added by `policy_b_financial_eligibility_extension.php`.

Audit decision: Extend dependent health verification only via assessment/review results linked to evaluation, not by adding health fields to dependent table (to avoid changing existing data model unnecessarily). If needed, a structured `DependentHealthStatus` model/table can reference `dependent_id` and `evaluation_id`.

## 3. Document/upload architecture
- `BeneficiaryDocument.php` exists (`beneficiary_id`, `document_type` enum `national_id`/`residence_id`/`citizen_account`/`social_security`/`additional_document`, `file_url`, `file_type`, `ocr_data` json).
- Migration: `2026_08_03_191821_create_beneficiary_documents_table.php`.
- Controllers: `BeneficiaryController::handleUploads()` stores files; `DailyBeneficiaryController` handles daily docs separately.
- No document verification/review controller or service.
- No `document_type` values for `death_certificate`, `divorce_deed`, `medical_report`, `dependency_deed`, `housing_condition_assessment` etc.
- `ocr_data` is JSON (existing pattern); `file_url` is text.

Audit decision: Add new document types to enum (via migration or extend type field); create verification/review service/model. Binary files continue to use existing `Storage::disk('public')`. Do NOT duplicate binaries into snapshots.

## 4. Storage/filesystem
- Existing: `public/` disk, paths in `public/beneficiaries`.
- `Storage::disk('public')` used in controllers.
- No centralized document storage service.

Audit decision: Reuse existing public disk/storage mechanism. Policies store only verification results/references, not files.

## 5. Beneficiary registration/edit forms (frontend)
- `AddBeneficiaryPage.jsx` and `EditBeneficiaryPage.jsx` contain document upload fields (`FileUpload`, `FileUploadItem`) for identity, residence, national address, rental contract, salary certificate, etc.
- No approval/review document fields.
- No social assessment fields.

Audit decision: Add POLICY-D sections to the review/assessment page (not registration) — document verification controls, assessment forms, approval/rejection buttons.

## 6. Beneficiary detail page (frontend)
- `BeneficiaryDetails.jsx`: tabs include identity, family/dependents, financial, documents (image/pdf links), history (distributions).
- No health/special needs detail beyond boolean flag display.
- No assessment/research notes.
- No approval/review status.

Audit decision: Extend detail/review page with new POLICY-D sections.

## 7. Policy/evaluation models
- `BeneficiaryPolicyVersion.php`: UUID PK, `status` (`draft`/`published`/`retired`), `effective_from`/`effective_to`, `approved_by`, `published_by`, `retired_by`, `configuration` array, `parent_version_id`, `board_approval_reference`. Relationships: `approver()`, `publisher()`, `retirer()`, `parentVersion()`, `evaluations()` HasMany.
- `BeneficiaryPolicyEvaluation.php`: UUID PK, `status` (`completed`/`failed`), `evaluation_status` (`completed`/`failed` — note: this seems to overlap; check usage), `eligibility_decision` (`eligible`/`ineligible`/`review_required`/`not_applicable`), `eligibility_reasons` (JSON), `scoring_snapshot` array, `input_snapshot` array, `financial_snapshot` array, `final_policy_decision` string(60) nullable, `policy_score` decimal:4, `income_category` (varchar), `score_category` (varchar), `exception_code` (varchar), `exception_details` (JSON).
- Migration: `2026_09_21_010000_create_beneficiary_policy_architecture.php`.
- `final_policy_decision` stays null; POLICY-D decisions are retained separately in `PolicyDecision` (the earlier plan to set this column is superseded). Existing `scoring_snapshot`, `income_category`, `score_category` must not be altered by POLICY-D except via new evaluation record.

Audit decision: Create new assessment/research/evaluation extension models. Preserve immutability of existing evaluation snapshots. Add `final_policy_decision` updates only through controlled new evaluation/update mechanism.

## 8. Existing Policy services
- Listed in audit (subagent result): `PolicyConfigurationValidator.php`, `PolicyExceptionService.php`, `PolicyScoringService.php`, `PolicyOutcomeService.php`, `PolicyFinancialEvaluationService.php`, `PolicyIncomeCategoriesService.php`, `PolicyScoringInputs.php`, `PolicyScoringInputProvider.php`, `BeneficiaryPolicyVersionService.php`, `BeneficiaryPolicyEvaluationService.php`, `BeneficiaryPolicyEligibilityService.php`.
- All focus on versioned evaluation; none handle approval/research/social assessment.

Audit decision: Create new services: `PolicyDocumentVerificationService.php`, `SocialAssessmentService.php`, `PolicyApprovalService.php`, `PolicyDocumentRuleService.php`.

## 9. AuditLog architecture
- `AuditLog.php`: UUID PK, `user_id`, `action`, `target_table`, `target_id`, `details` (array), `created_at`.
- Migration: `2026_08_03_180641_create_audit_logs_table.php`.
- `AuditController.php`: returns audit logs for beneficiaries, distributions, representatives, inventory, drivers.
- Policy lifecycle audit (`BeneficiaryPolicyVersionService::audit()`): logs `POLICY_DRAFT_CREATED`, `POLICY_APPROVED`, `POLICY_PUBLISHED`, `POLICY_RETIRED`.

Audit decision: Reuse `AuditLog` for new actions: `DOCUMENT_VERIFIED`, `DOCUMENT_REJECTED`, `SOCIAL_ASSESSMENT_CREATED`, `SOCIAL_ASSESSMENT_SUBMITTED`, `POLICY_DECISION_APPROVED`, `POLICY_DECISION_REJECTED`.

## 10. Role/permission architecture
- `User.php`: `permissions` array; `role` string (`admin` has full bypass via `hasPermission()`).
- Migration: `2026_08_19_000000_add_permissions_to_users_table.php`.
- `BeneficiaryPolicyController.php` (if exists) and services use `Sanctum::actingAs()` but policy endpoints lack granular RBAC in service layer.
- `Permissions` not explicitly mapped to policy actions.

Audit decision: Add granular permissions for POLICY-D: `beneficiary_policy:view_documents`, `verify_documents`, `social_assessment`, `review`, `decide`. Admin full. Other users explicit-only. Do NOT allow `view` to implicitly grant `verify`, `approve`, `reject`.

## 11. Housing fields
- `housing_type` enum (`rent`, `own` in DB; `charitable_housing` in frontend — check migration consistency).
- `owns_house` boolean; `monthly_rent` (computed from `annual_rent_amount` or `monthly_rent_direct_input`).
- No `housing_condition` structured field (poor/average/good) — this is exactly the POLICY-C gap that POLICY-D must fill.

Audit decision: Create `housing_condition` as structured assessment result linked to evaluation/review, not as a beneficiary DB column (to avoid changing core beneficiary data model). Or if needed, add column to `beneficiaries` — design choice must be documented. The audit recommends a separate assessment/review result table to preserve immutability.

## 12. Family/dependent/children health
- `dependents` table has `is_active`. `Beneficiary` has `family_members_count` (manual), `non_working_children_count` (manual), `family_status` (enum), `father_status`/`mother_status` (alive/deceased).
- No health fields on dependents. No affected-child count verification mechanism beyond manual input used by scoring.
- `PolicyScoringService` uses `affected_children_count` input parameter (from input provider); `children_health` dimension uses configured band values (1→5, 2→7, 3→10).
- Policy source defines >3 as unresolved.

Audit decision: Create structured verification for affected children health (e.g., through assessment/review or through dependent health status verification). Keep `CHILDREN_HEALTH_REVIEW_REQUIRED` for >3 regardless of evidence collected.

## 13. Service area
- No `service_area` DB column; only `city`/`district`/`street` on `beneficiaries`. Review gate exists in eligibility service (`service_area` review reason). Document proof exists via `national_address_image_url`.
- Migration: no service-area registry table found.

Audit decision: Create structured service-area verification mechanism (e.g., service-area registry or deterministic match from district/city + verification result). Store result as structured assessment/review result linked to evaluation, not by altering beneficiary address.

## 14. Rental/landlord fields
- `monthly_rent`, `annual_rent_amount`, `monthly_rent_direct_input`, `housing_type`, `owns_house`. No `landlord` name/relation column. No `rent_contract` structured verification table (only image URL on beneficiary).
- `landlord_relation` is a review gate (`PolicyConfigurationValidator`); `BeneficiaryPolicyEligibilityService` checks it.

Audit decision: Add `landlord_relationship` verification result (structured: `no_prohibited_relationship` / `prohibited_relationship` / `review_required`) as assessment/review record linked to evaluation. Reference `rental_contract_image_url` for evidence, not binary copy.

## 15. Medical/health fields
- `has_special_needs`, `is_special_needs` booleans only. No `disability_percentage` column. No `verified_disability_percentage` or `medical_assessment` model.
- `head_health` scoring uses verified disability % input; `children_health` uses affected count.
- Policy requires verified disability % (`0..100` inclusive) for scoring; under-30 age unresolved; >3 affected children unresolved.

Audit decision: Create `MedicalEvidence` / `MedicalAssessment` model (verification status, verified_by, verified_at, verified_percentage `0..100`, notes/rejection reason, evidence reference). Do NOT invent percentage from boolean fields. Link to evaluation/review.

## 16. Document controllers/services
- `BeneficiaryController::handleUploads()` stores files. `DailyBeneficiaryController` handles daily docs.
- No `DocumentController` or `DocumentVerificationController`.
- No approval/rejection service for document submission.

Audit decision: Create `DocumentVerificationService` (or extend existing controller/service) to manage verification/rejection of new document types (death_certificate, divorce_deed, dependency_deed, medical_evidence, housing_condition_assessment, etc.).

## 17. Approval/review workflow
- `BeneficiaryPolicyVersionService` manages version lifecycle (`draft` → approve → publish → retire). `BeneficiaryPolicyEvaluationService` creates evaluation snapshots. `EligibilityService` produces eligibility verdict (`eligible`/`ineligible`/`review_required`/`not_applicable`).
- No researcher/manager approval workflow for beneficiary evaluation. No `final_policy_decision` mechanism (remains null). No assessment/research model.
- `AuditLog` covers policy lifecycle; does not cover assessment/research/approval.

Audit decision: Create new workflow models/services:
- `SocialAssessment` (beneficiary, policy_version/evaluation reference, researcher, assessment date, housing condition, household findings, structured recommendation, notes, status `draft`/`submitted`/`reviewed`)
- `PolicyApprovalRecord` / `PolicyDecision` (beneficiary/evaluation, approved_by/rejected_by, timestamp, decision (`approved`/`rejected`), stable reason code, evidence summary reference)
- Services: `SocialAssessmentService`, `PolicyApprovalService`, `PolicyDocumentVerificationService`, `PolicyDocumentRuleService`.

## 18. Document rule registry
- Existing config structure: `exceptions` (rules array with `code`, `enabled`, `label`, `income_ceiling`, `requires_manual_review`, `condition`). No `documents` section.
- `PolicyConfigurationValidator` validates sections via SECTIONS allowlist (`financial`, `income_categories`, `scoring`, `score_categories`, `exceptions`, `eligibility`). No `documents` section allowed.
- `withDefaults()` applies defaults per section.

Audit decision: Extend `PolicyConfigurationValidator` to add `documents` section (structured rules: code, label, applies_when, required, requires_verification, allowed_document_types, evidence_purpose). Maintain immutability of published versions; draft/new-version mechanism for changes. Do NOT add executable conditions/eval.

## 19. Database migrations
- Policy architecture: `create_beneficiary_policy_architecture.php` (versions + evaluations).
- Policy-B extension: `policy_b_financial_eligibility_extension.php` (adds eligibility fields, `is_active` on dependents, income fields).
- Documents: `create_beneficiary_documents_table.php`.
- Assessments/approval/workflow: **None found**.

Audit decision: New migrations required for:
- `social_assessments` table (assessment data, status, researcher FK, evaluation FK)
- `document_verifications` or `document_reviews` table (verification result, verified_by, verified_at, status, rejection_reason, document reference)
- `policy_decisions` table (approval/rejection history linked to evaluation)
- `housing_condition_assessments` (optional: could be part of social assessment or separate)
- `service_area_verifications` (optional: could be part of assessment)
- `medical_evidence` table (verification status, verified_percentage, verified_by, verified_at, evidence reference)
- `landlord_relationship_verifications` (optional: could be assessment field)
- `beneficiary_document_type` extension (new document types: `death_certificate`, `divorce_deed`, `medical_evidence`, `dependency_deed`, `housing_condition_assessment`, `service_area_document`, etc.)

Audit decision: Keep new tables separate; link to `beneficiary_policy_evaluations` via `evaluation_id` (FK). Preserve existing evaluation immutability by creating new evaluation/decision records rather than mutating old ones.

## 20. JSONB storage patterns
- Existing JSON columns (not exclusively JSONB on SQLite): `beneficiaries.ocr_extracted_data`, `beneficiary_documents.ocr_data`, `beneficiary_policy_versions.configuration`, `beneficiary_policy_evaluations.input_snapshot`, `financial_snapshot`, `scoring_snapshot`, `degree_classification_snapshot`, `need_level_snapshot`, `eligibility_reasons`, `users.permissions`.
- `configuration` uses `array` cast (JSON). `scoring_snapshot` stores structured breakdown.

Audit decision: New assessment/evidence results can use JSON/JSONB for structured notes/references, but core verification results should be structured columns (not embedded JSON) where they affect eligibility/scoring logic. Keep binary references (URLs) outside JSON; store verification status/reason/references as structured fields.

---

## Application integration audit — 2026-09-22

The inventory above describes the historical pre-POLICY-D baseline. It does not represent the current implemented application.

Before production edits, the integration audit inspected `routes/api.php`, `App.jsx`, `PolicyDReviewPage`, `BeneficiaryPolicyController`, `PolicyApprovalService`, `PolicyDocumentVerificationService`, `SocialAssessmentService`, all four POLICY-D models, `BeneficiaryPolicyEvaluation`, `User::hasPermission`, `ModulePermission`, and the failing controller acceptance tests.

Findings: unmounted hardcoded review page; nonexistent decision API; approval service with no completeness guards; unconstrained social transitions; permission placeholders; acceptance directory excluded from the default test gate. `User::hasPermission` uses flat permissions, whereas the authoritative API middleware uses nested module grants; integration preserves the latter contract.

Resolution: evaluation-scoped routes and real data/actions, existing service delegation, a read-only review assembler, transaction/row-lock guards, independent permissions, actual HTTP authorization/audit tests, standard-suite acceptance discovery, beneficiary detail links and a real end-to-end browser gate. No new schema and no alternate financial/scoring engine.

The permanent decision belongs in `PolicyDecision`. Input/financial/scoring snapshots and `final_policy_decision` on the producing evaluation remain untouched. Medical values are explicitly validated; no assumption is made that a schema builder `check()` declaration alone proves enforcement on every database.

The earlier 10/10 settings-only smoke is historical. Current review acceptance and all exact fresh results are recorded in [POLICY_D_IMPLEMENTATION_REPORT.md](POLICY_D_IMPLEMENTATION_REPORT.md). That report supersedes the earlier premature VERIFIED claims and missing-gate status lists.

Approval resolves only known documentary/social reason types from scoped verified evidence. Unknown policy ambiguities, unsupported age exceptions, orphan-mother exception ambiguity and more than three affected children remain unresolved; no score is invented. Published policy data and prior evaluation records are never rewritten by the review flow.


## Current final acceptance

POLICY-D VERIFIED — READY FOR POLICY-E.

Real routed review browser: 44/44, zero failures, zero unexpected remote requests. Default backend: 356 total /355 passed /1 existing skip /1543 assertions. Targeted POLICY-D: 36/36 /146 assertions. Fresh PostgreSQL: 51/51 /268 assertions. Frontend: 56 passed; lint/build, Pint and diff check passed. Full details and evidence are in the implementation report. No POLICY-E work or deployment was started.
