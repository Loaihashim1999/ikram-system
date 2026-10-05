@extends('pdf.letterhead_template', ['title' => 'التقرير الشامل للحوكمة'])
@section('styles')
body { font-family: xbriyaz, sans-serif; font-size: 10pt; color: #1C1915; direction: rtl; }
h1 { font-size: 16pt; color: #1C1915; line-height: 1.45; } h2 { font-size: 13pt; color: #1F4D3A; border-bottom: 0.3mm solid #A6843D; padding-bottom: 1.5mm; }
h3 { font-size: 14pt; color: #806523; margin-top: 6mm; }
p { line-height: 1.65; } .muted { color: #59645b; font-size: 9pt; } .eyebrow { color: #806523; font-size: 12pt; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 6mm; } thead { display: table-header-group; } tr { page-break-inside: avoid; } th { background: #E7EFEA; color: #1C1915; padding: 2mm; text-align: right; } td { border-bottom: .2mm solid #E4DDD0; padding: 2mm; vertical-align: top; }
.kpi td { background: #F7F3EA; width: 33%; } .value { font-size: 16pt; color: #1F4D3A; } .note { background: #F7F3EA; padding: 3mm; border-right: 0.8mm solid #A6843D; }
.bar { background: #355B30; height: 4mm; } .page { height: 3mm; } h2, h3 { page-break-after: avoid; } .small { font-size: 9pt; }
@endsection
@section('content')
@php
$a = $report['analytics'];
@endphp
<h1 class="doc-title">التقرير الشامل للحوكمة وتحليل البيانات</h1>
<p style="font-size:17pt">{{ $a['period']['start_date'] }} إلى {{ $a['period']['end_date'] }}</p>
<p>أعد بواسطة: {{ $report['generated_by'] }}<br>تاريخ الإنشاء: {{ $report['generated_at'] }}</p>
<div class="note">يستند هذا التقرير إلى سجلات قاعدة البيانات وقت الإنشاء. مؤشرات النشاط تتبع الفترة المحددة، بينما توضح مؤشرات اللقطة الحالية حالة السجلات الآن؛ ولا تمثل رصيداً تاريخياً عند نهاية الفترة.</div>
<h3>دليل القراءة</h3><p>الملخص التنفيذي • المستفيدون والمالية • التوزيع والاستلام • المسار التشغيلي • الأحياء • المخزون • الجهات والموظفون • التدقيق والإشعارات • الاستنتاجات والملاحق</p>
<pagebreak /><h2>الملخص التنفيذي</h2>
<table class="kpi"><tr><td><span class="value">{{ $a['beneficiaries']['total'] }}</span><br>المستفيدون — حالياً</td><td><span class="value">{{ $a['beneficiaries']['registered_in_period'] }}</span><br>التسجيل — خلال الفترة</td><td><span class="value">{{ $report['received_operations'] }}</span><br>الاستلام الفعلي — خلال الفترة</td></tr></table>
@foreach($report['insights'] as $insight)<p>• {{ $insight }}</p>@endforeach
<pagebreak /><h2>مؤشرات التحليل والأداء</h2>
<p class="muted">كل مؤشر يوضح نطاقه وطريقة حسابه. عدم توافر مقام صالح للحساب يظهر «غير متاح»؛ ولا يحوّل إلى صفر أو نسبة نجاح وهمية.</p>
@foreach($report['indicators'] as $indicator)
<div style="page-break-inside:avoid; margin-bottom:5mm; background:#f5f2e9; padding:4mm">
<table style="margin:0"><tr><td style="width:68%;border:0"><h3 style="margin:0">{{ $indicator['label'] }}</h3><span class="muted">{{ $indicator['scope'] }}</span></td><td style="border:0;text-align:left"><span class="value">{{ $indicator['value'] === null ? 'غير متاح' : number_format($indicator['value'], $indicator['unit'] === 'عملية' ? 0 : 1) }}</span> {{ $indicator['value'] === null ? '' : $indicator['unit'] }}</td></tr></table>
<p style="margin:1mm 0;font-size:9pt">الحساب: {{ $indicator['formula'] }}</p><p style="margin:1mm 0;font-size:9pt">{{ $indicator['note'] }}</p>
</div>@endforeach
<pagebreak /><h2>لوحة التحليل المرئي</h2>
<h3>التسجيلات حسب المجال</h3>
@php
$domainRows=$a['charts']['column_chart']['data'];
$domainMap = collect($domainRows)->mapWithKeys(fn ($row) => [$row['label'] => $row['count']])->all();
@endphp
@include('pdf.report_bar_chart', ['values' => $domainMap, 'label' => 'المجال'])
<h3>التسجيل والاستلام الفعلي عبر الزمن</h3><p class="muted">الجدول هو التمثيل المعتمد للطباعة. الأخضر في الواجهة يقابل التسجيل، والذهبي يقابل الاستلام وفق تاريخ التسليم الفعلي.</p>
@if(count($report['timeline']) <= 1)<p class="note">الفترة تشمل شهراً واحداً؛ تعرض المقارنة بالأعداد دون رسم اتجاه زمني قد يوحي بتغير غير موجود.</p>@endif
<table><thead><tr><th>الشهر</th><th>مسجلون جدد</th><th>عمليات استلام فعلية</th></tr></thead><tbody>@foreach($report['timeline'] as $row)<tr><td>{{ $row['label'] }}</td><td>{{ $row['registrations'] }}</td><td>{{ $row['receipts'] }}</td></tr>@endforeach</tbody></table>
<div style="page-break-inside:avoid"><h3>قمع تقدم محرك الدعم الموحد</h3><p class="muted">كل مرحلة تحسب العمليات المنشأة خلال الفترة التي وصلت إليها أو تجاوزتها وفق ترتيب حالات المحرك الفعلي.</p>
@php $funnel=$a['charts']['funnel_chart']['stages']; $funnelPeak=max(1,collect($funnel)->max('count')); @endphp
<table class="data-table"><thead><tr><th>المرحلة</th><th class="num">العدد</th><th class="num">النسبة</th></tr></thead><tbody>
@foreach($funnel as $stage)<tr><td>{{ $stage['stage'] }}</td><td class="num">{{ $stage['count'] }}</td><td class="num">{{ $stage['percentage'] }}%</td></tr>@endforeach
</tbody></table></div>
<div style="page-break-inside:avoid"><h3>النسبة حسب المجال</h3>
@php $domainTotal=max(1,collect($domainRows)->sum('count')); @endphp
<table class="data-table"><thead><tr><th>المجال</th><th class="num">العدد</th><th class="num">النسبة</th></tr></thead><tbody>
@foreach($domainRows as $row)<tr><td>{{ $row['label'] }}</td><td class="num">{{ $row['count'] }}</td><td class="num">{{ round(100 * $row['count'] / $domainTotal, 1) }}%</td></tr>@endforeach
</tbody></table></div>
<div style="page-break-inside:avoid"><h3>تركيز المستفيدين حسب الحي</h3><p class="muted">لقطة حالية. الأحياء الأعلى بعدد الملفات المسجلة، وهو مؤشر حجم الخدمة المحتملة ولا يثبت الطلب غير الملبى. تشمل «أحياء أخرى» بقية الأحياء.</p>
@include('pdf.report_bar_chart', ['values'=>$report['topDistricts'], 'label'=>'الحي'])</div>
<h3>حالة التوزيعات المجدولة خلال الفترة</h3><p class="muted">حالة العمليات الآن حسب تاريخ الجدولة في النطاق المحدد.</p>
@include('pdf.report_bar_chart', ['values'=>$report['scheduled_statuses'], 'label'=>'حالة العملية'])
<pagebreak /><h2>تحليل المستفيدين والموارد المالية</h2><p class="muted">التسجيلات الدائمة المطابقة للفترة والمرشحات. القيم المالية شهرية بالريال السعودي كما حسبها النظام عند الحفظ.</p>
<table><thead><tr><th>المؤشر المالي</th><th>القيمة (ريال)</th></tr></thead>@foreach(['total_income'=>'إجمالي الدخل','monthly_rent'=>'إجمالي الإيجار الشهري','net_income'=>'صافي الدخل المتاح','average_income'=>'متوسط الدخل المسجل'] as $key=>$label)<tr><td>{{ $label }}</td><td>{{ number_format($report['finance'][$key] ?? 0, 2) }}</td></tr>@endforeach</table>
<p class="muted">القيم أعلاه هي الحقول الحالية للتسجيلات المطابقة وليست لقطة تاريخية. المؤشرات التالية وحدها مأخوذة من تقييمات السياسة غير القابلة للاستبدال.</p>
<h3>اللقطات المالية التاريخية لتقييمات السياسة</h3><table><thead><tr><th>المؤشر المحفوظ</th><th>المجموع (ريال)</th></tr></thead>@foreach(['gross_counted_income'=>'الدخل المحتسب','monthly_rent'=>'الإيجار الشهري','adjusted_net_household_income'=>'صافي دخل الأسرة المعدل','net_income_per_capita'=>'صافي دخل الفرد'] as $key=>$label)<tr><td>{{ $label }}</td><td>{{ number_format($report['policy_finance'][$key] ?? 0, 2) }}</td></tr>@endforeach</table>
<h3>فئات الاستحقاق المسجلة</h3><p class="muted">الأسماء معروضة كما هي دون دمج أو إعادة تصنيف. طول الشريط يمثل عدد المستفيدين نسبة إلى أكبر فئة.</p>
@php
$maxCategory = max(1, collect($a['beneficiaries']['categories'])->max('total_beneficiaries') ?? 0);
@endphp
<table><thead><tr><th>الفئة</th><th>عدد المستفيدين</th><th>مقارنة الأعداد</th></tr></thead><tbody>@foreach($a['beneficiaries']['categories'] as $cat)<tr><td>{{ $cat['name'] }}</td><td>{{ $cat['total_beneficiaries'] }}</td><td><div style="background:#E7E1D4;height:3.2mm"><div style="background:#1F4D3A;height:3.2mm;width:{{ max(0, min(100, 100 * $cat['total_beneficiaries'] / $maxCategory)) }}%"></div></div></td></tr>@endforeach</tbody></table>
@foreach(['beneficiary_type'=>'صفة الإقامة','family_members_count'=>'حجم الأسرة','status'=>'حالة الملف','housing_type'=>'نوع السكن','family_status'=>'الحالة الأسرية','profession'=>'المهنة','priority'=>'الأولوية'] as $key=>$label)
<div style="page-break-inside:avoid"><h3>{{ $label }} — لقطة حالية</h3><table><thead><tr><th>القيمة المسجلة</th><th>العدد</th></tr></thead><tbody>@forelse($report['breakdowns'][$key] as $value=>$count)<tr><td>{{ $value }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد سجلات</td></tr>@endforelse</tbody></table></div>@endforeach
@php
$nat = $a['nationality_analysis'];
$natBuckets = [
    'registered' => collect($nat['populations']['registered']['buckets'])->keyBy('key'),
    'active' => collect($nat['populations']['active']['buckets'])->keyBy('key'),
    'served' => collect($nat['populations']['served']['buckets'])->keyBy('key'),
];
$natSplitPermanent = array_key_exists('permanent', $nat['populations']['registered']['buckets'][0] ?? []);
$natSplitDaily = array_key_exists('daily', $nat['populations']['registered']['buckets'][0] ?? []);
@endphp
<h2>تحليل الجنسية</h2>
<p class="muted">السكان الفريدون داخل كل مجال. المسجلون بتاريخ الإنشاء خلال الفترة، والنشطون لقطة حالية لا تقيدها الفترة، والمخدومون بإيصال مكتمل واحد لكل شخص خلال الفترة. الجنسية الفارغة في «غير مسجلة» ولا تُضم إلى سعودي. النطاق: {{ $nat['domain'] }}، من {{ $nat['period']['start_date'] }} إلى {{ $nat['period']['end_date'] }}.</p>
<table><thead><tr><th>الجنسية</th><th>المسجلون</th>@if($natSplitPermanent)<th>مسجلون دائمون</th>@endif @if($natSplitDaily)<th>مسجلون يوميون</th>@endif<th>النشطون</th>@if($natSplitPermanent)<th>نشطون دائمون</th>@endif @if($natSplitDaily)<th>نشطون يوميون</th>@endif<th>المخدومون</th>@if($natSplitPermanent)<th>مخدومون دائمون</th>@endif @if($natSplitDaily)<th>مخدومون يوميون</th>@endif</tr></thead><tbody>
@foreach($nat['chart']['categories'] as $category)
@php $key = $category['key']; @endphp
<tr>
<td>{{ $category['label'] }}</td>
<td>{{ $natBuckets['registered'][$key]['count'] ?? 0 }}</td>
@if($natSplitPermanent)<td>{{ $natBuckets['registered'][$key]['permanent'] ?? 0 }}</td>@endif
@if($natSplitDaily)<td>{{ $natBuckets['registered'][$key]['daily'] ?? 0 }}</td>@endif
<td>{{ $natBuckets['active'][$key]['count'] ?? 0 }}</td>
@if($natSplitPermanent)<td>{{ $natBuckets['active'][$key]['permanent'] ?? 0 }}</td>@endif
@if($natSplitDaily)<td>{{ $natBuckets['active'][$key]['daily'] ?? 0 }}</td>@endif
<td>{{ $natBuckets['served'][$key]['count'] ?? 0 }}</td>
@if($natSplitPermanent)<td>{{ $natBuckets['served'][$key]['permanent'] ?? 0 }}</td>@endif
@if($natSplitDaily)<td>{{ $natBuckets['served'][$key]['daily'] ?? 0 }}</td>@endif
</tr>
@endforeach
<tr>
<td>المجموع</td>
<td>{{ $nat['populations']['registered']['total'] }}</td>
@if($natSplitPermanent)<td>{{ collect($nat['populations']['registered']['buckets'])->sum('permanent') }}</td>@endif
@if($natSplitDaily)<td>{{ collect($nat['populations']['registered']['buckets'])->sum('daily') }}</td>@endif
<td>{{ $nat['populations']['active']['total'] }}</td>
@if($natSplitPermanent)<td>{{ collect($nat['populations']['active']['buckets'])->sum('permanent') }}</td>@endif
@if($natSplitDaily)<td>{{ collect($nat['populations']['active']['buckets'])->sum('daily') }}</td>@endif
<td>{{ $nat['populations']['served']['total'] }}</td>
@if($natSplitPermanent)<td>{{ collect($nat['populations']['served']['buckets'])->sum('permanent') }}</td>@endif
@if($natSplitDaily)<td>{{ collect($nat['populations']['served']['buckets'])->sum('daily') }}</td>@endif
</tr>
</tbody></table>
@foreach(['registered' => 'المسجلون', 'active' => 'النشطون', 'served' => 'المخدومون'] as $populationKey => $populationLabel)
<div style="page-break-inside:avoid"><h3>{{ $populationLabel }}</h3>
@include('pdf.report_bar_chart', ['values' => collect($nat['populations'][$populationKey]['buckets'])->mapWithKeys(fn ($bucket) => [$bucket['label'] => $bucket['count']])->all(), 'label' => 'الجنسية'])
</div>
@endforeach
<div class="page"></div><h2>المساعدات والتوزيع والمسار التشغيلي</h2>
<h3>محرك الدعم الموحد</h3><table><tr><th>الحالة الحالية</th><th>عدد العمليات المنشأة خلال الفترة</th></tr>@forelse($report['support_statuses'] as $status=>$count)<tr><td>{{ $status }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد عمليات مطابقة</td></tr>@endforelse</table>
<h3>نتائج محرك سياسة المستفيدين</h3><p class="muted">تُقرأ من سجلات التقييم التاريخية غير القابلة للاستبدال؛ لا يعاد حسابها من بيانات المستفيد الحالية.</p><table><tr><th>نتيجة الأهلية</th><th>عدد التقييمات خلال الفترة</th></tr>@forelse($report['policy_outcomes'] as $outcome=>$count)<tr><td>{{ $outcome }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد تقييمات مطابقة</td></tr>@endforelse</table>
<table><tr><th>المؤشر</th><th>العدد</th></tr><tr><td>عمليات استلام فعلية حسب delivered_at خلال الفترة</td><td>{{ $report['received_operations'] }}</td></tr><tr><td>مستفيدون فريدون استلموا خلال الفترة</td><td>{{ $report['received_beneficiaries'] }}</td></tr><tr><td>عمليات المستفيدين اليوميين خلال الفترة</td><td>{{ $a['daily_beneficiaries']['transactions_count'] }}</td></tr><tr><td>كمية المساعدات اليومية خلال الفترة</td><td>{{ $a['daily_beneficiaries']['baskets_distributed'] }}</td></tr></table>
<h3>حالة العمليات المجدولة خلال الفترة</h3><table><tr><th>الحالة الحالية</th><th>عدد العمليات</th></tr>@foreach($report['scheduled_statuses'] as $status=>$count)<tr><td>{{ $status }}</td><td>{{ $count }}</td></tr>@endforeach</table>
<p class="note">يعرض سجل التوزيع القديم للتوافق فقط. يعتمد قمع التقدم أعلاه على حالات محرك الدعم الموحد، وتُعرض تقييمات وقرارات السياسة من سجلاتها التاريخية المستقلة.</p>
<h3>المساعدات اليومية حسب نوع السلة</h3><table><tr><th>نوع السلة</th><th>الكمية</th><th>العمليات</th></tr>@foreach($a['daily_beneficiaries']['by_basket_type'] as $row)<tr><td>{{ $row['basket_type_name'] }}</td><td>{{ $row['total_quantity'] }}</td><td>{{ $row['transactions_count'] }}</td></tr>@endforeach</table>
<div class="page"></div><h2>التحليل الجغرافي</h2><p class="muted">المستفيدون والأسر: لقطة حالية. المساعدات: عمليات مجدولة خلال الفترة ومكتملة حالياً.</p>
<table><thead><tr><th>الحي</th><th>مستفيدون</th><th>يوميون</th><th>أسر</th><th>مساعدات</th></tr></thead><tbody>@foreach($a['neighborhoods']['list'] as $row)<tr><td>{{ $row['district'] ?? $row['name'] ?? $row['neighborhood'] ?? '' }}</td><td>{{ $row['general_beneficiaries'] ?? $row['general_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['daily_beneficiaries'] ?? $row['daily_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['families_count'] ?? 0 }}</td><td>{{ $row['baskets_distributed'] ?? 0 }}</td></tr>@endforeach</tbody></table>
<div class="page"></div><h2>المستودع والمخزون</h2><p class="muted">النظام يحتوي سجلي مخزون عام ويومي، ولا يحتوي سجل مواقع مستودعات مستقلاً. الكميات بوحداتها المسجلة ولا تجمع الوحدات المختلفة كمقياس مادي موحد.</p>
@foreach(['main'=>'المخزون العام','daily'=>'المخزون اليومي'] as $key=>$label)<h3>{{ $label }}</h3><table><tr><th>أصناف حالية</th><th>أصناف منخفضة حالياً</th><th>وارد خلال الفترة</th><th>صادر خلال الفترة</th></tr><tr><td>{{ $a['inventory'][$key]['total_items'] }}</td><td>{{ $a['inventory'][$key]['low_stock_count'] }}</td><td>{{ $a['inventory'][$key]['stock_in'] }}</td><td>{{ $a['inventory'][$key]['stock_out'] }}</td></tr></table>@endforeach
<h3>تنبيهات الصلاحية الحالية — المخزون اليومي</h3><table><tr><th>منتهي</th><th>خلال 5 أيام</th><th>8–30 يوماً</th><th>31–60 يوماً</th></tr><tr><td>{{ $a['inventory']['expiry_alerts']['expired_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_5_days_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_30_days_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_60_days_count'] }}</td></tr></table>
<div class="page"></div><h2>الجهات والعمليات الإدارية</h2><p>المنظمات المسجلة: {{ count($report['datasets']['organizations_snapshot']) }}. مناديب الأحياء: {{ $a['organizations']['total'] }}. يعرض الملحق السجلين بشكل مستقل؛ لا توجد علاقة تشغيلية مسجلة للمنظمات تسمح بإسناد المساعدات إليها.</p>
<p>الموظفون حالياً: {{ $a['staff']['total'] }}. المستخدمون النشطون: {{ $report['users_active'] }}. عمليات دعم الموظفين خلال الفترة: {{ $a['staff']['baskets_distributed'] }}.</p>
<h3>مناديب الأحياء</h3><table><thead><tr><th>الجهة / المندوب</th><th>الحي</th><th>السلال خلال الفترة</th></tr></thead><tbody>@foreach($a['organizations']['list'] as $row)<tr><td>{{ $row['name'] }}</td><td>{{ $row['neighborhood'] }}</td><td>{{ $row['baskets_received'] }}</td></tr>@endforeach</tbody></table>
<pagebreak /><h2>الحوكمة والتدقيق وجودة البيانات</h2>
<table><tr><th>نوع النشاط خلال الفترة</th><th>العدد</th></tr>@forelse($report['audit_actions'] as $action=>$count)<tr><td>{{ $action }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد أحداث تدقيق في الفترة</td></tr>@endforelse</table>
<table><tr><th>فحص جودة البيانات — حالياً</th><th>العدد</th></tr>@foreach(['missing_district'=>'حي غير مسجل','missing_category'=>'فئة غير مسجلة','missing_birth_date'=>'تاريخ ميلاد غير مسجل','negative_net_income'=>'دخل صافٍ سالب (مؤشر احتياج وليس خطأ تلقائياً)','delivered_without_date'=>'عملية مسلمة بلا تاريخ تسليم'] as $key=>$label)<tr><td>{{ $label }}</td><td>{{ $report['quality'][$key] }}</td></tr>@endforeach</table>
<p>عدد سجلات صيغ فئة ذوي/ذوو الاحتياجات الخاصة: {{ $report['categoryVariants']->count() }}. تبقى الفئات مستقلة إلى حين مراجعة المعنى واعتماد التوحيد.</p>
<h3>الإشعارات خلال الفترة</h3><p>تم إنشاء {{ $report['notifications']['total'] }} إشعاراً؛ منها {{ $report['notifications']['unread'] }} غير مقروء حالياً. العدد يمثل سجلات المستلمين وليس عدد الأحداث الفريدة.</p>
<h3>استنتاجات الإدارة</h3>@foreach($report['insights'] as $insight)<p>• {{ $insight }}</p>@endforeach
<p class="note">تراجع الإدارة الملفات الناقصة ومخاطر المخزون قبل اتخاذ قرار. لا يعادل غياب سجل تدقيق تأكيداً على عدم حدوث العملية.</p>
<div class="page"></div><h2>الملاحق التفصيلية</h2><p>جميع الصفوف المطابقة متاحة في ملف Excel المرافق؛ تُستبعد بيانات الدخول والحسابات البنكية ومسارات الوثائق. الجداول التالية تدعم مراجعة الأرصدة والجهات دون ازدحام الرسوم.</p>
@foreach(['main_stock_snapshot'=>'المخزون العام — حالياً','daily_stock_snapshot'=>'المخزون اليومي — حالياً','organizations_snapshot'=>'المنظمات المسجلة — حالياً'] as $key=>$label)<h3>{{ $label }}</h3><table><thead><tr><th>الاسم</th><th>الكمية / الرمز</th><th>الوحدة / الحالة</th></tr></thead><tbody>@forelse($report['datasets'][$key] as $row)<tr><td>{{ $row['name'] }}</td><td>{{ $row['current_quantity'] ?? $row['code'] ?? '' }}</td><td>{{ $row['unit'] ?? $row['status'] ?? '' }}</td></tr>@empty<tr><td colspan="3">لا توجد سجلات</td></tr>@endforelse</tbody></table>@endforeach
@endsection
