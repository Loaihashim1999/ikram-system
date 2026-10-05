# معمارية وحدة الجهات المستفيدة ومندوبي الأحياء (Organization & Representative Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية:**
- `app/Models/NeighborhoodRep.php`
- `app/Models/Organization.php`
- `app/Models/RepDistribution.php`
- `app/Models/RepDistributionProof.php`
- `app/Http/Controllers/NeighborhoodRepController.php`
- `frontend/src/pages/representatives/NeighborhoodRepsPage.jsx`  
**التاريخ:** سبتمبر 2026

---

## 1. نموذج البيانات والدمج الوظيفي (Data Model & Schema Integration)

```mermaid
erDiagram
    NEIGHBORHOOD_REPS ||--o{ REP_DISTRIBUTIONS : "يستلم كميات للتوزيع"
    REP_DISTRIBUTIONS ||--o{ REP_DISTRIBUTION_PROOFS : "إثباتات التوزيع للأسر"

    NEIGHBORHOOD_REPS {
        bigint id PK
        string name "اسم المندوب أو ممثل الجهة"
        string national_id UK "رقم الهوية الوطنية"
        string phone "رقم الهاتف"
        string district "الحي المسؤول عنه"
        string organization_name "اسم الجمعية / المنظمة التابع لها"
        string organization_type "جمعية خيرية | وقف | لجنة تنمية | فرد"
        string license_number "رقم الترخيص الرسمي"
        integer estimated_families_count "عدد الأسر التابعة له"
        string status "active | suspended"
        timestamps created_at
    }

    REP_DISTRIBUTIONS {
        bigint id PK
        bigint rep_id FK
        integer meals_count "عدد الوجبات"
        integer baskets_count "عدد السلال"
        date distribution_date
        string status "pending | in_progress | completed"
    }

    REP_DISTRIBUTION_PROOFS {
        bigint id PK
        bigint rep_distribution_id FK
        string proof_type "image | document | signature"
        string file_path
        text notes
    }
```

---

## 2. الملاحظات المعمارية لاندماج "الجهات" مع "المندوبين"

أثبت الفحص الشامل للواجهة والواجهة الخلفية:
1. **الواجهة الأمامية (`NeighborhoodRepsPage.jsx`):** تدمج إدارة الجهات والمندوبين في شاشة واحدة بعنوان "إدارة الجهات المستفيدة ومندوبي الأحياء".
2. **الواجهة الخلفية والـ API:** يتم توجيه طلبات الجهات والمندوبين إلى مسار `/api/representatives` الذي يديره `NeighborhoodRepController`.
3. **ازدواجية جداول الجهات:**
   - يوجد جدول وموديل مستقل باسم `Organization` (`app/Models/Organization.php`).
   - إلا أن العمليات الحية في النظام تُخزن اسم الجهة وترخيصها داخل حقول جدول `neighborhood_reps` مباشرة (`organization_name`, `organization_type`, `license_number`).

---

## 3. تدفق التوزيع الجماعي وإثبات التسليم (Bulk Distribution Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as إدارة الجمعية / المستودع
    actor Rep as مندوب الحي / ممثل الجهة
    actor Beneficiaries as الأسر في الحي

    Admin->>Rep: إصدار شحنة توزيع مجمعة (وجبات / سلال)
    Rep-->>Admin: توقيع سند استلام الشحنة المجمعة
    Rep->>Beneficiaries: توزيع المساعدات على الأسر المسجلة لديه
    Rep->>Admin: رفع كشوفات التوقيعات أو صور التوزيع عبر إثباتات (Proofs)
    Admin->>Admin: تدقيق الإثباتات واعتماد اكتمال التوزيع
```
