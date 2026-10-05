<?php

namespace App\Http\Controllers\BeneficiaryPolicy;

use App\Http\Controllers\Controller;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Services\BeneficiaryPolicy\PolicyApplicationExecutionService;
use App\Services\BeneficiaryPolicy\PolicyApplicationRunService;
use App\Services\BeneficiaryPolicy\PolicyApplicationSimulationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POLICY-E run ledger API (E2 simulation + E3 controlled execution).
 *
 * Every route sits behind auth:sanctum + ModulePermission, which maps each
 * operation to its granular beneficiary_policy ability (simulate / apply_scope /
 * execute_reevaluation / view_application_runs). The backend stays the
 * authorization boundary: hidden UI controls are never authorization.
 */
class PolicyApplicationRunController extends Controller
{
    /** Items endpoint bound: no unbounded thousands-row payload. */
    public const MAX_PER_PAGE = 100;

    public const DEFAULT_PER_PAGE = 25;

    public function __construct(
        private readonly PolicyApplicationRunService $runs,
        private readonly PolicyApplicationSimulationService $simulation,
        private readonly PolicyApplicationExecutionService $execution,
    ) {}

    public function index(string $version): JsonResponse
    {
        $model = BeneficiaryPolicyVersion::findOrFail($version);

        $runs = PolicyApplicationRun::query()
            ->where('policy_version_id', $model->id)
            ->with(['requestedBy:id,full_name', 'approvedBy:id,full_name', 'executionRequestedBy:id,full_name'])
            ->latest('created_at')
            ->limit(200)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $runs->map(fn (PolicyApplicationRun $run) => $this->present($run)),
        ]);
    }

    public function store(Request $request, string $version): JsonResponse
    {
        $model = BeneficiaryPolicyVersion::findOrFail($version);
        $data = $request->validate([
            'scope_parameters' => ['sometimes', 'array'],
        ]);

        $run = $this->runs->create($model, $data['scope_parameters'] ?? [], (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($run)], 201);
    }

    public function show(string $run): JsonResponse
    {
        $model = PolicyApplicationRun::with(['policyVersion', 'requestedBy:id,full_name'])->findOrFail($run);

        return response()->json([
            'success' => true,
            'data' => $this->present($model, withFreshness: true),
        ]);
    }

    /** Server-side paginated, bounded impact detail. */
    public function items(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $data = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'page' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'string', 'max:40'],
        ]);
        $perPage = (int) ($data['per_page'] ?? self::DEFAULT_PER_PAGE);

        $page = $model->items()
            ->with('beneficiary:id,full_name,beneficiary_type,status')
            ->when(isset($data['status']), fn ($q) => $q->where('status', $data['status']))
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate($perPage)
            ->through(fn ($item) => [
                'id' => $item->id,
                'beneficiary_id' => $item->beneficiary_id,
                'beneficiary_name' => $item->beneficiary?->full_name,
                'beneficiary_type' => $item->beneficiary?->beneficiary_type,
                'status' => $item->status,
                'attempt_count' => $item->attempt_count,
                'failure_code' => $item->failure_code,
                'failure_details' => $item->failure_details,
                'source_evaluation_id' => $item->source_evaluation_id,
                'new_evaluation_id' => $item->new_evaluation_id,
                'simulation_result' => $item->simulation_result,
                'processed_at' => optional($item->processed_at)->toISOString(),
            ]);

        return response()->json(['success' => true, 'data' => $page]);
    }

    /**
     * One-shot convenience: create a draft run for this version and immediately
     * simulate it (still strictly read-only).
     */
    public function simulateVersion(Request $request, string $version): JsonResponse
    {
        $model = BeneficiaryPolicyVersion::findOrFail($version);
        $data = $request->validate([
            'scope_parameters' => ['sometimes', 'array'],
        ]);

        $run = $this->runs->create($model, $data['scope_parameters'] ?? [], (string) $request->user()->id);
        $run = $this->simulation->simulate($run, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($run, withFreshness: true)]);
    }

    public function simulate(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $simulated = $this->simulation->simulate($model, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($simulated, withFreshness: true)]);
    }

    public function approveApplication(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $approved = $this->execution->approveApplication($model, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($approved, withFreshness: true)]);
    }

    public function execute(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $completed = $this->execution->execute($model, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($completed, withFreshness: true)]);
    }

    public function retry(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $completed = $this->execution->retry($model, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($completed, withFreshness: true)]);
    }

    public function cancel(Request $request, string $run): JsonResponse
    {
        $model = PolicyApplicationRun::findOrFail($run);
        $cancelled = $this->execution->cancel($model, (string) $request->user()->id);

        return response()->json(['success' => true, 'data' => $this->present($cancelled)]);
    }

    /**
     * Sanitized run projection: aggregates, hashes and lifecycle metadata only.
     * No beneficiary PII and no per-item snapshots (items carry their own detail).
     */
    private function present(PolicyApplicationRun $run, bool $withFreshness = false): array
    {
        $data = $run->only([
            'id', 'policy_version_id', 'scope_mode', 'scope_parameters', 'status',
            'simulation_fingerprint', 'candidate_set_hash', 'simulation_summary',
            'total_candidates', 'processed_count', 'success_count', 'review_count',
            'not_applicable_count', 'failed_count',
        ]);
        $data['policy_version'] = $run->policyVersion?->only(['id', 'version', 'policy_name', 'status']);
        $data['requested_by_name'] = $run->requestedBy?->full_name;
        $data['approved_by_name'] = $run->approvedBy?->full_name;
        $data['execution_requested_by_name'] = $run->executionRequestedBy?->full_name;
        foreach (['simulated_at', 'approved_at', 'execution_started_at', 'completed_at', 'cancelled_at', 'created_at'] as $field) {
            $data[$field] = optional($run->{$field})->toISOString();
        }
        if ($withFreshness) {
            $data['freshness'] = $this->execution->verifyFreshness($run);
        }

        return $data;
    }
}
