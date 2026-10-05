# EKRAM notification event and recipient matrix

Backend NotificationService remains authoritative. All recipients must be active and have canReceiveNotifications enabled. Admin receives eligible domain alerts; other accounts also satisfy the domain conditions below. Existing historical records remain immutable.

| Event domain | Other recipient permissions / roles | Target |
| --- | --- | --- |
| support_* | support.notifications; action shown only with support.view | Distribution: /receiver?task=UUID for pickup, /delivery?task=UUID for delivery |
| beneficiary* | beneficiaries.view and notifications; assistant_admin, reception, staff, readonly | /beneficiaries/UUID |
| stock* / warehouse* | warehouse.view and notifications; assistant_admin, warehouse, staff, readonly | /warehouse |
| Daily inventory model events | daily_beneficiaries.view and notifications; assistant_admin, reception, staff, readonly | /daily-beneficiaries/inventory |
| Delivery events | delivery.view and notifications; assistant_admin, staff, historical driver roles | /delivery |

Driver-domain secure links remain scoped delivery credentials; this matrix does not grant application login to drivers. All target APIs continue authorizing independently. Opening a record first persists read state; failed read writes keep the detail visible. Deleted targets must show an unavailable-record notice in the destination page and retain navigation to the authorized module list.

## Communication evidence

Requested intent is persisted once with masked destination and encrypted, expiring payload. Pending/retrying intent is queued; sending means a worker claimed it. Legacy sent status is retained, and new successful calls add acceptance_state=provider_accepted and delivery_state=unconfirmed. Neither field proves actual handset delivery. No delivered state may be inferred without provider evidence.

Provider or in-flight worker timeout produces failed/send_outcome_unknown and reconciliation_required=true. Neither automatic nor administrator retry can resend an ambiguous intent. Known rejection/rate-limit paths retain bounded retries. Expired payloads are erased. Production E2E-006 remains an external evidence gate; this task performs no live send.
