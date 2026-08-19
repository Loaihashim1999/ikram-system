# 🎨 Frontend Design System — Ikram Association

This document defines the visual identity, design tokens, page layouts, UI components, interaction patterns, overlays, dialogs, responsive behavior, and accessibility standards for the Ikram Association web application.

The goal is a modern, premium, professional, calm, and highly usable RTL Arabic interface while preserving the association's established visual identity.

---

## 1. 🎨 Visual Identity & Color System

The design system preserves the official Ikram visual identity:

| Token | HEX | Primary Usage |
|---|---|---|
| Primary Green | `#3F6B3A` | Brand identity, main headings, primary navigation |
| Royal Gold | `#C9A24A` | Active navigation, accents, key icons |
| Action Amber | `#D97706` | Primary actions, save, add, submit support |
| Dark Amber | `#B45309` | Hover/pressed action states |
| Warm Background | `#F7F5F0` | Application background |
| Soft Background | `#FAF8F5` | Cards and secondary surfaces |
| Light Border | `#E5E2D9` | Cards, tables, inputs |
| Neutral Border | `#E5E7EB` | General UI borders |
| Primary Text | `#111827` | Headings and important content |
| Secondary Text | `#4B5563` | Supporting text |

### Color Usage Principles

- Use green and gold as identity accents rather than covering the entire interface with strong colors.
- Use amber for primary actions.
- Use red only for destructive or dangerous actions.
- Keep surfaces predominantly neutral and warm.
- Maintain strong contrast between text and backgrounds.

---

## 2. 🔤 Typography & Direction

- **Direction:** `dir="rtl"` for the Arabic application interface.
- **Font Family:** Prefer `Tajawal`, `Cairo`, or an appropriate RTL system font.
- **Numeric / Identity Data:** Use `font-mono` for national IDs, phone numbers, QR codes, and technical identifiers.
- **Headings:** Clear, confident, and compact.
- **Body Text:** Comfortable line height and readable spacing.

---

## 3. 📐 Application Layout

### Main Layout

```text
+-----------------------------------------------------------------------------------+
| Header: Logo | Page Context | Current User | Notifications | User Menu          |
+------------------------------------------+----------------------------------------+
| Sidebar                                  | Main Content                           |
| Width: 288px                             | Max Width: 1280px                      |
|                                          | Padding: 24px                          |
| - Dashboard                              | 1. Page Header                         |
| - Beneficiaries                          | 2. Statistics Cards                    |
| - Warehouse & Inventory                  | 3. Filters / Search                     |
| - Association Employees                  | 4. Interactive Data Table              |
| - Neighborhood Representatives            |                                        |
| - Home Delivery                          |                                        |
| - Governance & Indicators                |                                        |
| - Accounts & Permissions                 |                                        |
+------------------------------------------+----------------------------------------+
```

### Sidebar

- Desktop width: `288px`.
- Fixed or sticky positioning.
- Soft neutral background.
- Active item uses a subtle green/gold accent.
- Navigation groups can be collapsible.
- Icons use a consistent size and visual weight.
- On mobile, the sidebar becomes a slide-in drawer.

### Header

- Sticky on desktop where appropriate.
- Clean neutral surface.
- Subtle border and shadow.
- User menu and notifications are accessible from the header.
- Avoid excessive visual density.

---

## 4. 🌫️ Scrim / Backdrop / Overlay System

All actions that require user focus must use a consistent overlay system.

### Use Scrim For

- Edit dialogs.
- Delete confirmations.
- Add/create dialogs.
- Beneficiary details.
- Support submission.
- Permission editing.
- Inventory actions.
- Any critical or focused workflow.

### Standard Scrim

```css
fixed inset-0
bg-slate-950/45
backdrop-blur-[3px]
z-40
```

### Scrim Behavior

- Fade from `opacity-0` to `opacity-100`.
- Prevent interaction with content behind the active dialog.
- Support `Esc` to close non-critical dialogs.
- Preserve RTL behavior.
- Do not use excessive blur.

### Animation

```text
Scrim:
opacity 0 → 100

Dialog:
opacity 0 → 100
scale 0.97 → 1
translateY 8px → 0
```

Use short, subtle transitions around `150–220ms`.

---

## 5. 🪟 Dialog & Modal System

Use a unified component architecture:

