# RTL guidelines

`dir="rtl"` is set on `body`, `MainLayout`, and the sidebar. New components inherit it. Do not set `dir="ltr"` on a page.

## Direction

- Sidebar active mark uses `inset 3px 0 0`, on the inner edge of the right-hand sidebar (audit C6).
- Breadcrumb separators use `ChevronLeft` with no rotation. In RTL the trail moves left.
- Pagination keeps the previous control on the right (`ChevronRight`) and the next control on the left (`ChevronLeft`).
- A left-pointing arrow on “فتح القسم” means forward in RTL. Do not mirror it back to a right-pointing arrow.
- Phone numbers, dates, and amounts use `dir="ltr"` or `.ikram-numeric` on the value only.

## Mixed text

Isolate Latin identifiers, phones, and amounts. Do not isolate a whole Arabic sentence.

## Layout

Shell offset stays `lg:mr-72` because the sidebar is physically on the right. A future logical-property pass can replace that once the sidebar side is a token. Do not add per-page RTL CSS.
