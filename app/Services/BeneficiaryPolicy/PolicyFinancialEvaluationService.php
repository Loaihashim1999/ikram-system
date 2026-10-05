<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Services\FinancialCalculationService;

/**
 * PolicyFinancialEvaluationService — POLICY-B + POLICY-C evaluation orchestrator.
 *
 * Flow: population gate → FinancialCalculationService::calculatePolicyFinancials()
 * (the ONE authoritative calculator) → BeneficiaryPolicyEligibilityService (POLICY-B)
 * → income categorization + scoring + exceptions (POLICY-C) → immutable snapshot
 * through BeneficiaryPolicyEvaluationService.
 *
 * - Requires an explicit PUBLISHED policy version (never "whatever settings
 *   exist now"); the version id and calculated_at are recorded for reproducibility.
 * - A citizen-policy evaluation for a resident returns a clear
 *   not_applicable result — citizen rules are never silently applied.
 * - POLICY-C consumes the authoritative `net_income_per_capita`; it never
 *   re-implements financial arithmetic and never issues a final policy decision
 *   (final_policy_decision stays null until POLICY-D).
 * - No mass recalculation, no mutation of historical evaluations: every run
 *   creates a NEW snapshot (application scope / bulk are POLICY-E).
 */
final class PolicyFinancialEvaluationService
{
    public function __construct(
        private readonly FinancialCalculationService $calculator,
        private readonly BeneficiaryPolicyEligibilityService $eligibility,
        private readonly BeneficiaryPolicyEvaluationService $evaluations,
        private readonly PolicyScoringInputProvider $inputProvider,
        private readonly PolicyIncomeCategoriesService $incomeCategories,
        private readonly PolicyScoringService $scoring,
        private readonly PolicyExceptionService $exceptions,
        private readonly PolicyOutcomeService $outcomes,
    ) {}

    public function evaluate(string $beneficiaryId, string $policyVersionId, string $actorId): BeneficiaryPolicyEvaluation
    {
        $beneficiary = Beneficiary::with('dependents')->findOrFail($beneficiaryId);
        $version = BeneficiaryPolicyVersion::findOrFail($policyVersionId);

        if (! $version->isPublished()) {
            abort(409, 'لا يمكن إجراء تقييم مالي على نسخة سياسة غير منشورة.');
        }

        return $this->evaluations->create($this->compute($beneficiary, $version), $actorId);
    }

