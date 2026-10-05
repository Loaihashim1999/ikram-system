<?php

namespace App\Http\Controllers\BeneficiaryPolicy;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BeneficiaryPolicyVersion;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Policy lifecycle management (POLICY-A) + single-record POLICY-B evaluation.
 *
 * Exposed operations: list/get versions, create/edit/clone draft, approve,
 * publish, retire, history, and a permission-gated single-record financial
 * evaluation. Simulation, bulk evaluation and beneficiary recalculation are
 * intentionally NOT exposed in POLICY-A/POLICY-B.
 */
class BeneficiaryPolicyController extends Controller
{
    public function __construct(
        private readonly BeneficiaryPolicyVersionService $versions,
        private readonly PolicyFinancialEvaluationService $financialEvaluator,
    ) {}

    public function permissions(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role === 'admin') {
            $map = ['view' => true, 'edit_draft' => true, 'approve' => true, 'publish' => true, 'retire' => true, 'evaluate' => true,
                'simulate' => true, 'apply_scope' => true, 'execute_reevaluation' => true, 'view_application_runs' => true];
        } else {
            $perms = $user->permissions['beneficiary_policy'] ?? [];
            $map = [
                'view' => ($perms['view'] ?? false) === true,
                'edit_draft' => ($perms['edit_draft'] ?? false) === true,
                'approve' => ($perms['approve'] ?? false) === true,
                'publish' => ($perms['publish'] ?? false) === true,
                'retire' => ($perms['retire'] ?? false) === true,
                'evaluate' => ($perms['evaluate'] ?? false) === true,
                'simulate' => ($perms['simulate'] ?? false) === true,
                'apply_scope' => ($perms['apply_scope'] ?? false) === true,
                'execute_reevaluation' => ($perms['execute_reevaluation'] ?? false) === true,
                'view_application_runs' => ($perms['view_application_runs'] ?? false) === true,
            ];
        }

        return response()->json(['success' => true, 'data' => $map]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = BeneficiaryPolicyVersion::query()
            ->with('approver:id,full_name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->when($request->filled('policy_scope'), fn ($q) => $q->where('policy_scope', $request->string('policy_scope')->toString()))
            ->latest('created_at');

        return response()->json(['success' => true, 'data' => $query->get()]);
    }

    public function show(string $id): JsonResponse
    {
        $version = BeneficiaryPolicyVersion::with(['approver:id,full_name', 'publisher:id,full_name', 'retirer:id,full_name', 'parentVersion:id,version,status'])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $version]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateDraftPayload($request);
        $version = $this->versions->createDraft($data, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $this->validateDraftPayload($request);
        $version = $this->versions->updateDraft($id, $data, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version]);
    }

    public function clone(Request $request, string $id): JsonResponse
    {
        $version = $this->versions->cloneDraft($id, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version], 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'board_approval_reference' => ['required', 'string', 'max:150'],
            'board_approval_date' => ['required', 'date'],
        ]);
        $version = $this->versions->approve($id, $data, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version]);
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $version = $this->versions->publish($id, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version]);
    }

    public function retire(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'change_reason' => ['required', 'string', 'max:2000'],
        ]);
        $version = $this->versions->retire($id, $data, $request->user()->id);

        return response()->json(['success' => true, 'data' => $version]);
    }

    public function history(string $id): JsonResponse
    {
        $version = BeneficiaryPolicyVersion::findOrFail($id);
        $logs = AuditLog::with('user:id,full_name')
            ->where('target_table', BeneficiaryPolicyVersionService::AUDIT_TABLE)
            ->where('target_id', $version->id)
            ->latest('created_at')
            ->get();

        return response()->json(['success' => true, 'data' => $logs]);
    }

    /**
     * POLICY-B — single-record financial eligibility evaluation.
     *
     * Permission-gated (granular `evaluate`; never executable via `view`),
     * requires an explicit published policy version, and creates ONE immutable
     * snapshot. It does NOT circumvent POLICY-E application scope: no bulk, no
     * simulation, no mass recalculation is reachable through this endpoint.
     */
    public function evaluate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'beneficiary_id' => ['required', 'uuid', Rule::exists('beneficiaries', 'id')],
            'policy_version_id' => ['required', 'uuid', Rule::exists('beneficiary_policy_versions', 'id')],
        ]);

        $evaluation = $this->financialEvaluator->evaluate(
            $validated['beneficiary_id'],
            $validated['policy_version_id'],
            (string) $request->user()->id,
        );

        return response()->json(['success' => true, 'data' => $evaluation]);
    }

    /**
     * Structural payload validation (domain invariants are enforced by the service).
     */
    private function validateDraftPayload(Request $request): array
    {
        $data = $request->all();

        $validator = Validator::make($data, [
            'policy_name' => ['sometimes', 'required', 'string', 'max:150'],
            'policy_scope' => ['sometimes', 'required', 'string', 'max:80'],
            'version' => ['sometimes', 'required', 'string', 'max:30', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]*$/'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', function ($attribute, $value, $fail) use ($data) {
                // Only compare when both bounds arrive in the same payload (PATCH-safe).
                if ($value !== null && isset($data['effective_from']) && $data['effective_from'] !== null && $value < $data['effective_from']) {
                    $fail('تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.');
                }
            }],
            'source_document_reference' => ['nullable', 'string', 'max:255'],
            'source_document_version' => ['nullable', 'string', 'max:50'],
            'board_approval_reference' => ['nullable', 'string', 'max:150'],
            'board_approval_date' => ['nullable', 'date'],
            'change_reason' => ['nullable', 'string', 'max:2000'],
            'configuration' => ['sometimes', 'array'],
        ]);
        $validator->validate();

        return $data;
    }
}
