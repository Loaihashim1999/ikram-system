const vocabulary = {
  role: { admin: 'المدير العام', assistant_admin: 'مساعد المدير', reception: 'الاستقبال', staff: 'موظف', warehouse: 'المستودع', readonly: 'عرض فقط', driver: 'سائق تاريخي', delivery_driver: 'سائق تاريخي' },
  family: { poor: 'فقير', married: 'متزوج', single: 'أعزب', divorced: 'مطلقة', divorced_with_children: 'مطلقة مع أطفال', widow: 'أرملة', widower: 'أرمل', widow_with_orphans: 'أرملة مع أيتام', abandoned: 'مهجورة', separated: 'منفصل' },
  housing: { rent: 'إيجار', own: 'ملك', owned: 'ملك', charitable_housing: 'سكن خيري', provided: 'سكن متاح', free: 'سكن مجاني', poor: 'متدني', average: 'متوسط', good: 'جيد' },
  beneficiary: { citizen: 'مواطن', resident: 'مقيم' },
  priority: { first_class: 'درجة أولى', class_first: 'درجة أولى', second_class: 'درجة ثانية', class_second: 'درجة ثانية', special_needs: 'ذوو الاحتياجات الخاصة', elderly: 'كبار السن', employee: 'عامل بالجمعية' },
  status: { in_delivery: 'جارٍ التوصيل', completed: 'مكتمل', active: 'نشط', suspended: 'موقوف', under_review: 'قيد المراجعة', confirmed: 'مؤكد', archived: 'مؤرشف', eligible: 'مؤهل', ineligible: 'غير مؤهل', review_required: 'يتطلب المراجعة', not_applicable: 'لا تنطبق السياسة', pending: 'بانتظار الإرسال', queued: 'في قائمة الإرسال', retrying: 'بانتظار إعادة المحاولة', sending: 'جارٍ التواصل مع مزود الرسائل', sent: 'تم قبول الرسالة للإرسال', provider_accepted: 'قبل مزود الرسائل الطلب', delivered: 'تم التسليم المؤكد', failed: 'تعذر الإرسال', requested: 'تم طلب الإرسال', unknown: 'تحتاج نتيجة الإرسال إلى مراجعة', draft: 'مسودة', pending_approval: 'بانتظار الموافقة', approved: 'معتمد', reserved: 'تم حجز الأصناف', ready: 'جاهز للاستلام', assigned: 'تم إسناد التوصيل', cancelled: 'ملغي', rejected: 'مرفوض' },
  financialCategory: { A: 'الفئة الأولى', B: 'الفئة الثانية', C: 'الفئة الثالثة', D: 'الفئة الرابعة', E: 'الفئة الخامسة', a: 'الفئة الأولى', b: 'الفئة الثانية', c: 'الفئة الثالثة', d: 'الفئة الرابعة', e: 'الفئة الخامسة', eligible: 'مؤهل', ineligible: 'غير مؤهل' },
  scoreCategory: { A: 'الفئة الأولى', B: 'الفئة الثانية', C: 'الفئة الثالثة', D: 'الفئة الرابعة', E: 'الفئة الخامسة', a: 'الفئة الأولى', b: 'الفئة الثانية', c: 'الفئة الثالثة', d: 'الفئة الرابعة', e: 'الفئة الخامسة' },
  policyDimension: { income: 'الدخل', housing_condition: 'حالة المسكن', housing_tenure: 'ملكية المسكن', head_health: 'إعاقة رب الأسرة', children_health: 'الأطفال المتأثرون صحياً', age: 'عمر رب الأسرة' },
  policyBlocker: { REQUIRED_DOCUMENTS_INCOMPLETE: 'الوثائق المطلوبة غير مكتملة', SOCIAL_REVIEW_INCOMPLETE: 'التقييم الاجتماعي غير مكتمل', SERVICE_AREA_UNCONFIRMED: 'نطاق الخدمة غير مؤكد', LANDLORD_RELATION_UNCONFIRMED: 'علاقة المؤجر غير مؤكدة', HOUSING_CONDITION_UNCONFIRMED: 'حالة المسكن غير مؤكدة', CHILDREN_HEALTH_UNCONFIRMED: 'حالة الأطفال الصحية غير مؤكدة', MORE_THAN_THREE_AFFECTED_CHILDREN_UNRESOLVED: 'عدد الأطفال المتأثرين يحتاج مراجعة', EVALUATION_NOT_ELIGIBLE: 'نتيجة التقييم لا تسمح بالاعتماد', SNAPSHOT_INCOMPLETE: 'لقطة التقييم غير مكتملة', POLICY_OUTCOME_BLOCKED: 'نتيجة السياسة تمنع الاعتماد', ALREADY_DECIDED: 'صدر قرار سابق على هذا التقييم', POLICY_NOT_APPLICABLE_RESIDENT: 'سياسة المواطنين لا تنطبق على المقيم', POLICY_DOCUMENT_REVIEW_REQUIRED: 'مراجعة الوثائق مطلوبة', SERVICE_AREA_REVIEW_REQUIRED: 'مراجعة نطاق الخدمة مطلوبة', HOUSING_CONDITION_REVIEW_REQUIRED: 'مراجعة حالة المسكن مطلوبة', HEAD_HEALTH_REVIEW_REQUIRED: 'مراجعة الحالة الصحية لرب الأسرة مطلوبة', CHILDREN_HEALTH_REVIEW_REQUIRED: 'مراجعة حالة الأطفال مطلوبة', LANDLORD_RELATION_REVIEW_REQUIRED: 'مراجعة علاقة المؤجر مطلوبة', FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED: 'مراجعة الوضع الأسري مطلوبة', MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED: 'مراجعة الدليل الطبي مطلوبة', BENEFICIARY_UNDER_REVIEW_REQUIRED: 'المستفيد تحت المراجعة', INELIGIBLE_BENEFICIARY_STATUS: 'حالة المستفيد تمنع الاستحقاق', INCOME_DATA_REVIEW_REQUIRED: 'بيانات الدخل تحتاج مراجعة', AGE_REVIEW_REQUIRED: 'عمر رب الأسرة يحتاج مراجعة', HOUSING_TENURE_REVIEW_REQUIRED: 'ملكية المسكن تحتاج مراجعة' },
  documentStatus: { verified: 'موثقة', rejected: 'مرفوضة', under_review: 'قيد المراجعة', missing: 'مفقودة', not_applicable: 'غير مطلوبة', draft: 'مسودة', submitted: 'مقدمة للمراجعة', reviewed: 'تمت المراجعة', pending: 'بانتظار القرار', approved: 'معتمد', available: 'متوفرة', approve: 'اعتماد', pending_review: 'مراجعة إضافية' },
  channel: { sms: 'رسالة نصية', email: 'بريد إلكتروني' },
  recipient: { beneficiary: 'مستفيد', staff: 'موظف', organization: 'جهة', driver: 'سائق', account: 'حساب' },
  fulfillment: { pickup: 'استلام مباشر', delivery: 'توصيل للمنازل', direct_handover: 'استلام مباشر', home_delivery: 'توصيل للمنازل' },
  verification: { receipt_code: 'رمز الاستلام' },
  providerError: { send_outcome_unknown: 'نتيجة الإرسال غير مؤكدة؛ يلزم التحقق قبل المحاولة', provider_timeout: 'انتهت مهلة مزود الرسائل', provider_rejected: 'رفض مزود الرسائل الطلب', payload_expired: 'انتهت صلاحية الرسالة', worker_timeout: 'انتهت مهلة الإرسال', provider_unavailable: 'مزود الرسائل غير متاح', provider_rate_limited: 'تم تجاوز حد الإرسال', provider_authentication: 'إعدادات اتصال مزود الرسائل تحتاج مراجعة' },
  token: { recipient_name: 'اسم المستلم', beneficiary_name: 'اسم المستفيد', staff_name: 'اسم الموظف', organization_name: 'اسم الجهة', fulfillment_method: 'طريقة التسليم', delivery_date: 'تاريخ التسليم', verification_code: 'رمز الاستلام', association_name: 'اسم الجمعية', pickup_location_name: 'اسم موقع الاستلام', pickup_location_url: 'رابط موقع الاستلام', driver_name: 'اسم السائق', temporary_driver_link: 'رابط السائق الآمن', link_expiry: 'انتهاء صلاحية الرابط', user_name: 'اسم المستخدم', reset_link: 'رابط استعادة الحساب', reset_expiry: 'انتهاء صلاحية الاستعادة', reset_code: 'رمز التحقق', expiry_minutes: 'مدة الصلاحية بالدقائق' },
};
const headings = {
  id: 'المعرف', full_name: 'الاسم', beneficiary_type: 'صفة المستفيد', status: 'الحالة', nationality: 'الجنسية',
  city: 'المدينة', district: 'الحي', phone: 'الهاتف', family_status: 'الحالة الأسرية', family_members_count: 'عدد أفراد الأسرة',
  housing_type: 'نوع السكن', created_at: 'تاريخ التسجيل', category_id: 'الفئة', category_name: 'الفئة',
  beneficiary_id: 'المستفيد', policy_version_id: 'إصدار السياسة', evaluation_status: 'حالة التقييم',
  eligibility_decision: 'نتيجة الاستحقاق', income_category: 'فئة الدخل', score_category: 'فئة النقاط',
  policy_score: 'درجة السياسة', evaluated_at: 'تاريخ التقييم', evaluation_id: 'التقييم', decision: 'القرار',
  stable_reason_code: 'سبب القرار', decided_at: 'تاريخ القرار', recipient_type: 'نوع المستفيد',
  recipient_name: 'اسم المستلم', fulfillment_method: 'طريقة التسليم', support_date: 'تاريخ الاستحقاق',
  completed_at: 'تاريخ الإكمال', basket_id: 'السلة', scheduled_at: 'تاريخ الجدولة', delivered_at: 'تاريخ التسليم',
  driver_id: 'السائق', quantity: 'الكمية', basket_type_name: 'نوع السلة', receiving_date: 'تاريخ الاستلام',
  name: 'الاسم', unit: 'الوحدة', current_quantity: 'الكمية الحالية', min_threshold: 'حد التنبيه',
  type: 'النوع', reason: 'السبب', code: 'الرمز', department: 'القسم', job_title: 'المسمى', hire_date: 'تاريخ التعيين',
  total_received_count: 'عدد الاستلامات', daily_beneficiary_id: 'المستفيد اليومي', inventory_item_id: 'الصنف',
  daily_inventory_item_id: 'الصنف اليومي', reserved_quantity: 'الكمية المحجوزة', expiry_date: 'تاريخ الصلاحية',
};
export function displayLabel(category, value) { return vocabulary[category]?.[value] || 'غير محدد'; }
export function displayHeading(key) { return headings[key] || (/^[A-Za-z0-9_]+$/.test(String(key)) ? 'حقل' : String(key)); }
export function displayReason(code) { return vocabulary.policyBlocker?.[code] || 'سبب يحتاج مراجعة'; }
export function policyBreakdown(snapshot) {
  const stored = Array.isArray(snapshot?.breakdown) ? snapshot.breakdown : null;
  const source = stored || (Array.isArray(snapshot?.components) ? snapshot.components : []);
  return source.map((row) => ({
    rule_id: row.rule_id || row.dimension || '',
    label: row.label || displayLabel('policyDimension', row.rule_id || row.dimension),
    value: row.value ?? row.input ?? null,
    condition: row.condition || row.rule || null,
    awarded_points: row.awarded_points ?? row.points ?? null,
    max_points: row.max_points ?? null,
    reason: row.reason || null,
  }));
}
export function templateDisplay(text) { return String(text || '').replace(/\{([a-z_]+)\}/g, (_, key) => '‹' + displayLabel('token', key) + '›'); }
export function templateStorage(text, allowed = []) { return allowed.reduce((result, key) => result.split('‹' + displayLabel('token', key) + '›').join('{' + key + '}'), text); }
