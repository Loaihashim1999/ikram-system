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

    public function display(?string $stored): string
    {
        $digits = preg_replace('/[^0-9]/', '', (string) $stored);
        if (preg_match('/^9665[0-9]{8}$/D', $digits)) {
            return '0'.substr($digits, 3);
        }

        return trim((string) $stored);
    }

    /**
     * Classify a stored value without writing it.
     * VALID is already canonical. AUTO-FIX SAFE can be normalized to exactly one canonical number.
     */
    public function classifyStored(?string $stored): string
    {
        $digits = preg_replace('/[^0-9]/', '', trim((string) $stored));
        if (preg_match('/^9665[0-9]{8}$/D', $digits)) {
            return 'VALID';
        }
        try {
            $this->normalize($stored);

            return 'AUTO-FIX SAFE';
        } catch (ValidationException) {
            return 'MANUAL REVIEW';
        }
    }
}
