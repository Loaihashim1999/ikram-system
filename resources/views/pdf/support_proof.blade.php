@extends('pdf.letterhead_template', ['title' => ($proof['fulfillment_method'] ?? '') === 'delivery' ? 'إثبات توصيل دعم' : 'إيصال استلام دعم'])
@section('content')
<h1 class="doc-title">{{ $proof['fulfillment_method'] === 'delivery' ? 'إثبات توصيل دعم' : 'إيصال استلام دعم' }}</h1>
@if($legacy)
<p style="border:1px solid #9c6800;padding:8pt;color:#704a00">تنبيه — سجل استلام سابق دون نسخة محفوظة لبيانات وقت التسليم. الاسم وبيانات التواصل والعنوان ونوع الدعم واسم السائق المعروضة مستمدة من السجلات الحالية؛ لا تعد إثباتاً لهذه التفاصيل وقت التسليم.</p>
@else
<p class="pdf-muted">البيانات محفوظة وقت تأكيد الاستلام؛ تحديث السجلات الحالية لا يغير هذه النسخة التاريخية.</p>
@endif
<table>
<tr><th>رقم الوثيقة</th><td class="pdf-muted">{{ $receipt->id }}</td></tr>
<tr><th>رقم المهمة / مرجع الدعم</th><td class="pdf-muted">{{ $proof['task_reference'] }}</td></tr>
@if(array_key_exists('schema_version', $proof))
<tr><th>إصدار بيانات الإثبات</th><td class="pdf-muted">{{ $proof['schema_version'] }}</td></tr>
@endif
<tr><th>المستلم</th><td>{{ $proof['recipient']['display_name'] }}</td></tr>
@if(array_key_exists('type', $proof['recipient']))
<tr><th>نوع المستلم</th><td>{{ \App\Support\Documents\DocumentLabels::text($proof['recipient']['type']) ?: 'غير متوفر' }}</td></tr>
@endif
@if(array_key_exists('id', $proof['recipient']))
<tr><th>معرف المستلم</th><td class="pdf-muted">{{ $proof['recipient']['id'] ?: 'غير متوفر' }}</td></tr>
@endif
<tr><th>مرجع الملف</th><td>{{ $proof['recipient']['reference'] ?: 'غير متوفر' }}</td></tr>
<tr><th>هاتف المستلم</th><td dir="ltr">{{ $proof['recipient']['phone'] ?: 'غير متوفر' }}</td></tr>
<tr><th>العنوان</th><td>{{ $proof['recipient']['full_address'] ?: 'غير متوفر' }}</td></tr>
@if(array_key_exists('city', $proof['recipient']))
<tr><th>المدينة</th><td>{{ $proof['recipient']['city'] ?: 'غير متوفر' }}</td></tr>
@endif
@if(array_key_exists('district', $proof['recipient']))
<tr><th>الحي</th><td>{{ $proof['recipient']['district'] ?: 'غير متوفر' }}</td></tr>
@endif
@if(array_key_exists('address', $proof['recipient']))
<tr><th>العنوان التفصيلي</th><td>{{ $proof['recipient']['address'] ?: 'غير متوفر' }}</td></tr>
@endif
@if($proof['fulfillment_method'] === 'delivery')
<tr><th>السائق</th><td>{{ $proof['driver']['name'] ?? 'غير متوفر' }}</td></tr>
@if(is_array($proof['driver'] ?? null) && array_key_exists('id', $proof['driver']))
<tr><th>معرف السائق</th><td class="pdf-muted">{{ $proof['driver']['id'] ?: 'غير متوفر' }}</td></tr>
@endif
@if(is_array($proof['driver'] ?? null) && array_key_exists('assignment_id', $proof['driver']))
<tr><th>معرف التعيين</th><td class="pdf-muted">{{ $proof['driver']['assignment_id'] ?: 'غير متوفر' }}</td></tr>
@endif
@else
<tr><th>موقع الاستلام</th><td>{{ $proof['pickup_location'] }}</td></tr>
@endif
<tr><th>الموظف المسؤول</th><td>{{ $proof['employee']['name'] ?: 'غير متوفر' }}</td></tr>
@if(array_key_exists('id', $proof['employee']))
<tr><th>معرف الموظف</th><td class="pdf-muted">{{ $proof['employee']['id'] ?: 'غير متوفر' }}</td></tr>
@endif
<tr><th>{{ $proof['fulfillment_method'] === 'delivery' ? 'تاريخ ووقت التوصيل' : 'تاريخ ووقت الاستلام' }}</th><td>{{ $confirmedAt->format('Y-m-d H:i') }}</td></tr>
<tr><th>طريقة التسليم</th><td>{{ \App\Support\Documents\DocumentLabels::text($proof['fulfillment_method']) }}</td></tr>
<tr><th>طريقة التحقق</th><td>{{ \App\Support\Documents\DocumentLabels::text($proof['verification_method'] ?? 'receipt_code') }}</td></tr>
<tr><th>الحالة النهائية</th><td>{{ $proof['fulfillment_method'] === 'delivery' ? 'تم التوصيل' : 'تم الاستلام' }}</td></tr>
</table>
<table><thead><tr><th>نوع الدعم</th><th>الكمية</th><th>الوحدة</th><th>معرف الصنف</th></tr></thead><tbody>
@foreach($proof['items'] as $item)
<tr><td>{{ $item['name'] ?: 'غير متوفر' }}</td><td>{{ $item['quantity'] }}</td><td>{{ $item['unit'] }}</td><td class="pdf-muted">{{ array_key_exists('inventory_item_id', $item) ? ($item['inventory_item_id'] ?: 'غير متوفر') : 'غير متوفر' }}</td></tr>
@endforeach
</tbody></table>
<p class="pdf-muted">تاريخ إصدار الوثيقة: {{ $generatedAt->format('Y-m-d H:i') }} — مرجع النظام: {{ $proof['task_reference'] }}</p>
<p class="pdf-muted">وثيقة داخلية؛ تتضمن بيانات المستلم وتعرض للموظفين المخولين فقط.</p>
@endsection
