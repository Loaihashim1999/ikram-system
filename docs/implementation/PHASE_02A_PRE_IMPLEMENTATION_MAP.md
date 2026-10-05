# IKRAM SYSTEM — PHASE 2A PRE-IMPLEMENTATION MAP

**التاريخ:** 2026-09-19
**النطاق:** خريطة ما قبل التنفيذ لمحرك الدعم الموحد (Unified Support Engine) — توثيق المسارات النشطة الحالية قبل أي تعديل.
**قاعدة صارمة:** لا تعديل على الجداول القديمة قبل اكتمال هذه الخريطة. PostgreSQL هو قاعدة البيانات المعتمدة؛ SQLite للاختبارات السريعة فقط.

---

## 1. المسار الحالي — دعم المستفيدين الدائمين (Beneficiary Support)

| العنصر | القيمة الفعلية |
|---|---|
| CURRENT FLOW | `POST /api/distributions` (batch: beneficiary_ids[] + basket_id واحد) |
| ACTIVE CONTROLLER | `app/Http/Controllers/DistributionController.php` → `store()` |
| MODEL | `App\Models\Distribution` (+ `App\Models\Basket` كظل/legacy) |
| TABLE | `distributions` — uuid PK، beneficiary_id FK→beneficiaries **cascadeOnDelete**، basket_id FK→baskets **cascadeOnDelete**، assigned_by FK→users nullOnDelete، driver_id **string غير مقيّد** (يشير فعليًا إلى users)، scheduled_at، pickup_location (نص حر)، barcode_code unique، status enum(scheduled/delivered/no_show/cancelled)، sms_status، delivered_at |
| INVENTORY EFFECT | خصم مزدوج بدون transaction ولا lock: `baskets.stock_quantity -= count` ثم `inventory_items.current_quantity -= count` (الأخير عبر upsert لـ Basket من InventoryItem) — سباق محتمل |
| MOVEMENT EFFECT | `InventoryMovement` type=out يُكتب **best-effort داخل try/catch** (قد يضيع بصمت) — بلا balance_after ولا مرجع للتوزيع |
| NOTIFICATION EFFECT | `aid_distributed` عبر hook `Distribution::created` → `NotificationService::notifyAll` (dedup بـ event_key) |
| DOCUMENT EFFECT | `individual_receipt` / `total_delivery` PDFs عبر `PdfExportController` + WhatsApp stub (بيانات Meta مضمّنة في الكود — خارج نطاق 2A) |
| RECEIPT/CONFIRM | `PUT /distributions/{id}/received` → markReceived (409 على التكرار) + `ReceiverController` QR scan/confirm |

**عيوب موثقة (لا تُصلح في 2A — المحرك الجديد صُمم لتجنبها):**
- `distributions.beneficiary_id` و`distributions.basket_id` بـ **CASCADE** → حذف مستفيد/سلة يمحو التاريخ (هجرة إصلاح 2026_09_09 لم تشملهما).
- لا يوجد transaction/lock → مخاطر overselling.
- حركة المخزون غير موثوقة (try/catch swallow).
- `driver_id` string بلا FK.

## 2. المسار الحالي — دعم الموظفين (Staff Support)

| العنصر | القيمة الفعلية |
|---|---|
| CURRENT FLOW | نفس `POST /api/distributions` مع `staff_ids[]` بدلاً من beneficiary_ids |
| ACTIVE CONTROLLER | نفس `DistributionController@store` (فرع isStaffDistribution) |
| MODEL | `App\Models\StaffDistribution` |
| TABLE | `staff_distributions` — uuid PK، staff_member_id (legacy، أصبح nullable)، **staff_id FK→staff nullOnDelete** (أضيفت 2026_09_15)، basket_id FK→baskets **cascadeOnDelete**، barcode، status enum(scheduled/delivered/cancelled)، delivered_at |
| INVENTORY EFFECT | نفس الخصم المزدوج أعلاه (count = عدد الموظفين) |
| NOTIFICATION EFFECT | لا يوجد hook إشعار على StaffDistribution |
| DOCUMENT EFFECT | `staff_receipt` PDF |
| التحقق | `required_without` يمنع الطلب الفارغ لكن لا يمنع إرسال النوعين معًا |

**ملاحظة:** لا يوجد اليوم إنشاء سجلات مستفيدين وهمية للموظفين؛ عيب `beneficiary_ids` يظهر في مسارات الواجهة الأمامية فقط (`SendSupportPage.jsx`/`DistributionPage.jsx` يرسلان beneficiary_ids دائمًا).

## 3. المسار الحالي — دعم المندوبين/الجهات (Rep/Org Support)

