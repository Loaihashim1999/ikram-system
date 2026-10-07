@extends('pdf.letterhead_template', ['title' => 'تقرير المستودع'])
@section('content')
@php use App\Support\Documents\DocumentLabels; @endphp
<div class="doc-title">تقرير المستودع</div>
<p class="pdf-muted">تاريخ الإصدار: {{ $generatedAt->format('Y-m-d H:i') }}. الكميات من سجل المخزون الحالي.</p>
<table class="data-table"><thead><tr><th>الصنف</th><th>الوحدة</th><th>الكمية الحالية</th><th>المحجوز</th><th>الحالة</th></tr></thead><tbody>
@forelse($items as $item)
<tr>
<td>{{ $item->name }}</td>
<td>{{ $item->unit }}</td>
<td class="num">{{ $item->current_quantity }}</td>
<td class="num">{{ $item->reserved_quantity }}</td>
<td>{{ DocumentLabels::text($item->stock_status) }}</td>
</tr>
@empty
<tr><td colspan="5">لا توجد أصناف.</td></tr>
@endforelse
</tbody></table>
@endsection
