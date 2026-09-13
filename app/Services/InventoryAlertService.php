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
        DailyInventoryItem::whereNotNull('expiry_date')->where('current_quantity', '>', 0)->whereDate('expiry_date', '<=', now()->addDays($days)->toDateString())->each(function ($item) {
            NotificationService::notifyAll('warehouse_expiry', 'تنبيه صلاحية: '.$item->name.'؛ تاريخ الانتهاء '.$item->expiry_date->toDateString().' — '.now()->toDateString(), $item);
        });
    }
}
