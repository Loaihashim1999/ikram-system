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
            $warehouseEvent = str_starts_with($type, 'stock') || str_starts_with($type, 'warehouse');
            $module = $warehouseEvent ? 'warehouse' : (str_starts_with($type, 'beneficiary') ? 'beneficiaries' : 'delivery');
            $allowedRoles = [
                'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
                'beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
                'delivery' => ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
            ][$module];
            $recipients = $allUsers->filter(fn ($user) => $user->canReceiveNotifications()
                && ($user->role === 'admin' || (in_array($user->role, $allowedRoles, true)
                    && ($user->permissions[$module]['view'] ?? true)
                    && ($user->permissions[$module]['notifications'] ?? true))));

            $category = $warehouseEvent ? 'warehouse_expiry' : (str_starts_with($type, 'security') ? 'security' : 'system_event');
            $title = match ($module) {
                'warehouse' => 'تنبيه المستودع',
                'beneficiaries' => 'تحديث المستفيدين',
                default => 'تحديث عمليات التوزيع',
            };
            $actionUrl = match ($module) {
                'warehouse' => '/warehouse',
                'beneficiaries' => $relatedModel?->id ? '/beneficiaries/'.$relatedModel->id : '/beneficiaries',
                default => '/delivery',
            };

            foreach ($recipients as $recipient) {
                $recordVersion = $relatedModel
                    ? hash('sha256', json_encode($relatedModel->getAttributes(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
                    : now()->toDateString();
                Notification::firstOrCreate([
                    'event_key' => hash('sha256', implode('|', [$recipient->id, $type, $relatedModel?->id ?? '', $recordVersion, $message])),
                ], [
                    'id' => (string) Str::uuid(),
                    'recipient_type' => 'staff',
                    'recipient_id' => $recipient->id,
                    'related_record_type' => $relatedModel ? get_class($relatedModel) : 'System',
                    'related_record_id' => $relatedModel?->id ?? (string) Str::uuid(),
                    'message_body' => $message,
                    'title' => $title,
                    'action_url' => $actionUrl,
                    'status' => 'sent',
                    'category' => $category,
                    'sent_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("NotificationService dispatch error for [{$type}]: ".$e->getMessage());
        }
    }
}
