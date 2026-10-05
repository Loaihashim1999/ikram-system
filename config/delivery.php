<?php

// TEST defaults only: production policy requires explicit user approval.
return [
    'receipt_ttl_minutes' => (int) env('RECEIPT_TTL_MINUTES', 15),
    'receipt_max_attempts' => (int) env('RECEIPT_MAX_ATTEMPTS', 5),
    'receipt_lock_minutes' => (int) env('RECEIPT_LOCK_MINUTES', 15),
    'verification_per_minute' => (int) env('RECEIPT_REQUESTS_PER_MINUTE', 5),
    'reissue_cooldown_seconds' => (int) env('RECEIPT_REISSUE_SECONDS', 60),
    'driver_default_minutes' => (int) env('DRIVER_DEFAULT_MINUTES', 480),
    'driver_max_minutes' => (int) env('DRIVER_MAX_MINUTES', 1440),
    'send_max_attempts' => 3,
    'communication_queue' => env('COMMUNICATION_QUEUE', 'ekram-communications-v2'),
    'send_backoff_seconds' => [30, 120, 600],
];
