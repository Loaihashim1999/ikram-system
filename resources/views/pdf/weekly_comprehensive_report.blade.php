<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page { margin: 55mm 16mm 35mm; margin-footer: 25mm; background: url('{{ public_path('assets/11.jpeg') }}') no-repeat 0 0; background-image-resize: 6; footer: html_reportFooter; }
body { font-family: xbriyaz; font-size: 11pt; color: #243524; direction: rtl; }
h1 { font-size: 28pt; color: #355B30; line-height: 1.6; } h2 { font-size: 19pt; color: #355B30; border-bottom: 1mm solid #C9A24A; padding-bottom: 3mm; }
h3 { font-size: 14pt; color: #806523; margin-top: 6mm; }
p { line-height: 1.65; } .muted { color: #59645b; font-size: 9pt; } .eyebrow { color: #806523; font-size: 12pt; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 6mm; } th { background: #355B30; color: white; padding: 3mm; text-align: right; } td { border-bottom: .2mm solid #ddd; padding: 2.5mm; vertical-align: top; }
.kpi td { background: #f5f2e9; width: 33%; } .value { font-size: 23pt; color: #355B30; } .note { background: #f5f2e9; padding: 4mm; border-right: 1mm solid #C9A24A; }
.bar { background: #355B30; height: 4mm; } .page { height: 3mm; } h2, h3 { page-break-after: avoid; } .small { font-size: 9pt; }
</style></head><body>
<htmlpagefooter name="reportFooter"><div style="font-size:8pt;text-align:center;color:#59645b">تقرير الحوكمة | {{ $report['analytics']['period']['start_date'] }} — {{ $report['analytics']['period']['end_date'] }} | {{ $report['generated_at'] }} | {PAGENO} / {nbpg}</div></htmlpagefooter>
@php
$a = $report['analytics'];
@endphp
<p class="eyebrow">جمعية إكرام الجود لخدمة ضيوف الرحمن</p>
<h1>التقرير الشامل للحوكمة<br>وتحليل البيانات</h1>
<p style="font-size:17pt">{{ $a['period']['start_date'] }} إلى {{ $a['period']['end_date'] }}</p>
<p>أعد بواسطة: {{ $report['generated_by'] }}<br>تاريخ الإنشاء: {{ $report['generated_at'] }}</p>
<div class="note">يستند هذا التقرير إلى سجلات قاعدة البيانات وقت الإنشاء. مؤشرات النشاط تتبع الفترة المحددة، بينما توضح مؤشرات اللقطة الحالية حالة السجلات الآن؛ ولا تمثل رصيداً تاريخياً عند نهاية الفترة.</div>
<h3>دليل القراءة</h3><p>الملخص التنفيذي • المستفيدون والمالية • التوزيع والاستلام • المسار التشغيلي • الأحياء • المخزون • الجهات والموظفون • التدقيق والإشعارات • الاستنتاجات والملاحق</p>
<pagebreak /><h2>الملخص التنفيذي</h2>
<table class="kpi"><tr><td><span class="value">{{ $a['beneficiaries']['total'] }}</span><br>المستفيدون — حالياً</td><td><span class="value">{{ $a['beneficiaries']['registered_in_period'] }}</span><br>التسجيل — خلال الفترة</td><td><span class="value">{{ $report['received_operations'] }}</span><br>الاستلام الفعلي — خلال الفترة</td></tr></table>
@foreach($report['insights'] as $insight)<p>• {{ $insight }}</p>@endforeach
<pagebreak /><h2>مؤشرات التحليل والأداء</h2>
<p class="muted">كل مؤشر يوضح نطاقه وطريقة حسابه. عدم توافر مقام صالح للحساب يظهر «غير متاح»؛ ولا يحوّل إلى صفر أو نسبة نجاح وهمية.</p>
@foreach($report['indicators'] as $indicator)
<div style="page-break-inside:avoid; margin-bottom:5mm; background:#f5f2e9; padding:4mm">
<table style="margin:0"><tr><td style="width:68%;border:0"><h3 style="margin:0">{{ $indicator['label'] }}</h3><span class="muted">{{ $indicator['scope'] }}</span></td><td style="border:0;text-align:left"><span class="value">{{ $indicator['value'] === null ? 'غير متاح' : number_format($indicator['value'], $indicator['unit'] === 'عملية' ? 0 : 1) }}</span> {{ $indicator['value'] === null ? '' : $indicator['unit'] }}</td></tr></table>
<p style="margin:1mm 0;font-size:9pt">الحساب: {{ $indicator['formula'] }}</p><p style="margin:1mm 0;font-size:9pt">{{ $indicator['note'] }}</p>
</div>@endforeach
<pagebreak /><h2>لوحة التحليل المرئي</h2>
<h3>التسجيل والاستلام الفعلي عبر الزمن</h3><p class="muted">المحور الأفقي: الشهر ضمن الفترة المحددة. المحور الرأسي: العدد. الأخضر: تسجيل مستفيدين؛ الذهبي: عمليات الاستلام وفق تاريخ التسليم الفعلي.</p>
@if(count($report['timeline']) > 1)
@php
$n=count($report['timeline']); $peak=max(1,collect($report['timeline'])->max('registrations'),collect($report['timeline'])->max('receipts')); $regPoints=[]; $recPoints=[];
foreach($report['timeline'] as $i=>$point){$x=40+460*$i/max(1,$n-1);$regPoints[]=$x.','. (190-155*$point['registrations']/$peak);$recPoints[]=$x.','. (190-155*$point['receipts']/$peak);}
@endphp
<svg width="530" height="235" viewBox="0 0 530 235"><line x1="40" y1="35" x2="40" y2="190" stroke="#777"/><line x1="40" y1="190" x2="510" y2="190" stroke="#777"/><text x="5" y="40" font-size="13">{{ $peak }}</text><text x="15" y="192" font-size="13">0</text><polyline points="{{ implode(' ',$regPoints) }}" fill="none" stroke="#355B30" stroke-width="3"/><polyline points="{{ implode(' ',$recPoints) }}" fill="none" stroke="#C9A24A" stroke-width="3"/>
@foreach($report['timeline'] as $i=>$point)@if($i===0 || $i===count($report['timeline'])-1 || count($report['timeline'])<=6)<text x="{{ 20+460*$i/max(1,$n-1) }}" y="215" font-size="11">{{ $point['label'] }}</text>@endif
@endforeach</svg>
@else<p class="note">الفترة تشمل شهراً واحداً؛ تعرض المقارنة بالأعداد دون رسم اتجاه زمني قد يوحي بتغير غير موجود.</p>@endif
<table><thead><tr><th>الشهر</th><th>مسجلون جدد</th><th>عمليات استلام فعلية</th></tr></thead><tbody>@foreach($report['timeline'] as $row)<tr><td>{{ $row['label'] }}</td><td>{{ $row['registrations'] }}</td><td>{{ $row['receipts'] }}</td></tr>@endforeach</tbody></table>
<div style="page-break-inside:avoid"><h3>تركيز المستفيدين حسب الحي</h3><p class="muted">لقطة حالية. الأحياء الأعلى بعدد الملفات المسجلة، وهو مؤشر حجم الخدمة المحتملة ولا يثبت الطلب غير الملبى. تشمل «أحياء أخرى» بقية الأحياء.</p>
@include('pdf.report_bar_chart', ['values'=>$report['topDistricts'], 'label'=>'الحي'])</div>
<h3>حالة التوزيعات المجدولة خلال الفترة</h3><p class="muted">حالة العمليات الآن حسب تاريخ الجدولة في النطاق المحدد.</p>
@include('pdf.report_bar_chart', ['values'=>$report['scheduled_statuses'], 'label'=>'حالة العملية'])
<pagebreak /><h2>تحليل المستفيدين والموارد المالية</h2><p class="muted">لقطة حالية لجميع المستفيدين. القيم المالية شهرية بالريال السعودي كما حسبها النظام عند الحفظ.</p>
<table><thead><tr><th>المؤشر المالي</th><th>القيمة (ريال)</th></tr></thead>@foreach(['total_income'=>'إجمالي الدخل','monthly_rent'=>'إجمالي الإيجار الشهري','net_income'=>'صافي الدخل المتاح','average_income'=>'متوسط الدخل المسجل'] as $key=>$label)<tr><td>{{ $label }}</td><td>{{ number_format($report['finance'][$key] ?? 0, 2) }}</td></tr>@endforeach</table>
<h3>فئات الاستحقاق المسجلة</h3><p class="muted">الأسماء معروضة كما هي دون دمج أو إعادة تصنيف. طول الشريط يمثل عدد المستفيدين نسبة إلى أكبر فئة.</p>
@php
$maxCategory = max(1, collect($a['beneficiaries']['categories'])->max('total_beneficiaries') ?? 0);
@endphp
<table><thead><tr><th>الفئة</th><th>عدد المستفيدين</th><th>مقارنة الأعداد</th></tr></thead><tbody>@foreach($a['beneficiaries']['categories'] as $cat)<tr><td>{{ $cat['name'] }}</td><td>{{ $cat['total_beneficiaries'] }}</td><td style="width:45%"><svg width="200" height="18" viewBox="0 0 200 18"><rect x="0" y="2" width="{{ 200*$cat['total_beneficiaries']/$maxCategory }}" height="14" fill="#355B30" /></svg></td></tr>@endforeach</tbody></table>
@foreach(['beneficiary_type'=>'صفة الإقامة','family_members_count'=>'حجم الأسرة','status'=>'حالة الملف','nationality'=>'الجنسية','housing_type'=>'نوع السكن','family_status'=>'الحالة الأسرية','profession'=>'المهنة','priority'=>'الأولوية'] as $key=>$label)
<div style="page-break-inside:avoid"><h3>{{ $label }} — لقطة حالية</h3><table><thead><tr><th>القيمة المسجلة</th><th>العدد</th></tr></thead><tbody>@forelse($report['breakdowns'][$key] as $value=>$count)<tr><td>{{ $value }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد سجلات</td></tr>@endforelse</tbody></table></div>@endforeach
<div class="page"></div><h2>المساعدات والتوزيع والمسار التشغيلي</h2>
<table><tr><th>المؤشر</th><th>العدد</th></tr><tr><td>عمليات استلام فعلية حسب delivered_at خلال الفترة</td><td>{{ $report['received_operations'] }}</td></tr><tr><td>مستفيدون فريدون استلموا خلال الفترة</td><td>{{ $report['received_beneficiaries'] }}</td></tr><tr><td>عمليات المستفيدين اليوميين خلال الفترة</td><td>{{ $a['daily_beneficiaries']['transactions_count'] }}</td></tr><tr><td>كمية المساعدات اليومية خلال الفترة</td><td>{{ $a['daily_beneficiaries']['baskets_distributed'] }}</td></tr></table>
<h3>حالة العمليات المجدولة خلال الفترة</h3><table><tr><th>الحالة الحالية</th><th>عدد العمليات</th></tr>@foreach($report['scheduled_statuses'] as $status=>$count)<tr><td>{{ $status }}</td><td>{{ $count }}</td></tr>@endforeach</table>
<p class="note">التسجيل ← الحالة الحالية للملف ← الجدولة ← التسليم. لا يوجد حقل قرار استحقاق مستقل أو سجل تاريخي كامل للمراجعة، لذلك لا نعرض قمعاً تراكمياً يوحي بمراحل غير مثبتة. قد تُسجل المساعدة خلال الفترة لمستفيد سجل قبلها.</p>
<h3>المساعدات اليومية حسب نوع السلة</h3><table><tr><th>نوع السلة</th><th>الكمية</th><th>العمليات</th></tr>@foreach($a['daily_beneficiaries']['by_basket_type'] as $row)<tr><td>{{ $row['basket_type_name'] }}</td><td>{{ $row['total_quantity'] }}</td><td>{{ $row['transactions_count'] }}</td></tr>@endforeach</table>
<div class="page"></div><h2>التحليل الجغرافي</h2><p class="muted">المستفيدون والأسر: لقطة حالية. المساعدات: عمليات مجدولة خلال الفترة ومكتملة حالياً.</p>
<table><thead><tr><th>الحي</th><th>مستفيدون</th><th>يوميون</th><th>أسر</th><th>مساعدات</th></tr></thead><tbody>@foreach($a['neighborhoods']['list'] as $row)<tr><td>{{ $row['district'] ?? $row['name'] ?? $row['neighborhood'] ?? '' }}</td><td>{{ $row['general_beneficiaries'] ?? $row['general_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['daily_beneficiaries'] ?? $row['daily_beneficiaries_count'] ?? 0 }}</td><td>{{ $row['families_count'] ?? 0 }}</td><td>{{ $row['baskets_distributed'] ?? 0 }}</td></tr>@endforeach</tbody></table>
<div class="page"></div><h2>المستودع والمخزون</h2><p class="muted">النظام يحتوي سجلي مخزون عام ويومي، ولا يحتوي سجل مواقع مستودعات مستقلاً. الكميات بوحداتها المسجلة ولا تجمع الوحدات المختلفة كمقياس مادي موحد.</p>
@foreach(['main'=>'المخزون العام','daily'=>'المخزون اليومي'] as $key=>$label)<h3>{{ $label }}</h3><table><tr><th>أصناف حالية</th><th>أصناف منخفضة حالياً</th><th>وارد خلال الفترة</th><th>صادر خلال الفترة</th></tr><tr><td>{{ $a['inventory'][$key]['total_items'] }}</td><td>{{ $a['inventory'][$key]['low_stock_count'] }}</td><td>{{ $a['inventory'][$key]['stock_in'] }}</td><td>{{ $a['inventory'][$key]['stock_out'] }}</td></tr></table>@endforeach
<h3>تنبيهات الصلاحية الحالية — المخزون اليومي</h3><table><tr><th>منتهي</th><th>خلال 7 أيام</th><th>8–30 يوماً</th><th>31–60 يوماً</th></tr><tr><td>{{ $a['inventory']['expiry_alerts']['expired_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_7_days_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_30_days_count'] }}</td><td>{{ $a['inventory']['expiry_alerts']['in_60_days_count'] }}</td></tr></table>
<div class="page"></div><h2>الجهات والعمليات الإدارية</h2><p>المنظمات المسجلة: {{ count($report['datasets']['organizations_snapshot']) }}. مناديب الأحياء: {{ $a['organizations']['total'] }}. يعرض الملحق السجلين بشكل مستقل؛ لا توجد علاقة تشغيلية مسجلة للمنظمات تسمح بإسناد المساعدات إليها.</p>
<p>الموظفون حالياً: {{ $a['staff']['total'] }}. المستخدمون النشطون: {{ $report['users_active'] }}. عمليات دعم الموظفين خلال الفترة: {{ $a['staff']['baskets_distributed'] }}.</p>
<h3>مناديب الأحياء</h3><table><thead><tr><th>الجهة / المندوب</th><th>الحي</th><th>السلال خلال الفترة</th></tr></thead><tbody>@foreach($a['organizations']['list'] as $row)<tr><td>{{ $row['name'] }}</td><td>{{ $row['neighborhood'] }}</td><td>{{ $row['baskets_received'] }}</td></tr>@endforeach</tbody></table>
<pagebreak /><h2>الحوكمة والتدقيق وجودة البيانات</h2>
<table><tr><th>نوع النشاط خلال الفترة</th><th>العدد</th></tr>@forelse($report['audit_actions'] as $action=>$count)<tr><td>{{ $action }}</td><td>{{ $count }}</td></tr>@empty<tr><td colspan="2">لا توجد أحداث تدقيق في الفترة</td></tr>@endforelse</table>
<table><tr><th>فحص جودة البيانات — حالياً</th><th>العدد</th></tr>@foreach(['missing_district'=>'حي غير مسجل','missing_category'=>'فئة غير مسجلة','missing_birth_date'=>'تاريخ ميلاد غير مسجل','negative_net_income'=>'دخل صافٍ سالب (مؤشر احتياج وليس خطأ تلقائياً)','delivered_without_date'=>'عملية مسلمة بلا تاريخ تسليم'] as $key=>$label)<tr><td>{{ $label }}</td><td>{{ $report['quality'][$key] }}</td></tr>@endforeach</table>
<p>عدد سجلات صيغ فئة ذوي/ذوو الاحتياجات الخاصة: {{ $report['categoryVariants']->count() }}. تبقى الفئات مستقلة إلى حين مراجعة المعنى واعتماد التوحيد.</p>
<h3>الإشعارات خلال الفترة</h3><p>تم إنشاء {{ $report['notifications']['total'] }} إشعاراً؛ منها {{ $report['notifications']['unread'] }} غير مقروء حالياً. العدد يمثل سجلات المستلمين وليس عدد الأحداث الفريدة.</p>
<h3>استنتاجات الإدارة</h3>@foreach($report['insights'] as $insight)<p>• {{ $insight }}</p>@endforeach
<p class="note">تراجع الإدارة الملفات الناقصة ومخاطر المخزون قبل اتخاذ قرار. لا يعادل غياب سجل تدقيق تأكيداً على عدم حدوث العملية.</p>
<div class="page"></div><h2>الملاحق التفصيلية</h2><p>جميع الصفوف المطابقة متاحة في ملف Excel المرافق؛ تُستبعد بيانات الدخول والحسابات البنكية ومسارات الوثائق. الجداول التالية تدعم مراجعة الأرصدة والجهات دون ازدحام الرسوم.</p>
@foreach(['main_stock_snapshot'=>'المخزون العام — حالياً','daily_stock_snapshot'=>'المخزون اليومي — حالياً','organizations_snapshot'=>'المنظمات المسجلة — حالياً'] as $key=>$label)<h3>{{ $label }}</h3><table><thead><tr><th>الاسم</th><th>الكمية / الرمز</th><th>الوحدة / الحالة</th></tr></thead><tbody>@forelse($report['datasets'][$key] as $row)<tr><td>{{ $row['name'] }}</td><td>{{ $row['current_quantity'] ?? $row['code'] ?? '' }}</td><td>{{ $row['unit'] ?? $row['status'] ?? '' }}</td></tr>@empty<tr><td colspan="3">لا توجد سجلات</td></tr>@endforelse</tbody></table>@endforeach
</body></html>