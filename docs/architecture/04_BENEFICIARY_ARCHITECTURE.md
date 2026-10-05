# معمارية وحدة المستفيدين الدائمين (Permanent Beneficiary Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية الرئيسية:**
- `app/Models/Beneficiary.php`
- `app/Models/Dependent.php`
- `app/Models/BeneficiaryDocument.php`
- `app/Http/Controllers/Beneficiaries/BeneficiaryController.php`
- `frontend/src/pages/beneficiaries/AddBeneficiaryPage.jsx`
- `frontend/src/utils/beneficiaryValidation.js`  
**التاريخ:** سبتمبر 2026

---

## 1. نموذج البيانات والعلاقات (Data Model & Schema)

```mermaid
erDiagram
    BENEFICIARIES ||--o{ DEPENDENTS : "يعول"
    BENEFICIARIES ||--o{ BENEFICIARY_DOCUMENTS : "مرفقاته"
    BENEFICIARIES ||--o{ DISTRIBUTIONS : "استلامات الدعم"
    CATEGORIES ||--o{ BENEFICIARIES : "تصنيف الفئة"

    BENEFICIARIES {
        bigint id PK
        string file_number UK "رقم الملف"
        string full_name "الاسم الرباعي"
        string national_id UK "رقم الهوية الوطنية أو الإقامة"
        string beneficiary_type "citizen | resident"
        string phone "رقم الهاتف"
        string gender "male | female"
        date birth_date "تاريخ الميلاد"
        string marital_status "أعزب | متزوج | مطلق | أرمل"
        integer family_members_count "عدد أفراد الأسرة"
        decimal total_income "الدخل الشهري الإجمالي"
        decimal monthly_rent "قيمة الإيجار الشهري"
        decimal net_income "صافي الدخل المحسوب"
        string financial_category "الفئة الأولى | الفئة الثانية | الفئة الثالثة"
        string status "active | suspended | archived"
        string district "الحي السكني"
        text address "العنوان التفصيلي"
        timestamps created_at
    }

    DEPENDENTS {
        bigint id PK
        bigint beneficiary_id FK
        string full_name
        string national_id
        string relationship "ابن | ابنة | زوجة | والد | والدة"
        date birth_date
        string gender
        string health_status "سليم | مريض مزمن | ذوي إعاقة"
    }

    BENEFICIARY_DOCUMENTS {
        bigint id PK
        bigint beneficiary_id FK
        string document_type "هوية | عقد إيجار | مشهد دخل | تقرير طبي"
        string file_path
        string original_name
        integer file_size
    }
```

---

## 2. قواعد التحقق والنزاهة (Validation Rules)

### 2.1 رقم الهوية الوطنية والإقامة:
- يتكون الحقل `national_id` من **10 أرقام بالضبط**.
- **المواطن (Citizen):** يبدأ الرقم بـ `1`.
- **المقيم (Resident):** يبدأ الرقم بـ `2`.
- تخضع الهوية لخوارزمية التحقق الرسمية (Luhn-based checksum) في الواجهة الأمامية (`beneficiaryValidation.js`) لمنع الأخطاء المطبعية قبل الإرسال.

### 2.2 الحقول الإلزامية المشتركة:
- الاسم الكامل، نوع الجنس، تاريخ الميلاد، رقم الهاتف، الحي السكني، الحالة الاجتماعية، عدد المعالين، وإجمالي الدخل الشهري.

---

## 3. دورة حياة ملف المستفيد (Beneficiary Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> تسجيل_جديد: إدخال البيانات والوثائق
    تسجيل_جديد --> حساب_الاستحقاق: تقييم الدخل والمعالين
    حساب_الاستحقاق --> معتمد_نشط: تعيين الفئة المالية (active)
    
    معتمد_نشط --> استلام_المساعدات: جدولة التوزيع الدوري
    معتمد_نشط --> موقوف_مؤقتاً: تحديث بيانات ناقصة / تجاوز الدخل (suspended)
    موقوف_مؤقتاً --> معتمد_نشط: إعادة التنشيط بعد التحقق
    معتمد_نشط --> مؤرشف: وفاة / انتقال / عدم استحقاق دائم (archived)
```

---

## 4. إطلاق الأحداث والإشعارات (Events & Notification Trigger)
- عند إنشاء مستفيد أو تعديل بياناته الأساسية أو تغيير حالته:
  - يُطلق الحدث `App\Events\BeneficiaryChanged`.
  - يستمع له `App\Listeners\SendBeneficiaryNotification`.
  - يتم إدراج إشعار في جدول `notifications` للمستخدمين الإداريين المعنيين لمتابعة أي تعديل على ملفات الحالات الدائمة.
