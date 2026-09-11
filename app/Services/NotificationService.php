<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NotificationService
{
    /**
     * Dispatch operations notifications to active users.
     * Admin always receives alerts; other users only if canReceiveNotifications() is true.
     */
    public static function notifyAll(string $type, string $message, $relatedModel = null): void
    {
        try {
            $allUsers = User::where('is_active', true)->get();
            $recipients = $allUsers->filter(fn($user) => $user->canReceiveNotifications());

            foreach ($recipients as $recipient) {
                Notification::create([
                    'id' => (string) Str::uuid(),
                    'recipient_type' => $recipient->role === 'admin' ? 'admin' : 'staff',
                    'recipient_id'   => $recipient->id,
                    'related_record_type' => $relatedModel ? get_class($relatedModel) : 'System',
                    'related_record_id'   => $relatedModel?->id ?? (string) Str::uuid(),
                    'message_body' => $message,
                    'status' => 'unread',
                    'sent_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("NotificationService dispatch error for [{$type}]: " . $e->getMessage());
        }
    }
}