| Component | Purpose |
|---|---|
| `Dialog` | Create and edit forms |
| `ConfirmDialog` | Delete and destructive confirmations |
| `DetailsDialog` | View beneficiary/support details |
| `ActionDialog` | Submit support or execute workflows |
| `Drawer` | Mobile-friendly forms and contextual actions |

### Dialog Design

- `rounded-2xl`.
- Clean white/warm surface.
- Deep but soft shadow.
- Clear header.
- Contextual icon.
- Close button.
- Scrollable content area when necessary.
- Stable footer for actions.
- Maximum readable width.
- Full RTL support.

### Dialog Footer

Primary action should be visually dominant.

```text
[ Cancel ]                         [ Save Changes ]
```

For destructive actions:

```text
[ Cancel ]                         [ Delete Permanently ]
```

---

## 6. 🗑️ Destructive Actions

Never delete important records immediately without confirmation.

### Delete Confirmation

```text
Delete Beneficiary?

Are you sure you want to delete this record?
This action cannot be undone.

[ Cancel ]              [ Delete Permanently ]
```

Rules:

- Destructive button uses red.
- Confirmation dialog uses a warning icon.
- Do not use red for unrelated UI.
- Show loading state while deletion is processing.
- Prevent duplicate submissions.

---

## 7. 🤝 Support Submission Workflow

Support submission should use a dedicated `ActionDialog`.

```text
Submit Support
────────────────────────────────

Beneficiary
[ Mohammed Ahmed                         ]

Support Type
[ Food Basket                         ▼ ]

Quantity
[ 3 ]

Delivery Method
○ Home Delivery
○ Association Pickup

Notes
[                                      ]
[                                      ]

────────────────────────────────
[ Cancel ]                    [ Submit Support ]
```

After successful submission, show a success toast:

```text
✓ Support submitted successfully
```

---

## 8. 🔘 Buttons & Action Controls

Buttons must have consistent states:

```text
Default
Hover
Focus
Active
Disabled
Loading
Success
Warning
Danger
```

### Primary Button

Use amber for the main application action.

```text
bg-amber-600
hover:bg-amber-700
```

### Secondary Button

Use a neutral surface with a subtle border.

### Destructive Button

Use red only for irreversible or dangerous actions.

### Icon Action Buttons

Use compact icon buttons for table actions.

```jsx
<button className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200">
  <Key className="w-4 h-4" />
</button>
```

Delete:

```jsx
<button className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200">
  <Trash2 className="w-4 h-4" />
</button>
```

For dense tables, prefer a single `MoreHorizontal` menu when multiple actions are available.

---

## 9. 📊 Data Tables

### Standard

- `rounded-2xl`.
- `border border-gray-200`.
- Warm table header.
- Clear row separation.
- `hover:bg-gray-50`.
- Sticky header for long datasets.
- Horizontal scrolling on mobile.

### Table Features

Where appropriate, provide:

- Search.
- Filters.
- Sorting.
- Pagination.
- Multi-row selection.
- Bulk actions.
- Row action menu.
- Empty state.
- Loading skeleton.
- Error state.

Example:

