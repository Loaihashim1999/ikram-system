# Taqnyat SMS delivery webhook

Status: endpoint infrastructure prepared locally. The provider contract and production activation remain blocked. The intended URL is not ready for the Taqnyat portal.

2026-10-05 update: the user selected [SMS without a webhook](EKRAM-SMS-WITHOUT-WEBHOOK.md). This document's contract and activation blockers apply to webhook processing only. They are not prerequisites for outbound SMS. Leave the webhook disabled; provider acceptance stays delivery-unconfirmed and ambiguous sends must not be retried blindly.

## Intended address

`https://systemben.ekramfb.org.sa/api/webhooks/taqnyat/sms`

`APP_URL` in `docs/deployment/azure-runtime.env.example` is `https://systemben.ekramfb.org.sa`. Container nginx serves the Laravel public root, and `routes/api.php` is mounted at `/api`. This was not probed on the live host.

Acknowledgement phrase, configured and not yet returned: `EKRAM_WEBHOOK_RECEIVED`.

## What official documentation establishes

- [SMS API reference](https://dev.taqnyat.sa/en/doc/sms/): a callback URL is set in the portal under Developer tools, with a pass phrase. If the response is not that phrase, Taqnyat retries the same callback up to three times.
- [Software solutions](https://portal.taqnyat.sa/technical_explanations/en/software_solutions/): the phrase confirms that the server received the delivery report.
- [Sending reports](https://portal.taqnyat.sa/technical_explanations/en/technical_explanations/dispatch_reports/): portal colors distinguish delivered, not delivered, and no report yet. They do not name callback field values.
- [SMS OpenAPI](https://github.com/taqnyat/OpenAPI/blob/main/sms/v1/openapi.yaml): submission, balance, senders, and scheduled deletion. No delivery-report callback.
- Context7 `/taqnyat/python`: no delivery-report webhook documentation.

Bearer authentication in the SMS guide applies to calls EKRAM makes to Taqnyat. It is not documented as inbound webhook authentication.

## Missing contract

Do not activate until the account-specific guide supplies all of these:

- HTTP method and content type.
- Request fields, types, message reference, and recipient correlation.
- Delivery-state values and which ones are terminal.
- Timestamp format and timezone.
- Authentication or signature mechanism, separate from the acknowledgement phrase.
- Event identity or a documented deduplication rule.

No delivery-state mapping is implemented. Unknown states are not treated as delivered. The sender-list JSON under the guide's Callback heading is not a delivery report.

## Local behavior

`TAQNYAT_SMS_WEBHOOK_ENABLED` defaults to false. `TAQNYAT_SMS_WEBHOOK_ACK` defaults to `EKRAM_WEBHOOK_RECEIVED` and is not a secret. The reserved route is POST only, outside `auth:sanctum`, limited to 30 requests per minute, and rejects bodies over 8192 bytes. POST returns HTTP 503 `{"status":"unavailable"}` without the acknowledgement phrase. GET, PUT, and PATCH are not accepted. The provider HTTP method is still undocumented, so POST is only the reserved application route. Enabling the switch does not open processing while the contract is missing. The handler does not read or write communication rows, does not call `CommunicationService::send` or `retry`, and does not create receipts or inventory movements.

The API router does not use web CSRF protection. No extra CSRF exemption was added.

Logs contain only `result=rejected` and a safe category: `disabled`, `oversized`, or `provider_contract_missing`.

## Deployment and rollback

Do not deploy, change Azure secrets, edit the Taqnyat portal, start a worker, or send SMS from this change.

After a separately approved deployment, probe the live URL and confirm a non-success response that is not `EKRAM_WEBHOOK_RECEIVED` before any portal save. Save the URL in Taqnyat only after that live check and after the missing contract has been implemented.

Rollback while the switch is false is a normal application rollback. Leave `TAQNYAT_SMS_WEBHOOK_ENABLED` unset or `false`. Do not put the acknowledgement phrase in Key Vault as a credential.
