<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\InventoryMovement;
use App\Models\NeighborhoodRep;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(?Request $request = null): JsonResponse
    {
        $beneficiaries = Beneficiary::with('dependents')->latest()->take(100)->get();
        $distributions = Distribution::with(['beneficiary', 'basket'])->latest()->take(100)->get();
        $representatives = NeighborhoodRep::withCount('repDistributions')->latest()->get();
        $inventoryMovements = InventoryMovement::with('inventoryItem')->latest()->take(100)->get();
        $drivers = User::where('role', 'delivery_driver')->orWhere('role', 'driver')->get();

        $auditLogs = AuditLog::with('user')->latest()->take(200)->get();

        return response()->json([
            'success' => true,
            'data' => [
                'beneficiaries' => $beneficiaries,
                'distributions' => $distributions,
                'representatives' => $representatives,
                'inventory_movements' => $inventoryMovements,
                'drivers' => $drivers,
                'audit_logs' => $auditLogs,
            ],
        ]);
    }
}
