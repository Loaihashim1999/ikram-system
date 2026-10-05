<?php

namespace App\Services;

use App\Models\CommunicationMessage;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\Notification;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\Communications\CommunicationService;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NotificationService
{
    /**
     * Single application entry point for recipient communications.
     */
    public static function queueCommunication(string $key, string $type, string $reference, string $operationType, string $operationId, string $destination, string $body, CarbonInterface $expires, ?string $subject = null, bool $dispatch = true): CommunicationMessage
    {
        return app(CommunicationService::class)->enqueue($key, $type, $reference, $operationType, $operationId, $destination, $body, $expires, $subject, $dispatch);
    }

    /**
     * Dispatch operations notifications to active users.
     * Admin always receives alerts; other users only if canReceiveNotifications() is true.
     */
    public static function notifyAll(string $type, string $message, $relatedModel = null): void
    {
        try {
            $allUsers = User::where('is_active', true)->get();
            $warehouseEvent = str_starts_with($type, 'stock') || str_starts_with($type, 'warehouse');
            $dailyInventoryEvent = $relatedModel instanceof DailyInventoryItem
                || $relatedModel instanceof DailyInventoryMovement
                || $relatedModel instanceof DailyReceivingTransaction;
            $module = $dailyInventoryEvent ? 'daily_beneficiaries' : ($warehouseEvent ? 'warehouse' : (str_starts_with($type, 'beneficiary') ? 'beneficiaries' : 'delivery'));
            if (str_starts_with($type, 'support_')) {
                $module = 'support';
            }
            $allowedRoles = [
                'support' => [],
                'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
                'daily_beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
                'beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
                'delivery' => ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
            ][$module];
            $recipients = $allUsers->filter(fn ($user) => $user->canReceiveNotifications()
                && ($user->role === 'admin' || ($module === 'support' && ($user->permissions['support']['notifications'] ?? false) === true) || (in_array($user->role, $allowedRoles, true)
                    && ($user->permissions[$module]['view'] ?? false)
                    && ($user->permissions[$module]['notifications'] ?? false))));

            $category = $warehouseEvent ? 'warehouse_expiry' : (str_starts_with($type, 'security') ? 'security' : 'system_event');
            $title = match ($module) {
                'warehouse', 'daily_beneficiaries' => 'تنبيه المستودع',
                'beneficiaries' => 'تحديث المستفيدين',
                default => 'تحديث عمليات التوزيع',
            };
            $actionUrl = match ($module) {
                'support' => $relatedModel instanceof SupportDistribution ? (($relatedModel->fulfillment_method === 'delivery' ? '/delivery' : '/receiver').'?task='.$relatedModel->id) : null,
                'warehouse' => '/warehouse',
                'daily_beneficiaries' => '/daily-beneficiaries/inventory',
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
                    'event_type' => $type,
                    'recipient_type' => 'staff',
                    'recipient_id' => $recipient->id,
                    'related_record_type' => $relatedModel ? get_class($relatedModel) : 'System',
                    'related_record_id' => $relatedModel?->id ?? (string) Str::uuid(),
                    'message_body' => $message,
                    'title' => $title,
                    'action_url' => $module === 'support' && $recipient->role !== 'admin' && ! ($recipient->permissions['support']['view'] ?? false) ? null : $actionUrl,
                    'status' => 'sent',
                    'category' => $category,
                    'sent_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('NotificationService dispatch failed.', ['type' => $type, 'exception' => $e::class]);
        }
    }

    /**
     * Retrieval must not reveal a stored target after the recipient loses access.
     * A row with no event type cannot be checked, so it stays hidden.
     */
    public static function recipientMaySeeTarget(User $user, Notification $notification): bool
    {
        if ($user->role === 'admin') {
            return true;
        }
        $module = self::targetModule($notification);
        if ($module === null) {
            return false;
        }
        $permissions = $user->permissions ?? [];
        if ($module === 'support') {
            return ($permissions['support']['view'] ?? false) === true
                && ($permissions['support']['notifications'] ?? false) === true;
        }
        $allowedRoles = [
            'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
            'daily_beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
            'beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
            'delivery' => ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
        ];

        return in_array($user->role, $allowedRoles[$module] ?? [], true)
            && ($permissions[$module]['view'] ?? false) === true
            && ($permissions[$module]['notifications'] ?? false) === true;
    }

    private static function targetModule(Notification $notification): ?string
    {
        $type = (string) ($notification->event_type ?? '');
        if ($type === '') {
            return null;
        }
        $related = (string) ($notification->related_record_type ?? '');
        $daily = in_array($related, [
            DailyInventoryItem::class,
            DailyInventoryMovement::class,
            DailyReceivingTransaction::class,
        ], true);
        if (str_starts_with($type, 'support_')) {
            return 'support';
        }
        if ($daily) {
            return 'daily_beneficiaries';
        }
        if (str_starts_with($type, 'stock') || str_starts_with($type, 'warehouse')) {
            return 'warehouse';
        }
        if (str_starts_with($type, 'beneficiary')) {
            return 'beneficiaries';
        }

        return 'delivery';
    }
}
