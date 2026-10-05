# A9 — Driver and Delivery

## 1. Objective

Preserve operation without SMS and the dedicated driver capability flow.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirement R-DRV-01
- `app/Services/Delivery/DriverAccessService.php`
- `frontend/src/pages/admin/DriversDirectoryPage.jsx`
- `frontend/src/pages/delivery/HomeDeliveryPage.jsx`
- `frontend/src/pages/driver/DriverAccessPage.jsx`

## 3. Dependencies

A5 permission keys for staff actions. No dependency on live SMS.

## 4. Assigned files

A0 assigns driver and delivery files only if A1 finds a phase-2 defect. Otherwise A9 verifies and returns NO application changes.

## 5. Allowed changes

Defect fixes that restore R-DRV-01 on assigned files. No new driver User accounts.

## 6. Explicit exclusions

No live SMS, no webhook, no worker, no automatic retry, no phone-to-User mapping, no logging of capability URLs.

## 7. Detailed requirements

Keep the driver directory, active-driver selection, assignment, reassignment, view and copy without rotation, explicit rotation, scoped expiry, revocation, inactive-driver denial, sibling-task access, and idempotent completion. Copying must not rotate, send SMS, or create a duplicate communication intent.

## 8. Acceptance criteria

Existing focused driver tests still pass. A reveal does not change the token hash. An enqueue failure does not roll back assignment.

## 9. Relevant verification

`php artisan test --filter=DeliveryCommunicationTest` only if a driver file changes. If nothing changes, cite the existing 2 passed / 28 assertions result and do not repeat the suite unless the code moved.

## 10. Handoff format

Use the common report block. State whether any file changed.
