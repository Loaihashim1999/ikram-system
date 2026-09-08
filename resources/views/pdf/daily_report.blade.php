<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $title ?? 'التقرير اليومي لعمليات التوزيع والمساعدات' }}</title>
    <style>
        @page {
            margin-top: 25mm;
            margin-bottom: 20mm;
            margin-left: 15mm;
            margin-right: 15mm;
        }
        body {
            font-family: 'xbriyaz', 'tajawal', 'cairo', 'DejaVu Sans', sans-serif;
            color: #1A1A1A;
            font-size: 10px;
            line-height: 1.4;
            direction: rtl;
            text-align: right;
        }
        .header-table {
            width: 100%;
            border-bottom: 2px solid #C9A24B;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        .header-title {
            font-size: 16px;
            font-weight: bold;
            color: #2E5A27;
            text-align: center;
        }
        .header-subtitle {
            font-size: 12px;
            color: #8C6C26;
            text-align: center;
            margin-top: 4px;
        }
        .kpi-table {
            width: 100%;
            margin-bottom: 15px;
            border-collapse: collapse;
        }
        .kpi-card {
            border: 1px solid #D0D0D0;
            background-color: #FAF8F5;
            padding: 8px;
            text-align: center;
            border-radius: 4px;
        }
        .kpi-val {
            font-size: 15px;
            font-weight: bold;
            color: #2E5A27;
        }
        .kpi-lbl {
            font-size: 9px;
            color: #666;
            margin-top: 2px;
        }
        .section-heading {
            font-size: 12px;
            font-weight: bold;
            color: #2E5A27;
            background-color: #EBF4EA;
            padding: 5px 8px;
            border-right: 4px solid #3F6B3A;
            margin-top: 12px;
            margin-bottom: 6px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .data-table th {
            background-color: #F5EDDA;
            color: #8C6C26;
            border: 1px solid #D0D0D0;
            padding: 5px;
            font-size: 9px;
            font-weight: bold;
            text-align: center;
        }
        .data-table td {
            border: 1px solid #E0E0E0;
            padding: 5px;
            font-size: 9px;
            text-align: center;
        }
        .badge {
            display: inline-block;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: bold;
            background-color: #EBF4EA;
            color: #2E5A27;
        }
        .footer-signatures {
            width: 100%;
            margin-top: 25px;
            border-collapse: collapse;
            text-align: center;
        }
    </style>
</head>
<body>

    {{-- ترويسة التقرير اليومي --}}
    <table class="header-table">
        <tr>
            <td style="width: 25%; text-align: right;">
                <strong style="color: #2E5A27; font-size: 12px;">جمعية إكرام لحفظ الطعام</strong><br>
                <span style="font-size: 9px; color: #666;">المملكة العربية السعودية</span>
            </td>
            <td style="width: 50%; text-align: center;">
                <div class="header-title">التقرير اليومي للمساعدات والتوزيع</div>
                <div class="header-subtitle">ليوم: {{ \Carbon\Carbon::parse($date)->translatedFormat('l d F Y') }}</div>
            </td>
            <td style="width: 25%; text-align: left; font-size: 9px; color: #666;">
                <strong>تاريخ الطباعة:</strong> {{ now()->format('Y/m/d H:i') }}<br>
                <strong>المستخدم:</strong> {{ auth()->user()->full_name ?? 'مدير النظام' }}
            </td>
        </tr>
    </table>

    {{-- كروت المؤشرات السريعة لليوم --}}
    <table class="kpi-table">
        <tr>
            <td style="width: 25%; padding: 4px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $dailyReceivingCount }}</div>
                    <div class="kpi-lbl">استلامات المستفيدين اليوميين</div>
                </div>
            </td>
            <td style="width: 25%; padding: 4px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $dailyBasketsCount }}</div>
                    <div class="kpi-lbl">سلال المستفيدين اليوميين</div>
                </div>
            </td>
            <td style="width: 25%; padding: 4px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $generalDeliveriesCount }}</div>
                    <div class="kpi-lbl">تسليمات التوزيع العام</div>
                </div>
            </td>
            <td style="width: 25%; padding: 4px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $dailyBasketsCount + $generalDeliveriesCount }}</div>
                    <div class="kpi-lbl">إجمالي السلال الموزعة اليوم</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- جدول استلامات المستفيدين اليوميين --}}
    <div class="section-heading">1. سجل استلامات المستفيدين اليوميين لليوم</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 15%;">رقم السند</th>
                <th style="width: 20%;">اسم المستفيد</th>
                <th style="width: 12%;">الهوية / الإقامة</th>
                <th style="width: 13%;">الحي</th>
                <th style="width: 15%;">نوع السلة / المادة</th>
                <th style="width: 8%;">الكمية</th>
                <th style="width: 12%;">المعتمد</th>
            </tr>
        </thead>
        <tbody>
            @forelse($dailyReceivingList as $idx => $rx)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td style="font-weight: bold; color: #8C6C26;">{{ $rx->document_number }}</td>
                    <td style="text-align: right; padding-right: 8px;">{{ $rx->beneficiary->full_name ?? 'غير محدد' }}</td>
                    <td>{{ $rx->beneficiary->national_id ?? '-' }}</td>
                    <td>{{ $rx->beneficiary->district ?? '-' }}</td>
                    <td>{{ $rx->basket_type_name }}</td>
                    <td><span class="badge">{{ $rx->quantity }}</span></td>
                    <td>{{ $rx->authorizedUser->full_name ?? 'النظام' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" style="padding: 12px; color: #777;">لا توجد عمليات استلام مسجلة في هذا اليوم حتى الآن.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- جدول حركات المستودعات اليومية --}}
    <div class="section-heading">2. حركات مستودع المستفيدين اليوميين الصادرة والواردة</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">الصنف</th>
                <th style="width: 12%;">نوع الحركة</th>
                <th style="width: 10%;">الكمية</th>
                <th style="width: 33%;">السبب / البيان</th>
                <th style="width: 15%;">المسؤول</th>
            </tr>
        </thead>
        <tbody>
            @forelse($dailyMovements as $idx => $mov)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td style="text-align: right; padding-right: 8px;">{{ $mov->item->name ?? 'صنف مستودع' }}</td>
                    <td>
                        @if($mov->type === 'in')
                            <span class="badge" style="background-color: #EBF4EA; color: #2E5A27;">توريد (+)</span>
                        @elseif($mov->type === 'out')
                            <span class="badge" style="background-color: #FDF2E9; color: #D97706;">صرف (-)</span>
                        @else
                            <span class="badge" style="background-color: #E8F4F8; color: #0284C7;">تسوية</span>
                        @endif
                    </td>
                    <td style="font-weight: bold;">{{ $mov->quantity }}</td>
                    <td style="text-align: right; padding-right: 8px;">{{ $mov->reason }}</td>
                    <td>{{ $mov->user->full_name ?? 'النظام' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="padding: 12px; color: #777;">لا توجد حركات مستودعية مسجلة في هذا اليوم.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- التوقيعات الرسمية --}}
    <table class="footer-signatures">
        <tr>
            <td style="width: 33%;">
                <strong>مسؤول التوزيع الميداني:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 33%;">
                <strong>أمين المستودع:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 34%;">
                <strong>مدير إدارة العمليات:</strong><br><br>
                <span>....................................</span>
            </td>
        </tr>
    </table>

</body>
</html>
