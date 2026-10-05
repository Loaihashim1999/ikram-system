# Cleanup ledger

Date: 2026-10-05. Agent: A3. Branch: `main`.

A2 incremental refactors: **none** (`evidence/A2-CONTRACTS.md` section 7).

No application file was removed in this pass.

## Removals

None.

## Uncertain candidates left in place

These files are not mounted from `frontend/src/App.jsx`. A2 did not authorize a refactor, and a missing route import is not a full proof that the file is unused. They stay.

| File | References checked | Decision | Reason it stays |
| --- | --- | --- | --- |
| `frontend/src/pages/beneficiaries/BeneficiaryList.jsx` | No `frontend/src` importer. A2 section 4 says do not remount it. | Leave | Legacy support entry. A2 forbids remounting and did not authorize deletion. |
| `frontend/src/pages/delivery/SendSupportPage.jsx` | No `frontend/src` importer. A2 section 4 says do not remount it. | Leave | Same as above. |
| `frontend/src/pages/delivery/DistributionPage.jsx` | No `frontend/src` importer. A2 section 4 says do not remount it. | Leave | Same as above. |
| `frontend/src/pages/delivery/DeliveryPage.jsx` | No `frontend/src` importer. A1 records it as unmounted and still calling `GET /drivers`. | Leave | Dynamic or historical callers were not exhaustively ruled out. A2 authorized no removal. |
| `frontend/src/pages/delivery/DriverDashboard.jsx` | No `frontend/src` importer. A1 records the same `/drivers` call. | Leave | Same as `DeliveryPage.jsx`. |
| `frontend/src/pages/receiver/ReceiverPage.jsx` | Not mounted in `App.jsx`. Imported by `frontend/src/test/ReceiverScanner.test.jsx`. | Leave | A live test still loads it. |
| `frontend/src/pages/statistics/StatisticsPage.jsx` | No import under `*.js`, `*.jsx`, or `*.php`. `/statistics` renders `GovernancePage`. | Leave | Unmounted, but absence of an import is not proof the file is safe to delete. |
| `frontend/src/pages/statistics/Statistics.jsx` | No import under `*.js`, `*.jsx`, or `*.php`. | Leave | Same as `StatisticsPage.jsx`. |
