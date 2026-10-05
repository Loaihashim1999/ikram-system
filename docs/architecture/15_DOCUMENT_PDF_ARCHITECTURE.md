# معمارية توليد الوثائق الرسمية وسندات الـ PDF (Document & PDF Generation Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية:**
- `app/Http/Controllers/PdfExportController.php`
- قوالب Blade: `resources/views/pdf/`
- حزم: `mpdf/mpdf` (v8.2) و `phpoffice/phpspreadsheet` (v1.29)  
**التاريخ:** سبتمبر 2026

---

## 1. محرك توليد المستندات (mPDF Engine Configuration)

يستخدم النظام محرك **mPDF** لإنشاء السندات والتقارير بصيغة PDF عالية الدقة، مع دعم مدمج للغة العربية والاتجاه من اليمين لليسار (RTL):
```php
new Mpdf([
    'mode' => 'utf-8',
    'format' => 'A4',
    'orientation' => $orientation, // P (عمودي) أو L (أفقي)
    'margin_top' => $orientation === 'L' ? 18 : 58,
    'margin_bottom' => $orientation === 'L' ? 18 : 32,
    'margin_left' => 12,
    'margin_right' => 12,
    'autoScriptToLang' => true,
    'autoLangToFont' => true,
    'tempDir' => storage_path('app/mpdf'),
]);
```

---

## 2. كتالوج الوثائق والسندات الرسمية المعتمدة (Official Document Catalog)

| اسم الوثيقة | المسار البرمجي (API Endpoint) | القالب (Blade View) | التوجيه | الغرض والبيانات المتضمنة |
|---|---|---|:---:|---|
| **بطاقة المستفيد** | `GET /api/documents/beneficiary-card/{id}` | `pdf.beneficiary_card` | عمودي (P) | بطاقة تعريفية للمستفيد تتضمن رقم الملف، الاسم، الهوية، الفئة، والباركود. |
| **سند استلام فردي** | `GET /api/documents/individual-receipt/{id}` | `pdf.individual_receipt` | عمودي (P) | سند تسليم مساعدة لمستفيد فردي، يشمل رقم الإرسالية، السائق، كود التحقق 8 خانات، وتوقيع الاستلام. |
| **سند استلام شامل** | `GET /api/documents/total-delivery/{id}` | `pdf.total_delivery` | عمودي (P) | كشف تاريخي بجميع المساعدات والسلال التي استلمها المستفيد منذ تسجيله. |
| **سند تسليم مندوب الحي** | `GET /api/documents/rep-receipt/{id}` | `pdf.representative_receipt` | عمودي (P) | كشف تسليم كميات مجمعة لمندوب الحي أو رئيس الجهة الشريكة وقائمة الأسر التابعة له. |
| **سند استلام موظف** | `GET /api/documents/staff-receipt/{id}` | `pdf.staff_receipt` | عمودي (P) | توثيق استلام موظف الجمعية لحصته الغذائية الشهرية أو الدعم السكني. |
| **سند استلام يومي** | `GET /api/daily-beneficiaries/receiving/{id}/pdf` | `pdf.daily_receiving_voucher` | عمودي (P) | سند فوري تسليم وجبات لحالة طارئة أو عابر سبيل يشمل رقم السند والوجبات والإقرار. |
| **التقرير اليومي الموحد** | `GET /api/reports/daily/pdf` | `pdf.daily_report` | أفقي (L) | تقرير رقابي يومي لحركات المستودع ومجموع الوجبات المصروفة لليوميين وإرساليات الدائمين. |
| **تقرير الحوكمة الشامل** | `GET /api/reports/comprehensive/pdf` | `pdf.weekly_comprehensive_report` | عمودي (P) | تقرير الحوكمة الأسبوعي أو المخصص، يتضمن مؤشرات الهدر، التوزيع الجغرافي، وميزان المخزون. |
| **ملف الحوكمة إكسل** | `GET /api/reports/comprehensive/excel` | عبر `PhpSpreadsheet` | - | ملف Excel متعدد التبويبات يحتوي على كافة البيانات الخام ومؤشرات التحليل. |

---

## 3. معايير الأمان والخصوصية في تصدير البيانات (Export Privacy Safeguards)
- يتم تطبيق سياسة صارمة في التصدير (`exportComprehensiveExcel`):
  - استبعاد كلمات المرور، التوكنات، الحسابات المصرفية، ومسارات الملفات الشخصية الداخلية.
  - تجميد الصف العلوي (`freezePane('A2')`) وتفعيل التصفية التلقائية (`setAutoFilter`).
  - رأس الصفحة (HTTP Response) مشفر بـ `Cache-Control: private, no-store` لمنع التخزين المؤقت غير الآمن على أجهزة التصفح المشتركة.
