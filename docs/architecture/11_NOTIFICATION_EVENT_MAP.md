# خريطة أحداث ومثيرات الإشعارات (Notification Event Map)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**التاريخ:** سبتمبر 2026

---

## جدول الأحداث والمثيرات الفعلي في الكود المصدري

| نوع الحدث (Event Type) | المصدر المثير في الكود (Trigger Source) | الوحدة (Module) | عنوان الإشعار | الرابط التوجيهي (Action URL) | الفئة المستهدفة |
|---|---|---|---|---|---|
| `beneficiary_changed` | `BeneficiaryController` $\rightarrow$ `BeneficiaryChanged` $\rightarrow$ `SendBeneficiaryNotification` | `beneficiaries` | تحديث المستفيدين | `/beneficiaries/{id}` | مستخدمو وحدة المستفيدين ومدير النظام |
| `stock_near_expiry` / `warehouse_near_expiry` | `InventoryAlertService` عند فحص الأصناف التي تنتهي صلاحيتها خلال $\le 5$ أيام | `warehouse` | تنبيه المستودع | `/warehouse` | مسؤولو المستودع والإدارة |
| `stock_low` | `InventoryAlertService` / حركة صرف تجعل الرصيد $\le \text{min\_threshold}$ | `warehouse` | تنبيه المستودع | `/warehouse` | مسؤولو المستودع والمشتريات |
| `stock_changed` | حدث Eloquent عند إنشاء حركة في جدول `inventory_movements` | `warehouse` | تنبيه المستودع | `/warehouse` | مسؤولو المستودع |
| `aid_distributed` | `DistributionController@store` / إنشاء إرسالية توزيع جديدة | `delivery` | تحديث عمليات التوزيع | `/delivery` | السائقون وفرق التوصيل والإدارة |
| `delivery_receipt_confirmed`| `ReceiverController@confirm` بعد مسح رمز QR أو إدخال كود 8 خانات | `delivery` | تحديث عمليات التوزيع | `/delivery` | السائق وفرق العمليات والإدارة |
| `daily_receiving_created` | `DailyReceivingController@store` عند إصدار سند استلام وجبات لحالة يومية | `daily_beneficiaries` | تنبيه المستودع | `/daily-beneficiaries/inventory` | مسؤولو الحالات اليومية والمستودع |

---

## آلية فلترة المستلمين في الكود (`NotificationService.php:L25-L35`)

```php
$allowedRoles = [
    'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
    'daily_beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
    'beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
    'delivery' => ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
][$module];

$recipients = $allUsers->filter(fn ($user) => $user->canReceiveNotifications()
    && ($user->role === 'admin' || (in_array($user->role, $allowedRoles, true)
        && ($user->permissions[$module]['view'] ?? false)
        && ($user->permissions[$module]['notifications'] ?? false))));
```
- **مدير النظام (`admin`):** يتلقى جميع الإشعارات دائماً دون قيد.
- **باقي الأدوار:** يتطلب استلامهم للإشعار ثلاثة شروط مجتمعة:
  1. أن يكون الحساب مفعلاً `is_active = true`.
  2. أن يكون خيار `can_receive_notifications = true`.
  3. أن يمتلك صلاحية العرض وصلاحية استلام الإشعارات على الوحدة المحددة (`permissions[$module]['view']` و `permissions[$module]['notifications']`).
