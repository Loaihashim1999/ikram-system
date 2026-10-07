<?php

namespace App\Services\BeneficiaryPolicy;

/**
 * Maps an already scored snapshot into the explainable breakdown contract.
 * It does not award points and does not replace PolicyScoringService.
 */
final class PolicyScoreBreakdown
{
    public const LABELS = [
        'income' => 'الدخل',
        'housing_condition' => 'حالة المسكن',
        'housing_tenure' => 'ملكية المسكن',
        'head_health' => 'إعاقة رب الأسرة',
        'children_health' => 'الأطفال المتأثرون صحياً',
        'age' => 'عمر رب الأسرة',
    ];

    /**
     * @param  array<int, array<string, mixed>>  $components
     * @param  array<string, array<string, mixed>>  $dimensions
     * @return array<int, array<string, mixed>>
     */
    public static function fromComponents(array $components, array $dimensions = []): array
    {
        return array_map(function (array $component) use ($dimensions) {
            $dimension = (string) ($component['dimension'] ?? '');
            $configured = is_array($dimensions[$dimension] ?? null) ? $dimensions[$dimension] : [];

            return self::row($component, self::maxPoints($configured));
        }, $components);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function fromSnapshot(?array $snapshot): array
    {
        if (! is_array($snapshot)) {
            return [];
        }
        if (is_array($snapshot['breakdown'] ?? null)) {
            return array_values($snapshot['breakdown']);
        }

        return self::fromComponents(is_array($snapshot['components'] ?? null) ? $snapshot['components'] : []);
    }

    /**
     * @param  array<string, mixed>  $component
     * @return array<string, mixed>
     */
    private static function row(array $component, ?float $maxPoints): array
    {
        $dimension = (string) ($component['dimension'] ?? '');

        return [
            'rule_id' => $dimension,
            'label' => self::LABELS[$dimension] ?? 'بند السياسة',
            'value' => $component['input'] ?? $component['value'] ?? null,
            'condition' => $component['condition'] ?? $component['rule'] ?? null,
            'awarded_points' => $component['awarded_points'] ?? $component['points'] ?? null,
            'max_points' => $component['max_points'] ?? $maxPoints,
            'reason' => $component['reason'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $dimension
     */
    private static function maxPoints(array $dimension): ?float
    {
        $points = [];
        foreach (['bands', 'values'] as $key) {
            foreach ($dimension[$key] ?? [] as $row) {
                if (is_array($row) && array_key_exists('points', $row)) {
                    $points[] = (float) $row['points'];
                }
            }
        }

        return $points === [] ? null : max($points);
    }
}
