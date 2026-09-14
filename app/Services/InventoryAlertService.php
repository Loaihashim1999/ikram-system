<?php
namespace App\Services;
use App\Models\{InventoryItem, DailyInventoryItem, Setting};
class InventoryAlertService {
    public function scan(): void {
        $days = max(0, (int) Setting::get('warehouse_alert_threshold_days', 10));
        foreach ([InventoryItem::class, DailyInventoryItem::class] as $model) {
            $model::whereColumn('current_quantity', '<=', 'min_threshold')->each(function ($item) {
                NotificationService::notifyAll('warehouse_low_stock', 'مخزون منخفض: '.$item->name.'؛ الرصيد '.$item->current_quantity.' '.$item->unit.' — '.now()->toDateString(), $item);
            });
        }
        DailyInventoryItem::whereNotNull('expiry_date')->where('current_quantity', '>', 0)
            ->whereDate('expiry_date', '<=', today()->addDays($days))->each(function ($item) {
            $type = $item->expiry_status === 'expired' ? 'warehouse_expired' : 'warehouse_near_expiry';
            $status = $item->expiry_status === 'expired'
                ? 'منتهي الصلاحية'
                : 'قارب على الانتهاء (متبقي '.$item->remaining_days.' يوم)';
            NotificationService::notifyAll($type, 'صلاحية الصنف: '.$item->name.'؛ الحالة: '.$status.'؛ تاريخ الانتهاء '.$item->expiry_date->toDateString(), $item);
        });
    }
}
