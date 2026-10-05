<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\BeneficiaryPolicyVersion;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * POLICY-E1 — application-scope run parameter contract & deterministic
 * fingerprints.
 *
 * Parameter ownership:
 * - The immutable published policy configuration owns `application_scope.applies_to`
 *   and (for mode `effective_from_date`) `application_scope.effective_from_date`.
 * - The application RUN owns the selected existing beneficiary IDs for
 *   `selected_existing_and_new` (never stored in published configuration).
 * - Future beneficiaries are never part of a run's selected-ID list.
 *
 * Canonical date rule (POLICY-E0 §2): the ONLY beneficiary date field is
 * `beneficiaries.created_at` (server-set). The `effective_from_date` eligibility
 * boundary is a DATE-ONLY comparison in the application timezone:
 *     date(beneficiaries.created_at) >= application_scope.effective_from_date
 * `updated_at` is never used; no new registration column is created.
 *
 * This service performs NO financial/scoring/eligibility/decision computation
 * (POLICY-B/C/D own those). It only validates/normalizes scope parameters and
 * derives deterministic fingerprints.
 */
class PolicyApplicationScopeService
{
    /** Canonical beneficiary registration timestamp field (do not change). */
    public const REGISTRATION_DATE_FIELD = 'beneficiaries.created_at';

    public const MODE_NEW_ONLY = 'new_only';

    public const MODE_ALL = 'all_existing_and_new';

    public const MODE_SELECTED = 'selected_existing_and_new';

    public const MODE_EFFECTIVE_DATE = 'effective_from_date';

    /**
     * Resolve the scope mode owned by the policy version configuration.
     */
    public function modeFor(BeneficiaryPolicyVersion $version): string
    {
        return $version->configuration['application_scope']['applies_to']
            ?? PolicyConfigurationValidator::DEFAULT_APPLIES_TO;
    }

    /**
     * Validate run-level parameters for a scope mode and return the NORMALIZED
     * canonical parameter set (deterministic order, deduplicated IDs). Any
     * unknown key — including sensitive fields — is rejected.
     *
     * @return array normalized parameters (may be empty)
     *
     * @throws ValidationException
     */
    public function validateAndNormalize(string $mode, array $parameters, ?BeneficiaryPolicyVersion $version = null): array
    {
        if (! in_array($mode, PolicyConfigurationValidator::APPLICATION_SCOPES, true)) {
            throw ValidationException::withMessages([
                'scope_mode' => 'نطاق تطبيق غير معروف: '.$mode,
            ]);
        }

        return match ($mode) {
            self::MODE_NEW_ONLY, self::MODE_ALL => $this->requireEmptyParameters($mode, $parameters),
            self::MODE_SELECTED => $this->normalizeSelectedParameters($parameters),
            self::MODE_EFFECTIVE_DATE => $this->normalizeEffectiveDateParameters($parameters, $version),
        };
    }

    /**
     * Deterministic sha256 fingerprint over exactly:
     *   policy_version_id + scope_mode + normalized scope parameters.
     * Sensitive data can never enter: validateAndNormalize rejects every key
     * outside the per-mode whitelist before fingerprinting.
     */
    public function fingerprint(string $policyVersionId, string $scopeMode, array $normalizedParameters): string
    {
        $payload = [
            'parameters' => $normalizedParameters,
            'policy_version_id' => $policyVersionId,
            'scope_mode' => $scopeMode,
        ];

        return hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function requireEmptyParameters(string $mode, array $parameters): array
    {
        if ($parameters !== []) {
            throw ValidationException::withMessages([
                'scope_parameters' => 'نطاق «'.$mode.'» لا يقبل مُعاملات تشغيل (لا قوائم مستفيدين ولا تاريخ نفاذ على مستوى التشغيل).',
            ]);
        }

        return [];
    }

    private function normalizeSelectedParameters(array $parameters): array
    {
        $unknown = array_values(array_diff(array_keys($parameters), ['beneficiary_ids']));
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'scope_parameters' => 'مُعاملات غير معروفة لنطاق التحديد: '.implode('، ', $unknown),
            ]);
        }

        $ids = $parameters['beneficiary_ids'] ?? null;
        if (! is_array($ids) || $ids === [] || array_values($ids) !== $ids) {
            throw ValidationException::withMessages([
                'scope_parameters.beneficiary_ids' => 'يجب تمرير قائمة غير فارغة من معرّفات المستفيدين الحاليين.',
            ]);
        }
        foreach ($ids as $id) {
            if (! is_string($id) || ! Str::isUuid($id)) {
                throw ValidationException::withMessages([
                    'scope_parameters.beneficiary_ids' => 'معرّف مستفيد غير صالح في قائمة التحديد.',
                ]);
            }
        }

        // Deterministic normalization: deduplicate, sort, re-index.
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_STRING);

        return ['beneficiary_ids' => $ids];
    }

    private function normalizeEffectiveDateParameters(array $parameters, ?BeneficiaryPolicyVersion $version): array
    {
        if ($parameters !== []) {
            throw ValidationException::withMessages([
                'scope_parameters' => 'تاريخ النفاذ مملوك لإعداد الإصدار المنشور، وليس لمُعاملات التشغيل.',
            ]);
        }

        $date = $version?->configuration['application_scope']['effective_from_date'] ?? null;
        if (! is_string($date) || ! PolicyConfigurationValidator::isCanonicalDate($date)) {
            throw ValidationException::withMessages([
                'configuration.application_scope.effective_from_date' => 'نطاق «effective_from_date» يتطلب تاريخ نفاذ صالحاً (YYYY-MM-DD) في إعداد الإصدار المنشور.',
            ]);
        }

        return ['effective_from_date' => $date];
    }
}
