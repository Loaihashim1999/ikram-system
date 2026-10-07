@extends('pdf.letterhead_template', ['title' => 'التقرير الشامل للحوكمة'])
@section('styles')
body { font-size: 9pt; line-height: 1.25; }
h1 { font-size: 13pt; margin: 0 0 1mm; line-height: 1.2; }
h2 { font-size: 11pt; color: #1F4D3A; border-bottom: 0.25mm solid #A6843D; margin: 2mm 0 1mm; padding-bottom: 0.4mm; page-break-after: avoid; }
h3 { font-size: 10pt; color: #806523; margin: 1mm 0; page-break-after: avoid; }
p { margin: 0.5mm 0 1mm; line-height: 1.25; }
table { width: 100%; border-collapse: collapse; margin: 1mm 0 1.5mm; }
th, td { padding: 0.8mm 1.2mm; font-size: 8.5pt; }
.muted { font-size: 8pt; }
.kpi td { background: #F7F3EA; width: 25%; text-align: center; }
.value { font-size: 12pt; color: #1F4D3A; font-weight: bold; }
.chart { margin: 0 0 1.5mm; }
.pair td { width: 50%; border: 0; vertical-align: top; padding: 0 1mm; }
.note { background: #F7F3EA; padding: 1.2mm; border-right: 0.6mm solid #A6843D; font-size: 8pt; }
@endsection
@section('content')
@php
$a = $report['analytics'];
$ops = $a['operational_metrics'] ?? [];
$nat = $a['nationality_analysis'];
@endphp
<h1 class="doc-title">التقرير الشامل للحوكمة</h1>
<p class="muted">{{ $a['period']['start_date'] }} إلى {{ $a['period']['end_date'] }} — {{ $report['generated_by'] }} — {{ $report['generated_at'] }}</p>
<div class="note">مؤشرات الفترة تتبع التواريخ المحددة. مؤشرات اللقطة تصف السجلات الآن، وليست رصيداً تاريخياً عند نهاية الفترة.</div>
<h2>الملخص التنفيذي</h2>
<table class="kpi"><tr>
<td><span class="value">{{ $a['beneficiaries']['total'] ?? 0 }}</span><br>مستفيدون الآن</td>
<td><span class="value">{{ $a['beneficiaries']['active'] ?? 0 }}</span><br>نشطون الآن</td>
<td><span class="value">{{ $a['beneficiaries']['registered_in_period'] ?? 0 }}</span><br>تسجيل الفترة</td>
<td><span class="value">{{ $a['daily_beneficiaries']['total'] ?? 0 }}</span><br>يوميون الآن</td>
</tr><tr>
<td><span class="value">{{ $ops['total_due'] ?? 0 }}</span><br>مستحق خلال الفترة</td>
<td><span class="value">{{ $ops['completed_by_cutoff'] ?? 0 }}</span><br>مكتمل حتى نهاية الفترة</td>
<td><span class="value">{{ $ops['not_completed'] ?? 0 }}</span><br>غير مكتمل</td>
<td><span class="value">{{ $ops['overdue'] ?? 0 }}</span><br>متأخر</td>
</tr></table>
@foreach(array_slice($report['insights'] ?? [], 0, 3) as $insight)<p>• {{ $insight }}</p>@endforeach

<pagebreak />
<h2>المستفيدون والسياسة والدعم</h2>
<table><tr><th>المؤشر المالي الحالي</th><th>ريال</th><th>المؤشر المحفوظ من التقييم</th><th>ريال</th></tr>
@php $finance = ['total_income'=>'إجمالي الدخل','monthly_rent'=>'الإيجار','net_income'=>'صافي الدخل','average_income'=>'متوسط الدخل']; $saved = ['gross_counted_income'=>'الدخل المحتسب','monthly_rent'=>'الإيجار','adjusted_net_household_income'=>'صافي الأسرة','net_income_per_capita'=>'نصيب الفرد']; $savedKeys = array_keys($saved); $i = 0; @endphp
@foreach($finance as $key=>$label)
<tr><td>{{ $label }}</td><td>{{ number_format($report['finance'][$key] ?? 0, 2) }}</td><td>{{ $saved[$savedKeys[$i]] }}</td><td>{{ number_format($report['policy_finance'][$savedKeys[$i]] ?? 0, 2) }}</td></tr>
@php $i++; @endphp
@endforeach
</table>
<table><tr><th>نتيجة السياسة</th><th>العدد</th><th>حالة الدعم</th><th>العدد</th></tr>
@php $outcomes = $report['policy_outcomes'] ?: ['—' => 0]; $statuses = $report['support_statuses'] ?: ['—' => 0]; $rows = max(count($outcomes), count($statuses)); $outcomeRows = array_values($outcomes); $outcomeKeys = array_keys($outcomes); $statusRows = array_values($statuses); $statusKeys = array_keys($statuses); @endphp
@for($n = 0; $n < $rows; $n++)
<tr><td>{{ isset($outcomeKeys[$n]) ? \App\Support\Documents\DocumentLabels::text($outcomeKeys[$n]) : '' }}</td><td>{{ $outcomeRows[$n] ?? '' }}</td><td>{{ isset($statusKeys[$n]) ? \App\Support\Documents\DocumentLabels::text($statusKeys[$n]) : '' }}</td><td>{{ $statusRows[$n] ?? '' }}</td></tr>
@endfor
</table>
<h2>تحليل الجنسية</h2>
<table><tr><th>الجنسية</th><th>مسجلون</th><th>نشطون</th><th>مخدومون</th></tr>
@foreach($nat['chart']['categories'] as $category)
@php $key = $category['key']; $buckets = collect($nat['populations']['registered']['buckets'])->keyBy('key'); $active = collect($nat['populations']['active']['buckets'])->keyBy('key'); $served = collect($nat['populations']['served']['buckets'])->keyBy('key'); @endphp
<tr><td>{{ $category['label'] }}</td><td>{{ $buckets[$key]['count'] ?? 0 }}</td><td>{{ $active[$key]['count'] ?? 0 }}</td><td>{{ $served[$key]['count'] ?? 0 }}</td></tr>
@endforeach
<tr><td>المجموع</td><td>{{ $nat['populations']['registered']['total'] }}</td><td>{{ $nat['populations']['active']['total'] }}</td><td>{{ $nat['populations']['served']['total'] }}</td></tr>
</table>

<pagebreak />
<h2>النشاط التشغيلي والمخزون</h2>
<p class="muted">تشمل مؤشرات التشغيل الاستلام المباشر وتوصيل المنازل.</p>
<table class="kpi"><tr>
<td><span class="value">{{ $ops['unique_due_beneficiaries'] ?? 0 }}</span><br>مستفيدون مستحقون</td>
<td><span class="value">{{ $ops['unique_completed_beneficiaries'] ?? 0 }}</span><br>اكتمل دعمهم</td>
<td><span class="value">{{ $report['received_operations'] ?? 0 }}</span><br>استلام فعلي</td>
<td><span class="value">{{ $a['daily_beneficiaries']['transactions_count'] ?? 0 }}</span><br>عمليات يومية</td>
</tr></table>
<table><tr><th>المخزون</th><th>أصناف</th><th>منخفض</th><th>وارد الفترة</th><th>صادر الفترة</th></tr>
@foreach(['main'=>'عام','daily'=>'يومي'] as $key=>$label)
<tr><td>{{ $label }}</td><td>{{ $a['inventory'][$key]['total_items'] ?? 0 }}</td><td>{{ $a['inventory'][$key]['low_stock_count'] ?? 0 }}</td><td>{{ $a['inventory'][$key]['stock_in'] ?? 0 }}</td><td>{{ $a['inventory'][$key]['stock_out'] ?? 0 }}</td></tr>
@endforeach
<tr><td>صلاحية اليومي</td><td colspan="4">منتهي {{ $a['inventory']['expiry_alerts']['expired_count'] ?? 0 }} — خلال 5 أيام {{ $a['inventory']['expiry_alerts']['in_5_days_count'] ?? 0 }} — حتى 30 يوماً {{ $a['inventory']['expiry_alerts']['in_30_days_count'] ?? 0 }} — حتى 60 يوماً {{ $a['inventory']['expiry_alerts']['in_60_days_count'] ?? 0 }}</td></tr>
</table>
<p class="muted">الجهات: {{ count($report['datasets']['organizations_snapshot'] ?? []) }}. الموظفون: {{ $a['staff']['total'] ?? 0 }}. إشعارات الفترة: {{ $report['notifications']['total'] ?? 0 }}، غير المقروء {{ $report['notifications']['unread'] ?? 0 }}.</p>
<table><tr><th>فحص الجودة</th><th>العدد</th></tr>
@foreach(['missing_district'=>'حي غير مسجل','missing_category'=>'فئة غير مسجلة','missing_birth_date'=>'تاريخ ميلاد غير مسجل','negative_net_income'=>'دخل صافٍ سالب','delivered_without_date'=>'تسليم بلا تاريخ'] as $key=>$label)
<tr><td>{{ $label }}</td><td>{{ $report['quality'][$key] ?? 0 }}</td></tr>
@endforeach
</table>
@php $districts = array_slice($a['neighborhoods']['list'] ?? [], 0, 8); @endphp
@if($districts !== [])
<table><tr><th>الحي</th><th>مستفيدون</th><th>يوميون</th><th>مساعدات</th></tr>
@foreach($districts as $row)<tr><td>{{ $row['district'] ?? $row['name'] ?? $row['neighborhood'] ?? '' }}</td><td>{{ $row['general_beneficiaries'] ?? $row['general_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['daily_beneficiaries'] ?? $row['daily_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['baskets_distributed'] ?? 0 }}</td></tr>@endforeach
</table>
@endif

<pagebreak />
<h2>الرسوم التحليلية</h2>
{!! \App\Support\Pdf\GovernanceCharts::columns($a['charts']['column_chart']['data'] ?? []) !!}
{!! \App\Support\Pdf\GovernanceCharts::line($a['charts']['line_chart']['data'] ?? []) !!}

<pagebreak />
{!! \App\Support\Pdf\GovernanceCharts::distribution($a['charts']['funnel_chart']['stages'] ?? [], $a['charts']['pie_chart']['data'] ?? []) !!}
<table class="kpi"><tr>
<td><span class="value">{{ $ops['total_due'] ?? 0 }}</span><br>مستحق</td>
<td><span class="value">{{ $ops['completed_by_cutoff'] ?? 0 }}</span><br>مكتمل</td>
<td><span class="value">{{ $ops['not_completed'] ?? 0 }}</span><br>غير مكتمل</td>
<td><span class="value">{{ $ops['overdue'] ?? 0 }}</span><br>متأخر</td>
</tr></table>
<p class="note">التفاصيل الصفية الكاملة في ملف إكسل المرافق. لا يعادل غياب سجل تدقيق تأكيداً على عدم حدوث العملية.</p>
@endsection
