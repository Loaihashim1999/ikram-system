<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\SocialAssessment;

final class SocialAssessmentService
{
    public function create(array $data): SocialAssessment
    {
        $assessment = SocialAssessment::create($data);
        AuditLog::create([
            'user_id' => $data['created_by'] ?? null,
            'action' => 'SOCIAL_ASSESSMENT_CREATED',
            'target_table' => 'social_assessments',
            'target_id' => $assessment->id,
            'details' => ['beneficiary_id' => $assessment->beneficiary_id, 'status' => $assessment->status, 'assessment_date' => $assessment->assessment_date],
        ]);

        return $assessment;
    }

    public function updateDraft(string $id, array $data, string $actorId): SocialAssessment
    {
        $assessment = SocialAssessment::findOrFail($id);
        abort_unless($assessment->status === 'draft', 409, 'Only a draft can be edited.');
        $assessment->update(array_merge($data, ['updated_by' => $actorId]));

        return $assessment->fresh();
    }

    public function submit(string $id, string $researcherId): SocialAssessment
    {
        $assessment = SocialAssessment::findOrFail($id);
        abort_unless($assessment->status === 'draft', 409, 'Only a draft can be submitted.');
        $assessment->update([
            'status' => 'submitted',
            'updated_by' => $researcherId,
        ]);
        AuditLog::create([
            'user_id' => $researcherId,
            'action' => 'SOCIAL_ASSESSMENT_SUBMITTED',
            'target_table' => 'social_assessments',
            'target_id' => $assessment->id,
            'details' => ['status' => 'submitted', 'beneficiary_id' => $assessment->beneficiary_id, 'assessment_date' => $assessment->assessment_date],
        ]);

        return $assessment->fresh();
    }

    public function review(string $id, array $updateData, ?string $reviewerId = null): SocialAssessment
    {
        $assessment = SocialAssessment::findOrFail($id);
        abort_unless($assessment->status === 'submitted', 409, 'Only a submitted assessment can be reviewed.');
        $update = array_merge($updateData, [
            'status' => 'reviewed',
            'updated_by' => $reviewerId ?? $assessment->updated_by,
        ]);
        $assessment->update($update);
        AuditLog::create([
            'user_id' => $reviewerId ?? $assessment->updated_by,
            'action' => 'SOCIAL_ASSESSMENT_REVIEWED',
            'target_table' => 'social_assessments',
            'target_id' => $assessment->id,
            'details' => ['status' => 'reviewed', 'beneficiary_id' => $assessment->beneficiary_id],
        ]);

        return $assessment->fresh();
    }

    public function resolveReviewReasons(string $evaluationId, array $verifiedEvidence = []): array
    {
        // Compatibility argument is deliberately not trusted as proof of evidence.
        $evaluation = BeneficiaryPolicyEvaluation::findOrFail($evaluationId);
        $review = app(PolicyReviewService::class)->data($evaluation);

        return [
            'resolved' => array_values(array_diff($review['review_reasons'], $review['unresolved_reasons'])),
            'unresolved_policy_ambiguities' => $review['unresolved_reasons'],
        ];
    }
}
