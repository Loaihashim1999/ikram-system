<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyApplicationRunItem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * POLICY-E2 — read-only impact simulation engine.
 *
 * Persists ONLY `policy_application_runs` (summary/counters/hashes) and
 * `policy_application_run_items` (sanitized per-beneficiary simulation output).
 * It NEVER creates or mutates BeneficiaryPolicyEvaluation, PolicyDecision,
 * DocumentVerification, MedicalEvidence, SocialAssessment or Beneficiary rows —
 * actual evaluation creation belongs to the POLICY-E3 execution phase.
 *
 * It reuses the single authoritative POLICY-B/C pipeline
 * (PolicyFinancialEvaluationService::compute()): no income, rent, family,
 * income-category, score, exception or eligibility logic is duplicated here.
 *
 * Canonical candidate enumeration (shared verbatim with POLICY-E3 staleness
 * verification):
 *   new_only                   → zero existing candidates (future registrations
 *                                are POLICY-E4's contract)
 *   all_existing_and_new       → every beneficiary row (residents evaluate to
 *                                not_applicable; citizen rules are never applied
 *                                to residents)
 *   selected_existing_and_new  → run-level normalized beneficiary IDs only; any
 *                                unknown ID rejects the whole request
 *   effective_from_date        → registrations at/after the canonical published
 *                                boundary: start-of-day(effective_from_date) in
 *                                the application timezone compared directly
 *                                against `beneficiaries.created_at` (stored as
 *                                application-timezone wall time — equivalent to
 *                                date(created_at) >= effective_from_date;
 *                                `updated_at` is never used)
 */
final class PolicyApplicationSimulationService
{
    /** Stable machine failure codes (never localized, safe for automation). */
    public const FAILURE_COMPUTE = 'SIMULATION_COMPUTE_ERROR';

    public const FAILURE_MISSING_CANDIDATE = 'SIMULATION_MISSING_BENEFICIARY';

    /** Bounded model batch size (candidate IDs stream, models load per batch). */
    public const BATCH = 100;

    public function __construct(
        private readonly PolicyFinancialEvaluationService $pipeline,
        private readonly PolicyApplicationRunService $runs,
    ) {}

    /**
     * Deterministic, ordering-independent candidate list for the scope mode.
     * Models are streamed (cursor) and never fully hydrated.
     *
     * @throws ValidationException when a selected ID does not exist
     */
    public function candidateIds(PolicyApplicationRun $run): array
    {
        $mode = $run->scope_mode;
        $parameters = $run->scope_parameters ?? [];

        if ($mode === PolicyApplicationScopeService::MODE_NEW_ONLY) {
            // No existing beneficiary belongs to a new_only scope; future
            // registrations are handled by POLICY-E4.
            return [];
        }

        if ($mode === PolicyApplicationScopeService::MODE_SELECTED) {
            $selected = $parameters['beneficiary_ids'] ?? [];
            $existing = Beneficiary::query()->whereIn('id', $selected)->pluck('id')->all();
            $unknown = array_values(array_diff($selected, $existing));
            if ($unknown !== []) {
                throw ValidationException::withMessages([
                    'scope_parameters.beneficiary_ids' => 'قائمة التحديد تحتوي معرّفات مستفيدين غير موجودة (عدد: '.count($unknown).').',
                ]);
            }

            $ids = array_values(array_unique($selected));
            sort($ids, SORT_STRING);

            return $ids;
        }

        if ($mode === PolicyApplicationScopeService::MODE_EFFECTIVE_DATE) {
            $date = $parameters['effective_from_date'] ?? null;
            if (! is_string($date) || ! PolicyConfigurationValidator::isCanonicalDate($date)) {
                throw ValidationException::withMessages([
                    'scope_parameters.effective_from_date' => 'تاريخ النفاذ غير صالح في معرّف النطاق.',
                ]);
            }
            // created_at stores application-timezone wall time (Eloquent and the
            // canonical registeredAt helper both write it); comparing the
            // start-of-day wall time directly is exactly the date-only
            // `date(created_at) >= effective_from_date` contract. Converting the
            // boundary to UTC here would wrongly include same-evening registrations.
            $boundary = CarbonImmutable::parse($date, config('app.timezone'))->startOfDay();

            return $this->streamIds(Beneficiary::query()->where('created_at', '>=', $boundary));
        }

        if ($mode === PolicyApplicationScopeService::MODE_ALL) {
            return $this->streamIds(Beneficiary::query());
        }

        throw ValidationException::withMessages(['scope_mode' => 'نطاق تطبيق غير معروف: '.$mode]);
    }

    /**
     * Deterministic candidate-set hash (sha256). Covers policy version, scope
     * mode, normalized run parameters and the ORDERED candidate IDs (sorted, so
     * enumeration order never changes the hash while any membership change
     * always does).
     */
    public function candidateSetHash(string $policyVersionId, string $scopeMode, array $parameters, array $candidateIds): string
    {
        $ids = array_values(array_unique($candidateIds));
        sort($ids, SORT_STRING);

        return hash('sha256', json_encode([
            'candidate_ids' => $ids,
            'parameters' => $parameters,
            'policy_version_id' => $policyVersionId,
            'scope_mode' => $scopeMode,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Minimum source-state marker: identity, population, lifecycle status and
     * row revision instant only — the fields that determine whether the
     * calculation basis of a simulated item moved. Never a full-row copy and
     * never a sensitive attribute. POLICY-E3 pairs this marker with the policy
     * fingerprint + candidate-set hash; field-level freshness verification is
     * deliberately deferred to the execution phase.
     */
    public function sourceStateMarker(Beneficiary $beneficiary): string
    {
        return hash('sha256', json_encode([
            'beneficiary_id' => $beneficiary->id,
            'beneficiary_type' => $beneficiary->beneficiary_type,
            'revision' => optional($beneficiary->updated_at)->toISOString(),
            'status' => $beneficiary->status,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Deterministic authoritative prior evaluation: the most recent COMPLETED
     * evaluation of the beneficiary ordered by (evaluated_at, created_at, id)
     * descending. No policy-version filter is applied — the comparison shows the
     * real historical position and the rule is stable across runs.
     */
    public function priorEvaluation(string $beneficiaryId): ?BeneficiaryPolicyEvaluation
    {
        return BeneficiaryPolicyEvaluation::query()
            ->where('beneficiary_id', $beneficiaryId)
            ->where('evaluation_status', BeneficiaryPolicyEvaluation::STATUS_COMPLETED)
            ->orderByDesc('evaluated_at')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
    }

    private function streamIds($query): array
    {
        $ids = [];
        foreach ($query->select('id')->orderBy('id')->cursor() as $row) {
            $ids[] = (string) $row->id;
        }
        sort($ids, SORT_STRING);

        return $ids;
    }

    /**
     * Run a complete read-only simulation of a DRAFT run and move it to
     * `simulated`. One item is produced per candidate; a single beneficiary
     * failure never erases successful items and never silently marks the run
     * simulated — an unexpected engine failure rolls the whole transaction back
     * and leaves the run in `draft`.
     *
     * @throws ValidationException
     */
    public function simulate(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        $locked = DB::transaction(function () use ($run) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if ($row->status !== PolicyApplicationRun::STATUS_DRAFT) {
                throw ValidationException::withMessages([
                    'run' => 'المحاكاة متاحة فقط من حالة المسودة (draft).',
                ]);
            }

            return $row;
        });

        $version = BeneficiaryPolicyVersion::findOrFail($locked->policy_version_id);
        if (! $version->isPublished()) {
            abort(409, 'لا يمكن محاكاة نطاق تطبيق على إصدار سياسة غير منشور.');
        }

        $candidateIds = $this->candidateIds($locked);

        return DB::transaction(function () use ($locked, $version, $candidateIds, $actorId) {
            foreach (array_chunk($candidateIds, self::BATCH) as $batch) {
                $beneficiaries = Beneficiary::with('dependents')->whereIn('id', $batch)->get()->keyBy('id');
                foreach ($batch as $id) {
                    $beneficiary = $beneficiaries->get($id);
                    if (! $beneficiary) {
                        $this->recordFailure($locked, $id, self::FAILURE_MISSING_CANDIDATE, 'Candidate disappeared before simulation.');

                        continue;
                    }
                    $this->simulateBeneficiary($locked, $beneficiary, $version);
                }
            }

            // Draft candidate capture that is not part of the reviewed candidate
            // set is cancelled so the reviewed set and the run stay identical.
            foreach ($locked->items()->where('status', PolicyApplicationRunItem::STATUS_PENDING)->get() as $item) {
                $item->transitionTo(PolicyApplicationRunItem::STATUS_CANCELLED);
            }

            $summary = $this->deriveSummary($locked);
            $locked->forceFill([
                'total_candidates' => count($candidateIds),
                'processed_count' => $summary['simulated_count'] + $summary['failed_count'],
                'success_count' => $summary['simulated_count'],
                'review_count' => $summary['review_required_count'],
                'not_applicable_count' => $summary['not_applicable_count'],
                'failed_count' => $summary['failed_count'],
                'candidate_set_hash' => $this->candidateSetHash($version->id, $locked->scope_mode, $locked->scope_parameters ?? [], $candidateIds),
                'simulation_summary' => $summary,
            ])->save();

            return $this->runs->transition($locked, PolicyApplicationRun::STATUS_SIMULATED, $actorId);
        });
    }

    private function simulateBeneficiary(PolicyApplicationRun $run, Beneficiary $beneficiary, BeneficiaryPolicyVersion $version): void
    {
        $prior = $this->priorEvaluation($beneficiary->id);

        try {
            $payload = $this->pipeline->compute($beneficiary, $version);
            $result = $this->buildResult($beneficiary, $payload, $prior);
        } catch (Throwable $e) {
            $this->recordFailure($run, $beneficiary->id, self::FAILURE_COMPUTE, $this->sanitizeFailure($e));

            return;
        }

        $item = $this->itemFor($run, $beneficiary->id);
        $item->forceFill([
            'simulation_result' => $result,
            'source_evaluation_id' => $prior?->id,
            'source_state_marker' => $this->sourceStateMarker($beneficiary),
            'failure_code' => null,
            'failure_details' => null,
        ])->save();
        $item->transitionTo(PolicyApplicationRunItem::STATUS_SIMULATED);
    }

    /**
     * A simulation failure follows the E1 item state machine honestly
     * (pending → simulated → processing → failed) so the item is never
     * mistaken for a completed simulation or reprocessed by E3 execution.
     */
    private function recordFailure(PolicyApplicationRun $run, string $beneficiaryId, string $code, string $details): void
    {
        $item = $this->itemFor($run, $beneficiaryId);
        $item->transitionTo(PolicyApplicationRunItem::STATUS_SIMULATED);
        $item->transitionTo(PolicyApplicationRunItem::STATUS_PROCESSING);
        $item->forceFill(['failure_code' => $code, 'failure_details' => $details])->save();
        $item->transitionTo(PolicyApplicationRunItem::STATUS_FAILED);
    }

    private function itemFor(PolicyApplicationRun $run, string $beneficiaryId): PolicyApplicationRunItem
    {
        $item = $run->items()->where('beneficiary_id', $beneficiaryId)->first();
        if (! $item) {
            $item = $run->items()->create([
                'beneficiary_id' => $beneficiaryId,
                'status' => PolicyApplicationRunItem::STATUS_PENDING,
            ]);
        }

        return $item;
    }

    private function sanitizeFailure(Throwable $e): string
    {
        return Str::limit(trim(preg_replace('/\s+/', ' ', class_basename($e).': '.$e->getMessage())), 300);
    }

    /**
     * Sanitized simulation output for one beneficiary: authoritative POLICY-B/C
     * results, the reviewed intermediate outcome, exception/review state and the
     * deterministic prior-evaluation comparison. No predicted administrative
     * approval/rejection is produced and no prior PolicyDecision is copied.
     */
    private function buildResult(Beneficiary $beneficiary, array $payload, ?BeneficiaryPolicyEvaluation $prior): array
    {
        $scoring = $payload['scoring_snapshot'] ?? [];
        $eligibility = (string) $payload['eligibility_decision'];
        $outcome = $this->outcomeOf($payload, $eligibility);
        $reviews = array_values(array_unique($scoring['reviews'] ?? $payload['eligibility_reasons'] ?? []));
        $exception = $scoring['exception'] ?? null;

        $current = [
            'policy_version_id' => $payload['policy_version_id'],
            'eligibility_decision' => $eligibility,
            'eligibility_reasons' => $payload['eligibility_reasons'] ?? [],
            'income_category' => $payload['income_category'] ?? null,
            'policy_score' => $payload['policy_score'] ?? null,
            'score_category' => $payload['score_category'] ?? null,
            'intermediate_outcome' => $outcome,
            'exception_status' => $exception['status'] ?? null,
            'exception_code' => $payload['exception_code'] ?? null,
            'review_required' => in_array($outcome, [
                PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED,
                PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED,
            ], true),
            'review_reasons' => $reviews,
            'not_applicable' => $eligibility === BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE,
            'resident' => $beneficiary->beneficiary_type !== 'citizen',
            'financial_exclusion' => $outcome === null
                ? null
                : $outcome === PolicyOutcomeService::OUTCOME_FINANCIALLY_EXCLUDED,
        ];

        $previous = $prior === null ? null : $this->previousState($prior);

        return [
            'source_evaluation_id' => $prior?->id,
            'previous' => $previous,
            'deltas' => $this->deltas($current, $previous),
        ] + $current;
    }

    private function outcomeOf(array $payload, string $eligibility): ?string
    {
        $fromSnapshot = $payload['scoring_snapshot']['outcome'] ?? null;
        if (is_string($fromSnapshot)) {
            return $fromSnapshot;
        }

        return $eligibility === BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE
            ? PolicyOutcomeService::OUTCOME_POLICY_NOT_APPLICABLE
            : null;
    }

    private function previousState(BeneficiaryPolicyEvaluation $prior): array
    {
        $snapshot = $prior->scoring_snapshot ?? [];
        $outcome = $this->outcomeOf([
            'scoring_snapshot' => $snapshot,
            'eligibility_decision' => $prior->eligibility_decision,
        ], (string) $prior->eligibility_decision);
        $reviews = array_values(array_unique($snapshot['reviews'] ?? $prior->eligibility_reasons ?? []));

        return [
            'policy_version_id' => $prior->policy_version_id,
            'eligibility_decision' => $prior->eligibility_decision,
            'income_category' => $prior->income_category,
            'policy_score' => $prior->policy_score === null ? null : (float) $prior->policy_score,
            'score_category' => $prior->score_category,
            'intermediate_outcome' => $outcome,
            'review_required' => $prior->eligibility_decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_REVIEW_REQUIRED
                || in_array($outcome, [
                    PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED,
                    PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED,
                ], true),
            'review_reasons' => $reviews,
            'financial_exclusion' => $outcome === null
                ? null
                : $outcome === PolicyOutcomeService::OUTCOME_FINANCIALLY_EXCLUDED,
            'evaluated_at' => optional($prior->evaluated_at)->toISOString(),
        ];
    }

    /**
     * Semantic delta flags. Deltas describe a real movement, so:
     * - without a prior completed evaluation the comparison deltas stay false
     *   (the only meaningful signal is `new_review_required`);
     * - null vs null is never a change;
     * - null vs a concrete value IS a change (an unknown prior position moved).
     */
    private function deltas(array $current, ?array $previous): array
    {
        $newReview = (bool) $current['review_required'];
        if ($previous === null) {
            return [
                'eligibility_changed' => false,
                'income_category_changed' => false,
                'score_category_changed' => false,
                'policy_outcome_changed' => false,
                'financial_exclusion_changed' => false,
                'new_review_required' => $newReview,
                'review_reasons_added' => $current['review_reasons'],
                'review_reasons_removed' => [],
                'policy_score_changed' => false,
                'policy_version_changed' => false,
            ];
        }

        $currentReasons = $current['review_reasons'];
        $previousReasons = $previous['review_reasons'];

        return [
            'eligibility_changed' => $this->differs($previous['eligibility_decision'], $current['eligibility_decision']),
            'income_category_changed' => $this->differs($previous['income_category'], $current['income_category']),
            'score_category_changed' => $this->differs($previous['score_category'], $current['score_category']),
            'policy_outcome_changed' => $this->differs($previous['intermediate_outcome'], $current['intermediate_outcome']),
            'financial_exclusion_changed' => $this->differs($previous['financial_exclusion'], $current['financial_exclusion']),
            'new_review_required' => $newReview && ! $previous['review_required'],
            'review_reasons_added' => array_values(array_diff($currentReasons, $previousReasons)),
            'review_reasons_removed' => array_values(array_diff($previousReasons, $currentReasons)),
            // Score movement is reported separately from the score category so a
            // numeric shift inside the same band stays visible to reviewers.
            'policy_score_changed' => $this->scoresDiffer($previous['policy_score'], $current['policy_score']),
            'policy_version_changed' => $this->differs($previous['policy_version_id'], $current['policy_version_id']),
        ];
    }

    private function differs(mixed $previous, mixed $current): bool
    {
        if ($previous === null && $current === null) {
            return false;
        }

        return $previous !== $current;
    }

    private function scoresDiffer(?float $previous, mixed $current): bool
    {
        if ($previous === null && $current === null) {
            return false;
        }
        if ($previous === null || $current === null) {
            return true;
        }

        return abs($previous - (float) $current) > 0.00005;
    }

    /**
     * Summary derived from the persisted items — never from in-memory counters —
     * so the reported impact always matches the ledger row-by-row.
     */
    private function deriveSummary(PolicyApplicationRun $run): array
    {
        $summary = [
            'total_candidates' => 0, 'simulated_count' => 0, 'failed_count' => 0,
            'eligible_count' => 0, 'ineligible_count' => 0, 'review_required_count' => 0,
            'not_applicable_count' => 0, 'resident_not_applicable_count' => 0,
            'financially_qualified_count' => 0, 'financially_excluded_count' => 0,
            'policy_review_required_count' => 0, 'exception_review_required_count' => 0,
            'eligibility_changed_count' => 0, 'income_category_changed_count' => 0,
            'score_category_changed_count' => 0, 'outcome_changed_count' => 0,
            'new_review_required_count' => 0,
            'income_category_counts' => [], 'score_category_counts' => [],
        ];

        foreach ($run->items()->orderBy('id')->cursor() as $item) {
            $summary['total_candidates']++;
            $result = is_array($item->simulation_result) ? $item->simulation_result : null;
            if ($item->status === PolicyApplicationRunItem::STATUS_FAILED || $result === null) {
                $summary['failed_count']++;

                continue;
            }
            $summary['simulated_count']++;

            $this->tallyEligibility($summary, $result);
            $this->tallyOutcome($summary, $result);
            $this->tallyCategories($summary, $result);
            $this->tallyDeltas($summary, $result);
        }

        ksort($summary['income_category_counts']);
        ksort($summary['score_category_counts']);

        return $summary;
    }

    private function tallyEligibility(array &$summary, array $result): void
    {
        $decision = $result['eligibility_decision'] ?? null;
        if ($decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_ELIGIBLE) {
            $summary['eligible_count']++;
        } elseif ($decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_INELIGIBLE) {
            $summary['ineligible_count']++;
        } elseif ($decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE) {
            $summary['not_applicable_count']++;
            if (($result['resident'] ?? false) === true) {
                $summary['resident_not_applicable_count']++;
            }
        }
    }

    private function tallyOutcome(array &$summary, array $result): void
    {
        $outcome = $result['intermediate_outcome'] ?? null;
        $map = [
            PolicyOutcomeService::OUTCOME_FINANCIALLY_QUALIFIED => 'financially_qualified_count',
            PolicyOutcomeService::OUTCOME_FINANCIALLY_EXCLUDED => 'financially_excluded_count',
            PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED => 'policy_review_required_count',
            PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED => 'exception_review_required_count',
        ];
        if (isset($map[$outcome])) {
            $summary[$map[$outcome]]++;
        }
        if (($result['review_required'] ?? false) === true) {
            $summary['review_required_count']++;
        }
    }

    private function tallyCategories(array &$summary, array $result): void
    {
        $income = $result['income_category'] ?? null;
        $summary['income_category_counts'][$income ?? 'none'] = ($summary['income_category_counts'][$income ?? 'none'] ?? 0) + 1;
        $score = $result['score_category'] ?? null;
        $summary['score_category_counts'][$score ?? 'none'] = ($summary['score_category_counts'][$score ?? 'none'] ?? 0) + 1;
    }

    private function tallyDeltas(array &$summary, array $result): void
    {
        $deltas = $result['deltas'] ?? [];
        foreach ([
            'eligibility_changed' => 'eligibility_changed_count',
            'income_category_changed' => 'income_category_changed_count',
            'score_category_changed' => 'score_category_changed_count',
            'policy_outcome_changed' => 'outcome_changed_count',
            'new_review_required' => 'new_review_required_count',
        ] as $flag => $counter) {
            if (($deltas[$flag] ?? false) === true) {
                $summary[$counter]++;
            }
        }
    }
}
