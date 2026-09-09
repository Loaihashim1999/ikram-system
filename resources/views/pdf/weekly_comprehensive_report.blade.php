<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $title ?? 'التقرير الإحصائي الشامل ومخططات الحوكمة - جمعية إكرام' }}</title>
    <style>
        @php
            $reportFrame = file_exists(public_path('assets/33.jpeg')) 
                ? public_path('assets/33.jpeg') 
                : (file_exists(public_path('assets/33. jpeg')) ? public_path('assets/33. jpeg') : '');
        @endphp
        @page {
            margin-top: 32mm;
            margin-bottom: 22mm;
            margin-left: 12mm;
            margin-right: 12mm;
            @if($reportFrame)
            background: url('{{ $reportFrame }}') no-repeat 0 0;
            background-image-resize: 6;
            @endif
            footer: html_reportFooter;
        }
        body {
            font-family: 'xbriyaz', 'tajawal', 'cairo', 'DejaVu Sans', sans-serif;
            color: #1A1A1A;
            font-size: 9.5px;
            line-height: 1.35;
            direction: rtl;
            text-align: right;
        }
        .header-table {
            width: 100%;
            border-bottom: 2px solid #C9A24B;
            padding-bottom: 6px;
            margin-bottom: 10px;
        }
        .header-title {
            font-size: 15px;
            font-weight: bold;
            color: #2E5A27;
            text-align: center;
        }
        .header-subtitle {
            font-size: 10.5px;
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
            padding: 5px;
            text-align: center;
            border-radius: 4px;
        }
        .kpi-val {
            font-size: 13px;
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
            margin-top: 8px;
            margin-bottom: 6px;
        }
        .chart-box {
            border: 1px solid #E2E8F0;
            background-color: #FFFFFF;
            border-radius: 4px;
            padding: 8px;
            text-align: center;
            margin-bottom: 10px;
        }
        .chart-title {
            font-size: 11px;
            font-weight: bold;
            color: #1E293B;
            margin-bottom: 6px;
            text-align: center;
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
            margin-top: 20px;
            border-collapse: collapse;
            text-align: center;
        }
        .funnel-bar {
            margin: 4px auto;
            border-radius: 3px;
            color: #FFFFFF;
            font-weight: bold;
            font-size: 9px;
            padding: 4px 8px;
            text-align: center;
        }
    </style>
