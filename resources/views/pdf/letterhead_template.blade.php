<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $title ?? 'وثيقة رسمية' }}</title>
    <style>
        body { font-family: xbriyaz, sans-serif; color: #1C1915; font-size: 11pt; line-height: 1.55; direction: rtl; text-align: right; }
        .doc-title, .pdf-title { text-align: center; font-size: 16pt; font-weight: bold; color: #1C1915; margin: 0 0 3mm; }
        .pdf-section { font-size: 13pt; font-weight: bold; color: #1F4D3A; border-bottom: 0.3mm solid #A6843D; padding-bottom: 1mm; margin: 5mm 0 2mm; }
        .pdf-meta, .pdf-muted, .muted { color: #3A342C; font-size: 9pt; }
        .pdf-note, .note { background: #F7F3EA; padding: 3mm; border-right: 0.8mm solid #A6843D; }
        .pdf-warning { border: 0.3mm solid #8A5A12; padding: 3mm; color: #8A5A12; }
        .info-table, .data-table, table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; }
        .info-table th, .info-table td, .data-table th, .data-table td, th, td { border: 0.2mm solid #E4DDD0; padding: 1.6mm 2mm; text-align: right; vertical-align: top; }
        .info-table th, .data-table th, th { background: #E7EFEA; color: #1C1915; font-weight: bold; }
        .num, td.num, th.num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        h2, h3, .pdf-section { page-break-after: avoid; }
        .wrap { overflow-wrap: anywhere; word-wrap: break-word; }
        .pdf-sign { page-break-inside: avoid; width: 100%; margin-top: 4mm; }
        .pdf-sign td { border: 0; text-align: center; vertical-align: top; }
        .pdf-value, .value { font-size: 16pt; color: #1F4D3A; font-weight: bold; }
        .kpi td { background: #F7F3EA; }
        @yield('styles')
    </style>
</head>
<body>
    {!! \App\Support\Pdf\AssociationFrame::frameMarkup() !!}
    <div class="content">
        @yield('content')
    </div>
</body>
</html>
