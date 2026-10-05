# A2 domain contracts

Date: 2026-10-05. Branch: `main`. Repository: `C:\laragon\www\ikram-system`.

This contract incorporates [A1-MAP.md](A1-MAP.md) with ADR-007, `EKRAM-TARGET-ARCHITECTURE.md`, `EKRAM-WORKFLOW-STATES.md`, and the current services named below. Nationality derivation, the elderly finding (NONE), and the جهات المستفيد finding (UNDEFINED) are unchanged.

No elderly threshold is introduced here. No recipient entity is introduced here.

## A1 reconciliation

Cited from `docs/agentic/phase-2-prompts/evidence/A1-MAP.md` sections 3, 5, 6, and 8, and the gaps list.

1. The dashboard card «تم التوصيل والإنهاء» (subtitle «استلام مكتمل ميدانياً») counts legacy `Distribution` rows with status `delivered` (`Dashboard` via `GET /distributions`). R-DASH-01 forbids relabeling that count as a `SupportReceipt` statistic. The label that must stay with that metric is «تم التوصيل والإنهاء». Completed `SupportReceipt` counts are a separate field on beneficiary lists (R-BEN-02, section 2). They are not a rename of this card.
2. The mounted support action is the draft save on `SupportRequestPage` (`POST /api/support/distributions`, heading طلب دعم للمستفيد, button حفظ مسودة طلب الدعم). Unmounted pages `BeneficiaryList` `handleSubmitDispatch`, `SendSupportPage`, and `DistributionPage` are not the phase-2 entry. List selection and beneficiary details must call that mounted draft endpoint. Do not remount those legacy pages.
3. Daily national-id prefix checks (`/^[12]\d{9}$/`, with 1 described as a national id and 2 as residency) stay format checks. They do not set `nationality` or `beneficiary_type`.

## 0. Authorities that stay

These stay the only writers for their decisions. Do not add a parallel calculator, policy engine, inventory engine, support engine, notification service, or receipt verifier.

| Concern | Authoritative type |
| --- | --- |
| Legacy financial totals and resident need level | `App\Services\FinancialCalculationService::calculate` |
| Policy financials | `FinancialCalculationService::calculatePolicyFinancials` |
| Citizen eligibility verdict | `App\Services\BeneficiaryPolicy\BeneficiaryPolicyEligibilityService` |
| Evaluation orchestration and new snapshots | `App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService` and `BeneficiaryPolicyEvaluationService::create` |
| Income categories, score, exceptions | `PolicyIncomeCategoriesService`, `PolicyScoringService`, `PolicyExceptionService` |
| Approval history | `PolicyApprovalService` writing `App\Models\PolicyDecision` |
| Simulation | `PolicyApplicationSimulationService` — no real evaluation and no `PolicyDecision` |
| Support initiation and stock transitions | `App\Services\SupportDistributionService` |
| Physical receipt confirmation | `App\Services\Delivery\ReceiptVerificationService` |
| Notifications | `App\Services\NotificationService` |
| Quantities | Existing stock lock / `SupportQuantity`. Daily inventory stays independent of General Warehouse |
| Permissions | `ModulePermission`. A 404 is not authorization |
| Governance read model | `App\Services\GovernanceReportService` |
| Spreadsheet parse / column suggest | `App\Services\SmartExcelImportService` |

Citizen policy applies only when `beneficiary_type` is `citizen` (`FinancialCalculationService::POLICY_APPLICABLE_TYPES`). A derived `resident` stays on the resident path. Income category and score category stay separate. A new evaluation inserts a new `beneficiary_policy_evaluations` row and does not copy a prior approval or rejection.

## 1. R-BEN-01 — nationality

### Where nationality is stored today

| Population | Column | Current rule |
| --- | --- | --- |
| Permanent | `beneficiaries.nationality` nullable string(100). Original migration comment: for the resident. | Not required for citizens. `BeneficiaryController::rules` uses `required_if:beneficiary_type,resident`. |
| Permanent classification | `beneficiaries.beneficiary_type` required `citizen` or `resident` | Client-supplied. Not derived from nationality. |
| Daily | `daily_beneficiaries` has no `nationality` and no `beneficiary_type` | `DailyBeneficiaryController::store` does not ask for either. `BeneficiaryController::unifiedQuery` selects the literal `'daily'` as `beneficiary_type`. That literal is the domain, not the classification. |

