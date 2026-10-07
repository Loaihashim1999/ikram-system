<?php

namespace App\Support\Documents;

/**
 * Arabic labels for official PDF and Excel output.
 * Unknown technical codes become «غير محدد» and are not shown raw.
 */
final class DocumentLabels
{
    /** @var array<string, string> */
    private const MAP = [
        'citizen' => 'مواطن', 'resident' => 'مقيم',
        'poor' => 'فقير', 'married' => 'متزوج', 'single' => 'أعزب', 'divorced' => 'مطلقة',
        'divorced_with_children' => 'مطلقة مع أطفال', 'widow' => 'أرملة', 'widower' => 'أرمل',
        'widow_with_orphans' => 'أرملة مع أيتام', 'abandoned' => 'مهجورة', 'separated' => 'منفصل',
        'rent' => 'إيجار', 'own' => 'ملك', 'owned' => 'ملك', 'charitable_housing' => 'سكن خيري',
        'provided' => 'سكن متاح', 'free' => 'سكن مجاني', 'average' => 'متوسط', 'good' => 'جيد', 'middle' => 'متوسط',
        'active' => 'نشط', 'suspended' => 'موقوف', 'archived' => 'مؤرشف', 'inactive' => 'غير نشط',
        'registered' => 'مسجل', 'served' => 'مخدوم',
        'draft' => 'مسودة', 'approved' => 'معتمد', 'reserved' => 'تم حجز الأصناف', 'ready' => 'جاهز للاستلام',
        'in_delivery' => 'جارٍ التوصيل', 'completed' => 'مكتمل', 'cancelled' => 'ملغي', 'rejected' => 'مرفوض',
        'delivered' => 'تم التسليم', 'received' => 'تم الاستلام', 'pending' => 'بانتظار الإرسال',
        'pickup' => 'استلام مباشر', 'delivery' => 'توصيل للمنازل', 'direct_handover' => 'استلام مباشر',
        'home_delivery' => 'توصيل للمنازل', 'receipt_code' => 'رمز الاستلام', 'confirmation' => 'تأكيد الاستلام',
        'eligible' => 'مؤهل', 'ineligible' => 'غير مؤهل', 'review_required' => 'يتطلب المراجعة',
        'not_applicable' => 'لا تنطبق السياسة', 'financially_excluded' => 'مستبعد مالياً',
        'A' => 'الفئة الأولى', 'B' => 'الفئة الثانية', 'C' => 'الفئة الثالثة', 'D' => 'الفئة الرابعة', 'E' => 'الفئة الخامسة',
        'a' => 'الفئة الأولى', 'b' => 'الفئة الثانية', 'c' => 'الفئة الثالثة', 'd' => 'الفئة الرابعة', 'e' => 'الفئة الخامسة',
        'in_stock' => 'متوفر', 'low_stock' => 'مخزون منخفض', 'out_of_stock' => 'نافذ',
        'all' => 'كل السجلات', 'delivered_at' => 'تاريخ التسليم', 'created_at' => 'تاريخ التسجيل',
        'near_expiry' => 'قارب على الانتهاء', 'expired' => 'منتهي الصلاحية',
        'beneficiary' => 'مستفيد', 'staff' => 'موظف', 'organization' => 'جهة', 'driver' => 'سائق',
        'first_class' => 'درجة أولى', 'second_class' => 'درجة ثانية', 'class_first' => 'درجة أولى',
        'class_second' => 'درجة ثانية', 'special_needs' => 'ذوو الاحتياجات الخاصة', 'elderly' => 'كبار السن',
        'income' => 'الدخل', 'housing_condition' => 'حالة المسكن', 'housing_tenure' => 'ملكية المسكن',
        'head_health' => 'إعاقة رب الأسرة', 'children_health' => 'الأطفال المتأثرون صحياً', 'age' => 'عمر رب الأسرة',
    ];

