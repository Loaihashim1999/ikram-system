<?php

namespace App\Services;

use App\Models\Category;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialCalculationService
{
    /**
     * حساب البيانات المالية والتصنيف الاستحقاقي للمستفيد
     *
     * @param array $data مصفوفة البيانات المالية والشخصية
     * @return array نتائج الاحتساب (إجمالي الدخل، الإيجار الشهري، صافي الدخل، التصنيف، الفئة)
     */
    public function calculate(array $data): array
    {
        $type = strtolower($data['beneficiary_type'] ?? 'citizen');
        $isCitizen = ($type === 'citizen');

        // تنظيف وتحويل المدخلات المالية بأمان (منع القيم السالبة وتفادي null)
        $salary = max(0, (float) ($data['monthly_salary'] ?? 0));
        $annualRent = max(0, (float) ($data['annual_rent_amount'] ?? 0));
        $monthlyRentDirect = max(0, (float) ($data['monthly_rent'] ?? ($data['monthly_rent_amount'] ?? 0)));
        $housingType = $data['housing_type'] ?? 'rent';

        // 1. حساب الإيجار الشهري
        $monthlyRent = 0.0;
        if ($housingType === 'rent') {
            if ($annualRent > 0) {
                $monthlyRent = round($annualRent / 12, 2);
            } elseif ($monthlyRentDirect > 0) {
                $monthlyRent = round($monthlyRentDirect, 2);
            }
        }

        // 2. حساب إجمالي الدخل بناءً على صفة المستفيد
        $totalIncome = 0.0;
        if ($isCitizen) {
            // المواطن: الراتب + التقاعد + حساب المواطن + الضمان الاجتماعي
            $pension = max(0, (float) ($data['retirement_pension'] ?? 0));
            $citizenAccount = max(0, (float) ($data['citizen_account_amount'] ?? 0));
            $socialSecurity = max(0, (float) ($data['social_security_amount'] ?? 0));

            $totalIncome = $salary + $pension + $citizenAccount + $socialSecurity;
        } else {
            // المقيم: الراتب + دعم الأسرة
            $familySupport = max(0, (float) ($data['family_support'] ?? 0));

            $totalIncome = $salary + $familySupport;
        }

        $totalIncome = round($totalIncome, 2);

        // 3. حساب صافي الدخل المتاح بعد خصم الإيجار
        $netIncome = max(0.0, round($totalIncome - $monthlyRent, 2));

        // 4. التصنيف التلقائي للأولوية والفئة
        $priority = $this->determinePriority($data, $netIncome, $isCitizen);
        $categoryId = $this->getCategoryIdForPriority($priority);

        return [
            'total_income' => $totalIncome,
            'monthly_rent' => $monthlyRent,
            'net_income' => $netIncome,
            'priority' => $priority,
            'category_id' => $categoryId,
        ];
    }

    /**
     * تحديد درجة أولوية المستفيد
     */
    private function determinePriority(array $data, float $netIncome, bool $isCitizen): string
    {
        // 1. إذا كان موظفاً
        if (! empty($data['is_employee'])) {
            return 'employee';
        }

        // 2. ذوو الاحتياجات الخاصة
        if (! empty($data['has_special_needs']) || ! empty($data['is_special_needs'])) {
            return 'special_needs';
        }

        // 3. كبار السن
        if (! empty($data['date_of_birth'])) {
            try {
                $dob = Carbon::parse($data['date_of_birth']);
                $elderlyAge = (int) (DB::table('settings')->where('key', 'elderly_min_age')->value('value') ?? 60);
                if ($dob->age >= $elderlyAge) {
                    return 'elderly';
                }
            } catch (\Throwable) {
            }
        }

        // 4. التصنيف المالي
        $firstMax = (float) (DB::table('settings')->where('key', 'first_class_max_income')->value('value') ?? 3000);
        $secondMax = (float) (DB::table('settings')->where('key', 'second_class_max_income')->value('value') ?? 6000);

        if ($isCitizen) {
            if ($netIncome <= $firstMax) {
                return 'first_class';
            }
            return 'second_class';
        } else {
            // المقيم يتبع الدرجة الثانية (أو مقسم داخلياً)
            return 'second_class';
        }
    }

    /**
     * استرجاع معرف الفئة المرتبط بالأولوية
     */
    public function getCategoryIdForPriority(string $priority): ?string
    {
        $map = [
            'first_class' => 'درجة أولى',
            'second_class' => 'درجة ثانية',
            'special_needs' => 'ذوي الاحتياجات الخاصة',
            'elderly' => 'كبار السن',
            'employee' => 'عامل بالجمعية',
        ];

        $name = $map[$priority] ?? 'درجة أولى';
        $category = Category::where('name', 'like', "%{$name}%")->first();
        if (! $category) {
            $category = Category::firstOrCreate(
                ['name' => $name],
                ['description' => 'فئة تلقائية بالنظام', 'basket_entitlement_per_period' => 1]
            );
        }

        return $category?->id;
    }
}
