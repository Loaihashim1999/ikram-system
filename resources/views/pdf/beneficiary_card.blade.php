@extends('pdf.letterhead_template', ['title' => 'بطاقة المستفيد الرسمية'])

@section('content')
    <div class="doc-title">بطاقة بيانات المستفيد الرسمية</div>
    <table class="info-table">
        <tr><th>الاسم</th><td>{{ $beneficiary->full_name }}</td><th>رقم الهوية / الإقامة</th><td>{{ $beneficiary->national_id }}</td></tr>
        <tr><th>نوع المستفيد</th><td>{{ $beneficiary->beneficiary_type === 'resident' ? 'مقيم' : 'مواطن' }}</td><th>رقم الجوال</th><td>{{ $beneficiary->phone }}</td></tr>
        <tr><th>العنوان</th><td colspan="3">{{ collect([$beneficiary->city, $beneficiary->district, $beneficiary->street])->filter()->join(' - ') ?: 'غير مسجل' }}</td></tr>
        <tr><th>التصنيف التشغيلي الحالي</th><td>{{ $beneficiary->category?->name ?? 'غير محدد' }}</td><th>تاريخ الإصدار</th><td>{{ now()->format('Y-m-d') }}</td></tr>
    </table>

    <h4>البيانات الأسرية</h4>
    <table class="info-table">
        <tr><th>الحالة الأسرية</th><td>{{ $beneficiary->family_status ?: 'غير مسجلة' }}</td><th>عدد أفراد الأسرة</th><td>{{ $beneficiary->family_members_count ?? 'غير مسجل' }}</td></tr>
        <tr><th>نوع السكن</th><td>{{ $beneficiary->housing_type === 'rent' ? 'إيجار' : 'ملك' }}</td><th>الإيجار السنوي</th><td>{{ number_format((float) $beneficiary->annual_rent_amount, 2) }} ر.س</td></tr>
    </table>

    <h4>آخر تقييم سياسة محفوظ</h4>
    @if($evaluation)
        @php
            $incomeLabels = ['A' => 'أ', 'B' => 'ب', 'C' => 'ج', 'D' => 'د', 'financially_excluded' => 'مستبعد مالياً'];
            $scoreLabels = ['A' => 'أ', 'B' => 'ب', 'C' => 'ج', 'D' => 'د'];
            $decisionLabels = ['approved' => 'مقبول', 'rejected' => 'مرفوض'];
        @endphp
        <table class="info-table">
            <tr><th>نسخة السياسة التاريخية</th><td>{{ $evaluation->policyVersion?->version ?? 'غير متوفرة' }}</td><th>تاريخ التقييم</th><td>{{ $evaluation->evaluated_at?->format('Y-m-d H:i') }}</td></tr>
            <tr><th>الدخل المحتسب شهرياً</th><td>{{ number_format((float) $evaluation->gross_counted_income, 2) }} ر.س</td><th>الإيجار الشهري</th><td>{{ number_format((float) $evaluation->monthly_rent, 2) }} ر.س</td></tr>
            <tr><th>صافي دخل الأسرة المعدل</th><td>{{ number_format((float) $evaluation->adjusted_net_household_income, 2) }} ر.س</td><th>نصيب الفرد</th><td>{{ number_format((float) $evaluation->net_income_per_capita, 2) }} ر.س</td></tr>
            <tr><th>فئة الدخل</th><td>{{ $incomeLabels[$evaluation->income_category] ?? ($evaluation->income_category ?: 'غير محددة') }}</td><th>فئة النقاط</th><td>{{ $scoreLabels[$evaluation->score_category] ?? ($evaluation->score_category ?: 'غير محددة') }}</td></tr>
            <tr><th>درجة السياسة</th><td>{{ $evaluation->policy_score === null ? 'غير متوفرة' : number_format((float) $evaluation->policy_score, 2) }}</td><th>حجم الأسرة المحتسب</th><td>{{ $evaluation->family_size ?? 'غير متوفر' }}</td></tr>
            <tr><th>القرار الإداري</th><td>{{ $decision ? ($decisionLabels[$decision->decision] ?? $decision->decision) : 'لم يصدر قرار' }}</td><th>تاريخ القرار</th><td>{{ $decision?->decided_at?->format('Y-m-d H:i') ?? '—' }}</td></tr>
        </table>
        @if($decision?->human_readable_reason)
            <div class="wrap" style="padding:8px;border:1px solid #D0D0D0;background:#FAF8F5"><strong>سبب القرار:</strong> {{ $decision->human_readable_reason }}</div>
        @endif
    @else
        <div style="padding:12px;border:1px solid #D0D0D0;background:#FAF8F5">لا يوجد تقييم سياسة مكتمل محفوظ لهذا المستفيد.</div>
    @endif
@endsection
