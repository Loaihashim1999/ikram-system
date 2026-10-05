<?php

namespace App\Listeners;

use App\Events\BeneficiaryChanged;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Log;

class SendBeneficiaryNotification
{
    /**
     * Handle the event.
     */
    public function handle(BeneficiaryChanged $event)
    {
        try {
            $name = $event->beneficiary->full_name ?? $event->beneficiary->name ?? 'مستفيد';
            $message = "تم تحديث أو إضافة بيانات المستفيد: {$name}";

            NotificationService::notifyAll('beneficiary_changed', $message, $event->beneficiary);
        } catch (\Throwable $e) {
            Log::error('Failed to send beneficiary notifications: ' . $e->getMessage());
        }
    }
}
