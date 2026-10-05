<?php

namespace App\Http\Controllers;

use App\Services\GovernanceReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GovernanceReportController extends Controller
{
    public function index(Request $request, GovernanceReportService $reports): JsonResponse
    {
        $report = $reports->build($request, true);

        return response()->json($report['analytics'] + ['filters' => $report['filters'], 'detail' => $report['detail'], 'indicators' => $report['indicators'], 'policy_outcomes' => $report['policy_outcomes'], 'support_statuses' => $report['support_statuses']]);
    }
}