    /**
     * compute() — POLICY-E2 shared NON-PERSISTING calculation path.
     *
     * The ONE authoritative computation pipeline: population gate →
     * FinancialCalculationService::calculatePolicyFinancials() → POLICY-B
     * eligibility → POLICY-C income categorization/scoring/exceptions/outcome.
     * Both the persisting evaluate() above and the POLICY-E2 read-only
     * simulation engine consume exactly this method — income/rent/family/
     * income-category/score/exception/eligibility logic is never duplicated.
     *
     * Returns the full evaluation payload (the same shape
     * BeneficiaryPolicyEvaluationService::create() consumes) WITHOUT writing
     * anything to the database.
     */
    public function compute(Beneficiary $beneficiary, BeneficiaryPolicyVersion $version): array
    {
        if ($beneficiary->beneficiary_type !== 'citizen') {
            $result = $this->eligibility->evaluate($beneficiary, [], $version);

            return [
                'beneficiary_id' => $beneficiary->id,
                'policy_version_id' => $version->id,
                'evaluation_status' => BeneficiaryPolicyEvaluation::STATUS_COMPLETED,
                'evaluated_at' => now(),
                'input_snapshot' => [
                    'beneficiary_type' => $beneficiary->beneficiary_type,
                    'status' => $beneficiary->status,
                    'housing_type' => $beneficiary->housing_type,
                    'family_members_count' => $beneficiary->family_members_count,
                    'population_excluded' => 'citizen_policy_not_applicable_to_residents',
                ],
                'financial_snapshot' => [],
                'eligibility_decision' => $result['decision'],
                'eligibility_reasons' => $result['reasons'],
            ];
        }

        $financials = $this->calculator->calculatePolicyFinancials($beneficiary, $version);
        $result = $this->eligibility->evaluate($beneficiary, $financials, $version);

        // ── POLICY-C: income categories, scoring, exceptions, outcome ──────
        $config = PolicyConfigurationValidator::withDefaults($version->configuration ?? []);
        $perCapita = (float) $financials['net_income_per_capita'];
        $exclusionThreshold = (float) $config['income_categories']['exclusion_threshold'];

        $income = $this->incomeCategories->classify($perCapita, $config['income_categories']);
        $inputs = $this->inputProvider->fromBeneficiary($beneficiary, $financials);
        $scoring = $this->scoring->score($inputs, $config['scoring'], $config['score_categories']);
        $exception = $this->exceptions->evaluate(
            $beneficiary->family_status,
            $perCapita,
            $config['exceptions']['rules'] ?? [],
            $exclusionThreshold,
            // No authoritative structured orphan-evidence field exists yet (POLICY-D
            // will collect documentary proof) → a generic 'widow' resolves to
            // review_required, never a silent auto-ceiling.
            null,
        );

        $reviews = array_values(array_unique(array_merge($result['reasons'], $scoring['reviews'])));
        if ($exception['status'] === PolicyExceptionService::STATUS_REVIEW_REQUIRED) {
            $reviews[] = $exception['reason'];
            $reviews = array_values(array_unique($reviews));
        }
        $outcome = $this->outcomes->resolve($result['decision'], $income['status'], $exception['status'], $reviews);

        return [
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $version->id,
            'evaluation_status' => BeneficiaryPolicyEvaluation::STATUS_COMPLETED,
            'evaluated_at' => now(),
            'input_snapshot' => [
                'beneficiary_type' => $beneficiary->beneficiary_type,
                'status' => $beneficiary->status,
                'housing_type' => $beneficiary->housing_type,
                'family_status' => $beneficiary->family_status,
                'family_members_count' => $beneficiary->family_members_count,
                'family_size_derivation' => 'head_plus_active_dependents',
                'dependents_count' => $financials['dependents_count'],
            ],
            'financial_snapshot' => [
                'counted_gross_monthly_income' => $financials['counted_gross_monthly_income'],
                'income_sources' => $financials['income_sources'],
                'monthly_rent' => $financials['monthly_rent'],
                'rent_mode' => $financials['rent_mode'],
                'family_size' => $financials['family_size'],
                'per_family_member_deduction' => $financials['per_family_member_deduction'],
                'family_member_deduction' => $financials['family_member_deduction'],
                'adjusted_net_household_income' => $financials['adjusted_net_household_income'],
                'net_income_per_capita' => $financials['net_income_per_capita'],
                'policy_version_id' => $version->id,
                'policy_version' => $financials['policy_version'],
                'calculated_at' => $financials['calculated_at'],
                'precision' => $financials['precision'],
            ],
            'gross_counted_income' => $financials['counted_gross_monthly_income'],
            'monthly_rent' => $financials['monthly_rent'],
            'family_size' => $financials['family_size'],
            'family_member_deduction' => $financials['family_member_deduction'],
            'adjusted_net_household_income' => $financials['adjusted_net_household_income'],
            'net_income_per_capita' => $financials['net_income_per_capita'],
            'eligibility_decision' => $result['decision'],
            'eligibility_reasons' => $result['reasons'],
            // POLICY-C results (stored separately from income_category/score_category)
            'income_category' => $income['category'],
            'policy_score' => $scoring['total_score'],
            'score_category' => $scoring['score_category'],
            'exception_code' => $exception['status'] !== PolicyExceptionService::STATUS_NOT_APPLICABLE ? $exception['code'] : null,
            'exception_details' => json_encode([
                'status' => $exception['status'],
                'code' => $exception['code'],
                'reason' => $exception['reason'],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'scoring_snapshot' => [
                'config' => [
                    'policy_version_id' => $version->id,
                    'policy_version' => $version->version,
                    'max_score' => (int) $config['scoring']['max_score'],
                    'generated_at' => now()->toISOString(),
                ],
                'input' => $inputs->toArray(),
                'income' => [
                    'category' => $income['category'],
                    'status' => $income['status'],
                    'band' => $income['band'],
                    'per_capita' => $perCapita,
                    'exclusion_threshold' => $exclusionThreshold,
                ],
                'components' => $scoring['components'],
                'total_score' => $scoring['total_score'],
                'score_category' => $scoring['score_category'],
                'reviews' => $reviews,
                'exception' => $exception,
                'outcome' => $outcome,
            ],
        ];
    }
}
