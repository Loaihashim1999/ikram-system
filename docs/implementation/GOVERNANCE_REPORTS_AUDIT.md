# Governance and Reports Audit

Date: 2026-09-24  
Scope: Governance dashboard, report queries, Excel/PDF exports, and their authorization only.

## Existing request path

| Surface | Route / component | Current source | Current behavior | Confirmed gap |
|---|---|---|---|---|
| Governance API | `GET /api/governance/analytics` → `AnalyticsController@index` | Permanent beneficiaries, daily beneficiaries, legacy distributions, both inventory domains, staff and organizations | Validates preset/custom dates and returns KPI/chart payloads | No report-row pagination or shared report filters; several counts are current snapshots even when a date range is selected |
| Governance UI | `GovernancePage.jsx`, `GovernanceCharts.jsx` | `/governance/analytics` | Date controls, KPI cards, four chart types, local presentation tables, PDF/Excel triggers | Detailed data is not queried with server-side pagination/filtering; export filters are limited to dates |
| Report assembly | `GovernanceReportService::build` | Calls `AnalyticsController`, then separately queries report datasets | Adds indicators, breakdowns, timeline, datasets and narrative | Loads all beneficiaries into memory; repeats monthly queries; uses mutable beneficiary finance fields; legacy distribution is treated as the support workflow |
| Excel | `PdfExportController::exportComprehensiveExcel` | `GovernanceReportService` datasets | Exports all service datasets | Every value is forced to string, formula-like text is not neutralized explicitly, no report/dataset filter contract, and independent permission is absent |
| PDF | `PdfExportController::exportWeeklyComprehensiveReport` | `GovernanceReportService`, Blade template, mPDF | Comprehensive Arabic PDF with summary and limited inline charts | No shared dataset filters, missing authoritative policy/support sections, and independent PDF permission is absent |
| Authorization | `ModulePermission` | Role allow-list plus nested JSON permissions | Governance GET requests normally require `governance.view`; paths containing export or ending in Excel require generic `export` | `governance:view`, `governance:export_excel`, and `governance:export_pdf` are not independent; PDF currently falls through to `view` |

## Authoritative reporting map

| Report / KPI | Authoritative data source | Date/filter basis | Permission | Chart / table | Excel / PDF expectation | Historical behavior | Audit result |
|---|---|---|---|---|---|---|---|
| Permanent registrations | `beneficiaries` | `created_at`; domain, beneficiary type, status, district | `governance:view` | Line + detailed table | All matching rows | Stable registration event | Existing count works by date; filters/pagination missing |
| Daily registrations/activity | `daily_beneficiaries`, `daily_receiving_transactions` | beneficiary `created_at`; activity `receiving_date`; daily domain | `governance:view` | Domain column/pie + activity table | All matching rows, kept separate from permanent | Stable event rows | Existing aggregate exists; unified report filter contract missing |
| Policy evaluations | `beneficiary_policy_evaluations` joined to immutable `beneficiary_policy_versions` snapshots | `evaluated_at`; status, eligibility decision, need level, score category | `governance:view` | KPI/pie + detailed table | Sanitized evaluation rows | Immutable evaluation snapshots; never recompute history | Missing from Governance reports |
| Policy decisions | `policy_decisions` joined to evaluation/version | `decided_at`; decision and stable reason code | `governance:view` | KPI/pie + detailed table | Sanitized decision rows | Immutable decision records | Missing from Governance reports |
| Support workflow | `support_distributions` | `created_at`, `support_date`, `completed_at`; status, fulfillment method | `governance:view` | Real workflow funnel + detailed table | All matching rows | Event/status timestamps retained in the operational record | Existing Governance uses legacy `distributions`; authoritative pipeline missing |
| Legacy scheduled distribution | `distributions` | `scheduled_at` / `delivered_at`; status | `governance:view` | Compatibility metrics only | Separate legacy sheet/section | Current row state; dates identify scheduling/delivery event | Present but incorrectly used as the only support authority |
| Main inventory | `inventory_items`, `inventory_movements` | snapshot for balances; movement `created_at` for period | `governance:view` | KPI/table | Separate sheets/sections | Movements provide historical activity; balances are current snapshots | Present; must remain separate from daily inventory |
| Daily inventory | `daily_inventory_items`, `daily_inventory_movements` | snapshot for balances; movement `created_at` for period | `governance:view` | KPI/table | Separate sheets/sections | Movements provide historical activity; balances are current snapshots | Present and separate; retain boundary |
| Staff / organizations | `staff`, `organizations` | current snapshot; status filters where applicable | `governance:view` | KPI/table | Sanitized snapshot rows | Explicitly labelled current snapshot | Present; no pagination/filter contract |
| Audit / notifications | `audit_logs`, `notifications` | `created_at` | `governance:view` | Aggregated table | Aggregates only; no sensitive payloads | Stable event records | Present as aggregates |

## Required contract

One validated report request must drive the dashboard, paginated detailed rows, Excel, and PDF. The contract must support an inclusive `start_date`/`end_date`, a report dataset, permanent/daily domain, beneficiary type, record status, district, policy outcome, need level, support status, and fulfillment method. Empty filters must be ignored safely; invalid or reversed dates must return a validation error. Sorting needs an allow-list and a stable ID tie-breaker.

The dashboard response must identify whether each metric is a period measure or a current snapshot. Counts shown in charts must be derived from the same filtered queries as their KPI/table counterparts. Permanent and daily beneficiary records may be summarized together only at the query/UI layer; their source tables, activity tables, and inventories remain independent.

Excel and PDF must rerun the same authorized, validated report request without page limits. Excel cells must preserve numeric/date types and neutralize formula-like user text. Both exports must exclude credentials, identity-document paths, banking/OCR payloads, contact details not needed for governance, and arbitrary audit payloads. PDF charts must be generated locally from server-side chart data, with no remote resources.

## Implementation decisions

1. Keep `/api/analytics` as a compatibility endpoint. Make `/api/governance/analytics` use a Governance controller/service contract that owns validation, KPIs, charts, and paginated detail rows.
2. Use immutable `BeneficiaryPolicyEvaluation` and `PolicyDecision` rows for policy reporting. Never derive historical policy outcomes from current beneficiary values.
3. Use `SupportDistribution` for the current support workflow and retain legacy `Distribution` only in an explicitly labelled compatibility section.
4. Build the workflow funnel from actual ordered support statuses. Each stage counts records that reached that stage according to the repository's transition order; cancelled records remain a separate KPI/table value.
5. Keep current inventory balances explicitly labelled snapshots and movement activity explicitly period-bound.
6. Require independent `governance.view`, `governance.export_excel`, and `governance.export_pdf` permissions for non-admin users, and expose these actions in the existing user permission editor.

