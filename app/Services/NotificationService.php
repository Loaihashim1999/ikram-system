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
use Illuminate\Database\Eloquent\Builder;
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

    public static function visibleQuery(User $user): Builder
    {
        $query = Notification::query()->where('recipient_type', 'staff')->where('recipient_id', $user->id);
        if ($user->role === 'admin') {
            return $query;
        }

        $query->whereNotNull('event_type')->where('event_type', '!=', '');
        $permissions = $user->permissions ?? [];
        $daily = [
            DailyInventoryItem::class,
            DailyInventoryMovement::class,
            DailyReceivingTransaction::class,
        ];
        $allowed = [
            'support' => ($permissions['support']['view'] ?? false) === true && ($permissions['support']['notifications'] ?? false) === true,
            'daily_beneficiaries' => self::moduleAllowed($user, 'daily_beneficiaries', ['assistant_admin', 'reception', 'staff', 'readonly']),
            'warehouse' => self::moduleAllowed($user, 'warehouse', ['assistant_admin', 'warehouse', 'staff', 'readonly']),
            'beneficiaries' => self::moduleAllowed($user, 'beneficiaries', ['assistant_admin', 'reception', 'staff', 'readonly']),
            'delivery' => self::moduleAllowed($user, 'delivery', ['assistant_admin', 'staff', 'delivery_driver', 'driver']),
        ];
        if (! in_array(true, $allowed, true)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function (Builder $outer) use ($allowed, $daily) {
            if ($allowed['support']) {
                $outer->orWhere('event_type', 'like', 'support_%');
            }
            if ($allowed['daily_beneficiaries']) {
                $outer->orWhere(function (Builder $inner) use ($daily) {
                    $inner->where('event_type', 'not like', 'support_%')->whereIn('related_record_type', $daily);
                });
            }
            if ($allowed['warehouse']) {
                $outer->orWhere(function (Builder $inner) use ($daily) {
                    $inner->where('event_type', 'not like', 'support_%')
                        ->whereNotIn('related_record_type', $daily)
                        ->where(fn (Builder $match) => $match->where('event_type', 'like', 'stock%')->orWhere('event_type', 'like', 'warehouse%'));
                });
            }
            if ($allowed['beneficiaries']) {
                $outer->orWhere(function (Builder $inner) use ($daily) {
                    $inner->where('event_type', 'like', 'beneficiary%')
                        ->where('event_type', 'not like', 'support_%')
                        ->whereNotIn('related_record_type', $daily)
                        ->where('event_type', 'not like', 'stock%')
                        ->where('event_type', 'not like', 'warehouse%');
                });
            }
            if ($allowed['delivery']) {
                $outer->orWhere(function (Builder $inner) use ($daily) {
                    $inner->where('event_type', 'not like', 'support_%')
                        ->where('event_type', 'not like', 'beneficiary%')
                        ->where('event_type', 'not like', 'stock%')
                        ->where('event_type', 'not like', 'warehouse%')
                        ->whereNotIn('related_record_type', $daily);
                });
            }
        });
    }

    public static function deleteMatching(Builder $query, int $chunk = 500): int
    {
        $deleted = 0;
        do {
            $ids = (clone $query)->orderBy('id')->limit($chunk)->pluck('id');
            if ($ids->isEmpty()) {
                break;
            }
            $removed = Notification::whereIn('id', $ids)->delete();
            if ($removed < 1) {
                break;
            }
            $deleted += $removed;
        } while (true);

        return $deleted;
    }

    public static function decorateTargets(iterable $notifications): void
    {
        $groups = [];
        foreach ($notifications as $notification) {
            $class = (string) $notification->related_record_type;
            if (class_exists($class) && is_subclass_of($class, \Illuminate\Database\Eloquent\Model::class)) {
                $groups[$class][] = (string) $notification->related_record_id;
            }
        }
        $found = [];
        foreach ($groups as $class => $ids) {
            $found[$class] = $class::query()->whereIn((new $class)->getKeyName(), array_values(array_unique($ids)))->pluck((new $class)->getKeyName())->map(fn ($id) => (string) $id)->all();
        }
        foreach ($notifications as $notification) {
            $class = (string) $notification->related_record_type;
            if (! isset($groups[$class])) {
                $notification->setAttribute('target_available', $class === 'System' && filled($notification->action_url));

                continue;
            }
            $notification->setAttribute('target_available', in_array((string) $notification->related_record_id, $found[$class], true));
        }
    }

    private static function moduleAllowed(User $user, string $module, array $roles): bool
    {
        $permissions = $user->permissions ?? [];

        return in_array($user->role, $roles, true)
            && ($permissions[$module]['view'] ?? false) === true
            && ($permissions[$module]['notifications'] ?? false) === true;
    }
}
