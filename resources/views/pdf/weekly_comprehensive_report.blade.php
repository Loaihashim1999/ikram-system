<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $title ?? 'التقرير الإحصائي الشامل - جمعية إكرام' }}</title>
    <style>
        @page {
            margin-top: 25mm;
            margin-bottom: 20mm;
            margin-left: 12mm;
            margin-right: 12mm;
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
            font-size: 11px;
            color: #8C6C26;
            text-align: center;
            margin-top: 3px;
        }
        .kpi-table {
            width: 100%;
            margin-bottom: 12px;
            border-collapse: collapse;
        }
        .kpi-card {
            border: 1px solid #D0D0D0;
            background-color: #FAF8F5;
            padding: 6px;
            text-align: center;
            border-radius: 4px;
        }
        .kpi-val {
            font-size: 14px;
            font-weight: bold;
            color: #2E5A27;
        }
        .kpi-lbl {
            font-size: 8px;
            color: #555;
            margin-top: 2px;
        }
        .section-heading {
            font-size: 11px;
            font-weight: bold;
            color: #2E5A27;
            background-color: #EBF4EA;
            padding: 4px 8px;
            border-right: 4px solid #3F6B3A;
            margin-top: 10px;
            margin-bottom: 6px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .data-table th {
            background-color: #F5EDDA;
            color: #8C6C26;
            border: 1px solid #D0D0D0;
            padding: 4px 6px;
            font-size: 8.5px;
            font-weight: bold;
            text-align: center;
        }
        .data-table td {
            border: 1px solid #E0E0E0;
            padding: 4px 6px;
            font-size: 8.5px;
            text-align: center;
        }
        .badge {
            display: inline-block;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: bold;
            background-color: #EBF4EA;
            color: #2E5A27;
        }
        .signatures-table {
            width: 100%;
            margin-top: 25px;
            border-collapse: collapse;
            text-align: center;
        }
    </style>
</head>
<body>

    {{-- ترويسة التقرير الشامل --}}
    <table class="header-table">
        <tr>
            <td style="width: 25%; text-align: right;">
                <strong style="color: #2E5A27; font-size: 12px;">جمعية إكرام لحفظ الطعام</strong><br>
                <span style="font-size: 9px; color: #666;">وحدة الحوكمة والتحليلات الإحصائية</span>
            </td>
            <td style="width: 50%; text-align: center;">
                <div class="header-title">التقرير الإحصائي الشامل لحفظ النعمة وتوزيع المساعدات</div>
                <div class="header-subtitle">{{ $analytics['period']['label'] ?? 'الفترة المحددة' }}</div>
            </td>
            <td style="width: 25%; text-align: left; font-size: 8.5px; color: #666;">
                <strong>تاريخ الإصدار:</strong> {{ now()->format('Y/m/d H:i') }}<br>
                <strong>المستخدم المسؤول:</strong> {{ auth()->user()->full_name ?? 'الإدارة العامة' }}
            </td>
        </tr>
    </table>

    {{-- المؤشرات الرئيسية الإجمالية --}}
    <table class="kpi-table">
        <tr>
            <td style="width: 20%; padding: 3px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $analytics['kpis']['grand_total_beneficiaries'] ?? 0 }}</div>
                    <div class="kpi-lbl">إجمالي المستفيدين المسجلين</div>
                </div>
            </td>
            <td style="width: 20%; padding: 3px;">
                <div class="kpi-card">
                    <div class="kpi-val" style="color: #0284C7;">{{ $analytics['kpis']['grand_total_served'] ?? 0 }}</div>
                    <div class="kpi-lbl">المستفيدون الذين استلموا مساعدات</div>
                </div>
            </td>
            <td style="width: 20%; padding: 3px;">
                <div class="kpi-card">
                    <div class="kpi-val" style="color: #D97706;">{{ $analytics['kpis']['grand_total_baskets'] ?? 0 }}</div>
                    <div class="kpi-lbl">إجمالي السلال الموزعة بالكامل</div>
                </div>
            </td>
            <td style="width: 20%; padding: 3px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $analytics['beneficiaries']['families_count'] ?? 0 }}</div>
                    <div class="kpi-lbl">عدد الأسر المستفيدة</div>
                </div>
            </td>
            <td style="width: 20%; padding: 3px;">
                <div class="kpi-card">
                    <div class="kpi-val">{{ $analytics['daily_beneficiaries']['transactions_count'] ?? 0 }}</div>
                    <div class="kpi-lbl">عمليات الاستلام اليومي</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- جدول توزيع الأحياء --}}
    <div class="section-heading">1. مؤشرات التوزيع والاستفادة حسب الأحياء السكنية</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">الحي السكني</th>
                <th style="width: 15%;">المستفيدون العامون</th>
                <th style="width: 15%;">المستفيدون اليوميون</th>
                <th style="width: 15%;">الأسر المتعففة</th>
                <th style="width: 15%;">السلال الموزعة</th>
                <th style="width: 10%;">الجهات الشريكة</th>
            </tr>
        </thead>
        <tbody>
            @forelse(array_slice((array)($analytics['neighborhoods']['list'] ?? []), 0, 8) as $idx => $nh)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td style="font-weight: bold; text-align: right; padding-right: 8px;">{{ $nh['neighborhood'] }}</td>
                    <td>{{ $nh['general_beneficiaries'] }}</td>
                    <td>{{ $nh['daily_beneficiaries'] }}</td>
                    <td>{{ $nh['families_count'] }}</td>
                    <td><span class="badge">{{ $nh['baskets_distributed'] }}</span></td>
                    <td>{{ $nh['organizations_count'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" style="padding: 8px;">لا توجد بيانات متاحة للأحياء خلال هذه الفترة.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- مقارنة المستودعات الرئيسية ومستودع اليوميين --}}
    <div class="section-heading">2. موقف المخزون وحركات المستودعات (المستودع الرئيسي vs مستودع المستفيدين اليوميين)</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 25%;">المستودع</th>
                <th style="width: 15%;">عدد الأصناف</th>
                <th style="width: 15%;">الرصيد المتاح الحالي</th>
                <th style="width: 15%;">الوارد في الفترة (+)</th>
                <th style="width: 15%;">المنصرف والموزع (-)</th>
                <th style="width: 15%;">أصناف قاربت النفاد</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="font-weight: bold; text-align: right; padding-right: 8px;">المستودع المركزي العام</td>
                <td>{{ $analytics['inventory']['main']['total_items'] ?? 0 }}</td>
                <td><strong>{{ $analytics['inventory']['main']['total_quantity'] ?? 0 }}</strong></td>
                <td style="color: #2E5A27;">+{{ $analytics['inventory']['main']['stock_in'] ?? 0 }}</td>
                <td style="color: #D97706;">-{{ $analytics['inventory']['main']['stock_out'] ?? 0 }}</td>
                <td><span class="badge" style="background-color: #FEF3C7; color: #92400E;">{{ $analytics['inventory']['main']['low_stock_count'] ?? 0 }}</span></td>
            </tr>
            <tr>
                <td style="font-weight: bold; text-align: right; padding-right: 8px;">مستودع المستفيدين اليوميين</td>
                <td>{{ $analytics['inventory']['daily']['total_items'] ?? 0 }}</td>
                <td><strong>{{ $analytics['inventory']['daily']['total_quantity'] ?? 0 }}</strong></td>
                <td style="color: #2E5A27;">+{{ $analytics['inventory']['daily']['stock_in'] ?? 0 }}</td>
                <td style="color: #D97706;">-{{ $analytics['inventory']['daily']['stock_out'] ?? 0 }}</td>
                <td><span class="badge" style="background-color: #FEF3C7; color: #92400E;">{{ $analytics['inventory']['daily']['low_stock_count'] ?? 0 }}</span></td>
            </tr>
        </tbody>
    </table>

    {{-- تحليلات المنظمات ومندوبي الأحياء --}}
    <div class="section-heading">3. أداء الجمعيات الشريكة ومندوبي الأحياء</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 30%;">اسم الجهة / المندوب</th>
                <th style="width: 25%;">الحي التابع له</th>
                <th style="width: 20%;">المستفيدون التابعون</th>
                <th style="width: 20%;">السلال المخصصة</th>
            </tr>
        </thead>
        <tbody>
            @forelse(array_slice((array)($analytics['organizations']['list'] ?? []), 0, 6) as $idx => $org)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td style="font-weight: bold; text-align: right; padding-right: 8px;">{{ $org['organization_name'] }}</td>
                    <td>{{ $org['neighborhood'] }}</td>
                    <td>{{ $org['beneficiaries_count'] }}</td>
                    <td><span class="badge">{{ $org['baskets_received'] }}</span></td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" style="padding: 8px;">لا توجد جهات مسجلة.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- التوقيعات --}}
    <table class="signatures-table">
        <tr>
            <td style="width: 33%;">
                <strong>مسؤول الإحصاء والبيانات:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 33%;">
                <strong>أمين عام الجمعية:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 34%;">
                <strong>المدير التنفيذي:</strong><br><br>
                <span>....................................</span>
            </td>
        </tr>
    </table>

</body>
</html>
