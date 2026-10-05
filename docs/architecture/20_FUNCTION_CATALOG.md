# كتالوج الدوال والخدمات البرمجية المركزية (Function & Service Catalog)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**التاريخ:** سبتمبر 2026

---

## 1. كتالوج خدمات الأعمال المركزية (Business Services)

### 1.1 خدمة الحسابات المالية: `App\Services\FinancialCalculationService`
- **`calculate(array $data): array`**
  - الغرض: احتساب إجمالي الدخل المالي، الإيجار الشهري، وصافي الدخل، واستدعاء دالة تحديد الأولوية.
  - المعاملات: مصفوفة بيانات المستفيد، الدخل، مصادر الدخل، ونوع السكن.
  - المخرجات: مصفوفة تتضمن `total_income`, `monthly_rent`, `net_income`, `priority`, `category_id`.
- **`determinePriority(array $data, float $netIncome, bool $isCitizen): string`**
  - الغرض: تصنيف الاستحقاق بناءً على حدود إعدادات النظام `first_class_max_income` و `second_class_max_income`.
- **`getCategoryIdForPriority(string $priority): ?string`**
  - الغرض: ربط رمز الأولوية بمعرف السجل الفعلي في جدول `categories`.

### 1.2 خدمة تقارير الحوكمة: `App\Services\GovernanceReportService`
- **`build(Request $request): array`**
  - الغرض: بناء وتجميع كافة مؤشرات الحوكمة السبعة، فحوصات جودة البيانات الخمسة، الطلب الجغرافي، والمخطط الزمني للتسليم.
  - المخرجات: مصفوفة متكاملة تشمل `analytics`, `indicators`, `quality`, `datasets`, `insights`.

### 1.3 خدمة تنبيهات المخزون: `App\Services\InventoryAlertService`
- **`checkNearExpiryItems(): Collection`**
  - الغرض: البحث عن الأصناف التي يتبقى على انتهاء صلاحيتها 5 أيام أو أقل وإطلاق إشعارات استباقية.
- **`checkLowStockItems(): Collection`**
  - الغرض: البحث عن الأصناف التي وصل رصيدها الفعلي إلى حد الأمان الأدنى أو تجاوزه للأسفل.

### 1.4 خدمة بث الإشعارات: `App\Services\NotificationService`
- **`notifyAll(string $type, string $message, $relatedModel = null): void`**
  - الغرض: فلترة المستخدمين المصرح لهم باستلام التنبيه للوحدة، توليد بصمة SHA-256 لمنع التكرار، وحفظ الإشعار بجدول `notifications`.

---

## 2. متحكمات العمليات الرئيسية (Core Controllers)

| المتحكم | الدوال البارزة | الوظيفة |
|---|---|---|
| `BeneficiaryController` | `index`, `store`, `show`, `update`, `destroy`, `exportExcel`, `importExcel` | إدارة دورة حياة المستفيد الدائم |
| `DailyBeneficiaryController` | `index`, `store`, `show`, `update`, `destroy` | إدارة الحالات الطارئة واليومية |
| `DailyReceivingController` | `index`, `store`, `show`, `update`, `destroy` | إصدار سندات استلام الوجبات اليومية |
| `DailyInventoryController` | `index`, `store`, `movements` | إدارة مخزون وجبات الطوارئ |
| `InventoryController` | `index`, `store`, `update`, `destroy`, `movements`, `alerts` | إدارة المستودع العام ومراقبة الصلاحيات |
| `DistributionController` | `index`, `store`, `show`, `update`, `driverDeliveries` | جدولة التوزيع وتوليد كود التحقق 8 خانات |
| `ReceiverController` | `scan`, `confirm` | بوابة فحص ومسح رمز QR وتأكيد التسليم الميداني |
| `PdfExportController` | 8 دوال تصدير PDF + دالة تصدير Excel الشاملة | توليد الوثائق الرسمية وسندات الاستلام |
| `UserController` | `index`, `store`, `show`, `update`, `destroy`, `toggleNotifications` | إدارة المستخدمين والأدوار والإشعارات |