The only Saudi nationality token stored by the current UI and by the employee-column default is the exact string `سعودي`. Do not add synonyms (`Saudi`, `السعودية`, national-id prefix `1` or `2`). The daily national-id pattern (`1` citizen id, `2` residence id) is an id format check only.

### Derivation the backend must apply

On permanent create, permanent update, daily create, daily update, and both import targets:

1. `nationality` is required. Trim it. Null, missing, or whitespace is a 422 on field `nationality`. Message may reuse the existing Arabic text `الجنسية مطلوبة للمستفيد المقيم.` only if it is changed so it is not limited to residents. Do not substitute `سعودي` or `citizen`.
2. After trim, exact `سعودي` sets `beneficiary_type = citizen`.
3. Any other non-empty value sets `beneficiary_type = resident`.
4. If the client also sends `beneficiary_type` or `type` and it disagrees with this derivation, return 422. Do not keep the client value.
5. Maximum length remains 100.

`FinancialCalculationService::calculate` still defaults a missing `beneficiary_type` to `citizen`. That default is not this rule. Callers must pass the derived type before `calculate()`. Do not change that default in this phase.

Daily storage is additive on the existing `daily_beneficiaries` table, not a new entity: `nationality` string(100) and `beneficiary_type` string `citizen|resident`, both required on write. `source` stays `permanent` or `daily`. Stop selecting `'daily' as beneficiary_type`.

### Switching nationality

Updating the live row may change `nationality`, the derived `beneficiary_type`, and the income fields already sanitized by `BeneficiaryController::sanitizeFinancialSources`:

- `citizen`: `salary`, `retirement`, `citizen_account`, `social_security`, `family_support`
- `resident`: `salary`, `family_support`

Disallowed source amounts are set to 0 on the live row only. Then `FinancialCalculationService::calculate` refreshes `total_income`, `monthly_rent`, `net_income`, `priority`, and `category_id` as it does today. Do not call `calculatePolicyFinancials` from registration or import.

Permanent create already requires `reviewed_confirmation` accepted. The same flag is required before a permanent update that changes nationality, before daily create, and before daily update that changes nationality. Daily has no `confirmed_at` column. Do not add one in this contract. The flag is the confirmation.

### What must not change

A nationality change must not update:

- `beneficiary_policy_evaluations` (input, financial, and scoring snapshots, `eligibility_decision`, `income_category`, `score_category`)
- `policy_decisions`
- `support_receipts`, including `proof_snapshot` (`SupportReceipt` already throws if that column is dirtied)
- issued PDF files

Do not auto-run `PolicyRegistrationEvaluationService` because nationality changed. A later re-evaluation, if separately requested, inserts a new evaluation and does not copy the old decision.

## 2. R-BEN-02 and R-BEN-03 — list, filters, receipts

### Completed receipt

Permanent completed receipt:

- Model: `App\Models\SupportReceipt` (`support_receipts`)
- The receipt row has no status column. It is inserted only by `ReceiptVerificationService` after completion.
- Parent status that means completed: `support_distributions.status = completed`
- Date: `support_distributions.completed_at` (copied onto `support_receipts.confirmed_at`)
- `support_receipts.support_distribution_id` is unique, so one receipt is one distribution
- `recipient_type` must be `beneficiary`

Do not count `distributions` (legacy; `delivered` / `received` / `completed` there is a compatibility metric only). Do not count `support_distribution_items` rows.

Daily completed receipt, kept separate from General Warehouse:

- Model: `App\Models\DailyReceivingTransaction`
- Status that means completed: `received` (`DailyReceivingController` writes this value)
- Date: `receiving_date`
- Count transaction ids, not `quantity`

### List fields

One response row for both domains. Keys:

| Key | Permanent source | Daily source |
| --- | --- | --- |
| `id` | `beneficiaries.id` | `daily_beneficiaries.id` |
| `source` | `permanent` | `daily` |
| `full_name` | `full_name` | `full_name` |
| `beneficiary_type` | derived `citizen` or `resident` | derived `citizen` or `resident` |
| `phone` | `phone` | `phone` |
| `address` | `street` | `null`. No street column exists. Do not add one here. |
| `district` | `district` | `district` |
| `family_status` | `family_status` | `null`. No column exists. Do not add one here. |
| `nationality` | `nationality` | `nationality` after the additive column |
| `created_at` | `created_at` | `created_at` |
| `completed_receipt_count` | integer from the aggregate below | integer from the daily aggregate |
| `latest_completed_receipt` | object or `null` | object or `null` |

