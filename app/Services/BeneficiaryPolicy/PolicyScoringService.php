<?php

namespace App\Services\BeneficiaryPolicy;

use Illuminate\Validation\ValidationException;

/**
 * PolicyScoringService — the ONE point-scoring engine (POLICY-C).
 *
 * Consumes canonical PolicyScoringInputs + published versioned scoring config and
 * returns a STRUCTURED breakdown (rule matched, input used, points awarded) — never
 * only the final total (mandate "Scoring breakdown snapshots").
 *
 * - Deterministic integer-cents band comparisons for money/percent boundaries.
 * - `review_required` (with stable reason codes) for missing/unmapped inputs — an
 *   unavailable value is NEVER silently scored zero.
 * - Invalid verified inputs are REJECTED (head disability % outside 0–100).
 * - Documented source ambiguities resolved per audit §5: >3 affected children and
 *   under-30 age → review_required until an explicit policy version defines them.
 */
final class PolicyScoringService
{
    public const REASON_HOUSING_CONDITION_REVIEW = 'HOUSING_CONDITION_REVIEW_REQUIRED';

    public const REASON_HOUSING_TENURE_REVIEW = 'HOUSING_TENURE_REVIEW_REQUIRED';

    public const REASON_HEAD_HEALTH_REVIEW = 'HEAD_HEALTH_REVIEW_REQUIRED';

    public const REASON_CHILDREN_HEALTH_REVIEW = 'CHILDREN_HEALTH_REVIEW_REQUIRED';

    public const REASON_AGE_REVIEW = 'AGE_REVIEW_REQUIRED';

    public const REASON_INCOME_REVIEW = 'INCOME_DATA_REVIEW_REQUIRED';

    /**
     * Score canonical inputs against the versioned scoring configuration.
     *
     * @param  array{max_score: int, dimensions: array<string, array>}  $scoringConfig
     * @param  array{bands: array<int, array{key:string,label:string,min:int,max:int}>}  $scoreCategoriesConfig
     * @return array{components: array<int, array{dimension:string,input:mixed,rule:string|null,points:int|null,review_required:bool,reason:string|null}>, total_score: float, score_category: string, reviews: array<int, string>}
     */
    public function score(PolicyScoringInputs $inputs, array $scoringConfig, array $scoreCategoriesConfig): array
    {
        $dimensions = $scoringConfig['dimensions'] ?? [];
        $components = [];
        $reviews = [];

        foreach (PolicyConfigurationValidator::SCORING_DIMENSIONS as $dimension) {
            $dim = is_array($dimensions[$dimension] ?? null) ? $dimensions[$dimension] : [];
            $rawEnabled = $dim['enabled'] ?? true;
            if (! is_bool($rawEnabled)) {
                $rawEnabled = true;
            }
            if (! $rawEnabled) {
                $components[] = $this->component($dimension, null, null, null, false, null, true);

                continue;
            }

            $component = match ($dimension) {
                'income' => $this->scoreIncome($inputs->incomePerCapita, $dim),
                'housing_condition' => $this->scoreEnumValue($dimension, $inputs->housingCondition, $dim, self::REASON_HOUSING_CONDITION_REVIEW),
                'housing_tenure' => $this->scoreEnumValue($dimension, $inputs->housingTenure, $dim, self::REASON_HOUSING_TENURE_REVIEW),
                'head_health' => $this->scoreHeadHealth($inputs->headDisabilityPercent, $dim),
                'children_health' => $this->scoreChildrenHealth($inputs->affectedChildrenCount, $dim),
                'age' => $this->scoreAge($inputs->headAge, $dim),
                default => $this->component($dimension, null, null, null, true, null),
            };

            $components[] = $component;
            if (! empty($component['reason']) && $component['review_required']) {
                $reviews[] = $component['reason'];
            }
        }

        $total = array_sum(array_map(
            static fn (array $c) => $c['points'] ?? 0,
            $components,
        ));

        return [
            'components' => $components,
            'total_score' => round((float) $total, 4),
            'score_category' => $this->scoreCategory($total, $scoreCategoriesConfig),
            'reviews' => array_values(array_unique($reviews)),
        ];
    }

    // ── per-dimension scorers ───────────────────────────────────────────────

    private function scoreIncome(?float $perCapita, array $dim): array
    {
        if ($perCapita === null) {
            return $this->component('income', null, null, null, true, self::REASON_INCOME_REVIEW);
        }
        $perCents = PolicyConfigurationValidator::toCents($perCapita);
        foreach (($dim['bands'] ?? []) as $band) {
            $minCents = PolicyConfigurationValidator::toCents((float) $band['min']);
            $canMax = array_key_exists('max', $band) && $band['max'] !== null;
            $maxCents = $canMax ? PolicyConfigurationValidator::toCents((float) $band['max']) : PHP_INT_MAX;
            if ($perCents >= $minCents && $perCents <= $maxCents) {
                $rawPoints = $band['points'] ?? 0;

                return $this->component('income', $perCapita, $this->bandLabel($band), (float) $rawPoints, false, null);
            }
        }

        return $this->component('income', $perCapita, null, null, true, self::REASON_INCOME_REVIEW);
    }