| العنصر | القيمة الفعلية |
|---|---|
| CURRENT FLOW | `POST /api/neighborhood-reps/{id}/dispatch` |
| ACTIVE CONTROLLER | `app/Http/Controllers/NeighborhoodRepController.php` → `dispatchSupport()` |
| MODEL | `App\Models\RepDistribution` |
| TABLE | `rep_distributions` — rep_id FK→neighborhood_reps **cascadeOnDelete**، basket_id FK→baskets **cascadeOnDelete**، basket_count int، target_beneficiaries_count int، status enum(scheduled/picked_up/distributed)، picked_up_at، is_documented |
| INVENTORY EFFECT | خصم مباشر `decrement` **بلا transaction ولا lock ولا حركة مخزون إطلاقًا** |
| QUANTITY VIOLATION | **`basket_count = max(1, rep->beneficiaries_count)` ضرب تلقائي غير مصرح به** — مخالف مباشرة لقاعدة الكمية الصريحة |
| NOTIFICATION EFFECT | لا يوجد |
| DOCUMENT EFFECT | `rep_receipt` PDF + RepDistributionProof |

**قرار الجهات (معتمد):** كيان الجهة المستفيدة الرسمي للمحرك الموحد = جدول **`organizations`** (uuid, name, code unique, contact, status). المندوبون ليسوا المستلم الأساسي — قد يُربطون لاحقًا كجهة اتصال/توصيل. الجداول القديمة تبقى للقراءة فقط، بلا ترحيل تلقائي في 2A.

## 4. بنية المخزون العام (General Warehouse)

| العنصر | القيمة الفعلية |
|---|---|
| TABLE | `inventory_items` — uuid PK، name، unit (نص حر default 'كرتون')، **current_quantity INTEGER**، min_threshold INTEGER، description، expiration_date (date، index، من هجرة 2026_09_15 غير المتتبعة)، basket_number (string) |
| MOVEMENTS | `inventory_movements` — inventory_item_id FK **cascadeOnDelete**، type **enum(in,out) فقط**، quantity INTEGER، reason، user_id FK→users nullOnDelete. **لا balance_after ولا مرجع أعمال** |
| RESERVATION | **غير موجود على المستودع العام**. النمط المرجعي موجود في النظام اليومي: `daily_inventory_items.reserved_quantity` + `available_quantity` append |
| DAILY BOUNDARY | النظام اليومي مستقل تمامًا (`daily_inventory_items/movements/receiving_transactions`) — لا يتقاطع مع مخزون المستودع العام إطلاقًا. **يُحافظ على الفصل (قرار معتمد)** |
| WRITERS | كل مواضع تعديل current_quantity: (1) InventoryController@store رصيد افتتاحي، (2) adjustStock (transaction+lock، لكن رفض السحب يرجع 500)، (3) **InventoryController::update() يكتب current_quantity مباشرة بلا حركة/قفل/تدقيق — ثغرة صمت**، (4) DistributionController (بلا tx)، (5) dispatchSupport (بلا tx ولا حركة) |
| NOTIFICATION HOOK | `InventoryMovement::created` يطلق `stock_changed` تلقائيًا — أي كتابة حركات عبر النموذج ستولد إشعارات ضمنية (dedup حسب حالة السجل) |
| ANALYTICS | `AnalyticsController` يجمع stock_in/out مع فلاتر فترة؛ Governance يعرض consumption وexpiry buckets؛ `GovernanceReportService` يلتقط لقطات مخزون |

## 5. الأخطار الحرجة المكتشفة (تُعالج في 2A أو تُوثق)

| # | الخطر | المعالجة في 2A |
|---|---|---|
| R1 | CASCADE يمحو التاريخ: distributions.beneficiary_id/basket_id، rep_distributions.rep_id/basket_id، staff_distributions.basket_id | هجرة تقوية FK (pgsql فقط): CASCADE→RESTRICT، قابلة للعكس، لا تحذف شيئًا |
| R2 | `InventoryController::update()` يكتب الكمية بلا حاجة للحجز | **حارس توافق:** رفض 422 أي تحديث يجعل current_quantity < reserved_quantity (بدون كشف استثناء قيد قاعدة البيانات، دون إعادة كتابة العمارة القديمة) + اختبار انحدار (100/60→40→422، الكمية والحجز يبقيان 100/60) |
| R3 | كتابة مخزون قديمة تتجاوز الحجز (DistributionController، dispatchSupport) | توثيق كحد معروف — لا إعادة تصميم في 2A؛ الانتقال لاحق |
| R4 | تعديل الكمية المباشر لا يسجل حركة | خارج نطاق 2A الحرفي؛ المحرك الجديد يسجل كل شيء |
| R5 | current_quantity INTEGER بينما الوحدات قد تكون كسرية (كجم 2.5/0.75) | توسعة آمنة INT→DECIMAL(12,2) على أعمدة المستودع العام + **down() آمن يفشل صراحة لو وُجدت قيم كسرية** (لا اقتطاع صامت) |

