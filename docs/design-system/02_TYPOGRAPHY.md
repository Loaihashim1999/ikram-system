# Typography

## Application

One family: IBM Plex Sans Arabic, then Tahoma, Segoe UI. Loaded from the existing `@fontsource` package. Tailwind `font-sans` uses the same stack. Do not add Tajawal or Cairo.

| Role | Token | Size |
| --- | --- | --- |
| Display | `--type-display` | 1.75rem |
| Page title | `--type-title` | 1.375rem |
| Section | `--type-section` | 1.05rem |
| Card | `--type-card` | 0.95rem |
| Body | `--type-body` | 1rem / 16px on `body` |
| Table, label, helper, caption | `--type-table`, `--type-label`, `--type-helper`, `--type-caption` | 0.875rem or 0.75rem |

Weight: 700 for titles and buttons. 400–600 for body. Do not use extrabold and black on the same page for the same role.

## PDF

One face: mPDF `xbriyaz` (XB Riyaz), with OpenType shaping. `autoLangToFont` is off so Arabic and Latin digits stay on that face.

| Role | Size |
| --- | --- |
| Report title | 16pt |
| Section | 13pt |
| Body | 11pt |
| Table and footer | 9–11pt |

IBM Plex is not embedded in mPDF. The documents stay related through color and tone, not by shipping a second webfont into the PDF engine.
