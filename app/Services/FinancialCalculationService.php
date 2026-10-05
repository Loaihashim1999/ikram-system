<?php

namespace App\Services;

use App\Models\Category;
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
        $allowedSources = $isCitizen
            ? ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support']
            : ['salary', 'family_support'];
        $selectedSources = array_values(array_intersect(
            $allowedSources,
            is_array($data['income_sources'] ?? null) ? $data['income_sources'] : []
        ));

        // تنظيف وتحويل المدخلات المالية بأمان (منع القيم السالبة وتفادي null)
        $amount = static fn (string $source, string $field): float => in_array($source, $selectedSources, true)
            ? max(0, (float) ($data[$field] ?? 0)) : 0.0;
        $salary = $amount('salary', 'monthly_salary');
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
            $pension = $amount('retirement', 'retirement_pension');
            $citizenAccount = $amount('citizen_account', 'citizen_account_amount');
            $socialSecurity = $amount('social_security', 'social_security_amount');
            $familySupport = $amount('family_support', 'family_support');

            $totalIncome = $salary + $pension + $citizenAccount + $socialSecurity + $familySupport;
        } else {
            // المقيم: الراتب + دعم الأسرة
            $familySupport = $amount('family_support', 'family_support');

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
        // درجة الاستحقاق محصورة في الأولى والثانية، والسمات الأخرى مستقلة.
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
