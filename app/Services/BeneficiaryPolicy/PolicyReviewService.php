<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\DocumentVerification;
use App\Models\MedicalEvidence;
use App\Models\PolicyDecision;
use App\Models\SocialAssessment;

/** Read-only documentary overlay. Never rewrites the producing evaluation. */
final class PolicyReviewService
{
    public function data(BeneficiaryPolicyEvaluation $evaluation): array
    {
        $version = $evaluation->policyVersion;
        $config = PolicyConfigurationValidator::withDefaults($version->configuration ?? []);
        $verifications = DocumentVerification::where('evaluation_id', $evaluation->id)
            ->where('beneficiary_id', $evaluation->beneficiary_id)->orderByDesc('created_at')->orderByDesc('id')->get();
        $documents = [];
        foreach ($config['documents']['rules'] as $rule) {
            $applicable = true;
            foreach ($rule['applies_when'] ?? [] as $field => $expected) {
                // Conditions use the historical input, never today's edited beneficiary.
                if (! array_key_exists($field, $evaluation->input_snapshot ?? [])) {
                    $applicable = null;
                    break;
                }
                $actual = $evaluation->input_snapshot[$field];
                if ($field === 'housing_type') {
                    $actual = ['rent' => 'rented', 'own' => 'owned'][$actual] ?? $actual;
                }
                $applicable = $applicable && in_array($actual, (array) $expected, true);
            }
            $record = $verifications->firstWhere('document_code', $rule['code']);
            $documents[] = array_merge($rule, [
                'applicable' => $applicable,
                'status' => $applicable === null ? 'under_review' : ($applicable ? ($record?->verification_status ?? 'missing') : 'not_applicable'),
                'verification' => $record,
            ]);
        }
        $assessment = SocialAssessment::where('evaluation_id', $evaluation->id)->where('beneficiary_id', $evaluation->beneficiary_id)->where('policy_version_id', $evaluation->policy_version_id)
            ->orderByDesc('created_at')->orderByDesc('id')->first();
        $medical = MedicalEvidence::where('evaluation_id', $evaluation->id)->where('beneficiary_id', $evaluation->beneficiary_id)
            ->orderByDesc('created_at')->orderByDesc('id')->first();
        $documentsComplete = collect($documents)->every(fn ($d) => $d['applicable'] === false || ! ($d['required'] ?? false) || ($d['applicable'] === true && $d['status'] === 'verified'));
        $reviewed = $assessment?->status === 'reviewed';
        $children = $assessment?->household_findings['affected_children_count'] ?? null;
        $medicalVerified = $medical?->verification_status === 'verified' && $medical->verified_disability_percentage !== null && (float) $medical->verified_disability_percentage >= 0 && (float) $medical->verified_disability_percentage <= 100;
        $reasons = array_values(array_unique(array_merge($evaluation->eligibility_reasons ?? [], $evaluation->scoring_snapshot['reviews'] ?? [])));
        $unresolved = [];
        foreach ($reasons as $reason) {
            $resolved = match ($reason) {
                'POLICY_DOCUMENT_REVIEW_REQUIRED' => $documentsComplete,
                'HOUSING_CONDITION_REVIEW_REQUIRED' => $reviewed && in_array($assessment->housing_condition, ['poor', 'average', 'good'], true),
                'SERVICE_AREA_REVIEW_REQUIRED' => $reviewed && $assessment->service_area_result === 'verified_inside',
                'LANDLORD_RELATION_REVIEW_REQUIRED' => $reviewed && $assessment->landlord_relationship_result === 'no_prohibited_relationship',
                'HEAD_HEALTH_REVIEW_REQUIRED', 'MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED' => $medicalVerified,
                'CHILDREN_HEALTH_REVIEW_REQUIRED' => $reviewed && is_int($children) && $children >= 0 && $children <= 3,
                default => false, // Unknown and unresolved policy ambiguities never auto-clear.
            };
            if (! $resolved) {
                $unresolved[] = $reason;
            }
        }
        $blockers = $unresolved;
        if (! $documentsComplete) {
            $blockers[] = 'REQUIRED_DOCUMENTS_INCOMPLETE';
        }
        if (! $reviewed || $assessment?->structured_recommendation !== 'approve') {
            $blockers[] = 'SOCIAL_REVIEW_INCOMPLETE';
        }
        if ($assessment?->service_area_result !== 'verified_inside') {
            $blockers[] = 'SERVICE_AREA_UNCONFIRMED';
        }
        if ($assessment?->landlord_relationship_result !== 'no_prohibited_relationship') {
            $blockers[] = 'LANDLORD_RELATION_UNCONFIRMED';
        }
        if (! in_array($assessment?->housing_condition, ['poor', 'average', 'good'], true)) {
            $blockers[] = 'HOUSING_CONDITION_UNCONFIRMED';
        }
        if (! is_int($children) || $children < 0) {
            $blockers[] = 'CHILDREN_HEALTH_UNCONFIRMED';
        }
        if ($children !== null && $children > 3) {
            $blockers[] = 'MORE_THAN_THREE_AFFECTED_CHILDREN_UNRESOLVED';
        }
        if ($evaluation->evaluation_status !== 'completed' || ! in_array($evaluation->eligibility_decision, ['eligible', 'review_required'], true)) {
            $blockers[] = 'EVALUATION_NOT_ELIGIBLE';
        }
        if (! $evaluation->financial_snapshot || ! $evaluation->scoring_snapshot) {
            $blockers[] = 'SNAPSHOT_INCOMPLETE';
        }
        if (! in_array($evaluation->scoring_snapshot['outcome'] ?? null, ['financially_qualified', 'policy_review_required'], true)) {
            $blockers[] = 'POLICY_OUTCOME_BLOCKED';
        }
        $decisions = PolicyDecision::where('evaluation_id', $evaluation->id)->orderBy('decided_at')->orderBy('id')->get();
        if ($decisions->isNotEmpty()) {
            $blockers[] = 'ALREADY_DECIDED';
        }

        return [
            'beneficiary' => $evaluation->beneficiary?->only(['id', 'full_name']),
            'policy_version' => $version->only(['id', 'version', 'policy_name', 'status']),
            'evaluation' => $evaluation->attributesToArray(),
            'documents' => $documents, 'medical_evidence' => $medical,
            'social_assessment' => $assessment, 'review_reasons' => $reasons,
            'unresolved_reasons' => $unresolved, 'approval_blockers' => array_values(array_unique($blockers)),
            'decision_history' => $decisions, 'current_state' => $decisions->last()?->decision ?? 'pending',
        ];
    }
}
