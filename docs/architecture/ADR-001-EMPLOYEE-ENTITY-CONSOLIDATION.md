# ADR-001: توحيد كيان الموظفين واعتماد جدول staff وتجميد staff_members
**العنوان:** توحيد كيان الموظفين واعتماد نموذج Staff ككيان نشط حصري  
**الحالة:** APPROVED  
**السياق:** تدقيق المرحلة التنفيذية الأولى (Implementation Phase 1)  
**التاريخ:** سبتمبر 2026

---

## 1. السياق والمشكلة (Context & Problem Statement)

أظهر التدقيق المعماري وجود كيانين منفصلين لتمثيل الموظفين داخل المشروع:
1. الكيان الأول:
   - الجدول: `staff`
   - الموديل: `App\Models\Staff`
   - المتحكم: `App\Http\Controllers\StaffController`
   - المعالون: `App\Models\StaffDependent` (جدول `staff_dependents` مربوط عبر `staff_id`)
2. الكيان الثاني (Legacy):
   - الجدول: `staff_members`
   - الموديل: `App\Models\StaffMember`
   - المتحكم: `App\Http\Controllers\Staff\StaffMemberController`

هذا الازدواج يمثل خطراً معمارياً حيث قد يقوم مطورون أو أدوات ذكاء اصطناعي بربط ميزات جديدة بـ `StaffMember` بينما الواجهة الأمامية و`routes/api.php` تعتمد حصرياً على `Staff`.

---

## 2. نتائج التدقيق الشامل للارتباطات (Comprehensive Reference Audit)

| العنصر البرمجي | الكيان الفعال (`Staff`) | الكيان القديم (`StaffMember`) | النتيجة والقرار |
|---|---|---|---|
| **المسارات في `routes/api.php`** | `Route::apiResource('staff', StaffController::class)` مسجل ونشط | **لا توجد مسارات إطلاقاً** | `Staff` هو النشط حصرياً |
| **واجهات React (`frontend/src/`)** | تستدعي `/api/staff` عبر `staffApi.js` في صفحات قائمة الموظفين والإضافة والتعديل والاستيراد | لا يوجد أي استدعاء لـ `staff_members` | `Staff` هو المعتمد في الـ UI |
| **سندات الاستلام الرسمية (`PdfExportController`)** | `exportStaffReceipt` يستورد `App\Models\Staff` حصرياً | لا يوجد استدعاء | `Staff` معتمد في السندات |
| **تقارير الحوكمة (`GovernanceReportService`)** | يستورد `App\Models\Staff` | لا يوجد استدعاء | `Staff` معتمد في الحوكمة |
| **توزيع المساعدات (`StaffDistribution`)** | العلاقة `staffMember()` تعيد `$this->belongsTo(Staff::class, 'staff_id')` | يوجد فقط حقل قديم غير مفعل `staff_member_id` | `Staff` هو الفعلي |
| **بيانات الإنتاج والبيئة الحالية** | 0 سجلات في قاعدة البيانات | 0 سجلات في قاعدة البيانات | لا يوجد خطر فقدان بيانات |

---

## 3. القرار المعماري (Architectural Decision)

1. **اعتماد `Staff` ككيان رسمي ووحيد:**
   - يمثل جدول `staff` وموديل `App\Models\Staff` ومتحكم `App\Http\Controllers\StaffController` الكيان الفعال والوحيد لإدارة منسوبي الجمعية.
2. **وسم `StaffMember` ككيان مهجور (LEGACY DEPRECATED):**
   - إضافة تنبيه إهمال صريح (`@deprecated`) على نموذج `App\Models\StaffMember` ومتحكم `App\Http\Controllers\Staff\StaffMemberController`.
3. **عدم الحذف المتلف في المرحلة الأولى:**
   - التزاماً بتوجيهات المرحلة الأولى (Zero Destructive Migrations)، لا يتم حذف جدول `staff_members` أو الموديل فوراً، بل يتم تجميده وتوثيقه لتسهيل أي تنظيف مستقبلي مجدول.

---

## 4. مسار الدمج والتنظيف الآمن المستقبلي (Safe Consolidation Path)
- في مرحلة قادمة معتمدة (Phase 2 أو ما بعدها):
  1. التحقق من عدم وجود أي سجلات تاريخية في جدول `staff_members`.
  2. إنشاء Migration لحذف جدول `staff_members` وإزالة الحقل القديم `staff_member_id` من `staff_distributions`.
  3. حذف ملفي `App\Models\StaffMember.php` و `App\Http\Controllers\Staff\StaffMemberController.php`.
