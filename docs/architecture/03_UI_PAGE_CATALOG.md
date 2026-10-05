# كتالوج شاشات واجهة المستخدم وتدفق التنقل (UI Page Catalog & Navigation Flow)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**المصدر المرجعي:** `frontend/src/App.jsx` و `frontend/src/components/Sidebar.jsx`  
**التاريخ:** سبتمبر 2026

---

## 1. شجرة التنقل والمسارات الفعالة في النظام (Route Tree & Access Control)

| المسار (Route Path) | المكون (Component) | الأدوار المخولة (Allowed Roles) | الغرض الوظيفي |
|---|---|---|---|
| `/setup-admin` | `FirstAdminSetupPage` | عام (مفتوح فقط عند أول تهيئة) | تهيئة حساب المسؤول الأول للنظام |
| `/login` | `LoginPage` | عام (غير المسجلين) | تسجيل دخول المستخدمين |
| `/forgot-password` | `ForgotPasswordPage` | عام | طلب رابط استعادة كلمة المرور |
| `/reset-password/:token` | `ResetPasswordPage` | عام | إعادة تعيين كلمة المرور بواسطة الرمز |
| `/dashboard` | `Dashboard` | `admin`, `assistant_admin`, `reception`, `staff`, `warehouse`, `readonly` | لوحة القيادة العامة والمؤشرات السريعة |
| `/beneficiaries` | `BeneficiaryList` | `admin`, `assistant_admin`, `reception`, `staff`, `readonly` | قائمة المستفيدين الدائمين وتصفيتهم |
| `/beneficiaries/add-citizen` | `AddBeneficiaryPage` | `admin`, `assistant_admin`, `reception`, `staff` | نموذج تسجيل مستفيد مواطن جديد |
| `/beneficiaries/add-resident` | `AddBeneficiaryPage` | `admin`, `assistant_admin`, `reception`, `staff` | نموذج تسجيل مستفيد مقيم جديد |
| `/beneficiaries/import` | `BeneficiaryImportPage` | `admin`, `assistant_admin`, `reception` | استيراد المستفيدين دفعة واحدة عبر ملف Excel |
| `/beneficiaries/:id` | `BeneficiaryDetails` | `admin`, `assistant_admin`, `reception`, `staff`, `readonly` | عرض الملف التفصيلي للمستفيد والمرفقات |
| `/beneficiaries/:id/edit` | `EditBeneficiaryPage` | `admin`, `assistant_admin`, `reception`, `staff` | تعديل بيانات المستفيد أو المعالين |
| `/daily-beneficiaries` | `DailyBeneficiariesPage` | `admin`, `assistant_admin`, `reception`, `staff`, `readonly` | سجل المستفيدين اليوميين وسندات التسليم |
| `/daily-beneficiaries/add` | `DailyBeneficiaryForm` | `admin`, `assistant_admin`, `reception`, `staff` | تسجيل حالة مستفيد يومي طارئة |
| `/daily-beneficiaries/:id` | `DailyBeneficiaryDetails` | `admin`, `assistant_admin`, `reception`, `staff`, `readonly` | ملف الحالة اليومية وسجل الاستلامات |
| `/daily-beneficiaries/:id/edit` | `DailyBeneficiaryForm` | `admin`, `assistant_admin`, `reception`, `staff` | تعديل بيانات المستفيد اليومي |
| `/daily-beneficiaries/receiving` | - | - | تحويل تلقائي إلى تبويب `deliveries` |
| `/daily-beneficiaries/inventory` | - | - | تحويل تلقائي إلى تبويب `inventory` |
| `/warehouse` | `Warehouse` | `admin`, `assistant_admin`, `warehouse`, `staff`, `readonly` | إدارة أصناف المستودع وحركات المخزون |
| `/staff` | `StaffListPage` | `admin`, `assistant_admin` | جدول موظفي الجمعية |
| `/staff/add` | `AddStaffPage` | `admin`, `assistant_admin` | إضافة موظف جديد ومعالين |
| `/staff/import` | `StaffImportPage` | `admin`, `assistant_admin` | استيراد موظفين عبر ملف Excel |
| `/staff/:id` | `StaffDetailsPage` | `admin`, `assistant_admin` | تفاصيل الموظف وسجل الدعم المصروف |
| `/staff/:id/edit` | `EditStaffPage` | `admin`, `assistant_admin` | تعديل بيانات الموظف |
| `/representatives` | `NeighborhoodRepsPage` | `admin`, `assistant_admin`, `staff` | إدارة الجهات المستفيدة ومندوبي الأحياء |
| `/delivery` | `DeliveryPage` | `admin`, `assistant_admin`, `staff`, `delivery_driver`, `driver` | إدارة عمليات التوصيل وسندات الإرسال |
| `/driver/deliveries` | `DriverDashboard` | `admin`, `assistant_admin`, `staff`, `delivery_driver`, `driver` | لوحة السائق لمهام اليوم واستلام العهد |
| `/receiver` | `ReceiverPage` | جميع الأدوار (8 أدوار) | مسح كود QR أو إدخال كود التحقق 8 خانات |
| `/governance` | `GovernancePage` | `admin`, `assistant_admin`, `readonly` | تقارير الحوكمة والرقابة ومؤشرات الهدر |
| `/statistics` | `GovernancePage` | `admin`, `assistant_admin`, `readonly` | اسم مسار بديل لنفس صفحة الحوكمة |
| `/audit` | `AuditPage` | `admin` فقط | سجل تدقيق العمليات الأمنية والإدارية |
| `/admin/users` | `Users` | `admin` فقط | إدارة حسابات مستخدمي النظام وصلاحياتهم |
| `/admin/settings` | `SystemSettingsPage` | `admin` فقط | إعدادات النظام وقواعد الاستحقاق |
| `/assistant-admin` | `AssistantAdminDashboard` | `admin`, `assistant_admin` | لوحة قيادة مخصصة للنائب الإداري |

---

## 2. عناصر القائمة الجانبية (Sidebar Navigation Visibility)

يتم التحكم في ظهور عناصر القائمة الجانبية في `frontend/src/components/Sidebar.jsx` ديناميكياً بناءً على دور المستخدم `user.role`:

```mermaid
graph LR
    UserRole{فحص دور المستخدم}
    UserRole -->|admin| FullMenu[ظهور القائمة كاملة + الإدارة والتدقيق]
    UserRole -->|assistant_admin| AsstMenu[العمليات + الحوكمة + الموظفين - الإعدادات والتدقيق]
    UserRole -->|reception| RecepMenu[المستفيدين الدائمين + اليوميين + الاستلام]
    UserRole -->|staff| StaffMenu[المستفيدين + المستودع + التوصيل + الاستلام + المندوبين]
    UserRole -->|warehouse| WhMenu[المستودع والمخزون + بوابة الاستلام]
    UserRole -->|driver| DriverMenu[لوحة التوصيل + بوابة التحقق والاستلام]
    UserRole -->|readonly| ReadMenu[عرض المستفيدين + المستودع + الحوكمة (قراءة فقط)]
```

---

## 3. مسار الهبوط الافتراضي للمستخدمين (Landing Page by Role)

كما هو معرف صراحة في `App.jsx` (الدالة `getHomePath`):
- لسائقي التوصيل (`delivery_driver` أو `driver`): التحويل المباشر إلى `/delivery`.
- للمساعد الإداري (`assistant_admin`): التحويل المباشر إلى صفحة الاستلام الميداني `/receiver`.
- لباقي الأدوار (`admin`, `staff`, `reception`, `warehouse`, `readonly`): التحويل المباشر إلى لوحة القيادة `/dashboard`.
