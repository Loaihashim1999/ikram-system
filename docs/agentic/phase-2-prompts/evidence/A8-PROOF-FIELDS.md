# Pickup proof fields for A11

Source: A8 replay check on 2026-10-05. Preserve these snapshot names. Do not invent values, and do not print live verification codes.

`schema_version`, `source`, `task_reference`, `fulfillment_method`, `recipient.type`, `recipient.id`, `recipient.display_name`, `recipient.reference`, `recipient.phone`, `recipient.city`, `recipient.district`, `recipient.address`, `recipient.full_address`, `driver`, `pickup_location`, `employee.id`, `employee.name`, `confirmed_at`, `verification_method`, `final_status`, `items.inventory_item_id`, `items.name`, `items.quantity`, `items.unit`.

On pickup, `driver` is null. On delivery, keep `driver.id`, `driver.name`, and `driver.assignment_id`.
