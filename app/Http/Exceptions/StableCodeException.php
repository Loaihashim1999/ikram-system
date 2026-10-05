<?php

namespace App\Http\Exceptions;

use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Conflict/state error carrying a STABLE machine code (e.g. SIMULATION_STALE)
 * beside the human Arabic message. The frontend and the automated gates branch
 * on `code`; operators read `message`. Codes are never localized and never
 * derived from user input.
 */
class StableCodeException extends HttpResponseException
{
    public function __construct(
        public readonly string $stableCode,
        string $message,
        int $status = 409,
    ) {
        parent::__construct(response()->json([
            'success' => false,
            'code' => $stableCode,
            'message' => $message,
        ], $status));
    }
}
