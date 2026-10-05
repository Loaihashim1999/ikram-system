<?php

namespace App\Services;

use App\Models\DailyInventoryItem;
use App\Models\InventoryItem;
use App\Models\Setting;

class InventoryAlertService
{
    public function scan(): void
    {
        $days = max(0, (int) Setting::get('warehouse_alert_threshold_days', InventoryExpiryPolicy::NEAR_EXPIRY_DAYS));

        // 1. Low stock alerts for both warehouse and daily items
        foreach ([InventoryItem::class, DailyInventoryItem::class] as $model) {
            $model::whereColumn('current_quantity', '<=', 'min_threshold')->each(function ($item) {
                NotificationService::notifyAll(
                    'warehouse_low_stock',
                    'مخزون منخفض: '.$item->name.'؛ الرصيد '.$item->current_quantity.' '.$item->unit.' — '.now()->toDateString(),
                    $item
                );
            });
        }

        // 2. Expiry alerts for DailyInventoryItem
        DailyInventoryItem::whereNotNull('expiry_date')
            ->where('current_quantity', '>', 0)
            ->whereDate('expiry_date', '<=', today()->addDays($days))
            ->each(function ($item) {
                $type = $item->expiry_status === 'expired' ? 'warehouse_expired' : 'warehouse_near_expiry';
                $status = $item->expiry_status === 'expired'
                    ? 'منتهي الصلاحية'
                    : 'قارب على الانتهاء (متبقي '.$item->remaining_days.' يوم)';
                $dateStr = $item->expiry_date instanceof \DateTimeInterface
                    ? $item->expiry_date->toDateString()
                    : (string) $item->expiry_date;
                NotificationService::notifyAll(
                    $type,
                    'صلاحية الصنف: '.$item->name.'؛ الحالة: '.$status.'؛ تاريخ الانتهاء '.$dateStr,
                    $item
                );
            });

        // 3. Expiry alerts for InventoryItem (Warehouse Central Inventory)
        InventoryItem::whereNotNull('expiration_date')
            ->where('current_quantity', '>', 0)
            ->whereDate('expiration_date', '<=', today()->addDays($days))
            ->each(function ($item) {
                $type = $item->expiry_status === 'expired' ? 'warehouse_expired' : 'warehouse_near_expiry';
                $status = $item->expiry_status === 'expired'
                    ? 'منتهي الصلاحية'
                    : 'قارب على الانتهاء (متبقي '.$item->remaining_days.' يوم)';
                $dateStr = (string) $item->expiration_date;
                NotificationService::notifyAll(
                    $type,
                    'صلاحية الصنف: '.$item->name.'؛ الحالة: '.$status.'؛ تاريخ الانتهاء '.$dateStr,
                    $item
                );
            });
    }
}