```text
┌──────────────────────────────────────────────────────────────┐
│ Beneficiaries                 Search...   Filters             │
├──────────────────────────────────────────────────────────────┤
│ □ │ Beneficiary │ Status │ Support │ Last Updated │ Actions │
│───┼─────────────┼────────┼─────────┼───────────────┼─────────│
│ □ │ Mohammed    │ Active │ 3       │ Today         │   ⋮     │
│ □ │ Abdullah    │ Active │ 1       │ Yesterday     │   ⋮     │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. 🏷️ Status & Category Badges

Use semantic colors consistently:

| Status / Category | Style |
|---|---|
| People with Disabilities | Blue |
| Senior Citizens | Purple |
| Active | Emerald |
| Suspended / Disabled | Red |
| Warning / Pending | Amber |
| Informational | Blue |

Badges should remain compact and readable, with optional semantic icons.

---

## 11. 📝 Forms & Inputs

Inputs should have:

- Clear labels.
- Helpful placeholders only when needed.
- Visible focus state.
- Error messages below the field.
- Consistent border radius.
- Adequate touch target size.
- RTL-aware alignment.
- Loading and disabled states.

Focus should be visually obvious without relying only on color.

---

## 12. 🔔 Toast & Feedback System

Use non-blocking Toast notifications for completed actions.

### Success

```text
✓ Support submitted successfully
```

### Error

```text
Unable to complete the action.
Please try again.
```

### Warning

```text
This action requires your attention.
```

### Info

```text
Changes have been saved as a draft.
```

Toasts should:

- Animate in/out smoothly.
- Remain readable.
- Support manual dismissal.
- Avoid blocking critical controls.

---

## 13. ✨ Motion & Micro-interactions

Motion should communicate state, not decorate the interface unnecessarily.

Recommended transitions:

```text
Modal       → Fade + Scale
Drawer      → Slide
Dropdown    → Fade + Translate
Toast       → Slide + Fade
Button      → 120–160ms press
Table Row   → 120ms hover
Sidebar     → 200ms transition
```

Respect `prefers-reduced-motion`.

---

## 14. 📱 Responsive Strategy

### Desktop — `lg` and above

- Sidebar visible.
- Sidebar width: `288px`.
- Main content uses a centered maximum width.
- Tables use full available space.

### Tablet / Mobile

- Sidebar hidden by default.
- Sidebar opens as a slide-in drawer.
- Scrim appears behind the drawer:

```css
fixed inset-0 bg-black/50 backdrop-blur-sm
```

- Tables use intelligent horizontal scrolling.
- Dialogs can become bottom sheets or full-width mobile dialogs where appropriate.
- Touch targets should remain comfortable.

---

## 15. 🧭 Empty, Loading & Error States

Every major data component should define three states.

### Empty State

```text
No beneficiaries found.

There are no records matching your current filters.

[ Add Beneficiary ]
```

### Loading State

Use skeleton placeholders instead of freezing the interface.

### Error State

```text
Something went wrong.

We could not load this information.

[ Try Again ]
```

---

## 16. ♿ Accessibility

The interface must support:

- Keyboard navigation.
- Visible focus indicators.
- Screen-reader labels for icon-only buttons.
- Proper semantic HTML.
- Logical RTL tab order.
- `aria-label` and dialog semantics where appropriate.
- Escape-to-close for non-critical dialogs.
- Reduced-motion preferences.
- Sufficient text/background contrast.

---

## 17. 🎯 Design Principles

1. **Modern** — clean SaaS-style interface without unnecessary decoration.
2. **Premium** — refined spacing, typography, shadows, and motion.
3. **Professional** — consistent components and predictable interactions.
4. **Calm** — warm neutral surfaces with controlled use of green and gold.
5. **Fast** — lightweight animations and clear feedback.
6. **Accessible** — keyboard, screen reader, contrast, and reduced-motion support.
7. **RTL First** — Arabic is treated as a first-class layout direction.
8. **Consistent** — the same interaction pattern should look and behave the same everywhere.
9. **Focused** — destructive and important actions use dialogs and scrims to keep user attention.
10. **Responsive** — desktop, tablet, and mobile layouts are designed as one coherent system.

---

## 18. 🧱 Recommended Component Architecture

```text
components/
├── layout/
│   ├── MainLayout
│   ├── Header
│   └── Sidebar
│
├── ui/
│   ├── Button
│   ├── IconButton
│   ├── Input
│   ├── Select
│   ├── Badge
│   ├── Toast
│   ├── Skeleton
│   └── DropdownMenu
│
├── overlays/
│   ├── Scrim
│   ├── Dialog
│   ├── ConfirmDialog
│   ├── DetailsDialog
│   ├── ActionDialog
│   └── Drawer
│
├── data/
│   ├── DataTable
│   ├── TableToolbar
│   ├── Pagination
│   └── EmptyState
│
└── forms/
    ├── BeneficiaryForm
    ├── SupportForm
    └── PermissionForm
```

This architecture ensures that every edit, delete, support, details, and permission workflow uses the same professional interaction patterns.

---

## 19. 🚀 Final UX Direction

The final product should feel like a modern enterprise SaaS platform designed specifically for Ikram Association:

- Premium but not excessive.
- Modern but still familiar.
- Warm and trustworthy.
- Strong Arabic RTL support.
- Clear actions.
- Minimal visual clutter.
- Consistent Scrim and Dialog behavior.
- Professional tables and forms.
- Smooth micro-interactions.
- Excellent mobile behavior.

The existing Ikram green and gold identity remains the foundation; the modernization comes from better spacing, hierarchy, overlays, dialogs, component consistency, interaction states, and responsive behavior.