    /** @var array<string, string> */
    private const HEADINGS = [
        'id' => 'المعرف', 'full_name' => 'الاسم', 'beneficiary_type' => 'صفة المستفيد', 'status' => 'الحالة',
        'nationality' => 'الجنسية', 'city' => 'المدينة', 'district' => 'الحي', 'phone' => 'الهاتف',
        'family_status' => 'الحالة الأسرية', 'family_members_count' => 'عدد أفراد الأسرة',
        'housing_type' => 'نوع السكن', 'monthly_salary' => 'الراتب الشهري', 'total_income' => 'إجمالي الدخل',
        'monthly_rent' => 'الإيجار الشهري', 'net_income' => 'صافي الدخل', 'policy_score' => 'درجة السياسة',
        'created_at' => 'تاريخ التسجيل', 'completed_at' => 'تاريخ الإكمال', 'support_date' => 'تاريخ الاستحقاق',
        'fulfillment_method' => 'طريقة التسليم', 'quantity' => 'الكمية', 'current_quantity' => 'الكمية الحالية',
        'reserved_quantity' => 'الكمية المحجوزة', 'min_threshold' => 'حد التنبيه', 'name' => 'الاسم',
        'From' => 'من تاريخ', 'To' => 'إلى تاريخ', 'Generated' => 'تاريخ الإنشاء', 'Scope' => 'النطاق', 'Privacy' => 'الخصوصية',
        'label' => 'البند', 'value' => 'القيمة', 'unit' => 'الوحدة', 'scope' => 'النطاق', 'formula' => 'طريقة الحساب', 'note' => 'الملاحظة',
        'registrations' => 'التسجيلات', 'receipts' => 'عمليات الاستلام', 'distributions' => 'عمليات الدعم', 'support_completed' => 'الدعم المكتمل',
        'evaluation_status' => 'حالة التقييم', 'eligibility_decision' => 'نتيجة الاستحقاق', 'score_category' => 'فئة النقاط',
        'evaluated_at' => 'تاريخ التقييم', 'decided_at' => 'تاريخ القرار', 'decision' => 'القرار', 'stable_reason_code' => 'سبب القرار',
        'recipient_type' => 'نوع المستفيد', 'recipient_name' => 'اسم المستلم', 'beneficiary_id' => 'المستفيد',
        'policy_version_id' => 'إصدار السياسة', 'evaluation_id' => 'التقييم', 'category_id' => 'الفئة', 'category_name' => 'الفئة',
        'scheduled_at' => 'تاريخ الجدولة', 'delivered_at' => 'تاريخ التسليم', 'driver_id' => 'السائق',
        'daily_beneficiary_id' => 'المستفيد اليومي', 'basket_type_name' => 'نوع السلة', 'receiving_date' => 'تاريخ الاستلام',
        'expiry_date' => 'تاريخ الصلاحية', 'inventory_item_id' => 'الصنف', 'type' => 'النوع', 'reason' => 'السبب',
        'daily_inventory_item_id' => 'الصنف اليومي', 'code' => 'الرمز', 'department' => 'القسم', 'job_title' => 'المسمى',
        'hire_date' => 'تاريخ التعيين', 'basket_id' => 'السلة',
    ];

    public static function text(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        $string = trim((string) $value);
        if (array_key_exists($string, self::MAP)) {
            return self::MAP[$string];
        }
        if (preg_match('/^[a-z][a-z0-9_]*$/', $string)) {
            return 'غير محدد';
        }

        return $string;
    }

    public static function prose(mixed $value): string
    {
        $string = trim((string) $value);

        return preg_replace_callback(
            '/\b[a-z][a-z0-9_]*\b/',
            fn (array $match): string => self::text($match[0]),
            $string
        ) ?? $string;
    }

    public static function heading(string $key): string
    {
        return self::HEADINGS[$key] ?? (preg_match('/^[A-Za-z0-9_]+$/', $key) ? 'حقل' : $key);
    }
}
