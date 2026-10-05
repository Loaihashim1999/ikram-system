# UX workflow and writing

No workflow was redesigned. Problems only.

## Workflows

### Login

`LoginPage.jsx` is a short form on the auth split. Failure copy depends on the API message. After login, home depends on role (C3): assistant admin opens receiver, drivers open delivery, everyone else opens the dashboard.

### Register a beneficiary

Two routes (`add-citizen`, `add-resident`) share `AddBeneficiaryPage.jsx`. The split is correct and must stay. The form is one long page (H1): identity, family table, financial fields, documents. Import is a separate route, which is the right extra step. Success feedback is a toast, then navigation; the new record is not summarized on the next screen.

### Find and open a beneficiary

`UnifiedBeneficiaryPage.jsx` has search, filters, table, and pagination. This is the best list in the product. Staff and daily lists do not match it (H2), so the same task feels different in each module.

### Edit

Edit is a separate route from details. That is clear. The edit form repeats the registration length. Cancel is a back action, not a named discard confirmation when the form is dirty.

### Export

Beneficiary export and governance print/Excel are different controls with different icons (`FileSpreadsheet`, `Printer` on statistics). There is no shared export label.

### Users and permissions

`Users.jsx` combines the account form and the permission matrix. A mistaken checkbox is easy because modules are not grouped with the same names as the sidebar. Changing a permission does not preview what menu the person will see (H8).

### Reports and governance

The task “open statistics” can hit `/statistics` or the menu item الحوكمة. Same screen, two names (C2). Charts do not say what to do next (C5, C7).

### Delivery and driver link

Admin delivery is `/delivery`. The public driver page is `/driver-access` and does not use the shell (H6). That separation is correct. The risk is visual: the public page can drift from the tokens and look like a different product.

### Dashboard

`Dashboard.jsx` loads `/beneficiaries` and `/distributions` and counts rows in the browser (C5). KPIs: beneficiary count, distributed, pending, delivered. Missing: what needs a person today, what changed since yesterday, and a single next action per card. Cards do navigate (good) via icons that include a physical `ArrowLeft` (C6).

## Writing

Do not rewrite copy in this phase. Preserve domain terms: مستفيد، مواطن، مقيم، استلام مباشر، توصيل منازل، حوكمة، صلاحيات.

| Issue | Example |
| --- | --- |
| Double labels | «إدارة وقوائم المستفيدين» vs the page title inside `UnifiedBeneficiaryPage` |
| Wrong destination name | «إدارة الجهات المستفيدة» for neighborhood representatives (C1) |
| Settings title | «إعدادات النظام المالية» also contains communications |
| Status vs brand | A green badge reads as the brand, not as success (H3) |
| Technical leaks | Validator keys and English status codes can reach toasts when the map in `displayVocabulary.js` has no entry |
| Singular / plural | «المستفيدون اليوميون» is plural; some buttons still say «مستفيد» without the daily qualifier |
| Confirmations | Generic confirm text on legacy pages; `ConfirmDialog` is the place for a specific noun and verb (H5) |

SMS status wording in `displayVocabulary.js` is a product copy issue tracked outside this audit. Do not change it here.

## Feedback gaps

- Loading: `LoadingState` exists; dashboard uses a boolean flag and still renders zeros before the request returns.
- Empty: not shared (M3).
- Errors: `ErrorState` exists and is easy to skip.
- Success: toast only.
