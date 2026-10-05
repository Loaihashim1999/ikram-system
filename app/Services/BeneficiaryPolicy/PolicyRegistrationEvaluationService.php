<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * POLICY-E4 — future-beneficiary policy application.
 *
 * An EXPLICIT, service-level integration point (no model observer): the
 * registration flow calls this after the beneficiary (and its dependents) are
 * written inside the existing registration transaction.
 *
 * Scope semantics for a NEW beneficiary:
 *   new_only                  → the policy applies to the new registration.
 *   all_existing_and_new      → the policy applies; existing beneficiaries still
 *                               require a controlled E2/E3 application run.
 *   selected_existing_and_new → selected IDs scope EXISTING records only; the new
 *                               beneficiary uses the policy normally and never has
 *                               to appear in an old selected-ID list.
 *   effective_from_date       → applies only when
 *                               date(created_at) >= effective_from_date
 *                               (canonical date-only rule, application timezone).
 *
 * Residents keep their existing classification: they are evaluated by the same
 * authoritative pipeline, which returns not_applicable — citizen rules are never
 * silently applied to residents.
 *
 * Reliability: POLICY-E integration is ancillary to registration. A recoverable
 * evaluation failure is recorded for follow-up and NEVER destroys a valid
 * beneficiary registration. Duplicate evaluations are prevented deterministically
 * per (beneficiary, policy version).
 */
class PolicyRegistrationEvaluationService
{
    public const AUDIT_EVALUATED = 'POLICY_REGISTRATION_EVALUATED';

    public const AUDIT_FAILED = 'POLICY_REGISTRATION_EVALUATION_FAILED';

    public const FAILURE_CODE = 'REGISTRATION_EVALUATION_FAILED';

    public function __construct(private readonly PolicyFinancialEvaluationService $pipeline) {}

    /**
     * The published policy version applicable to this beneficiary right now, or
     * null when no published policy covers the registration.
     */
    public function applicableVersion(Beneficiary $beneficiary): ?BeneficiaryPolicyVersion
    {
        $today = CarbonImmutable::now(config('app.timezone'))->toDateString();

        $versions = BeneficiaryPolicyVersion::query()
            ->where('status', BeneficiaryPolicyVersion::STATUS_PUBLISHED)
            ->where('policy_scope', BeneficiaryPolicyVersion::DEFAULT_SCOPE)
            ->whereDate('effective_from', '<=', $today)
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $today))
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->get();

        return $versions->first(fn (BeneficiaryPolicyVersion $version): bool => $this->scopeCovers($version, $beneficiary));
    }

    /**
     * Does the published application scope cover this (new) beneficiary?
     */
    public function scopeCovers(BeneficiaryPolicyVersion $version, Beneficiary $beneficiary): bool
    {
        $mode = $version->configuration['application_scope']['applies_to'] ?? PolicyConfigurationValidator::DEFAULT_APPLIES_TO;

        if ($mode === PolicyApplicationScopeService::MODE_EFFECTIVE_DATE) {
            $date = $version->configuration['application_scope']['effective_from_date'] ?? null;
            if (! is_string($date) || ! PolicyConfigurationValidator::isCanonicalDate($date)) {
                return false;
            }
            // `created_at` follows the application-timezone wall-clock contract;
            // compare against the local start of day without converting the
            // boundary to UTC (which would shift the inclusive date window).
            $boundary = CarbonImmutable::parse($date, config('app.timezone'))->startOfDay();

            return optional($beneficiary->created_at)->greaterThanOrEqualTo($boundary);
        }

        // new_only, all_existing_and_new and selected_existing_and_new all cover
        // future registrations.
        return true;
    }

    /**
     * Create the first policy evaluation for a newly registered beneficiary.
     * Returns null when no policy applies, when an evaluation already exists for
     * this (beneficiary, version) pair (idempotent re-entry) or when the
     * recoverable ancillary failure path was taken.
     */
    public function evaluateNewBeneficiary(Beneficiary $beneficiary, ?string $actorId): ?BeneficiaryPolicyEvaluation
    {
        $version = $this->applicableVersion($beneficiary);
        if (! $version) {
            return null;
        }
        if (blank($actorId)) {
            // No honest actor exists (e.g. a seeded/imported row): the evaluation
            // snapshot requires a real evaluating user — never fabricated.
            return null;
        }

        $mode = $version->configuration['application_scope']['applies_to'] ?? PolicyConfigurationValidator::DEFAULT_APPLIES_TO;

        try {
            $evaluation = DB::transaction(function () use ($beneficiary, $version, $actorId) {
                // Serialize re-entry for this registration. The lock is held
                // through the evaluation insert, so concurrent retries cannot
                // both pass the existence check and create duplicate snapshots.
                $locked = Beneficiary::query()->lockForUpdate()->findOrFail($beneficiary->id);
                $alreadyEvaluated = BeneficiaryPolicyEvaluation::query()
                    ->where('beneficiary_id', $locked->id)
                    ->where('policy_version_id', $version->id)
                    ->exists();
                if ($alreadyEvaluated) {
                    return null;
                }

                return $this->pipeline->evaluate($locked->id, $version->id, $actorId);
            });
            if ($evaluation === null) {
                return null;
            }
        } catch (Throwable $e) {
            $this->safeAudit(self::AUDIT_FAILED, $beneficiary, [
                'policy_version_id' => $version->id,
                'scope_mode' => $mode,
                'failure_code' => self::FAILURE_CODE,
                'failure_details' => Str::limit(trim(preg_replace('/\s+/', ' ', class_basename($e).': '.$e->getMessage())), 300),
            ]);

            // Registration integrity wins: the beneficiary row stays committed and
            // the failure is recorded for follow-up (the single-record evaluate
            // endpoint lets an authorized operator retry explicitly).
            return null;
        }

        $this->safeAudit(self::AUDIT_EVALUATED, $beneficiary, [
            'policy_version_id' => $version->id,
            'scope_mode' => $mode,
            'evaluation_id' => $evaluation->id,
        ]);

        return $evaluation;
    }

    /**
     * Audit writes must never mask a registration or abort a surrounding
     * transaction, so they run in their own savepoint and swallow their own
     * failures.
     */
    private function safeAudit(string $action, Beneficiary $beneficiary, array $details): void
    {
        try {
            DB::transaction(function () use ($action, $beneficiary, $details) {
                AuditLog::create([
                    'user_id' => $beneficiary->created_by,
                    'action' => $action,
                    'target_table' => 'beneficiaries',
                    'target_id' => $beneficiary->id,
                    'details' => $details,
                ]);
            });
        } catch (Throwable) {
            // Intentionally ignored: POLICY-E4 never breaks registration.
        }
    }
}
