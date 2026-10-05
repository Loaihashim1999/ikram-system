@extends('pdf.letterhead_template', ['title' => 'سند استلام موظف - ' . ($staff->name ?? 'موظف الجمعية')])

@section('content')
    <div class="doc-title">
        سند استلام ومكافأة موظف الجمعية الرسمي
    </div>

    <table class="info-table">
        <tr>
            <th>اسم الموظف الكامل</th>
            <td><strong>{{ $staff->name }}</strong></td>
            <th>رقم الهوية / الإقامة</th>
            <td style="font-family: monospace; font-weight: bold;">{{ $staff->national_id }}</td>
        </tr>
        <tr>
            <th>المسمى الوظيفي</th>
            <td><strong style="color: #8C6C26;">{{ $staff->job_title }}</strong></td>
            <th>القسم / الإدارة</th>
            <td>{{ $staff->department ?? 'عام' }}</td>
        </tr>
        <tr>
            <th>رقم الجوال والتواصل</th>
            <td style="font-family: monospace;">{{ $staff->phone }}</td>
            <th>تاريخ التعيين</th>
            <td>{{ $staff->hire_date ? \Carbon\Carbon::parse($staff->hire_date)->format('Y-m-d') : '—' }}</td>
        </tr>
        <tr>
            <th>حالة الموظف الحالية</th>
            <td>
                <span class="badge" style="background-color: #e6f4ea; color: #137333;">
                    {{ $staff->status === 'active' ? 'نشط' : ($staff->status === 'on_leave' ? 'إجازة' : 'منتهي الخدمة') }}
                </span>
            </td>
            <th>عدد أفراد الأسرة</th>
            <td>{{ $staff->family_members_count ?? 1 }} فرد</td>
        </tr>
    </table>

    @if(isset($distributions) && count($distributions) > 0)
        <h4 style="color: #3F6B3A; margin-top: 15px; margin-bottom: 5px;">سجل السلال والمستندات المسلمة للموظف:</h4>
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>تاريخ الاستلام</th>
                    <th>نوع السلة / الدعم</th>
                    <th>رمز الاستلام الرقمي (Barcode)</th>
                    <th>حالة التسليم</th>
                </tr>
            </thead>
            <tbody>
                @foreach($distributions as $idx => $d)
                    <tr>
                        <td>{{ $idx + 1 }}</td>
                        <td style="font-family: monospace;">{{ $d->delivered_at ? \Carbon\Carbon::parse($d->delivered_at)->format('Y-m-d') : ($d->scheduled_at ? \Carbon\Carbon::parse($d->scheduled_at)->format('Y-m-d') : '—') }}</td>
                        <td><strong>{{ $d->basket->name ?? 'سلة دعم مخصصة' }}</strong></td>
                        <td style="font-family: monospace; font-weight: bold; color: #8C6C26;">{{ $d->barcode_code ?? '—' }}</td>
                        <td>{{ $d->status === 'delivered' ? 'تم التسليم ✅' : 'قيد المعالجة ⏳' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <div style="margin-top: 15px; text-align: center; font-size: 12px; color: #777; padding: 15px; background: #fafafa; border: 1px dashed #ccc; border-radius: 8px;">
            لا توجد سلال استلام سابقة مسجلة بهذا السند للموظف.
        </div>
    @endif

    @if($staff->dependents && count($staff->dependents) > 0)
        <h4 style="color: #3F6B3A; margin-top: 15px; margin-bottom: 5px;">جدول الأفراد التابعين للمعالية:</h4>
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>اسم التابع الكامل</th>
                    <th>صلة القرابة</th>
                    <th>تاريخ الميلاد</th>
                </tr>
            </thead>
            <tbody>
                @foreach($staff->dependents as $idx => $dep)
                    <tr>
                        <td>{{ $idx + 1 }}</td>
                        <td>{{ $dep->name }}</td>
                        <td>{{ $dep->relationship }}</td>
                        <td style="font-family: monospace;">{{ $dep->date_of_birth }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div style="margin-top: 20px; font-size: 11px; color: #5C5C5C; border: 1px border #C9A24B; padding: 10px; background-color: #F7F5F0; border-radius: 6px;">
        📄 هذا المستند وسند الاستلام معتمد رسمياً وصادر من جمعية إكرام الجود لخدمة ضيوف الرحمن لتوثيق استلام الموظفين للدعم والمستحقات المعتمدة.
    </div>

    <table style="width: 100%; margin-top: 35px;">
        <tr>
            <td style="text-align: right; width: 50%;">
                <strong>توقيع الموظف المستلم:</strong><br><br>
                ..........................................
            </td>
            <td style="text-align: left; width: 50%;">
                <strong>ختم الجمعية والإدارة:</strong><br><br>
                ..........................................
            </td>
        </tr>
    </table>
@endsection
