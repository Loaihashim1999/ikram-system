@php($maximum = max(1, max(array_values($values ?: [0]))))
<table class="data-table"><thead><tr><th>{{ $label ?? 'الفئة' }}</th><th class="num">العدد</th><th>المقارنة</th></tr></thead><tbody>
@forelse($values as $name => $count)
<tr>
<td class="wrap">{{ \App\Support\Documents\DocumentLabels::prose($name) }}</td>
<td class="num">{{ $count }}</td>
@php($share = max(0, min(100, (int) round(100 * $count / $maximum))))
<td style="padding:1.2mm 1mm">
<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:0"><tr>
<td width="{{ max($share, 4) }}%" bgcolor="#1F4D3A" style="height:4.2mm;border:0;font-size:1pt">&nbsp;</td>
<td width="{{ max(0, 100 - max($share, 4)) }}%" bgcolor="#E7E1D4" style="height:4.2mm;border:0;font-size:1pt">&nbsp;</td>
</tr></table>
</td>
</tr>
@empty
<tr><td colspan="3">لا توجد بيانات في النطاق المحدد</td></tr>
@endforelse
</tbody></table>
