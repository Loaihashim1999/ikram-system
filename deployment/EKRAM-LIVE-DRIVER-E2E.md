# Controlled candidate driver validation

Status: PREPARED — NOT EXECUTED.

The browser runner requires the exact ready candidate revision hostname, synthetic actor credentials, and scoped test IDs supplied in memory by A0. It performs no cloud mutation or SMS provider call. Driver validation additionally requires A0 confirmation that the single controlled driver-link send has real provider evidence.

Planned evidence: Chrome synthetic administrator login and critical page smoke; citizen/resident registration with explicit review; published policy evaluation/workspace; Edge InPrivate scoped multi-task driver access, confirmation and replay; denied tampered capability/unassigned object; Chrome supervisor state, independent direct handover, Excel/PDF and persisted notification deep links. Only synthetic scoped driver screenshots are retained, after URL scrubbing and removal of code inputs.

Provider acceptance is distinct from handset delivery. No DELIVERED claim will be inferred. Runtime counts/snapshot hashes and exact-ID cleanup are separate mandatory checks before promotion.
# Scoped live database queue preparation

`tests/Browser/ekram-live-candidate-queue.php` is prepared, not operationally executed. The orchestrator must attest absent background workers and scheduler, identify the exact ready revision, and supply two fresh held intents (one basic run intent, one owned driver assignment intent). It uses the existing database queue and existing `SendCommunication` job in one PHP process, with a process-local service adapter calling `sendOnce`. Only the two approved idempotency keys and authorized destination can reach Taqnyat. The ordinary application provider stays fake.

The producer transaction commits before worker execution; the existing service commits its durable sending claim before provider HTTP. Worker limits are two jobs and 55 seconds, each job has one try. Ambiguous provider outcomes remain final and require reconciliation; acceptance is not delivery. A failed or interrupted invocation must never be rerun automatically. Recover by read-only intent/job inspection and exact-ID cleanup. Syntax validation passed; the false readiness gate rejected before application bootstrap. No provider or database execution occurred during preparation.
