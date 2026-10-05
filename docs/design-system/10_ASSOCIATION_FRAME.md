# Association frame

## Source of the name

`App\Support\AssociationIdentity::name()` is the only text identity.

1. `settings` key `communications.association_name`, when it has a value.
2. Otherwise `config('association.document_name')`, which is the Arabic name already printed on `public/assets/pdf-letterhead-header.jpg`.

Templates must not hardcode «جمعية إكرام لحفظ الطعام» or a second legal name. The SMS placeholder `association_name` uses the same method.

Contact lines, the registration number, and the EKRAM wordmark stay inside the header and footer JPEGs. They are not retyped into HTML.

## What every PDF gets

`AssociationFrame::open()` sets the header image, the footer image, and the page number for odd and even pages. `frameMarkup()` draws the hairline. `letterhead_template.blade.php` is the Blade shell.

These templates now extend that shell:

- `support_proof`
- `daily_report`
- `weekly_comprehensive_report`
- `beneficiary_card`
- `individual_receipt`
- `total_delivery`
- `representative_receipt`
- `staff_receipt`
- `daily_receiving_voucher`

`report_bar_chart` is a partial, not a document.

Routes are unchanged. Report numbers are unchanged.

## Optional blocks

Signature and stamp markup remains only on the documents that already had it. No QR is added.
