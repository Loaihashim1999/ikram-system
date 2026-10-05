<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\BeneficiaryPolicyEvaluation;

/**
 * PolicyOutcomeService — deterministic intermediate result (POLICY-C result contract).
 *
 * POLICY-C never issues a final association approval: final_policy_decision stays
 * null until document/social/manager steps (POLICY-D). These stable intermediate
 * outcomes summarize the financial + scoring + exception position:
 *
 *   policy_not_applicable   resident under citizen policy
 *   policy_ineligible       suspended/blocked beneficiary
 *   financially_excluded    income above threshold, no applicable exception
 *   exception_review_required  above threshold, exception proof pending (documents)
 *   policy_review_required  any review gate open (documents, missing data, …)
 *   financially_qualified   nothing blocks financial qualification yet
 *
 * Precedence is deterministic and documented in the POLICY-C implementation report.
 */
final class PolicyOutcomeService
{
    public const OUTCOME_FINANCIALLY_QUALIFIED = 'financially_qualified';

    public const OUTCOME_FINANCIALLY_EXCLUDED = 'financially_excluded';

    public const OUTCOME_EXCEPTION_REVIEW_REQUIRED = 'exception_review_required';

    public const OUTCOME_POLICY_REVIEW_REQUIRED = 'policy_review_required';

    public const OUTCOME_POLICY_NOT_APPLICABLE = 'policy_not_applicable';

    public const OUTCOME_POLICY_INELIGIBLE = 'policy_ineligible';

    public const OUTCOMES = [
        self::OUTCOME_POLICY_NOT_APPLICABLE,
        self::OUTCOME_POLICY_INELIGIBLE,
        self::OUTCOME_FINANCIALLY_EXCLUDED,
        self::OUTCOME_EXCEPTION_REVIEW_REQUIRED,
        self::OUTCOME_POLICY_REVIEW_REQUIRED,
        self::OUTCOME_FINANCIALLY_QUALIFIED,
    ];

    /**
     * @param  array<int, string>  $reviews  review reason codes (eligibility + scoring + exception)
     */
    public function resolve(
        string $eligibilityDecision,
        string $incomeStatus,
        string $exceptionStatus,
        array $reviews,
    ): string {
        if ($eligibilityDecision === BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE) {
            return self::OUTCOME_POLICY_NOT_APPLICABLE;
        }
        if ($eligibilityDecision === BeneficiaryPolicyEvaluation::ELIGIBILITY_INELIGIBLE) {
            return self::OUTCOME_POLICY_INELIGIBLE;
        }
        if ($incomeStatus === PolicyIncomeCategoriesService::STATUS_EXCLUDED
            && $exceptionStatus === PolicyExceptionService::STATUS_NOT_APPLICABLE) {
            return self::OUTCOME_FINANCIALLY_EXCLUDED;
        }
        if ($incomeStatus === PolicyIncomeCategoriesService::STATUS_EXCLUDED
            && $exceptionStatus === PolicyExceptionService::STATUS_REVIEW_REQUIRED) {
            return self::OUTCOME_EXCEPTION_REVIEW_REQUIRED;
        }
        if ($reviews !== []) {
            return self::OUTCOME_POLICY_REVIEW_REQUIRED;
        }

        return self::OUTCOME_FINANCIALLY_QUALIFIED;
    }
}
