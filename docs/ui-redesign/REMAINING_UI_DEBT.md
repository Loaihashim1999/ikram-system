# Remaining UI debt

1. Dashboard counts are computed in the browser from full beneficiary and distribution payloads. Fixing that needs a count endpoint. Audit C5. It was not hidden.
2. Staff, warehouse, audit, users, representatives, and daily lists still use their own tables. They inherit wrapping rules. Only the unified beneficiary list stacks on a narrow screen.
3. Twelve unmounted page files remain on disk. They are classified in `PHASE_3_PROGRESS.md` and were not deleted.
4. The PDF content hairline is too light to see at normal print resolution.
5. The daily report pushes signatures onto a sparse second page.
6. Governance PDF comparison bars are still faint in mPDF. The count table is the reliable print form.
7. Dompdf is installed and unused.
8. Driver access keeps its own stylesheet.
9. `UserEditHttpFlow` needs a stable local API before it can be treated as a UI result.
