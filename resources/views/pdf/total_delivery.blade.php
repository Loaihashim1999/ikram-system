@extends('pdf.letterhead_template', ['title' => 'سند الاستلام الشامل التاريخي'])

@section('content')
    <div class="doc-title">
        سند الاستلام الشامل لسجل التوزيعات التاريخي
    </div>

    <table class="info-table">
        <tr>
            <th>اسم المستفيد / المندوب</th>
            <td>{{ $beneficiary->full_name ?? $beneficiary->name }}</td>
            <th>رقم الهوية / الإقامة</th>
            <td>{{ $beneficiary->national_id }}</td>
        </tr>
        <tr>
            <th>إجمالي المرات التي استلم فيها سلال</th>
            <td><strong style="color: #3F6B3A; font-size: 14px;">{{ count($distributions) }} مرة</strong></td>
            <th>تاريخ إخراج هذا التقرير</th>
            <td>{{ now()->format('Y-m-d H:i') }}</td>
        </tr>
    </table>

    <h4 style="color: #3F6B3A; margin-top: 20px; margin-bottom: 5px;">السجل الكامل لجميع عمليات الاستلام والتوزيع:</h4>
    <table class="data-table">
        <thead>
            <tr>
                <th>#</th>
                <th>نوع سلة الدعم</th>
                <th>تاريخ التوزيع</th>
                <th>رمز الباركود</th>
                <th>حالة الاستلام</th>
                <th>نقطة الاستلام</th>
            </tr>
        </thead>
        <tbody>
            @foreach($distributions as $idx => $d)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td><strong>{{ $d->basket->name ?? 'سلة دعم' }}</strong></td>
                    <td>{{ \Carbon\Carbon::parse($d->scheduled_at)->format('Y-m-d') }}</td>
                    <td style="font-family: monospace; font-weight: bold;">{{ $d->barcode_code }}</td>
                    <td>
                        <span class="badge" style="{{ $d->status === 'delivered' ? 'background-color: #EBF4EA; color: #223B1E;' : '' }}">
                            {{ $d->status === 'delivered' ? 'تم الاستلام ✓' : 'قيد الانتظار' }}
                        </span>
                    </td>
                    <td>{{ $d->pickup_location ?? 'مقر الجمعية الرئيسي' }}</td>
                </tr>
            @endforeach
            @if(count($distributions) === 0)
                <tr>
                    <td colspan="6" style="text-align: center; color: #8A8A8A; padding: 15px;">لا توجد عمليات استلام مسجلة لهذا المستفيد حتى الآن.</td>
                </tr>
            @endif
        </tbody>
    </table>

    <div style="margin-top: 30px; text-align: left; font-size: 11px; color: #5C5C5C;">
        توقيع المشرف العام: ........................................
    </div>
@endsection
