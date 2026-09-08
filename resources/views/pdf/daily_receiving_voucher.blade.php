@extends('pdf.letterhead_template', ['title' => 'سند استلام مساعدة للمستفيد اليومي - ' . $transaction->document_number])

@section('content')

    <div class="doc-title">
        سند استلام مساعدة للمستفيدين اليوميين
    </div>

    <table style="width: 100%; margin-bottom: 12px; font-size: 11px;">
        <tr>
            <td style="text-align: right; width: 50%;">
                <strong>رقم السند:</strong> <span style="color: #8C6C26; font-weight: bold; font-size: 13px;">{{ $transaction->document_number }}</span>
            </td>
            <td style="text-align: left; width: 50%;">
                <strong>تاريخ ووقت الاستلام:</strong> {{ \Carbon\Carbon::parse($transaction->receiving_date)->format('Y/m/d - H:i') }}
            </td>
        </tr>
    </table>

    {{-- بيانات المستفيد --}}
    <table class="info-table">
        <tr>
            <th colspan="4" style="background-color: #EBF4EA; color: #223B1E; font-size: 12px; text-align: center;">
                بيانات المستفيد اليومي
            </th>
        </tr>
        <tr>
            <th>اسم المستفيد الرباعي</th>
            <td><strong>{{ $transaction->beneficiary->full_name ?? 'غير محدد' }}</strong></td>
            <th>رقم الهوية / الإقامة</th>
            <td><strong style="letter-spacing: 1px;">{{ $transaction->beneficiary->national_id ?? 'غير متوفر' }}</strong></td>
        </tr>
        <tr>
            <th>رقم الجوال</th>
            <td>{{ $transaction->beneficiary->phone ?? 'غير متوفر' }}</td>
            <th>الحي السكني</th>
            <td>{{ $transaction->beneficiary->district ?? 'غير محدد' }}</td>
        </tr>
        <tr>
            <th>الفئة المسجلة</th>
            <td>{{ $transaction->beneficiary->category_name ?? 'أسر متعففة' }}</td>
            <th>إجمالي مرات الاستلام</th>
            <td><span class="badge">{{ $transaction->beneficiary->total_received_count ?? 1 }} مرات</span></td>
        </tr>
    </table>

    {{-- بيانات المساعدة المستلمة --}}
    <table class="info-table">
        <tr>
            <th colspan="4" style="background-color: #F5EDDA; color: #8C6C26; font-size: 12px; text-align: center;">
                تفاصيل المساعدة المستلمة
            </th>
        </tr>
        <tr>
            <th>نوع السلة / المادة</th>
            <td colspan="3"><strong style="color: #2E5A27; font-size: 12px;">{{ $transaction->basket_type_name }}</strong></td>
        </tr>
        <tr>
            <th>الكمية المصروفة</th>
            <td><strong>{{ $transaction->quantity }} {{ $transaction->inventoryItem->unit ?? 'سلة' }}</strong></td>
            <th>المستودع المصروف منه</th>
            <td>مستودع المستفيدين اليوميين</td>
        </tr>
        <tr>
            <th>الموظف المعتمد للصرف</th>
            <td>{{ $transaction->authorizedUser->full_name ?? 'مدير النظام' }}</td>
            <th>حالة السند</th>
            <td><span class="badge" style="background-color: #EBF4EA; color: #223B1E;">تم الاستلام والتسليم</span></td>
        </tr>
        @if($transaction->notes)
        <tr>
            <th>ملاحظات إضافية</th>
            <td colspan="3">{{ $transaction->notes }}</td>
        </tr>
        @endif
    </table>

    {{-- الإقرار والتعهد --}}
    <div style="margin-top: 15px; padding: 10px; border: 1px dashed #C9A24B; background-color: #FAF8F5; border-radius: 4px; font-size: 10px; line-height: 1.6; text-align: justify;">
        <strong>إقرار الاستلام:</strong> أقر أنا المستفيد الموضح بياناتي أعلاه بأنني قد استلمت كامل المساعدة العينية المقررة لي من جمعية إكرام لحفظ الطعام بحالة سليمة وجيدة، وذلك للاستفادة الأسرية الشخصية، والله على ما أقول شهيد.
    </div>

    {{-- التوقيعات --}}
    <table style="width: 100%; margin-top: 35px; border-collapse: collapse; text-align: center;">
        <tr>
            <td style="width: 33%; vertical-align: top;">
                <strong>المستفيد المستلم:</strong><br><br>
                <div style="font-size: 11px; color: #555;">{{ $transaction->beneficiary->full_name ?? '' }}</div><br>
                <span>التوقيع: ............................</span>
            </td>
            <td style="width: 33%; vertical-align: top;">
                <strong>الموظف المختص:</strong><br><br>
                <div style="font-size: 11px; color: #555;">{{ $transaction->authorizedUser->full_name ?? 'إدارة الجمعية' }}</div><br>
                <span>التوقيع: ............................</span>
            </td>
            <td style="width: 34%; vertical-align: top;">
                <strong>ختم الجمعية الرسمي:</strong><br><br>
                <div style="width: 90px; height: 90px; border: 1.5px dashed #C9A24B; border-radius: 50%; margin: 0 auto; line-height: 90px; color: #C9A24B; font-size: 10px;">
                    ختم الاعتماد
                </div>
            </td>
        </tr>
    </table>

@endsection