## 6. أسماء قيود FK الحالية (أسماء Laravel الاصطلاحية — تُتحقق فعليًا على PG QA)

- `distributions_beneficiary_id_foreign`، `distributions_basket_id_foreign`
- `rep_distributions_rep_id_foreign`، `rep_distributions_basket_id_foreign`
- `staff_distributions_basket_id_foreign`

**SQL كشف السجلات اليتيمة (قراءة فقط — لا يُنفذ على قاعدة التشغيل دون موافقة صريحة):**
```sql
SELECT COUNT(*) FROM distributions d LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id WHERE d.beneficiary_id IS NOT NULL AND b.id IS NULL;
SELECT COUNT(*) FROM distributions d LEFT JOIN baskets k ON k.id = d.basket_id WHERE k.id IS NULL;
SELECT COUNT(*) FROM rep_distributions r LEFT JOIN neighborhood_reps n ON n.id = r.rep_id WHERE n.id IS NULL;
SELECT COUNT(*) FROM staff_distributions s LEFT JOIN baskets k ON k.id = s.basket_id WHERE k.id IS NULL;
```

## 7. البنية المشتركة المعاد استخدامها

- **الإشعارات:** `NotificationService::notifyAll(type, message, relatedModel)` — dedup بـ event_key (sha256 للمستلم+النوع+السجل+الحالة). إضافات 2A: وحدة support + أحداث support_* + action_url=null + فلترة صلاحيات support.
- **التدقيق:** `AuditLog::create` (user_id nullOnDelete، action، target_table، target_id، details JSON) — في 2A تُكتب داخل نفس الـ transaction للانتقالات الحرجة (موثوقية إلزامية، بلا كلمات مرور/توكنات/روابط).
- **الصلاحيات:** `ModulePermission` يستنتج الوحدة من مسار URL — أي مسار غير مسجل = رفض افتراضي. إضافة وحدة `support` بأفعال دقيقة (view/create/edit/approve/reserve/fulfill/cancel/notifications).
- **السائقون:** كيان دائم موجود `drivers` (uuid، full_name، phone، vehicle_info، is_active) — driver_id الجديد FK إليه (OPTION A معتمد).
- **لقطة المستلم الآمنة (قرار الخصوصية):** beneficiary→UUID المعتم، staff→id التسلسلي (رقم وظيفي فعلي)، organization→code. **لا national_id** — الكيان الأصلي يبقى مصدر بيانات الهوية.
- **الاختبارات:** sqlite :memory: عبر phpunit.xml، `Sanctum::actingAs`، بيانات TEST_، بلا factories (إنشاء مباشر)، `RefreshDatabase`.

## 8. التحقق النهائي

- [x] اكتملت الخريطة قبل أي تعديل على الجداول
- [x] لا تعديل على الجداول القديمة قبل تاريخ هذه الخريطة

## 9. Continuation audit — 2026-09-20

The ZCode working tree was audited before implementation. Initial `git status --short`, `git diff --stat`, and `git diff --check` were inspected; the whitespace check was clean. Local evidence is in `.tmp/phase2a-evidence/initial-status.txt` and `initial.diff` (not a replacement for Git history).

- DONE at handoff: this reference map; six migration files; InventoryItem decimal casts/reservation append; InventoryMovement decimal casts/new fillable fields.
- PARTIAL at handoff: migrations required a real `foreignId` for staff, recipient/location RESTRICT semantics, schema-aware legacy FK discovery, and integer-range rollback protection. Inventory availability returned a negative value without surfacing corrupted state.
- TODO at handoff: three new models, services, controllers/routes, granular support authorization, notifications, settings whitelist, legacy writer guards, tests, isolated PostgreSQL verification and final documentation.
- Pre-existing unrelated work: all authentication/account security, financial/classification, warehouse expiry, PDF, QR, governance, daily inventory, browser gate, Cloudflare and generated public asset changes in the initial status. These were preserved. Shared files were changed only where required for Phase 2A integration.

The earlier R3 entry is superseded: legacy DistributionController and NeighborhoodRepController now take a transaction/warehouse row lock and reject consumption of reserved stock before creating records. Their business workflows, legacy quantities and notification mechanisms are not redesigned.

PostgreSQL verification is blocked pending valid local credentials. A running local PostgreSQL 16 service was found, but no reusable local credentials were available. No operational/Aiven connection was attempted. `.env.phase2a.pgqa` is explicitly Git-ignored and has not been populated with guessed credentials.
