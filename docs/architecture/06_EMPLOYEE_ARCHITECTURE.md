# معمارية وحدة الموظفين ومنسوبي الجمعية (Staff & Employee Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية:**
- `app/Models/Staff.php`
- `app/Models/StaffDependent.php`
- `app/Models/StaffDistribution.php`
- `app/Models/StaffMember.php` (Legacy Model)
- `app/Http/Controllers/StaffController.php`
- `frontend/src/pages/staff/` (`StaffListPage.jsx`, `AddStaffPage.jsx`, `StaffDetailsPage.jsx`, `StaffImportPage.jsx`)  
**التاريخ:** سبتمبر 2026

---

## 1. نموذج البيانات والعلاقات (Data Model & Schema)

```mermaid
erDiagram
    STAFF ||--o{ STAFF_DEPENDENTS : "يعول"
    STAFF ||--o{ STAFF_DISTRIBUTIONS : "مساعدات مستلمة"

    STAFF {
        bigint id PK
        string name "اسم الموظف"
        string national_id UK "رقم الهوية أو الإقامة"
        string phone "رقم الجوال"
        string job_title "المسمى الوظيفي"
        string department "القسم / الإدارة"
        decimal salary "الراتب"
        string housing_type "نوع السكن: ملك / إيجار / سكن جمعية"
        boolean housing_support_eligible "مستحق لدعم السكن / الحصة الغذائية"
        string status "active | inactive"
        timestamps created_at
    }

    STAFF_DEPENDENTS {
        bigint id PK
        bigint staff_id FK
        string name "اسم المعال"
        string national_id "رقم الهوية"
        string relationship "صلة القرابة: زوجة / ابن / ابنة"
        date birth_date
        string gender
    }

    STAFF_DISTRIBUTIONS {
        bigint id PK
        bigint staff_id FK
        integer package_count "عدد السلال أو الوجبات"
        date distribution_date
        text notes
    }
```

---

## 2. ازدواجية الكيانات البرمجية (Staff Entity Duplication Risk)

أظهر التدقيق البرمجي وجود ازدواجية معمارية في تمثيل الموظفين:
1. **الكيان الفعال (Active Entity):**
   - الجدول: `staff`
   - الموديل: `App\Models\Staff`
   - المتحكم النشط في `routes/api.php`: `App\Http\Controllers\StaffController`
   - المسارات النشطة:
     - `GET /api/staff`
     - `POST /api/staff`
     - `GET /api/staff/{staff}`
     - `PUT /api/staff/{staff}`
     - `DELETE /api/staff/{staff}`
     - `POST /api/staff/import`
     - `POST /api/staff/{staff}/dependents`
     - `DELETE /api/staff/{staff}/dependents/{dependent}`
2. **الكيان القديم / الموازي (Legacy / Secondary Entity):**
   - الجدول: `staff_members`
   - الموديل: `App\Models\StaffMember`
   - المتحكم: `App\Http\Controllers\Staff\StaffMemberController`
   - **الملاحظة الرقابية:** لا توجد مسارات في `routes/api.php` توجه إلى `StaffMemberController` حالياً، مما يعني أن `staff_members` هو جدول legacy أو غير مستخدم في المسارات الحية.

---

## 3. الصلاحيات والتحكم بالوصول (Access Control)
- الوصول محصور حصرياً بالمدير العام ومساعد المدير:
  - فرونت إند: `allowedRoles={['admin', 'assistant_admin']}` في `App.jsx`.
  - باك إند: `ModulePermission` على وحدة `staff`.