</head>
<body>

    {{-- ترويسة التقرير الشامل --}}
    <table class="header-table">
        <tr>
            <td style="width: 25%; text-align: right;">
                <strong style="color: #2E5A27; font-size: 11.5px;">جمعية إكرام لحفظ الطعام</strong><br>
                <span style="font-size: 8.5px; color: #666;">وحدة الحوكمة والتقارير الإحصائية</span>
            </td>
            <td style="width: 50%; text-align: center;">
                <div class="header-title">تقرير حوكمة العمليات الإحصائية وحفظ النعمة</div>
                <div class="header-subtitle">{{ $analytics['period']['label'] ?? 'الفترة المحددة' }}</div>
            </td>
            <td style="width: 25%; text-align: left; font-size: 8px; color: #666;">
                <strong>تاريخ التقرير:</strong> {{ now()->format('Y/m/d H:i') }}<br>
                <strong>المنفذ:</strong> {{ auth()->user()->full_name ?? 'إدارة الحوكمة' }}
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
                    <div class="kpi-lbl">المستفيدون المستلمون للمساعدات</div>
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

    {{-- ══════════════════════════════════════════════════════════════ --}}
    {{-- الصفحة الأولى: المخطط العمودي والمخطط الخطي --}}
    {{-- ══════════════════════════════════════════════════════════════ --}}
    <div class="section-heading">أولاً: الرسوم البيانية الاستراتيجية للحوكمة (1/2)</div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
        <tr>
            {{-- 1. المخطط العمودي (Column Chart) --}}
            <td style="width: 50%; vertical-align: top; padding-left: 5px;">
                <div class="chart-box">
                    <div class="chart-title">1. إجمالي المستفيدين حسب فئات الاستحقاق (Column Chart)</div>
                    @php
                        $colData = $analytics['charts']['column_chart']['data'] ?? [];
                        $maxCol = !empty($colData) ? max(array_column($colData, 'count')) : 1;
                        if ($maxCol <= 0) $maxCol = 1;
                    @endphp
                    <div style="height: 155px; width: 100%; text-align: center; padding-top: 10px;">
                        <table style="width: 100%; height: 135px; border-collapse: collapse; vertical-align: bottom;">
                            <tr>
                                @foreach($colData as $c)
                                    @php
                                        $barH = round(($c['count'] / $maxCol) * 95);
                                        if ($barH < 12 && $c['count'] > 0) $barH = 12;
                                    @endphp
                                    <td style="vertical-align: bottom; text-align: center; padding: 0 4px; width: {{ 100 / max(1, count($colData)) }}%;">
                                        <div style="font-size: 8px; font-weight: bold; color: #2E5A27; margin-bottom: 2px;">{{ $c['count'] }}</div>
                                        <div style="background-color: #2E5A27; height: {{ $barH }}px; width: 85%; margin: 0 auto; border-radius: 3px 3px 0 0;"></div>
                                        <div style="font-size: 7.5px; color: #475569; margin-top: 4px; line-height: 1.1;">{{ $c['label'] }}</div>
                                    </td>
                                @endforeach
                            </tr>
                        </table>
                    </div>
                </div>
            </td>

            {{-- 2. المخطط الخطي (Line Chart) --}}
            <td style="width: 50%; vertical-align: top; padding-right: 5px;">
                <div class="chart-box">
                    <div class="chart-title">2. تطور تسجيل المستفيدين وتقديم المساعدات (Line Chart)</div>
                    @php
                        $lineData = array_slice($analytics['charts']['line_chart']['data'] ?? [], -6);
                        $maxLine = 1;
                        foreach($lineData as $ld) {
                            $maxLine = max($maxLine, $ld['registrations'] ?? 0, $ld['distributions'] ?? 0);
                        }
                    @endphp
                    <div style="height: 155px; width: 100%; padding-top: 6px;">
                        <table class="data-table" style="margin-top: 4px; font-size: 8px;">
                            <thead>
                                <tr>
                                    <th style="font-size: 7.5px;">الشهر</th>
                                    <th style="font-size: 7.5px; color: #2E5A27;">تسجيل مستفيدين</th>
                                    <th style="font-size: 7.5px; color: #0284C7;">مساعدات مسلمة</th>
                                    <th style="font-size: 7.5px;">مؤشر الحركة</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($lineData as $ld)
                                    <tr>
                                        <td><strong>{{ $ld['period'] }}</strong></td>
                                        <td style="color: #2E5A27; font-weight: bold;">+{{ $ld['registrations'] }}</td>
                                        <td style="color: #0284C7; font-weight: bold;">{{ $ld['distributions'] }}</td>
                                        <td style="text-align: right; padding-right: 4px;">
                                            @php
                                                $barPct = round((($ld['registrations'] + $ld['distributions']) / ($maxLine * 2)) * 100);
                                            @endphp
                                            <div style="background-color: #E2E8F0; width: 100%; height: 6px; border-radius: 3px;">
                                                <div style="background-color: #C9A24B; width: {{ min(100, max(5, $barPct)) }}%; height: 6px; border-radius: 3px;"></div>
                                            </div>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                        <div style="font-size: 7px; color: #64748B; text-align: center; margin-top: 4px;">
                            ■ الأخضر: تسجيل المستفيدين | ■ الأزرق: عمليات التوزيع المسلمة
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    </table>

    {{-- فاصل إجباري لبدء الصفحة الثانية --}}
    <pagebreak />

    {{-- ══════════════════════════════════════════════════════════════ --}}
    {{-- الصفحة الثانية: المخطط القمعي والمخطط الدائري وجدول الفئات --}}
    {{-- ══════════════════════════════════════════════════════════════ --}}
    <div class="section-heading">ثانياً: مسارات الاستحقاق والتوزيع النسبي (2/2)</div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
        <tr>
            {{-- 3. المخطط القمعي (Funnel Chart) --}}
            <td style="width: 50%; vertical-align: top; padding-left: 5px;">
                <div class="chart-box">
                    <div class="chart-title">3. مسار المستفيدين حسب مراحل الاستحقاق والدعم (Funnel Chart)</div>
                    @php
                        $funnelStages = $analytics['charts']['funnel_chart']['stages'] ?? [];
                        $colors = ['#2E5A27', '#3F6B3A', '#8C6C26', '#C9A24A'];
                    @endphp
                    <div style="padding: 6px 4px; text-align: center;">
                        @foreach($funnelStages as $idx => $stage)
                            @php
                                $w = max(40, min(100, (int)$stage['percentage']));
                                $color = $colors[$idx % count($colors)];
                            @endphp
                            <div style="margin: 4px auto; width: {{ $w }}%;">
                                <div class="funnel-bar" style="background-color: {{ $color }};">
                                    {{ $stage['stage'] }}: {{ $stage['count'] }} ({{ $stage['percentage'] }}%)
                                </div>
                            </div>
                        @endforeach
                        <div style="font-size: 7.5px; color: #64748B; margin-top: 6px;">
                            مخطط تسلسلي يوضح انتقال المستفيد من التسجيل المبدئي وحتى الاستلام الفعلي
                        </div>
                    </div>
                </div>
            </td>

            {{-- 4. المخطط الدائري والنسبي (Pie Chart) --}}
            <td style="width: 50%; vertical-align: top; padding-right: 5px;">
                <div class="chart-box">
                    <div class="chart-title">4. توزيع المستفيدين حسب صفة الإقامة ونوع الأسرة (Pie / Donut Chart)</div>
                    @php
                        $pieCitizenship = $analytics['charts']['pie_chart']['data'] ?? [];
                        $pieFamily = $analytics['charts']['pie_chart']['secondary_data'] ?? [];
                        $totalCitizen = array_sum(array_column($pieCitizenship, 'count')) ?: 1;
                        $totalFamily = array_sum(array_column($pieFamily, 'count')) ?: 1;
                    @endphp
                    <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
                        <tr>
                            <td style="width: 50%; vertical-align: top; padding: 2px 4px; text-align: center;">
                                <div style="font-size: 8.5px; font-weight: bold; color: #2E5A27; margin-bottom: 4px;">حسب صفة الإقامة</div>
                                @foreach($pieCitizenship as $pc)
                                    @php
                                        $pct = round(($pc['count'] / $totalCitizen) * 100, 1);
                                    @endphp
                                    <div style="margin-bottom: 4px; text-align: right; font-size: 7.5px;">
                                        <span style="color: {{ $pc['color'] }}; font-weight: bold;">● {{ $pc['label'] }}:</span>
                                        <strong>{{ $pc['count'] }}</strong> ({{ $pct }}%)
                                        <div style="background-color: #E2E8F0; width: 100%; height: 5px; border-radius: 2px; margin-top: 1px;">
                                            <div style="background-color: {{ $pc['color'] }}; width: {{ $pct }}%; height: 5px; border-radius: 2px;"></div>
                                        </div>
                                    </div>
                                @endforeach
                            </td>
                            <td style="width: 50%; vertical-align: top; padding: 2px 4px; text-align: center; border-right: 1px dashed #CBD5E1;">
                                <div style="font-size: 8.5px; font-weight: bold; color: #0284C7; margin-bottom: 4px;">حسب بنية الأسرة</div>
                                @foreach($pieFamily as $pf)
                                    @php
                                        $pct = round(($pf['count'] / $totalFamily) * 100, 1);
                                    @endphp
                                    <div style="margin-bottom: 4px; text-align: right; font-size: 7.5px;">
                                        <span style="color: {{ $pf['color'] }}; font-weight: bold;">● {{ $pf['label'] }}:</span>
                                        <strong>{{ $pf['count'] }}</strong> ({{ $pct }}%)
                                        <div style="background-color: #E2E8F0; width: 100%; height: 5px; border-radius: 2px; margin-top: 1px;">
                                            <div style="background-color: {{ $pf['color'] }}; width: {{ $pct }}%; height: 5px; border-radius: 2px;"></div>
                                        </div>
                                    </div>
                                @endforeach
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    {{-- جدول تفصيلي لفئات الاستحقاق --}}
    <div class="section-heading">تفصيل استحقاق الفئات المسجلة في النظام</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 10%;">#</th>
                <th style="width: 40%;">فئة الاستحقاق</th>
                <th style="width: 25%;">إجمالي المستفيدين</th>
                <th style="width: 25%;">المستلمون في الفترة</th>
            </tr>
        </thead>
        <tbody>
            @forelse((array)($analytics['beneficiaries']['categories'] ?? []) as $idx => $cat)
                <tr>
                    <td>{{ $idx + 1 }}</td>
                    <td style="font-weight: bold; text-align: right; padding-right: 8px;">{{ $cat['name'] }}</td>
                    <td>{{ $cat['total_beneficiaries'] }}</td>
                    <td><span class="badge">{{ $cat['received_count'] }}</span></td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" style="padding: 6px;">لا توجد بيانات فئات.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- فاصل إجباري لبدء الصفحة الثالثة --}}
    <pagebreak />

    {{-- ══════════════════════════════════════════════════════════════ --}}
    {{-- الصفحة الثالثة: تفاصيل الأحياء والمستودعات والمنظمات والتوقيعات --}}
    {{-- ══════════════════════════════════════════════════════════════ --}}
    <div class="section-heading">ثالثاً: تفاصيل الأحياء السكنية والجهات التابعة</div>

    {{-- جدول توزيع الأحياء --}}
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
            @forelse(array_slice((array)($analytics['neighborhoods']['list'] ?? []), 0, 10) as $idx => $nh)
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
                    <td colspan="7" style="padding: 6px;">لا توجد بيانات متاحة للأحياء خلال هذه الفترة.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{-- جدول مقارنة المستودعات --}}
    <div class="section-heading">رابعاً: موقف المخزون وحركات المستودعات المركزية واليومية</div>
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

    {{-- التوقيعات والاعتماد الرسمي --}}
    <table class="signatures-table">
        <tr>
            <td style="width: 33%;">
                <strong>مسؤول الحوكمة والإحصاء:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 33%;">
                <strong>مدير إدارة العمليات:</strong><br><br>
                <span>....................................</span>
            </td>
            <td style="width: 34%;">
                <strong>المدير التنفيذي للجمعية:</strong><br><br>
                <span>....................................</span>
            </td>
        </tr>
    </table>

    {{-- تذييل الصفحة مع الترقيم التلقائي --}}
    <htmlpagefooter name="reportFooter">
        <table style="width: 100%; border-top: 1px solid #CBD5E1; padding-top: 4px; font-size: 8px; color: #64748B;">
            <tr>
                <td style="width: 33%; text-align: right;">جمعية إكرام لحفظ الطعام بمكة المكرمة</td>
                <td style="width: 34%; text-align: center;">صفحة {PAGENO} من {nbpg}</td>
                <td style="width: 33%; text-align: left;">نظام إكرام لإدارة المستفيدين والمساعدات</td>
            </tr>
        </table>
    </htmlpagefooter>

</body>
</html>