`latest_completed_receipt` keys: `id` (support distribution id, or daily transaction id), `completed_at` (ISO-8601), `summary` (string).

Permanent summary: item `name`, `fulfilled_quantity`, and `unit_snapshot` for that one distribution, joined once. Daily summary: `basket_type_name` and `quantity` of that one transaction.

Actions are not columns. They stay on the existing routes and stay hidden without the existing module permission:

- edit: `POST /api/beneficiaries/{beneficiary}` or daily update
- archive/delete: permanent `destroy` sets `archived_at`, `archived_by`, `archive_reason` and does not hard-delete. Daily keeps `SoftDeletes`.
- detail: existing show routes
- attachments: `PrivateDocumentController` beneficiary documents, and daily document routes. Do not add a replace-in-place upload.

Employee rows stay out of this list. Use the existing predicate in `unifiedQuery`: `is_employee` is false or null, and `priority` is not `employee` or is null.

### Filters

Combined with AND. Query names:

| Param | Rule |
| --- | --- |
| `beneficiary_type` | `citizen` or `resident`. Do not accept `daily` here. |
| `district` | exact match on `district` |
| `family_status` | exact match on `beneficiaries.family_status`. When set, the daily arm matches nothing. |
| `nationality` | exact match on the trimmed stored value |
| `nationality_missing` | `1` means null or blank after trim. Do not treat that set as `سعودي`. |
| `search` | existing unified predicate: `full_name`, `national_id`, `phone` |
| `tab` | existing `all`, `permanent`, `daily` |
| `sort` | `full_name`, `created_at`, `district`, `beneficiary_type`, `completed_receipt_count`, `latest_completed_at` |
| `direction` | `asc` or `desc` |
| `page`, `per_page` | existing unified bounds: page ≥ 1, per_page 1–100 |

Default order remains `created_at` desc, then `id` desc.

`GET /api/beneficiaries/unified` and `GET /api/beneficiaries/unified/export` already share `unifiedQuery`. Extend that one query. Export uses the same filters and the full match set, not the page slice. Do not keep a second receipt calculation on `BeneficiaryController::index`.

### Aggregate

Not a query per row. At most two statements for receipt data on a page: the grouped join inside the list query, then one `whereIn` for the latest ids on that page to build `summary`.

Permanent arm, joined once:

```sql
SELECT d.beneficiary_id,
       COUNT(r.id) AS completed_receipt_count,
       MAX(d.completed_at) AS latest_completed_at
FROM support_distributions d
INNER JOIN support_receipts r ON r.support_distribution_id = d.id
WHERE d.status = 'completed'
  AND d.recipient_type = 'beneficiary'
  AND d.beneficiary_id IS NOT NULL
GROUP BY d.beneficiary_id
```

Latest row tie-break: greatest `completed_at`, then greatest `support_distributions.id`.

Daily arm, joined once, not mixed into the permanent subquery:

```sql
SELECT daily_beneficiary_id,
       COUNT(id) AS completed_receipt_count,
       MAX(receiving_date) AS latest_completed_at
FROM daily_receiving_transactions
WHERE status = 'received'
GROUP BY daily_beneficiary_id
```

Latest row tie-break: greatest `receiving_date`, then greatest `id`.

## 3. R-IMP-01 — import

Reuse `App\Services\SmartExcelImportService` through `App\Http\Controllers\SmartImportController`.

| Call | Route | Writes |
| --- | --- | --- |
| `preview` | `POST /api/smart-import/{entity}/preview` | nothing |
| `store` | `POST /api/smart-import/{entity}` | only after confirmation |

Beneficiary management uses `entity=beneficiaries` plus a required `target` of `permanent` or `daily`. Missing or unknown `target` is 422. Do not default to permanent. Do not use `entity=organizations` or `entity=staff` for this flow.

`target=permanent` inserts `beneficiaries`. `target=daily` inserts `daily_beneficiaries`. Both use section 1 for nationality. Preview still returns `fields`, and each sheet's `suggested_mapping`, `preview_rows` (first 10), and `row_count`.

`store` requires `reviewed_confirmation` accepted for both targets. If it is absent, write nothing.

Duplicates: existing `national_id` is `skipped`. Do not update that row. Response shape stays `created`, `skipped`, `failed`, `total`, `errors` (first 100), `message`.

