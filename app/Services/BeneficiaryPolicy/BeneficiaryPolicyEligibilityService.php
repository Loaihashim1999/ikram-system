<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;

/**
 * BeneficiaryPolicyEligibilityService — POLICY-B basic eligibility engine.
 *
 * Produces the structured result {decision, reasons[]} using ONLY rules that
 * can be evaluated reliably from current canonical structured data. Everything
 * that needs a document, medical/widow/divorce evidence, a social-researcher
 * decision, a manual approval or service-area configuration (not yet
 * implemented) returns review_required with a stable machine-readable reason
 * code. No guessing, no silent approve, no silent reject.
 *
 * This service CONSUMES financial results — it never re-implements arithmetic.
 *
 * Stable codes (backend); Arabic labels are a frontend concern.
 */
final class BeneficiaryPolicyEligibilityService
{
    public const DECISION_ELIGIBLE = 'eligible';

    public const DECISION_INELIGIBLE = 'ineligible';

    public const DECISION_REVIEW_REQUIRED = 'review_required';

    public const DECISION_NOT_APPLICABLE = 'not_applicable';

    public const REASON_POLICY_NOT_APPLICABLE_RESIDENT = 'POLICY_NOT_APPLICABLE_RESIDENT';

    public const REASON_REQUIRES_CITIZEN_POLICY_POPULATION = 'REQUIRES_CITIZEN_POLICY_POPULATION';

    public const REASON_FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED = 'FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED';

    public const REASON_MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED = 'MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED';

    public const REASON_SERVICE_AREA_REVIEW_REQUIRED = 'SERVICE_AREA_REVIEW_REQUIRED';

    public const REASON_LANDLORD_RELATION_REVIEW_REQUIRED = 'LANDLORD_RELATION_REVIEW_REQUIRED';

    public const REASON_POLICY_DOCUMENT_REVIEW_REQUIRED = 'POLICY_DOCUMENT_REVIEW_REQUIRED';

    public const REASON_INELIGIBLE_STATUS = 'INELIGIBLE_BENEFICIARY_STATUS';

    public const REASON_BENEFICIARY_UNDER_REVIEW = 'BENEFICIARY_UNDER_REVIEW_REQUIRED';

    /** Family statuses that imply widow/divorce evidence requirements (deterministic marker). */
    public const FAMILY_STATUS_REVIEW_MARKERS = [
        'widow', 'widow_with_orphans', 'divorced', 'divorced_with_children', 'abandoned',
    ];

    /** Saudi national IDs are 10 digits; the first digit encodes sex (1 = male, 2 = female). */
    public const SAUDI_ID_PATTERN = '/^[12][0-9]{9}$/';

    private const MALE_UNDER_40_AGE = 40;

    /**
     * @param  array  $financials  result of FinancialCalculationService::calculatePolicyFinancials()
     *                             (may be empty for non-applicable populations)
     * @return array{decision: string, reasons: string[]}
     */
    public function evaluate(Beneficiary $beneficiary, array $financials, BeneficiaryPolicyVersion $version): array
    {
        // Population gate — the Version-4 citizen policy applies only to citizens.
        if ($beneficiary->beneficiary_type !== 'citizen') {
            return [
                'decision' => self::DECISION_NOT_APPLICABLE,
                'reasons' => [self::REASON_POLICY_NOT_APPLICABLE_RESIDENT],
            ];
        }

        // Deterministic structured disqualifier (workflow state).
        if ($beneficiary->status === 'suspended') {
            return [
                'decision' => self::DECISION_INELIGIBLE,
                'reasons' => [self::REASON_INELIGIBLE_STATUS],
            ];
        }

        $reasons = [];
        if ($beneficiary->status === 'under_review') {
            $reasons[] = self::REASON_BENEFICIARY_UNDER_REVIEW;
        }

        $config = PolicyConfigurationValidator::withDefaults($version->configuration ?? []);
        $review = $config['eligibility']['review'] ?? [];

        if (! empty($review['documents'])) {
            $reasons[] = self::REASON_POLICY_DOCUMENT_REVIEW_REQUIRED;
        }
        if (! empty($review['service_area'])) {
            $reasons[] = self::REASON_SERVICE_AREA_REVIEW_REQUIRED;
        }
        if (! empty($review['landlord_relation']) && $beneficiary->housing_type === 'rent') {
            $reasons[] = self::REASON_LANDLORD_RELATION_REVIEW_REQUIRED;
        }
        if (! empty($review['family_status']) && in_array($beneficiary->family_status, self::FAMILY_STATUS_REVIEW_MARKERS, true)) {
            $reasons[] = self::REASON_FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED;
        }
        if (! empty($review['male_under_40']) && $this->isDerivedMaleUnder40($beneficiary)) {
            $reasons[] = self::REASON_MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED;
        }

        $reasons = array_values(array_unique($reasons));

        return [
            'decision' => $reasons === [] ? self::DECISION_ELIGIBLE : self::DECISION_REVIEW_REQUIRED,
            'reasons' => $reasons,
        ];
    }

    /**
     * Deterministic male-under-40 derivation from structured data only:
     * 10-digit Saudi national ID starting with 1 (male) + age below the policy
     * threshold. When not derivable the medical-review rule is simply not flagged.
     */
    private function isDerivedMaleUnder40(Beneficiary $beneficiary): bool
    {
        $id = (string) ($beneficiary->national_id ?? '');
        if (! preg_match(self::SAUDI_ID_PATTERN, $id) || $id[0] !== '1') {
            return false;
        }
        if (! $beneficiary->date_of_birth) {
            return false;
        }
        try {
            $age = $beneficiary->date_of_birth->age;
        } catch (\Throwable) {
            return false;
        }

        return $age < self::MALE_UNDER_40_AGE;
    }
}
