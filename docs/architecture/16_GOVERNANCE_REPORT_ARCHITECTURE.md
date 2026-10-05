# معمارية محرك تقارير الحوكمة والرقابة (Governance & Reporting Engine Architecture)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**الملفات المرجعية:**
- `app/Services/GovernanceReportService.php`
- `app/Http/Controllers/AnalyticsController.php`
- `app/Http/Controllers/PdfExportController.php`
- `frontend/src/pages/governance/GovernancePage.jsx`
- `frontend/src/pages/governance/GovernanceCharts.jsx`  
**التاريخ:** سبتمبر 2026

---

## 1. فلسفة الحوكمة في نظام إكرام (Governance Philosophy)

صُممت وحدة الحوكمة لتكون أداة رقابية مستقلة للجمعية، تقدم تحليلات تشغيلية وإحصائية دقيقة تمنع الهدر، تقيس كفاءة التوزيع، وتتحقق من جودة ونزاهة البيانات المخزنة.

```mermaid
graph TD
    Period[تحديد الفترة الزمنية للتقرير] --> Analytics[AnalyticsController@index]
    Analytics --> GovService[GovernanceReportService::build]
    
    subgraph "محاور الرقابة والتحليل"
        GovService --> KPI[مؤشرات الأداء التشغيلية KPIs]
        GovService --> DataQuality[فحص جودة ونزاهة السجلات Quality Checks]
        GovService --> GeoDemand[تحليل التوزيع والطلب الجغرافي Top Districts]
        GovService --> RentBurden[تحليل عبء الإيجار على الدخل]
        GovService --> StockHealth[مؤشرات صحة وركود المخزون]
    end

    GovService --> OutUI[عرض تفاعلي على لوحة الحوكمة GovernancePage]
    GovService --> OutPDF[تصدير التقرير الشامل PDF]
    GovService --> OutExcel[تصدير قاعدة البيانات الرقابية إكسل متعدد التبويبات]
```

---

## 2. مؤشرات الأداء السبعة المعتمدة (The 7 Core Governance Indicators)

| المؤشر (Indicator) | الصيغة الحسابية (Formula) | النطاق (Scope) | الوحدة |
|---|---|---|:---:|
| **نمو التسجيل (Registration Growth)** | $\frac{\text{التسجيل الحالي} - \text{السابق}}{\text{السابق}} \times 100$ | الفترة مقارنة بالفترة السابقة المساوية لها | $\%$ |
| **نسبة إكمال الجدولة (Schedule Completion)**| $\frac{\text{التوزيعات المكتملة}}{\text{كافة التوزيعات المجدولة}} \times 100$ | العمليات المجدولة خلال الفترة المحددة | $\%$ |
| **العمليات المتأخرة (Overdue Tasks)** | عدد العمليات المعلقة (`scheduled`) التي تجاوزت موعدها | العمليات المجدولة ضمن الفترة ولم تسلم | عملية |
| **متوسط مرات الاستلام (Avg Receipts/Person)**| $\frac{\text{عمليات الاستلام المنفذة}}{\text{المستفيدين الفريدين المستلمين}}$ | المستفيدين الدائمين الفعليين في الفترة | عملية / فرد |
| **عبء الإيجار على الدخل (Rent Burden)** | $\text{متوسط}\left(\frac{\text{الإيجار الشهري}}{\text{إجمالي الدخل}} \times 100\right)$ | المستأجرين ذوي الدخل الإيجابي ($>0$) | $\%$ |
| **اكتمال بيانات التحليل (Data Completeness)** | $\frac{\text{سجلات تحوي الحي والفئة وتاريخ الميلاد}}{\text{إجمالي سجلات المستفيدين}} \times 100$ | جميع المستفيدين الدائمين | $\%$ |
| **نسبة المخزون المنخفض (Low Stock Ratio)** | $\frac{\text{الأصناف عند حد الأمان أو أدنى}}{\text{إجمالي أصناف المخزون العام واليومي}} \times 100$ | لقطة حالية للأصناف في المستودعات | $\%$ |

---

## 3. محرك فحص جودة ونزاهة البيانات (Data Quality Audits)

يقوم `GovernanceReportService` آلياً بفحص خمسة شذوذات في السجلات:
1. `missing_district`: مستفيدون بدون تحديد الحي السكني (يصعب التوجيه اللوجستي).
2. `missing_category`: مستفيدون غير مربوطين بفئة استحقاق مالية.
3. `missing_birth_date`: مستفيدون بدون تاريخ ميلاد (يعيق التحقق من كبار السن).
4. `negative_net_income`: شذوذ حسابي حيث الإيجار أعلى من إجمالي الدخل مما يجعل الصافي سالباً.
5. `delivered_without_date`: عمليات تم وسمها كمسلمة (`delivered`) دون توثيق تاريخ التسليم الدقيق `delivered_at`.
