<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $title ?? 'وثيقة رسمية - جمعية إكرام' }}</title>
    <style>
        @page {
            margin-top: 58mm;
            margin-bottom: 32mm;
            margin-left: 15mm;
            margin-right: 15mm;
            background: url('{{ public_path("assets/ekram-letterhead.jpeg") }}') no-repeat 0 0;
            background-image-resize: 6;
        }
        body {
            font-family: 'xbriyaz', 'tajawal', 'cairo', 'DejaVu Sans', sans-serif;
            color: #1A1A1A;
            font-size: 11px;
            line-height: 1.5;
            direction: rtl;
            text-align: right;
        }
        .content {
            padding: 0;
        }
        .doc-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            color: #C9A24B;
            margin-top: 5px;
            margin-bottom: 15px;
            border-bottom: 1.5px solid #C9A24B;
            padding-bottom: 6px;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .info-table th, .info-table td {
            border: 1px solid #D0D0D0;
            padding: 6px 8px;
            text-align: right;
        }
        .info-table th {
            background-color: #F5EDDA;
            color: #8C6C26;
            font-weight: bold;
            width: 25%;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .data-table th {
            background-color: #EBF4EA;
            color: #223B1E;
            padding: 6px;
            border: 1px solid #C2E0BF;
            font-size: 10px;
            font-weight: bold;
        }
        .data-table td {
            padding: 6px;
            border: 1px solid #E0E0E0;
            font-size: 10px;
        }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: bold;
            background-color: #F5EDDA;
            color: #8C6C26;
        }
    </style>
</head>
<body>

    <div class="content">
        @yield('content')
    </div>

</body>
</html>
