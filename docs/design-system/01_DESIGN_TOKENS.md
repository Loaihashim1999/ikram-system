# Design tokens

Source: `frontend/src/index.css`. Tailwind `brand.green` and `brand.gold` match these values. `frontend/src/theme/tokens.js` repeats the same palette and IBM Plex family for any JavaScript consumer. Do not put a second font or a second success green there.

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#1F4D3A` | Actions, brand |
| `--color-primary-hover` | `#14352C` | Hover, sidebar |
| `--color-primary-active` | `#0E241C` | Pressed |
| `--color-secondary` | `#14352C` | Secondary button |
| `--color-bg-page` | `#F3EFE6` | Page |
| `--color-surface` | `#FFFDF8` | Panels |
| `--color-surface-muted` | `#F7F3EA` | Table head, soft fill |
| `--color-border` | `#E4DDD0` | Hairline |
| `--color-border-strong` | `#C9BFAE` | Inputs |
| `--color-text-primary` | `#1C1915` | Text |
| `--color-text-secondary` | `#3A342C` | Secondary text |
| `--color-text-muted` | `#5C564C` | Hints |
| `--color-success` | `#146C43` | Success, distinct from brand |
| `--color-warning` | `#8A5A12` | Warning |
| `--color-danger` | `#9B2C2C` | Danger |
| `--color-info` | `#1D4E89` | Info |
| `--color-disabled` | `#8A8478` | Disabled text |

Association tokens (`--association-*`) repeat the same green, gold, and ink for documents. They are not a second palette.

Chart series: `--chart-1` through `--chart-5`.

Spacing: `--space-1` (4px) through `--space-6` (24px). Page padding uses `--space-page`.

Radius: `--radius-sm` 6px, `--radius-control` 8px, `--radius-panel` 12px. No larger radius token.

Shadows: `--shadow-rest`, `--shadow-overlay`, `--shadow-dialog`.
