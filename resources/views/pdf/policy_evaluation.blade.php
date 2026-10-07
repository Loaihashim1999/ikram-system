@extends('pdf.letterhead_template', ['title' => 'تقرير تقييم السياسة'])
@section('content')
@php
use App\Services\BeneficiaryPolicy\PolicyScoreBreakdown;
use App\Support\Documents\DocumentLabels;
$breakdown = PolicyScoreBreakdown::fromSnapshot($evaluation->scoring_snapshot);
$blockers = is_array($evaluation->scoring_snapshot['blockers'] ?? null) ? $evaluation->scoring_snapshot['blockers'] : [];
@endphp
<div class="doc-title">تقرير تقييم السياسة</div>
<h2 class="pdf-section">ملخص المستفيد</h2>
<table class="info-table">
<tr><th>الاسم</th><td>{{ $beneficiary->full_name }}</td><th>صفة المستفيد</th><td>{{ DocumentLabels::text($beneficiary->beneficiary_type) }}</td></tr>
<tr><th>مرجع الملف</th><td>{{ $beneficiary->national_id }}</td><th>الحالة الأسرية</th><td>{{ DocumentLabels::text($beneficiary->family_status) ?: 'غير مسجلة' }}</td></tr>
</table>
<h2 class="pdf-section">التقييم المحفوظ</h2>
<table class="info-table">
<tr><th>إصدار السياسة</th><td>{{ $evaluation->policyVersion?->version ?? 'غير متوفرة' }}</td><th>تاريخ التقييم</th><td>{{ $evaluation->evaluated_at?->format('Y-m-d H:i') }}</td></tr>
<tr><th>مجموع النقاط</th><td>{{ $evaluation->policy_score === null ? 'غير متوفرة' : number_format((float) $evaluation->policy_score, 2) }}</td><th>الفئة</th><td>{{ DocumentLabels::text($evaluation->score_category) ?: 'غير محددة' }}</td></tr>
<tr><th>فئة الدخل</th><td>{{ DocumentLabels::text($evaluation->income_category) ?: 'غير محددة' }}</td><th>نتيجة الاستحقاق</th><td>{{ $decision ? DocumentLabels::text($decision->decision) : 'لم يصدر قرار' }}</td></tr>
<tr><th>الدخل المحتسب</th><td>{{ number_format((float) $evaluation->gross_counted_income, 2) }} ر.س</td><th>نصيب الفرد</th><td>{{ number_format((float) $evaluation->net_income_per_capita, 2) }} ر.س</td></tr>
</table>
@if($decision?->human_readable_reason)
<div class="pdf-note">{{ $decision->human_readable_reason }}</div>
@endif
<h2 class="pdf-section">تفصيل النقاط</h2>
@if($breakdown === [])
<p>لا يوجد تفصيل محفوظ لهذا التقييم.</p>
@else
<table class="data-table"><thead><tr><th>البند</th><th>القيمة المستخدمة</th><th>الشرط</th><th>النقاط</th><th>الحد الأعلى</th><th>السبب</th></tr></thead><tbody>
@foreach($breakdown as $row)
<tr>
<td>{{ $row['label'] ?? DocumentLabels::text($row['rule_id'] ?? '') }}</td>
<td>{{ is_scalar($row['value'] ?? null) ? DocumentLabels::text($row['value']) : '—' }}</td>
<td>{{ is_scalar($row['condition'] ?? null) ? $row['condition'] : '—' }}</td>
<td>{{ $row['awarded_points'] ?? '—' }}</td>
<td>{{ $row['max_points'] ?? '—' }}</td>
<td>{{ $row['reason'] ?? '—' }}</td>
</tr>
@endforeach
</tbody></table>
@endif
@if($blockers !== [])
<h2 class="pdf-section">موانع المراجعة</h2>
<ul>@foreach($blockers as $blocker)<li>{{ DocumentLabels::text(is_array($blocker) ? ($blocker['code'] ?? '') : $blocker) }}</li>@endforeach</ul>
@endif
@endsection
