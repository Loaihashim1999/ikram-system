@extends('pdf.letterhead_template', ['title' => 'بطاقة المستفيد الرسمية'])
@section('content')
@php
use App\Services\BeneficiaryPolicy\PolicyScoreBreakdown;
use App\Support\Documents\DocumentLabels;
$breakdown = $evaluation ? PolicyScoreBreakdown::fromSnapshot($evaluation->scoring_snapshot) : [];
@endphp
<div class="doc-title">بطاقة بيانات المستفيد الرسمية</div>
<h2 class="pdf-section">بيانات المستفيد</h2>
<table class="info-table">
<tr><th>الاسم</th><td>{{ $beneficiary->full_name }}</td><th>رقم الهوية / الإقامة</th><td>{{ $beneficiary->national_id }}</td></tr>
<tr><th>صفة المستفيد</th><td>{{ DocumentLabels::text($beneficiary->beneficiary_type) }}</td><th>رقم الجوال</th><td dir="ltr">{{ $beneficiary->phone }}</td></tr>
<tr><th>العنوان</th><td colspan="3">{{ collect([$beneficiary->city, $beneficiary->district, $beneficiary->street])->filter()->join(' - ') ?: 'غير مسجل' }}</td></tr>
<tr><th>التصنيف التشغيلي الحالي</th><td>{{ $beneficiary->category?->name ?? 'غير محدد' }}</td><th>تاريخ الإصدار</th><td>{{ now()->format('Y-m-d') }}</td></tr>
<tr><th>الحالة</th><td>{{ DocumentLabels::text($beneficiary->status) ?: 'غير محددة' }}</td><th></th><td></td></tr>
</table>
<h2 class="pdf-section">بيانات الأسرة</h2>
<table class="info-table">
<tr><th>الحالة الأسرية</th><td>{{ DocumentLabels::text($beneficiary->family_status) ?: 'غير مسجلة' }}</td><th>عدد أفراد الأسرة</th><td>{{ $beneficiary->family_members_count ?? 'غير مسجل' }}</td></tr>
<tr><th>نوع السكن</th><td>{{ DocumentLabels::text($beneficiary->housing_type) ?: 'غير مسجل' }}</td><th>الإيجار السنوي</th><td>{{ number_format((float) $beneficiary->annual_rent_amount, 2) }} ر.س</td></tr>
</table>
<h2 class="pdf-section">السياسة والاستحقاق</h2>
@if($evaluation)
<table class="info-table">
<tr><th>إصدار السياسة</th><td>{{ $evaluation->policyVersion?->version ?? 'غير متوفرة' }}</td><th>تاريخ التقييم</th><td>{{ $evaluation->evaluated_at?->format('Y-m-d H:i') }}</td></tr>
<tr><th>مجموع النقاط</th><td>{{ $evaluation->policy_score === null ? 'غير متوفرة' : number_format((float) $evaluation->policy_score, 2) }}</td><th>الفئة</th><td>{{ DocumentLabels::text($evaluation->score_category) ?: 'غير محددة' }}</td></tr>
<tr><th>فئة الدخل</th><td>{{ DocumentLabels::text($evaluation->income_category) ?: 'غير محددة' }}</td><th>نتيجة الاستحقاق</th><td>{{ $decision ? DocumentLabels::text($decision->decision) : 'لم يصدر قرار' }}</td></tr>
<tr><th>الدخل المحتسب شهرياً</th><td>{{ number_format((float) $evaluation->gross_counted_income, 2) }} ر.س</td><th>الإيجار الشهري</th><td>{{ number_format((float) $evaluation->monthly_rent, 2) }} ر.س</td></tr>
<tr><th>صافي دخل الأسرة المعدل</th><td>{{ number_format((float) $evaluation->adjusted_net_household_income, 2) }} ر.س</td><th>نصيب الفرد</th><td>{{ number_format((float) $evaluation->net_income_per_capita, 2) }} ر.س</td></tr>
</table>
@if($decision?->human_readable_reason)
<div class="pdf-note"><strong>سبب القرار:</strong> {{ $decision->human_readable_reason }}</div>
@endif
@if($breakdown !== [])
<h3>تفصيل النقاط</h3>
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
@else
<div class="pdf-note">لا يوجد تقييم سياسة مكتمل محفوظ لهذا المستفيد.</div>
@endif
@endsection
