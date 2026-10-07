@extends('pdf.letterhead_template', ['title' => 'تقرير السائقين'])
@section('content')
<div class="doc-title">تقرير السائقين</div>
<p class="pdf-muted">تاريخ الإصدار: {{ $generatedAt->format('Y-m-d H:i') }}. العدادات عمليات توصيل، وليست عدد المستفيدين.</p>
<table class="data-table"><thead><tr><th>اسم السائق</th><th>رقم الهاتف</th><th>الحالة</th><th>إجمالي المهام</th><th>جاري التوصيل</th><th>تم التوصيل</th><th>متبقي</th><th>آخر نشاط</th></tr></thead><tbody>
@forelse($drivers as $driver)
<tr>
<td>{{ $driver['name'] }}</td>
<td dir="ltr">{{ $driver['phone_display'] }}</td>
<td>{{ $driver['status_label'] }}</td>
<td class="num">{{ $driver['assigned'] }}</td>
<td class="num">{{ $driver['in_delivery'] }}</td>
<td class="num">{{ $driver['completed'] }}</td>
<td class="num">{{ $driver['remaining'] }}</td>
<td>{{ $driver['last_activity'] }}</td>
</tr>
@empty
<tr><td colspan="8">لا يوجد سائقون.</td></tr>
@endforelse
</tbody></table>
@endsection