`SmartImportController::importRow` for `beneficiaries` currently maps an unknown type to `citizen` and then calls `PolicyRegistrationEvaluationService::evaluateNewBeneficiary`. Both stop. `BeneficiaryController::importExcel` (`POST /api/beneficiaries/import`) does the same default and the same policy call, and it also invents a name `مستفيد جديد` and a phone `0500000000`. That method is not a second importer. It must not keep those defaults. Beneficiary-management UI calls the smart-import routes only.

Side effects that must not run on preview or confirm:

- `PolicyRegistrationEvaluationService::evaluateNewBeneficiary`
- `PolicyFinancialEvaluationService`, `BeneficiaryPolicyEligibilityService`, or any insert into `beneficiary_policy_evaluations` or `policy_decisions`
- `SupportDistributionService` or legacy `DistributionController::store`
- `NotificationService`, communication jobs, or SMS
- inventory movements and `SupportReceipt` / `DailyReceivingTransaction` creation

Allowed on confirm only: parse and map, validate, skip duplicates, insert the new row, `FinancialCalculationService::calculate` for a permanent insert after the type is derived, `confirmed_at` / `confirmed_by` on that permanent row, and an audit row that records the import. Daily confirm does not call `calculate`.

## 4. R-SUP-01 — initiation versus physical receipt

### إرسال الدعم entry points that exist now

| Surface | What it does today | Initiates support? |
| --- | --- | --- |
| `frontend/src/pages/beneficiaries/BeneficiaryList.jsx` `handleSubmitDispatch` | `POST /api/distributions` via `distributionApi.create` | Legacy distribution create. Not `SupportDistributionService`. |
| `frontend/src/pages/beneficiaries/BeneficiaryDetails.jsx` link `إنشاء طلب دعم` to `/beneficiaries/:id/support` | `SupportRequestPage` `POST /api/support/distributions` | Yes. `SupportDistributionService::create`, status `draft`. |
| `frontend/src/pages/delivery/SendSupportPage.jsx` and `DistributionPage.jsx` | Legacy `distributionApi` | Not mounted in `frontend/src/App.jsx`. |

Staff and neighborhood-rep screens use the same Arabic label for other populations. They are not the beneficiary entry points.

The phase-2 entry is the mounted draft endpoint in the A1 reconciliation, not the unmounted rows in the table above. List selection and beneficiary details call `SupportDistributionService::create` (`POST /api/support/distributions`) with `recipient_type=beneficiary` and an explicit `fulfillment_method` of `pickup` or `delivery`. Creation status stays `draft`. Do not remount `BeneficiaryList`, `SendSupportPage`, or `DistributionPage`. Archived beneficiaries stay rejected by the existing service check. This call does not confirm a receipt, does not consume a code, and does not move stock to fulfilled.

`SupportDistributionController::transition` with action `complete` already returns 409: `يجب تأكيد رمز الاستلام عبر مسار التحقق.` Leave that refusal in place.

### Physical receipt

Confirmation is only `ReceiptVerificationService`:

- preview: `POST /api/support/distributions/{id}/verify-preview` (no completion)
- confirm: `POST /api/support/distributions/{id}/verify`

Confirm completes the distribution, writes one `SupportReceipt`, consumes the challenge, and moves stock once. Direct handover and home delivery stay separate experiences (section 9). They share this verifier. They do not share a page.

### Elderly age rule

**NONE.**

`SupportDistributionService` does not read an age. `FinancialCalculationService::determinePriority` has no age branch: a citizen is `first_class` or `second_class` from net income, and a resident is always `second_class`.

Do not add a numeric elderly threshold. Do not copy a number from the nearby code below into a new rule.

Nearby code that is not a support rule:

- `BeneficiaryController::classifyPriority` reads settings key `elderly_min_age` and, when the row is missing, uses integer 60, then returns priority `elderly` when `Carbon` age is greater than or equal to that integer. The method is private and is not called by `store`, `update`, or support creation.
- `SettingsController` accepts `elderly_min_age` as an integer from 0 to 150. No support or policy service reads it for eligibility.
- `frontend/src/pages/delivery/SendSupportPage.jsx` filters `priority === "elderly"` or a calendar-year difference of 60. The same client comparison appears in `DeliveryPage.jsx` and `StatisticsPage.jsx`. `Settings.jsx` labels the setting `فوق 60 سنة`. Those are not backend authority.
- `PolicyScoringService::scoreAge` scores versioned policy bands and returns `HEAD_AGE_UNRESOLVED` when age is missing or outside the published bands. That is not an elderly support cutoff.

Beneficiaries already stored with `priority = elderly` or `is_elderly = true` may be selected for support the same way as any other non-archived beneficiary. Do not compute a new age to include or exclude them.

