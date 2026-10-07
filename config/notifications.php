<?php

return [
    // Eligible when created_at is strictly before this cutoff. The exact cutoff instant is kept.
    // Automatic pruning never includes unread notifications.
    'retention_days' => (int) env('NOTIFICATION_RETENTION_DAYS', 30),
];
