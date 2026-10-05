<?php

namespace App\Services\Delivery;

use Illuminate\Validation\ValidationException;

class SecurityPolicy
{
    public function get(string $key): int
    {
        $bounds = [
            'receipt_ttl_minutes' => [1, 60], 'receipt_max_attempts' => [1, 10],
            'receipt_lock_minutes' => [1, 1440], 'verification_per_minute' => [1, 30],
            'reissue_cooldown_seconds' => [30, 3600], 'driver_default_minutes' => [1, 10080],
            'driver_max_minutes' => [1, 10080],
        ];
        $value = config('delivery.'.$key);
        if (! isset($bounds[$key]) || ! is_int($value) || $value < $bounds[$key][0] || $value > $bounds[$key][1]) {
            throw ValidationException::withMessages(['security_policy' => 'إعداد سياسة الأمان غير صالح.']);
        }
        if (config('delivery.driver_default_minutes') > config('delivery.driver_max_minutes')) {
            throw ValidationException::withMessages(['security_policy' => 'المدة الافتراضية تتجاوز الحد الأعلى.']);
        }

        return $value;
    }
}
