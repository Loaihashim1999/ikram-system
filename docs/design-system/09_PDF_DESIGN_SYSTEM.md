# PDF design system

Engine: mPDF 8 only. Dompdf stays unused.

## Type and color

- Font: `xbriyaz`.
- Ink `#1C1915`, brand `#1F4D3A`, gold `#A6843D`, rule `#E4DDD0`, header fill `#E7EFEA`.
- Title 16pt. Section 13pt with a gold underline. Body 11pt.

## Tables

Class `data-table` / the shared rules in `letterhead_template.blade.php`: full grid, repeating `thead`, rows kept together, `.num` for amounts.

## Charts

Printable representation is a table. Bars are HTML width percentages inside a cell. SVG text and pie dash arrays were removed because mPDF does not shape that text reliably (audit P0).

## Page geometry

Header and footer JPEGs keep their aspect ratio and span the page width. Content margins sit inside them: 14mm sides, header height + 4mm top, footer height + 10mm bottom. A 0.25mm green rule is `position: fixed` between the two images so it repeats on every page and does not cover the artwork.

The page line is only `صفحة {PAGENO} من {nbpg}`. The governance period stays in the body so it cannot collide with the footer image.