## 5. جهات المستفيد

**UNDEFINED.**

The exact phrase `جهات المستفيد` is not an application entity type. Two different records use similar words and must not be merged or aliased by this contract:

| Type | Table / class | How the product names it |
| --- | --- | --- |
| `App\Models\NeighborhoodRep` | `neighborhood_reps` | UI label `الجهات المستفيدة`, route `/representatives` |
| `App\Models\Organization` | `organizations` | `SupportDistribution.recipient_type = organization` |

Do not create a recipient type. Do not map the phrase onto either class. Support recipient types remain `beneficiary`, `staff`, and `organization`.

## 6. R-RPT-01 — nationality populations

Build this inside `GovernanceReportService` so the chart, table, totals, and PDF export call one method. Reuse the existing analytics period inputs already validated by `AnalyticsController::index`: `period_type` plus `date`, `start_date`/`end_date`, `month`, or `year`. Reuse `domain` `all|permanent|daily`.

Employee exclusion matches the list predicate in section 2. Do not dedupe a person across `beneficiaries` and `daily_beneficiaries` by national id. They are two records. Anti-duplication means one id counts once inside its own population, with no join to items.

| Population | Who | Date | Not the date |
| --- | --- | --- | --- |
| Registered | Distinct permanent ids, including archived, plus distinct non-deleted daily ids | `created_at` inside the period | `confirmed_at` |
| Active | Point-in-time snapshot. Permanent: `status = active` and `archived_at` is null. Daily: `status = active` and not soft-deleted. There is no `activated_at`. | none. The period does not filter this snapshot. | `created_at` |
| Served | Distinct ids with at least one completed receipt in the period. Permanent: section 2 support receipt. Daily: section 2 `received` transaction. Three receipts for one person count as one. | Permanent `support_distributions.completed_at`. Daily `daily_receiving_transactions.receiving_date`. | `support_date`, `created_at`, legacy `distributions.delivered_at` |

`under_review`, `suspended`, and daily `inactive` are not active. An archived permanent beneficiary can still be served if a completed receipt falls in the period. Soft-deleted daily rows stay out of all three populations.

Group each population by trimmed `nationality`. One bucket:

- key `missing`
- label `غير مسجلة`
- rows whose nationality is null or blank after trim

Do not put that bucket in `سعودي` or in `citizen`. Do not reuse the governance null label `غير مسجل` for this bucket. A stored `beneficiary_type` does not fill a blank nationality. Existing daily rows have no nationality until the additive column is filled; they stay in `missing`. Do not backfill them to `سعودي`.

Domain `permanent` omits daily counts. Domain `daily` omits permanent counts. Domain `all` adds the two domain totals. It does not join the tables.

## 7. Incremental refactors

**None.**

The work above is validation, derivation, one grouped join, and the existing import and support services. A new classifier class, a new recipient entity, and a revived `classifyPriority` are not justified. `classifyPriority` stays unused. Uncertain files stay.

## 8. Direct handover and home delivery

These stay separate pages, filters, and queries. They share one support aggregate and one receipt verifier.

| | Direct handover | Home delivery |
| --- | --- | --- |
| `fulfillment_method` | `pickup` | `delivery` |
| Page | `/receiver` → `DirectHandoverPage` | `/delivery` → `HomeDeliveryPage` |
| States | `draft → approved → reserved → ready → completed` | `draft → approved → reserved → ready → in_delivery → completed` |
| Driver | none. `ReceiptVerificationService` rejects a pickup confirm that carries an assignment | `Driver` assignment required. The same verifier rejects a delivery confirm without that assignment |
| Receipt | code preview, then verify, on this page only | code preview, then verify, on the driver/supervisor delivery flow only |

Do not put driver assignment, token rotation, or delivery dispatch on the handover page. Do not put pickup-location confirmation on the delivery page. Cancel stays allowed from `draft`, `approved`, `reserved`, and `ready`, and not from `in_delivery`. Completion still consumes the whole reserved quantity once.

## 9. Handoff

Next owners follow sections 1–8. A6 uses sections 1–3. A7 uses sections 4–5 and must not add an age threshold or a recipient entity. A8 and A9 keep section 8. A11 uses section 6 and `GovernanceReportService`. A3 owns any additive `daily_beneficiaries.nationality` and `beneficiary_type` columns and the shared routes.

Unresolved until a person decides: the meaning of `جهات المستفيد`. A1 is reconciled above and does not resolve that phrase.