    private function scoreEnumValue(string $dimension, ?string $input, array $dim, string $reviewReason): array
    {
        if ($input === null) {
            return $this->component($dimension, null, null, null, true, $reviewReason);
        }
        foreach (($dim['values'] ?? []) as $row) {
            if (($row['value'] ?? null) === $input) {
                return $this->component($dimension, $input, (string) $row['value'], (float) ($row['points'] ?? 0), false, null);
            }
        }

        // explicitly approved values only — unknown/other → review
        return $this->component($dimension, $input, null, null, true, $reviewReason);
    }

    private function scoreHeadHealth(?float $percent, array $dim): array
    {
        if ($percent === null) {
            return $this->component('head_health', null, null, null, true, self::REASON_HEAD_HEALTH_REVIEW);
        }
        $cents = PolicyConfigurationValidator::toCents($percent);
        if ($cents < 0 || $cents > 10000) {
            throw ValidationException::withMessages([
                'head_disability_percent' => 'نسبة الإعاقة يجب أن تكون بين 0 و 100.',
            ]);
        }
        foreach (($dim['bands'] ?? []) as $band) {
            $minCents = PolicyConfigurationValidator::toCents((float) $band['min']);
            $maxCents = PolicyConfigurationValidator::toCents((float) $band['max']);
            if ($cents >= $minCents && $cents <= $maxCents) {
                return $this->component('head_health', $percent, $this->bandLabel($band), (float) ($band['points'] ?? 0), false, null);
            }
        }

        return $this->component('head_health', $percent, null, null, true, self::REASON_HEAD_HEALTH_REVIEW);
    }

    private function scoreChildrenHealth(?int $count, array $dim): array
    {
        if ($count === null) {
            return $this->component('children_health', null, null, null, true, self::REASON_CHILDREN_HEALTH_REVIEW);
        }
        if ($count <= 0) {
            // zero affected children IS data (nothing affected) — policy-defined zero
            return $this->component('children_health', $count, '0', 0.0, false, null);
        }
        foreach (($dim['values'] ?? []) as $row) {
            if ((int) ($row['value'] ?? -1) === $count) {
                return $this->component('children_health', $count, (string) $row['value'], (float) ($row['points'] ?? 0), false, null);
            }
        }

        // > configured maximum (default 3): no authoritative source rule → review
        return $this->component('children_health', $count, null, null, true, self::REASON_CHILDREN_HEALTH_REVIEW);
    }

    private function scoreAge(?int $age, array $dim): array
    {
        if ($age === null) {
            return $this->component('age', null, null, null, true, self::REASON_AGE_REVIEW);
        }
        $minFirst = (int) (($dim['bands'][0]['min'] ?? 30));
        if ($age < $minFirst) {
            // under the lowest documented band (default under-30): no source rule → review
            return $this->component('age', $age, null, null, true, self::REASON_AGE_REVIEW);
        }
        foreach (($dim['bands'] ?? []) as $band) {
            $min = (int) ($band['min'] ?? 0);
            $canMax = array_key_exists('max', $band) && $band['max'] !== null;
            $max = $canMax ? (int) $band['max'] : PHP_INT_MAX;
            if ($age >= $min && $age <= $max) {
                return $this->component('age', $age, $this->bandLabel($band), (float) ($band['points'] ?? 0), false, null);
            }
        }

        return $this->component('age', $age, null, null, true, self::REASON_AGE_REVIEW);
    }

    // ── score categories ────────────────────────────────────────────────────

    /**
     * @param  array{bands: array<int, array{key:string,label:string,min:int,max:int}>}  $config
     */
    private function scoreCategory(float $total, array $config): string
    {
        $score = (int) round($total);
        foreach (($config['bands'] ?? []) as $band) {
            $min = (int) $band['min'];
            $max = (int) $band['max'];
            if ($score >= $min && $score <= $max) {
                return $band['key'];
            }
        }

        return PolicyConfigurationValidator::SCORE_CATEGORY_KEYS[array_key_last(PolicyConfigurationValidator::SCORE_CATEGORY_KEYS)];
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function bandLabel(array $band): string
    {
        if (array_key_exists('max', $band) && $band['max'] !== null) {
            return $band['min'].'–'.$band['max'];
        }

        return $band['min'].'+';
    }

    private function component(
        string $dimension,
        mixed $input,
        ?string $rule,
        ?float $points,
        bool $reviewRequired,
        ?string $reason,
        bool $disabled = false,
    ): array {
        return [
            'dimension' => $dimension,
            'input' => $input,
            'rule' => $rule,
            'points' => $disabled ? null : $points,
            'review_required' => $reviewRequired,
            'reason' => $reason,
            'disabled' => $disabled,
        ];
    }
}
