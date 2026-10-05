<?php

namespace App\Services\BeneficiaryPolicy;

/**
 * PolicyIncomeCategoriesService — income-per-capita categorization + exclusion (POLICY-C).
 *
 * Consumes the authoritative POLICY-B `net_income_per_capita` (2-dp, non-negative).
 * CATEGORIZATION IS NOT SCORING: income_category (a/b/c/d/excluded) is stored and
 * displayed separately from policy_score/score_category (see audit §2, §4).
 *
 * Boundaries are compared in integer cents — 400.00 → A, 400.01 → B deterministically.
 */
final class PolicyIncomeCategoriesService
{
    public const CATEGORY_EXCLUDED = 'excluded';

    public const STATUS_ELIGIBLE = 'eligible';

    public const STATUS_EXCLUDED = 'excluded';

    public const REASON_INCOME_EXCLUDED = 'INCOME_EXCLUDED_BY_THRESHOLD';

    /**
     * Classify per-capita income against the versioned income-category configuration.
     *
     * @param  array{exclusion_threshold: float|int, bands: array<int, array{key:string,label:string,min:float|int,max:float|int}>}  $config
     * @return array{category: string, status: string, band: array{key:string,label:string,min:float|int,max:float|int}|null}
     */
    public function classify(float $perCapita, array $config): array
    {
        $threshold = (float) ($config['exclusion_threshold'] ?? PolicyConfigurationValidator::DEFAULT_INCOME_EXCLUSION_THRESHOLD);
        $perCents = PolicyConfigurationValidator::toCents($perCapita);
        $thresholdCents = PolicyConfigurationValidator::toCents($threshold);

        if ($perCents > $thresholdCents) {
            return [
                'category' => self::CATEGORY_EXCLUDED,
                'status' => self::STATUS_EXCLUDED,
                'band' => null,
            ];
        }

        foreach (($config['bands'] ?? []) as $band) {
            $minCents = PolicyConfigurationValidator::toCents((float) $band['min']);
            $maxCents = PolicyConfigurationValidator::toCents((float) $band['max']);
            if ($perCents >= $minCents && $perCents <= $maxCents) {
                return [
                    'category' => $band['key'],
                    'status' => self::STATUS_ELIGIBLE,
                    'band' => $band,
                ];
            }
        }

        // A gap in configured bands is rejected at save-time (validator); if a stale
        // configuration ever contains one, expose it as excluded rather than guessing.
        return [
            'category' => self::CATEGORY_EXCLUDED,
            'status' => self::STATUS_EXCLUDED,
            'band' => null,
        ];
    }
}
