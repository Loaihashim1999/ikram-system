# Navigation and information architecture

Source: `frontend/src/components/layout/Sidebar.jsx`, `TopBar.jsx`, `App.jsx`.

## Sidebar hierarchy

Default (non-driver) menu, top to bottom:

1. لوحة التحكم `/dashboard`
2. إدارة وقوائم المستفيدين `/beneficiaries`
3. المستفيدون اليوميون `/daily-beneficiaries`
4. المستودع والمخزون `/warehouse`
5. إدارة وقوائم الموظفين `/staff`
6. إدارة الجهات المستفيدة `/representatives`
7. الاستلام المباشر `/receiver`
8. إدارة وتوصيل المنازل `/delivery`
9. الحوكمة والمؤشرات `/governance`
10. سجل التدقيق والوثائق `/audit` (admin)
11. Group «إدارة النظام والحسابات»: users, drivers, financial settings

Driver role sees only delivery and receiver. Assistant admin sees items 1–9 without audit and without the system group.

Grouping is mostly domain-correct: people, stock, delivery, oversight, system. Two delivery items share one icon and sit apart from warehouse, which is acceptable.

## Findings

### C1 — الجهات label

The item «إدارة الجهات المستفيدة» navigates to neighborhood representatives. There is no organizations screen in the router. «جهات المستفيد» remains an undefined product term. A redesign must not invent that destination or rename the route. Change the visible label only after the product decision.

### C2 — two governance doors

`/statistics` and `/governance` render `GovernancePage`. The menu shows only governance. Statistics remains reachable by URL and by any leftover link, with a different role list (`App.jsx`). Operators cannot tell which name is canonical.

### C3 — landing versus menu

`assistant_admin` home is `/receiver` (`App.jsx`). The sidebar still opens with «لوحة التحكم». After login the screen and the menu disagree.

### H4 — depth without breadcrumbs

Record routes (`/beneficiaries/:id`, edit, support, staff details, daily details) have no breadcrumb component. `PageHeader` is the only orientation. Wayfinding depends on the browser back button.

### H8 — two permission maps

`Sidebar.jsx` `isPathAllowed` repeats role prefixes and `user.permissions`. Routes use `allowedRoles` plus `PagePermissionGuard`. A person can see a menu row the route will reject, or miss a row the route allows. Statistics is in the route table and absent from the menu.

### Active state

`aria-current="page"` is set, and the style is a gold inset bar (`index.css` `.ikram-nav a[aria-current="page"]`). The bar sits on the outer edge (C6). Nested system items expand under «إدارة النظام والحسابات»; only one group exists, so nesting is fine.

### Duplicated destinations

| Label | Live target | Also exists |
| --- | --- | --- |
| الحوكمة والمؤشرات | `/governance` | `/statistics` same page |
| الاستلام المباشر | `/receiver` → `DirectHandoverPage` | unrouted `ReceiverPage.jsx` |
| إدارة وتوصيل المنازل | `/delivery` | `/distributions` and `/driver/deliveries` redirect here. `/send-support` redirects to `/support/request` |
| إعدادات النظام المالية | `/admin/settings` | also hosts communications; unrouted `Settings.jsx` |

### Labels

Several labels stack two ideas: «إدارة وقوائم المستفيدين», «إدارة وقوائم الموظفين», «سجل التدقيق والوثائق», «إعدادات النظام المالية». The financial settings screen also contains communications. Shorter labels can wait until wording review; do not change them in this phase.

### What is hard to find

- Policy review and policy application runs are routed and are not sidebar items.
- Communications settings are inside financial settings.
- Public driver access is not in the admin menu (correct) and is easy to confuse with «دليل السائقين».

No route renames are recommended in the implementation phase that follows this audit.
