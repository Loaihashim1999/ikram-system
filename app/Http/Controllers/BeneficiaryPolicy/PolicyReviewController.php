<?php

namespace App\Http\Controllers\BeneficiaryPolicy;

use App\Http\Controllers\Controller;
use App\Models\Beneficiary;
use App\Models\BeneficiaryDocument;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\PolicyDecision;
use App\Models\SocialAssessment;
use App\Services\BeneficiaryPolicy\PolicyApprovalService;
use App\Services\BeneficiaryPolicy\PolicyScoreBreakdown;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use App\Services\BeneficiaryPolicy\PolicyReviewService;
use App\Services\BeneficiaryPolicy\SocialAssessmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PolicyReviewController extends Controller
{
    public const ACTIONS = ['view_documents', 'verify_documents', 'social_assessment', 'review', 'decide'];

    public static function capable($user, string $action): bool
    {
        return $user->role === 'admin' || ($user->permissions['beneficiary_policy'][$action] ?? false) === true;
    }

    public function index(string $beneficiary)
    {
        Beneficiary::findOrFail($beneficiary);

        $rows = BeneficiaryPolicyEvaluation::with('policyVersion')->where('beneficiary_id', $beneficiary)->orderByDesc('evaluated_at')->orderByDesc('id')->get();
        $data = $rows->map(function ($evaluation) {
            $review = app(PolicyReviewService::class)->data($evaluation);

            return $evaluation->only(['id', 'policy_version_id', 'evaluated_at', 'evaluation_status',
                'eligibility_decision', 'eligibility_reasons', 'income_category', 'score_category', 'policy_score',
                'gross_counted_income', 'monthly_rent', 'family_size', 'family_member_deduction',
                'adjusted_net_household_income', 'net_income_per_capita']) + [
                    'current_state' => $review['current_state'],
                    'policy_version' => $evaluation->policyVersion?->only(['id', 'version', 'policy_name', 'status', 'effective_from', 'effective_to']),
                    'score_breakdown' => PolicyScoreBreakdown::fromSnapshot($evaluation->scoring_snapshot),
                    'decision_history' => $review['decision_history']->map(fn ($decision) => $decision->only(['decision', 'decided_at', 'human_readable_reason'])),
                ];
        });

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function show(Request $request, string $evaluation)
    {
        $data = app(PolicyReviewService::class)->data(BeneficiaryPolicyEvaluation::findOrFail($evaluation));
        $data['capabilities'] = collect(self::ACTIONS)->mapWithKeys(fn ($action) => [$action => self::capable($request->user(), $action)]);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function document(Request $request, string $evaluation, string $code)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['verified', 'rejected', 'under_review'])],
            'document_id' => ['nullable', 'uuid'],
            'evidence_reference' => ['required', 'string', 'max:255', 'not_regex:/^(data:|https?:)/i'],
            'rejection_reason' => ['required_if:status,rejected', 'nullable', 'string', 'max:2000'],
        ]);

        return $this->mutate($evaluation, function ($row) use ($request, $code, $data) {
            $rule = collect(app(PolicyReviewService::class)->data($row)['documents'])->firstWhere('code', $code);
            abort_unless($rule && $rule['applicable'], 422, 'Document rule is not applicable to this evaluation.');
            if (! empty($data['document_id'])) {
                $document = BeneficiaryDocument::where('beneficiary_id', $row->beneficiary_id)->findOrFail($data['document_id']);
                abort_unless(in_array($document->document_type, $rule['allowed_document_types'] ?? [], true), 422);
            }
            $service = app(PolicyDocumentVerificationService::class);
            $method = ['verified' => 'verify', 'rejected' => 'reject', 'under_review' => 'markUnderReview'][$data['status']];

            return $service->$method($row->beneficiary_id, $code, $data['document_id'] ?? null, [
                'evaluation_id' => $row->id, 'verified_by' => $request->user()->id, 'verified_at' => now(),
                'evidence_reference' => $data['evidence_reference'], 'rejection_reason' => $data['rejection_reason'] ?? null,
            ]);
        });
    }

    public function medical(Request $request, string $evaluation)
    {
        $data = $request->validate([
            'verification_status' => ['required', Rule::in(['verified', 'rejected', 'under_review'])],
            'verified_disability_percentage' => ['required_if:verification_status,verified', 'nullable', 'numeric', 'between:0,100', 'decimal:0,2'],
            'evidence_reference' => ['required', 'string', 'max:255', 'not_regex:/^(data:|https?:)/i'],
            'rejection_reason' => ['required_if:verification_status,rejected', 'nullable', 'string', 'max:2000'],
        ]);

        return $this->mutate($evaluation, fn ($row) => app(PolicyDocumentVerificationService::class)->medical(array_merge($data, [
            'evaluation_id' => $row->id, 'beneficiary_id' => $row->beneficiary_id,
            'verified_by' => $request->user()->id, 'verified_at' => now(),
        ])));
    }

    public function draft(Request $request, string $evaluation)
    {
        $data = $this->assessmentData($request);

        return $this->mutate($evaluation, function ($row) use ($request, $data) {
            $existing = SocialAssessment::where('evaluation_id', $row->id)->first();
            $service = app(SocialAssessmentService::class);
            if ($existing) {
                return $service->updateDraft($existing->id, $data, $request->user()->id);
            }

            return $service->create(array_merge($data, [
                'evaluation_id' => $row->id, 'beneficiary_id' => $row->beneficiary_id, 'policy_version_id' => $row->policy_version_id,
                'status' => 'draft', 'researcher_id' => $request->user()->id, 'researcher_type' => 'user', 'created_by' => $request->user()->id,
            ]));
        });
    }

    public function submit(Request $request, string $evaluation)
    {
        return $this->mutate($evaluation, function ($row) use ($request) {
            $assessment = SocialAssessment::where('evaluation_id', $row->id)->firstOrFail();

            return app(SocialAssessmentService::class)->submit($assessment->id, $request->user()->id);
        });
    }

    public function review(Request $request, string $evaluation)
    {
        $data = $request->validate(['structured_recommendation' => ['required', Rule::in(['approve', 'reject', 'pending_review'])]]);

        return $this->mutate($evaluation, function ($row) use ($request, $data) {
            $assessment = SocialAssessment::where('evaluation_id', $row->id)->firstOrFail();

            return app(SocialAssessmentService::class)->review($assessment->id, $data, $request->user()->id);
        });
    }

    public function approve(Request $request, string $evaluation)
    {
        return $this->decision($request, $evaluation, 'approve');
    }

    public function reject(Request $request, string $evaluation)
    {
        return $this->decision($request, $evaluation, 'reject');
    }

    private function decision(Request $request, string $evaluation, string $action)
    {
        $data = $request->validate([
            'reason_code' => ['required', 'string', 'max:60', 'regex:/^[A-Z][A-Z0-9_]+$/'],
            'reason_text' => ['required', 'string', 'max:2000'],
        ]);
        $row = BeneficiaryPolicyEvaluation::findOrFail($evaluation);
        $result = app(PolicyApprovalService::class)->$action($row->id, $row->policy_version_id, $request->user()->id, $data);

        return response()->json(['success' => true, 'data' => $result]);
    }

    private function mutate(string $id, callable $action)
    {
        return DB::transaction(function () use ($id, $action) {
            $row = BeneficiaryPolicyEvaluation::lockForUpdate()->findOrFail($id);
            abort_if(PolicyDecision::where('evaluation_id', $id)->exists(), 409, 'Evaluation already decided.');

            return response()->json(['success' => true, 'data' => $action($row)]);
        });
    }

    private function assessmentData(Request $request): array
    {
        return $request->validate([
            'assessment_date' => ['required', 'date'],
            'housing_condition' => ['required', Rule::in(['poor', 'average', 'good'])],
            'service_area_result' => ['required', Rule::in(['verified_inside', 'verified_outside', 'review_required'])],
            'landlord_relationship_result' => ['required', Rule::in(['no_prohibited_relationship', 'prohibited_relationship', 'review_required'])],
            'household_findings' => ['required', 'array:affected_children_count'],
            'household_findings.affected_children_count' => ['required', 'integer', 'min:0', 'max:100'],
            'controlled_notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
