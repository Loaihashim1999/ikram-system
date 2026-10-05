<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\PolicyDecision;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class PolicyApprovalService
{
    public function approve(string $evaluationId, string $policyVersionId, string $actorId, array $reference): PolicyDecision
    {
        return $this->decide('approved', $evaluationId, $policyVersionId, $actorId, $reference);
    }

    public function reject(string $evaluationId, string $policyVersionId, string $actorId, array $reference): PolicyDecision
    {
        return $this->decide('rejected', $evaluationId, $policyVersionId, $actorId, $reference);
    }

    private function decide(string $outcome, string $evaluationId, string $policyVersionId, string $actorId, array $reference): PolicyDecision
    {
        Validator::make($reference, [
            'reason_code' => ['required', 'string', 'max:60', 'regex:/^[A-Z][A-Z0-9_]+$/'],
            'reason_text' => ['required', 'string', 'max:2000'],
        ])->validate();

        return DB::transaction(function () use ($outcome, $evaluationId, $policyVersionId, $actorId, $reference) {
            $evaluation = BeneficiaryPolicyEvaluation::lockForUpdate()->findOrFail($evaluationId);
            abort_unless($evaluation->policy_version_id === $policyVersionId, 422);
            abort_if(PolicyDecision::where('evaluation_id', $evaluationId)->exists(), 409, 'Evaluation already decided.');
            $review = app(PolicyReviewService::class)->data($evaluation);
            if ($outcome === 'approved' && $review['approval_blockers'] !== []) {
                throw ValidationException::withMessages(['approval' => $review['approval_blockers']]);
            }
            $decision = PolicyDecision::create([
                'evaluation_id' => $evaluationId, 'policy_version_id' => $policyVersionId,
                'decision' => $outcome, 'decided_by' => $actorId, 'decided_at' => now(),
                'stable_reason_code' => $reference['reason_code'], 'human_readable_reason' => $reference['reason_text'],
                // Evidence references are derived by the server, not asserted by the caller.
                'evidence_summary_reference' => [
                    'document_verifications' => collect($review['documents'])->pluck('verification.id')->filter()->values()->all(),
                    'social_assessment' => $review['social_assessment']?->id,
                    'medical_evidence' => $review['medical_evidence']?->id,
                    'unresolved_reasons' => $review['unresolved_reasons'],
                ],
            ]);
            AuditLog::create([
                'user_id' => $actorId, 'action' => 'POLICY_DECISION_'.strtoupper($outcome),
                'target_table' => 'policy_decisions', 'target_id' => $decision->id,
                'details' => ['evaluation_id' => $evaluationId, 'policy_version_id' => $policyVersionId, 'reason_code' => $reference['reason_code']],
            ]);

            return $decision;
        });
    }
}
