# EKRAM metric definitions

`support_date` is the operational due date. `completed_at` is the completion timestamp. Phase 4 does not add `ready_at`, because historical readiness time cannot be reconstructed. These counts use `support_distributions` in statuses `ready`, `in_delivery`, and `completed`. Draft, approved, reserved, and cancelled operations are excluded. The legacy `distributions` table is not this source.

The application timezone supplies start-of-day and end-of-day boundaries. `from` must not be after `to`.

| Arabic label | Technical name | Date field | Formula | Count |
|---|---|---|---|---|
| العمليات المستحقة | `total_due` | `support_date` inside the selected range | Due operations in that range | Operations |
| اكتملت حتى نهاية الفترة | `completed_by_cutoff` | `completed_at <= period end` | Due operations completed by the cutoff | Operations |
| اكتملت خلال الفترة | `completed_in_period` | `completed_at` inside the range | Completed operations whose completion falls in the range | Operations |
| العمليات المستحقة غير المكتملة | `not_completed` | cutoff | `total_due - completed_by_cutoff` | Operations |
| العمليات المتأخرة | `overdue` | `support_date` before the end date, and not completed by the period end | A completion after the cutoff does not remove the historical overdue result | Operations |
| المستفيدون المستحقون | `unique_due_beneficiaries` | same due population | Distinct `beneficiary_id` | People |
| المستفيدون الذين استلموا | `unique_completed_beneficiaries` | completed by cutoff | Distinct `beneficiary_id` | People |
| المستفيدون المتبقون | `unique_not_completed_beneficiaries` | not completed by cutoff | Distinct `beneficiary_id` | People |

A null `completed_at` is not completed. Current beneficiary totals and current inventory are snapshots, not period formulas. «لم يستلم» is not all registered beneficiaries minus people who received something.

Home delivery may call the same service with `fulfillment_method = delivery`. That call still uses `support_date` and `completed_at`. It does not create a second due, completed, not-completed, or overdue formula.

The home-delivery queue snapshot is separate. It counts current delivery operations only: not started (draft, approved, reserved, ready), in delivery, and completed. It has no date field. There is no persisted failed-delivery state, so the queue does not show a failed-delivery count. Cancellation stays cancellation.
