<?php

namespace App\Http\Controllers;

use Illuminate\Database\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDOException;

class HealthController extends Controller
{
    public function live(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }

    public function ready(): JsonResponse
    {
        try {
            DB::select('select 1');
        } catch (ConnectionException|PDOException) {
            Log::warning('Readiness check failed because the database is unavailable.');

            return response()->json(['status' => 'unavailable'], 503);
        }

        return response()->json(['status' => 'ready']);
    }
}
