@extends('pdf.letterhead_template', ['title' => 'سند تسليم مندوب الحي - ' . ($representative->full_name ?? $representative->name)])

@section('content')
    <div class="doc-title">
        سند تسليم وتوزيع حادي لمندوب الحي
    </div>

    <table class="info-table">
        <tr>
            <th>اسم مندوب الحي</th>
            <td>{{ $representative->full_name ?? $representative->name }}</td>
            <th>رقم الهوية</th>
            <td>{{ $representative->national_id }}</td>
        </tr>
        <tr>
            <th>اسم الحي السكني</th>
            <td><strong style="color: #3F6B3A;">{{ $representative->district_name }}</strong></td>
            <th>رقم الجوال</th>
            <td>{{ $representative->phone }}</td>
        </tr>
        <tr>
            <th>عدد السلال المخصصة للحي</th>
            <td><strong style="color: #8C6C26; font-size: 14px;">{{ $representative->beneficiaries_count }} سلة</strong></td>
            <th>تاريخ التسليم والاعتماد</th>
            <td>{{ now()->format('Y-m-d') }}</td>
        </tr>
    </table>

    <h4 style="color: #3F6B3A; margin-top: 20px; margin-bottom: 5px;">قائمة المستفيدين المرتبطين بمندوب الحي المشمولين في التسليم:</h4>
    <table class="data-table">
        <thead>
            <tr>
                <th>#</th>
                <th>اسم المستفيد التابع للحي</th>
                <th>رقم الهوية</th>
                <th>رقم الجوال</th>
                <th>العنوان التفصيلي</th>
            </tr>
        </thead>
        <tbody>
            @foreach($linkedBeneficiaries as $idx => $b)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td><strong>{{ $b->full_name ?? $b->name }}</strong></td>
                    <td>{{ $b->national_id }}</td>
                    <td>{{ $b->phone }}</td>
                    <td>{{ $b->district ?? $representative->district_name }} ({{ $b->street ?? 'الشارع العام' }})</td>
                </tr>
            @endforeach
            @if(count($linkedBeneficiaries) === 0)
                <tr>
                    <td colspan="5" style="text-align: center; color: #8A8A8A; padding: 15px;">لم يتم ربط مستفيدين محددين بهذا المندوب بعد.</td>
                </tr>
            @endif
        </tbody>
    </table>

    <table style="width: 100%; margin-top: 40px;">
        <tr>
            <td style="text-align: right; width: 50%;">
                <strong>توقيع واقرار استلام مندوب الحي:</strong><br><br>
                ..........................................
            </td>
            <td style="text-align: left; width: 50%;">
                <strong>اعتماد وتختيم إدارة الجمعية:</strong><br><br>
                ..........................................
            </td>
        </tr>
    </table>
@endsection
