<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use Illuminate\Validation\ValidationException;

/**
 * BeneficiaryPolicyEvaluationService — permanent evaluation snapshots (POLICY-A).
 *
 * POLICY-A only provides safe snapshot storage: nothing here computes financial
 * or scoring results. Callers (later phases) supply the already-computed values.
 *
 * Snapshot rules honoured:
 * - a new evaluation always creates a new record; prior results are never overwritten;
 * - privacy: only data required to explain the decision is snapshotted,
 *   national ID / IBAN / document binaries / provider secrets are stripped;
 * - evaluations only reference published policy versions.
 */
class BeneficiaryPolicyEvaluationService
{
    private const FORBIDDEN_SNAPSHOT_KEYS = [
        'password', 'token', 'secret', 'api_key', 'provider_secret',
        'iban', 'iban_encrypted',
        'national_id', 'national_id_image_url', 'national_address_image_url',
        'residence_id_image_url',
        'citizen_account_image_url', 'social_security_image_url',
        'rental_contract_image_url', 'electricity_bill_image_url', 'salary_certificate_url',
    ];

    /**
     * Create an evaluation snapshot.
     *
     * @param  array  $input  snapshot fields (see BeneficiaryPolicyEvaluation)
     * @param  string  $actorId  evaluating user id
     */
    public function create(array $input, string $actorId): BeneficiaryPolicyEvaluation
    {
        $beneficiaryId = $input['beneficiary_id'] ?? null;
        $policyVersionId = $input['policy_version_id'] ?? null;
        if (! $beneficiaryId || ! $policyVersionId) {
            throw ValidationException::withMessages(['beneficiary_id' => 'بيانات التقييم غير مكتملة (المستفيد وإصدار السياسة مطلوبان).']);
        }

        $beneficiary = Beneficiary::query()->findOrFail($beneficiaryId);
        $policyVersion = BeneficiaryPolicyVersion::query()->findOrFail($policyVersionId);

        if (! $policyVersion->isPublished()) {
            abort(409, 'لا يمكن تسجيل تقييم على نسخة سياسة غير منشورة.');
        }

        $status = $input['evaluation_status'] ?? BeneficiaryPolicyEvaluation::STATUS_COMPLETED;
        if (! in_array($status, BeneficiaryPolicyEvaluation::STATUSES, true)) {
            throw ValidationException::withMessages(['evaluation_status' => 'حالة تقييم غير معروفة.']);
        }

        $familySize = $input['family_size'] ?? null;
        if ($familySize !== null && ((int) $familySize < 0)) {
            throw ValidationException::withMessages(['family_size' => 'حجم الأسرة لا يمكن أن يكون سالباً.']);
        }

        $eligibilityDecision = $input['eligibility_decision'] ?? null;
        if ($eligibilityDecision !== null && ! in_array($eligibilityDecision, BeneficiaryPolicyEvaluation::ELIGIBILITY_DECISIONS, true)) {
            throw ValidationException::withMessages(['eligibility_decision' => 'قرار أهلية غير معروف.']);
        }

        $eligibilityReasons = $input['eligibility_reasons'] ?? null;
        if ($eligibilityReasons !== null && (! is_array($eligibilityReasons) || array_filter($eligibilityReasons, static fn ($r) => ! is_string($r)) !== [])) {
            throw ValidationException::withMessages(['eligibility_reasons' => 'أكواد الأهلية يجب أن تكون قائمة نصوص (أكواد ثابتة تُقرأ آلياً).']);
        }

        $snapshot = $this->safeBeneficiaryReference($beneficiary);
        $snapshot = array_merge($snapshot, $this->sanitize($input['input_snapshot'] ?? []));

        $evaluation = new BeneficiaryPolicyEvaluation([
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $policyVersion->id,
            'evaluation_status' => $status,
            'evaluated_at' => $input['evaluated_at'] ?? now(),
            'evaluated_by' => $actorId,
            'input_snapshot' => $snapshot,
            'financial_snapshot' => $this->sanitize($input['financial_snapshot'] ?? []),
            'scoring_snapshot' => $this->sanitize($input['scoring_snapshot'] ?? []),
            'gross_counted_income' => $input['gross_counted_income'] ?? null,
            'monthly_rent' => $input['monthly_rent'] ?? null,
            'family_size' => $familySize,
            'family_member_deduction' => $input['family_member_deduction'] ?? null,
            'adjusted_net_household_income' => $input['adjusted_net_household_income'] ?? null,
            'net_income_per_capita' => $input['net_income_per_capita'] ?? null,
            'income_category' => $input['income_category'] ?? null,
            'policy_score' => $input['policy_score'] ?? null,
            'score_category' => $input['score_category'] ?? null,
            'degree_classification_snapshot' => $input['degree_classification_snapshot'] ?? null,
            'need_level_snapshot' => $input['need_level_snapshot'] ?? null,
            'exception_code' => $input['exception_code'] ?? null,
            'exception_details' => $input['exception_details'] ?? null,
            'final_policy_decision' => $input['final_policy_decision'] ?? null,
            'decision_reason' => $input['decision_reason'] ?? null,
            'eligibility_decision' => $eligibilityDecision,
            'eligibility_reasons' => $eligibilityReasons,
        ]);
        $evaluation->save();

        return $evaluation->fresh();
    }

    /**
     * Convenience snapshot builder for tests and later phases: derives a safe input
     * snapshot from whitelisted beneficiary financial attributes (figures only).
     */
    public function createForBeneficiary(
        Beneficiary $beneficiary,
        string $policyVersionId,
        array $financial,
        array $scoring,
        string $actorId,
        array $decision = []
    ): BeneficiaryPolicyEvaluation {
        return $this->create(array_merge($decision, [
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $policyVersionId,
            'financial_snapshot' => $financial,
            'scoring_snapshot' => $scoring,
        ]), $actorId);
    }

    /**
     * Minimal safe business reference for the head of household — no identity records.
     */
    private function safeBeneficiaryReference(Beneficiary $beneficiary): array
    {
        return array_filter([
            'beneficiary_type' => $beneficiary->beneficiary_type,
            'status' => $beneficiary->status,
            'housing_type' => $beneficiary->housing_type,
            'family_members_count' => $beneficiary->family_members_count,
        ], static fn ($value) => $value !== null);
    }

    /**
     * Strip privacy-sensitive keys recursively from a snapshot array.
     */
    private function sanitize(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::FORBIDDEN_SNAPSHOT_KEYS, true)) {
                unset($data[$key]);

                continue;
            }
            if (is_array($value)) {
                $data[$key] = $this->sanitize($value);
            }
        }

        return $data;
    }
}
