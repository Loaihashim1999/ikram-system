@php
    $publicIndex = public_path('index.html');
@endphp
@if (file_exists($publicIndex))
    {!! file_get_contents($publicIndex) !!}
@else
    <!doctype html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <link rel="icon" type="image/png" href="/1.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>نظام إكرام لإدارة الجمعية والخدمات الاجتماعية</title>
    </head>
    <body class="bg-[#F7F5F0] text-[#111827]">
      <div id="root">
        <div style="font-family: sans-serif; text-align: center; padding: 50px; direction: rtl;">
          <h2>نظام إكرام لإدارة الجمعية والخدمات الاجتماعية</h2>
          <p>يرجى بناء واجهة التطبيق عبر: <code>npm run build</code> داخل مجلد <code>frontend</code></p>
        </div>
      </div>
    </body>
    </html>
@endif
