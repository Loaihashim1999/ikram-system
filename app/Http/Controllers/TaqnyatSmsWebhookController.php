<?php

namespace App\Http\Controllers;

use App\Services\Communications\TaqnyatSmsDeliveryWebhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaqnyatSmsWebhookController extends Controller
{
    public function sms(Request $request, TaqnyatSmsDeliveryWebhook $webhook): JsonResponse
    {
        return $webhook->receive($request);
    }
}
