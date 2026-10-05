# Forms

Audit: `05_FORMS_TABLES_AUDIT.md` (H1). Long beneficiary and staff forms are not rewritten in this phase. The controls they should use are in place.

| Piece | Where |
| --- | --- |
| `FormSection` | Groups a fieldset with a legend |
| `FormField` | Label, error (`role="alert"`), helper, `aria-invalid` |
| `TextInput`, `SelectInput`, `TextArea`, `DateInput`, `NumericInput` | `formControls.jsx` |
| `CheckboxField`, `RadioField` | Visible label, 44px row |
| `ValidationMessage`, `HelperText`, `RequiredIndicator` | Shared text |

Dates and numbers are `dir="ltr"` on the control only. Required marks are visual and the input stays `required` when the prop is set.

Use `FormSection` for basic data, family, financial data, and staff data when those pages are migrated. Do not add a second form style on the page.
