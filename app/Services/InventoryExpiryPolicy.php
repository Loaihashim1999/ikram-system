<?php

namespace App\Services;

class InventoryExpiryPolicy
{
    public const NEAR_EXPIRY_DAYS = 5;

    public static function status(?int $days): ?string
    {
        return $days === null ? null : ($days <= 0 ? 'expired' : ($days <= self::NEAR_EXPIRY_DAYS ? 'near_expiry' : 'valid'));
    }
}
