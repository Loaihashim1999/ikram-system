<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Password Recovery OTP Policy (SMS — Taqnyat)
    |--------------------------------------------------------------------------
    | Dedicated policy for the 6-digit password-reset OTP. It is intentionally
    | separate from config/delivery.php which governs the 4-digit receipt
    | verification codes only.
    */
    'otp_ttl_minutes' => 10,
    'max_attempts' => 5,
    'lock_minutes' => 15,
    'resend_cooldown_seconds' => 60,
    'requests_per_hour' => 5,
    'recovery_token_ttl_minutes' => 10,
    'verify_per_minute' => 10,
];
