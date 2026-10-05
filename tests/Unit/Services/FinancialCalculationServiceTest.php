<?php

namespace Tests\Unit\Services;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Setting;
use App\Services\FinancialCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialCalculationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected FinancialCalculationService $service;

    protected Category $categoryDegree1;

    protected Category $categoryDegree2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new FinancialCalculationService;

        $this->categoryDegree1 = Category::firstOrCreate(
            ['name' => 'درجة أولى'],
            ['description' => 'الفئة الأكثر احتياجاً', 'basket_entitlement_per_period' => 1]
        );

        $this->categoryDegree2 = Category::firstOrCreate(
            ['name' => 'درجة ثانية'],
            ['description' => 'الفئة متوسطة الاحتياج', 'basket_entitlement_per_period' => 1]
        );
    }

    /** 1. Citizen gross income calculation */
    public function test_citizen_gross_income_calculation(): void
    {
        $data = [
            'beneficiary_type' => 'citizen',
            'income_sources' => ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support'],
            'monthly_salary' => 2500,
            'retirement_pension' => 1000,
            'citizen_account_amount' => 500,
            'social_security_amount' => 1200,
            'family_support' => 300,
            'housing_type' => 'own',
        ];

        $res = $this->service->calculate($data);

        // 2500 + 1000 + 500 + 1200 + 300 = 5500
        $this->assertEquals(5500.00, $res['total_income']);
        $this->assertEquals(0.00, $res['monthly_rent']);
        $this->assertEquals(5500.00, $res['net_income']);
    }

    /** 2. Annual rent divided by 12 */
    public function test_annual_rent_divided_by_12(): void
    {
        $data = [
            'beneficiary_type' => 'citizen',
            'income_sources' => ['salary'],
            'monthly_salary' => 4000,
            'housing_type' => 'rent',
            'annual_rent_amount' => 14400, // 14400 / 12 = 1200
        ];

        $res = $this->service->calculate($data);

        $this->assertEquals(4000.00, $res['total_income']);
        $this->assertEquals(1200.00, $res['monthly_rent']);
        $this->assertEquals(2800.00, $res['net_income']); // 4000 - 1200 = 2800
    }

    /** 3. Net income calculation max(0, gross - rent) */
    public function test_net_income_calculation_cannot_be_negative(): void
    {
        $data = [
            'beneficiary_type' => 'citizen',
            'income_sources' => ['salary'],
            'monthly_salary' => 1000,
            'housing_type' => 'rent',
            'annual_rent_amount' => 24000, // 2000/month, exceeds income
        ];

        $res = $this->service->calculate($data);

        $this->assertEquals(1000.00, $res['total_income']);
        $this->assertEquals(2000.00, $res['monthly_rent']);
        $this->assertEquals(0.00, $res['net_income']); // max(0, 1000 - 2000) = 0
    }

    /** 4. Hidden/unselected financial source excluded */
    public function test_unselected_financial_source_is_excluded(): void
    {
        $data = [
            'beneficiary_type' => 'citizen',
            // Only salary is selected; citizen_account and retirement amounts are present but unselected
            'income_sources' => ['salary'],
            'monthly_salary' => 2000,
            'citizen_account_amount' => 1500,
            'retirement_pension' => 3000,
            'housing_type' => 'own',
        ];

        $res = $this->service->calculate($data);

        $this->assertEquals(2000.00, $res['total_income']);
        $this->assertEquals(2000.00, $res['net_income']);
    }

    /** 5. Resident can never become First Degree (always Second Degree) */
    public function test_resident_can_never_become_first_degree(): void
    {
        // Even with 0 income, resident must remain second_class (Decision #8)
        $data = [
            'beneficiary_type' => 'resident',
            'income_sources' => ['salary'],
            'monthly_salary' => 500,
            'housing_type' => 'own',
            'priority' => 'first_class', // Attempting to pass first_class
        ];

        $res = $this->service->calculate($data);

        $this->assertEquals('second_class', $res['priority']);
        $this->assertEquals($this->categoryDegree2->id, $res['category_id']);
    }

    /** 6. Resident need level calculated from configured threshold */
    public function test_resident_need_level_calculated_from_threshold(): void
    {
        Setting::set('resident_need_threshold', '3000');

        // 1. Severe need: net_income <= 3000
        $severeData = [
            'beneficiary_type' => 'resident',
            'income_sources' => ['salary'],
            'monthly_salary' => 2500,
            'housing_type' => 'own',
        ];
        $severeRes = $this->service->calculate($severeData);
        $this->assertEquals('second_class', $severeRes['priority']);
        $this->assertEquals('severe_need', $severeRes['need_level']);
        $this->assertEquals('احتياج شديد', $severeRes['need_level_label']);

        // 2. Normal need: net_income > 3000
        $normalData = [
            'beneficiary_type' => 'resident',
            'income_sources' => ['salary'],
            'monthly_salary' => 4500,
            'housing_type' => 'own',
        ];
        $normalRes = $this->service->calculate($normalData);
        $this->assertEquals('second_class', $normalRes['priority']);
        $this->assertEquals('normal_need', $normalRes['need_level']);
        $this->assertEquals('احتياج عادي', $normalRes['need_level_label']);
    }

    /** 7. Threshold change in settings affects subsequent calculation correctly */
    public function test_threshold_change_in_settings_affects_calculation_dynamically(): void
    {
        // Initially threshold is 2000
        Setting::set('resident_need_threshold', '2000');

        $data = [
            'beneficiary_type' => 'resident',
            'income_sources' => ['salary'],
            'monthly_salary' => 2500,
            'housing_type' => 'own',
        ];

        $res1 = $this->service->calculate($data);
        $this->assertEquals('normal_need', $res1['need_level']); // 2500 > 2000

        // Change threshold to 3500
        Setting::set('resident_need_threshold', '3500');

        $res2 = $this->service->calculate($data);
        $this->assertEquals('severe_need', $res2['need_level']); // 2500 <= 3500
    }

    /** 8. Backend ignores forged client calculated totals */
    public function test_backend_ignores_forged_client_calculated_totals_on_save(): void
    {
        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'محمد عبدالله الحامد',
            'national_id' => '1029384756',
            'phone' => '0551234567',
            'date_of_birth' => '1985-05-15',
            'city' => 'مكة المكرمة',
            'district' => 'العزيزية',
            'street' => 'شارع النور',
            'family_status' => 'متزوج',
            'family_members_count' => 4,
            'housing_type' => 'rent',
            'annual_rent_amount' => 12000, // 1000/month
            'income_sources' => ['salary'],
            'monthly_salary' => 5000,
            // Client forges these values:
            'total_income' => 99999.00,
            'monthly_rent' => 0.00,
            'net_income' => 99999.00,
            'priority' => 'first_class', // Should be recalculated as second_class (5000 - 1000 = 4000 > 3000)
        ]);

        $beneficiary->refresh();

        // Authoritative recalculated values:
        $this->assertEquals(5000.00, (float) $beneficiary->total_income);
        $this->assertEquals(1000.00, (float) $beneficiary->monthly_rent);
        $this->assertEquals(4000.00, (float) $beneficiary->net_income);
        $this->assertEquals('second_class', $beneficiary->priority);
    }

    /** 9. Resident Eloquent save strictly forces second_class even if first_class attempted */
    public function test_resident_eloquent_save_strictly_forces_second_class(): void
    {
        $resident = Beneficiary::create([
            'beneficiary_type' => 'resident',
            'full_name' => 'طارق الزيات',
            'national_id' => '2098765432',
            'phone' => '0559876543',
            'date_of_birth' => '1990-08-20',
            'nationality' => 'سوري',
            'city' => 'مكة المكرمة',
            'district' => 'الرصيفة',
            'street' => 'شارع التقوى',
            'family_status' => 'متزوج',
            'family_members_count' => 3,
            'housing_type' => 'own',
            'income_sources' => ['salary'],
            'monthly_salary' => 1000, // Even with 1000 SAR income
            'priority' => 'first_class', // Client attempts to force first_class
        ]);

        $resident->refresh();

        $this->assertEquals('second_class', $resident->priority);
        $this->assertEquals('severe_need', $resident->need_level);
        $this->assertEquals('احتياج شديد', $resident->need_level_label);
    }

    /** 10. No regression to existing citizen first degree classification */
    public function test_citizen_under_3000_is_first_degree(): void
    {
        $citizen = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'عبدالعزيز القحطاني',
            'national_id' => '1087654321',
            'phone' => '0507654321',
            'date_of_birth' => '1975-03-10',
            'city' => 'مكة المكرمة',
            'district' => 'النزهة',
            'street' => 'شارع السلام',
            'family_status' => 'متزوج',
            'family_members_count' => 6,
            'housing_type' => 'rent',
            'annual_rent_amount' => 18000, // 1500/month
            'income_sources' => ['salary', 'citizen_account'],
            'monthly_salary' => 3500,
            'citizen_account_amount' => 500, // Gross: 4000 - 1500 = 2500 <= 3000 -> First Class
        ]);

        $citizen->refresh();

        $this->assertEquals(4000.00, (float) $citizen->total_income);
        $this->assertEquals(1500.00, (float) $citizen->monthly_rent);
        $this->assertEquals(2500.00, (float) $citizen->net_income);
        $this->assertEquals('first_class', $citizen->priority);
        $this->assertNull($citizen->need_level); // Need level applies to residents
    }
}
