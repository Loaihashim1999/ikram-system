# معمارية وحدة المستفيدين اليوميين الموحدة (Daily Beneficiary Consolidated Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية:**
- `app/Models/DailyBeneficiary.php`
- `app/Models/DailyBeneficiaryDocument.php`
- `app/Models/DailyReceivingTransaction.php`
- `app/Models/DailyInventoryItem.php`
- `app/Models/DailyInventoryMovement.php`
- `app/Http/Controllers/DailyBeneficiaryController.php`
- `app/Http/Controllers/DailyReceivingController.php`
- `app/Http/Controllers/DailyInventoryController.php`
- `frontend/src/pages/daily-beneficiaries/DailyBeneficiariesPage.jsx`  
**التاريخ:** سبتمبر 2026

---

## 1. نموذج البيانات والعلاقات (Data Model & Schema)

```mermaid
erDiagram
    DAILY_BENEFICIARIES ||--o{ DAILY_RECEIVING_TRANSACTIONS : "سندات الاستلام اليومية"
    DAILY_BENEFICIARIES ||--o{ DAILY_BENEFICIARY_DOCUMENTS : "مرفقات الحالة"
    DAILY_INVENTORY_ITEMS ||--o{ DAILY_INVENTORY_MOVEMENTS : "حركات الصرف والوارد"

    DAILY_BENEFICIARIES {
        bigint id PK
        string full_name "الاسم"
        string national_id "رقم الهوية أو الإقامة"
        string phone "رقم الجوال"
        string nationality "الجنسية"
        integer family_members_count "عدد المرافقين"
        string reason "سبب الدعم الطارئ: عابر سبيل / انقطاع عمل / حالة إنسانية"
        string status "active | served | cancelled"
        timestamps created_at
    }

    DAILY_RECEIVING_TRANSACTIONS {
        bigint id PK
        bigint daily_beneficiary_id FK
        string voucher_number UK "رقم سند الاستلام اليومي"
        integer meals_count "عدد الوجبات المصروفة"
        text items_description "وصف المواد المصروفة"
        datetime receiving_time "وقت الاستلام"
        string receiver_signature "التوقيع أو الإقرار"
        string created_by "الموظف المنفذ"
    }

    DAILY_INVENTORY_ITEMS {
        bigint id PK
        string item_name "اسم الصنف المخصص لليوميين"
        string unit "وجبة | سلة | كرتون"
        integer current_quantity "الرصيد المتاح"
        integer min_threshold "الحد الأدنى للإنذار"
    }

    DAILY_INVENTORY_MOVEMENTS {
        bigint id PK
        bigint daily_inventory_item_id FK
        string movement_type "in (توريد) | out (صرف)"
        integer quantity "الكمية"
        string reference_type "daily_receiving | manual"
        text notes
    }
```

---

## 2. دمج الوحدة في الواجهة الأمامية (Frontend Consolidation)

تم دمج المسارات الثلاثة المعنية بالحالات اليومية في شاشة واحدة موحدة لتسهيل العمل الميداني:
- المسارات القديمة المحولة في `App.jsx`:
  - `/daily-beneficiaries/receiving` $\rightarrow$ يُوجّه إلى `/daily-beneficiaries?tab=deliveries`.
  - `/daily-beneficiaries/inventory` $\rightarrow$ يُوجّه إلى `/daily-beneficiaries?tab=inventory`.
- التبويبات الثلاثة النشطة في `DailyBeneficiariesPage.jsx`:
  1. **سجل المستفيدين اليوميين:** إدارة بيانات المستفيدين العابرين والحالات الطارئة.
  2. **سندات الاستلام اليومية:** توثيق تسليم الوجبات اليومية واستخراج وطباعة سند الاستلام بصيغة PDF.
  3. **مخزون الحالات اليومية:** تتبع الوجبات والمواد الجاهزة المخصصة للصرف اليومي الفوري منفصلة عن مستودع السلال التموينية الدائمة.

---

## 3. إصدار سندات الاستلام والطباعة (Voucher PDF Generation)
- يوفر النظام مساراً مخصصاً لطباعة سند الاستلام اليومي:
  - المسار: `GET /api/daily-beneficiaries/receiving/{id}/pdf`
  - المتحكم: `PdfExportController@exportDailyReceivingVoucher`
  - المعيار الرقابي: يتضمن السند اسم المستفيد، رقم هويته، عدد الوجبات، وتوقيع المستلم وختم الجمعية مع رمز تحقق فوري.
