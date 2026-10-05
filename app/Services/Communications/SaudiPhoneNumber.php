<?php

namespace App\Services\Communications;

use Illuminate\Validation\ValidationException;

class SaudiPhoneNumber
{
    public function normalize(?string $number): string
    {
        $digits = preg_replace('/[^0-9]/', '', trim((string) $number));
        if (str_starts_with($digits, '00966')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '05')) {
            $digits = '966'.substr($digits, 1);
        } elseif (str_starts_with($digits, '5')) {
            $digits = '966'.$digits;
        }

        if (! preg_match('/^9665[0-9]{8}$/D', $digits)) {
            throw ValidationException::withMessages(['destination' => 'رقم الجوال السعودي غير صالح.']);
        }

        return $digits;
    }
}
