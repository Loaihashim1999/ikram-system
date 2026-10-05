@extends('pdf.letterhead_template', ['title' => 'سند استلام دعم - ' . ($beneficiary->full_name ?? $beneficiary->name)])

@section('content')
    <div class="doc-title">
        سند استلام دعم ومساعدة رسمية
    </div>

    <table class="info-table">
        <tr>
            <th>اسم المستفيد</th>
            <td>{{ $beneficiary->full_name ?? $beneficiary->name }}</td>
            <th>رقم الهوية / الإقامة</th>
            <td>{{ $beneficiary->national_id }}</td>
        </tr>
        <tr>
            <th>نوع المستفيد</th>
            <td>{{ ($beneficiary->beneficiary_type ?? $beneficiary->type) === 'citizen' ? 'مواطن' : 'مقيم' }}</td>
            <th>التصنيف المستحق</th>
            <td><span class="badge">{{ $beneficiary->priority === 'first_class' ? 'درجة أولى' : ($beneficiary->priority === 'second_class' ? 'درجة ثانية' : ($beneficiary->priority === 'special_needs' ? 'ذوو احتياجات خاصة' : ($beneficiary->priority === 'elderly' ? 'كبار السن' : ($beneficiary->priority === 'employee' ? 'موظف' : 'مستفيد')))) }}</span></td>
        </tr>
        <tr>
            <th>رقم التواصل</th>
            <td>{{ $beneficiary->phone }}</td>
            <th>المدينة والحي</th>
            <td>{{ $beneficiary->city }} - {{ $beneficiary->district }}</td>
        </tr>
        <tr>
            <th>نوع سلة الدعم</th>
            <td><strong>{{ $distribution->basket->name ?? 'سلة دعم مخصصة' }}</strong></td>
            <th>تاريخ الاستلام والمعالجة</th>
            <td>{{ \Carbon\Carbon::parse($distribution->scheduled_at)->format('Y-m-d') }}</td>
        </tr>
        <tr>
            <th>رمز الاستلام الرقمي (Barcode)</th>
            <td colspan="3" style="font-family: monospace; font-size: 14px; font-weight: bold; color: #8C6C26;">
                {{ $distribution->barcode_code }}
            </td>
        </tr>
    </table>

    @if($beneficiary->dependents && count($beneficiary->dependents) > 0)
        <h4 style="color: #3F6B3A; margin-top: 15px; margin-bottom: 5px;">جدول الأفراد التابعين للمعالية:</h4>
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>الاسم</th>
                    <th>صلة القرابة</th>
                    <th>تاريخ الميلاد</th>
                </tr>
            </thead>
            <tbody>
                @foreach($beneficiary->dependents as $idx => $dep)
                    <tr>
                        <td>{{ $idx + 1 }}</td>
                        <td>{{ $dep->name }}</td>
                        <td>{{ $dep->relationship }}</td>
                        <td>{{ $dep->date_of_birth }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div style="margin-top: 20px; font-size: 11px; color: #5C5C5C; border: 1px border #C9A24B; padding: 10px; background-color: #F7F5F0;">
        ⚠️ هذا السند إلكتروني معتمد وصادر من جمعية إكرام الجود لخدمة ضيوف الرحمن لتوثيق استلام المساعدات والسلال الغذائية.
    </div>

    <table style="width: 100%; margin-top: 40px;">
        <tr>
            <td style="text-align: right; width: 50%;">
                <strong>توقيع المستفيد / المندوب:</strong><br><br>
                ..........................................
            </td>
            <td style="text-align: left; width: 50%;">
                <strong>ختم الجمعية / المشرف:</strong><br><br>
                ..........................................
            </td>
        </tr>
    </table>
@endsection
