<?php

namespace App\Services\BeneficiaryPolicy;

/**
 * PolicyExceptionService — versioned, controlled exception registry (POLICY-C).
 *
 * Safe concepts only: code / enabled / label / income_ceiling /
 * requires_manual_review / declarative structured condition. No executable
 * expressions (no eval, no formula text). The engine evaluates conditions ONLY
 * against allowlisted canonical fields.
 *
 * Orphan-mother exception (Version 4): ceiling 1200 SAR per capita, applied ONLY
 * when structured data proves the exception condition AND no manual review is
 * required by the published configuration. Default configuration keeps
 * requires_manual_review=true (document evidence pending → POLICY-D) so a per-capita
 * income above the exclusion threshold yields exception_review_required, never an
 * invented final approval.
 *
 * Default authoritative structured match is `widow_with_orphans` ONLY. A generic
 * `widow` (canonical value `widow`) does NOT auto-match — orphan status cannot be
 * proven from the enum alone; without authoritative structured orphan evidence it
 * resolves to review_required (stable reason) and documentary/legal proof is
 * deferred to POLICY-D. The 1200 SAR ceiling is NEVER silently applied to a bare
 * widow. A published configuration that explicitly broadens the condition to
 * include `widow` is honored verbatim as immutable policy — it is never silently
 * rewritten.
 */
final class PolicyExceptionService
{
    public const STATUS_NOT_APPLICABLE = 'not_applicable';

    public const STATUS_APPLICABLE = 'applicable';

    public const STATUS_REVIEW_REQUIRED = 'review_required';

    public const REASON_EVIDENCE_REVIEW_REQUIRED = 'ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED';

    /**
     * Evaluate exception rules against structured family data + per-capita income.
     *
     * @param  string|null  $familyStatus  canonical beneficiaries.family_status value
     * @param  array<int, array{code:string,enabled:bool,label:string,income_ceiling:float|int,requires_manual_review:bool,condition:array{field:string,operator:string,values:array<int,string>}}>  $rules
     * @param  bool|null  $orphanEvidenceConfirmed  authoritative structured proof of
     *                                              orphan status for a generic `widow` (from structured data only, never free
     *                                              text / inference). Absent or null = not provable → review_required.
     * @return array{status: string, code: string|null, reason: string|null}
     */
    public function evaluate(?string $familyStatus, float $perCapita, array $rules, float $exclusionThreshold, ?bool $orphanEvidenceConfirmed = null): array
    {
        foreach ($rules as $rule) {
            if (! is_array($rule) || ($rule['enabled'] ?? false) !== true) {
                continue;
            }
            $code = (string) ($rule['code'] ?? '');
            $ceiling = (float) ($rule['income_ceiling'] ?? 0);
            $condition = $rule['condition'] ?? [];

            // Exception only matters inside (threshold, ceiling] — outside it is
            // genuinely not applicable (either income is fine, or no ceiling can save it).
            if ($perCapita <= $exclusionThreshold || $perCapita > $ceiling) {
                continue;
            }

            // No authoritative structured value for the condition field → proof is
            // impossible: review_required, never a silent guess.
            if ($familyStatus === null) {
                return [
                    'status' => self::STATUS_REVIEW_REQUIRED,
                    'code' => $code,
                    'reason' => self::REASON_EVIDENCE_REVIEW_REQUIRED,
                ];
            }

            $matched = $this->matchesCondition($familyStatus, $condition);

            if ($familyStatus === 'widow' && ! $matched && ! $this->conditionCovers($condition, 'widow')) {
                // Generic widow: canonical 'widow' alone is NOT orphan-mother proof —
                // only the structured 'widow_with_orphans' status is. Orphan status
                // cannot be proven from authoritative structured data here → review
                // until POLICY-D documentary/legal evidence; the 1200 SAR ceiling is
                // never silently auto-applied to a bare widow.
                // (A published condition that explicitly lists 'widow' already
                // matched above via matchesCondition → honored verbatim, immutable.)
                if ($orphanEvidenceConfirmed !== true) {
                    return [
                        'status' => self::STATUS_REVIEW_REQUIRED,
                        'code' => $code,
                        'reason' => self::REASON_EVIDENCE_REVIEW_REQUIRED,
                    ];
                }
                // Authoritative structured orphan evidence → treated as an
                // orphan-mother candidate; requires_manual_review below governs.
                $matched = true;
            }

            if (! $matched) {
                continue;
            }

            if (($rule['requires_manual_review'] ?? true) === true) {
                return [
                    'status' => self::STATUS_REVIEW_REQUIRED,
                    'code' => $code,
                    'reason' => self::REASON_EVIDENCE_REVIEW_REQUIRED,
                ];
            }

            return [
                'status' => self::STATUS_APPLICABLE,
                'code' => $code,
                'reason' => null,
            ];
        }

        return [
            'status' => self::STATUS_NOT_APPLICABLE,
            'code' => null,
            'reason' => null,
        ];
    }

    /**
     * Declarative condition matching — only allowlisted fields/operators.
     *
     * @param  array{field:string|null,operator:string|null,values:array<int,string>|null}  $condition
     */
    private function matchesCondition(string $value, array $condition): bool
    {
        $field = $condition['field'] ?? null;
        if ($field !== 'family_status') {
            return false;
        }
        $operator = $condition['operator'] ?? null;
        if ($operator !== PolicyConfigurationValidator::EXCEPTION_CONDITION_OPERATORS[0]) {
            return false;
        }

        return in_array($value, $condition['values'] ?? [], true);
    }

    /**
     * Does the condition value list already explicitly mention the given status?
     */
    private function conditionCovers(array $condition, string $value): bool
    {
        return in_array($value, $condition['values'] ?? [], true);
    }
}
