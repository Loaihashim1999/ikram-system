<?php

namespace Tests\Unit\Services;

use App\Models\Category;
use App\Models\Setting;
use App\Services\BeneficiaryClassificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BeneficiaryClassificationServiceTest extends TestCase
{
    use RefreshDatabase;

    protected BeneficiaryClassificationService $service;
    protected Category $categoryDegree1;
    protected Category $categoryDegree2;
    protected Category $categorySpecialNeeds;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new BeneficiaryClassificationService();

        $this->categoryDegree1 = Category::create([
            'name' => 'درجة أولى',
            'description' => 'الفئة الأكثر احتياجاً',
        ]);

        $this->categoryDegree2 = Category::create([
            'name' => 'درجة ثانية',
            'description' => 'الفئة متوسطة الاحتياج',
        ]);

        $this->categorySpecialNeeds = Category::create([
            'name' => 'ذوي الاحتياجات الخاصة',
            'description' => 'حالات ذوي الإعاقة',
        ]);
    }

    public function test_assigns_special_needs_category_when_flag_is_true(): void
    {
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'citizen',
            monthlySalary: 10000,
            hasSpecialNeeds: true
        );

        $this->assertEquals($this->categorySpecialNeeds->id, $categoryId);
    }

    public function test_assigns_degree_1_for_citizen_when_total_income_below_threshold(): void
    {
        // Salary 2000 + Social 1000 + Citizen Account 500 = 3500 <= 4000
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'citizen',
            monthlySalary: 2000,
            socialSecurityAmount: 1000,
            citizenAccountAmount: 500
        );

        $this->assertEquals($this->categoryDegree1->id, $categoryId);
    }

    public function test_assigns_degree_2_for_citizen_when_total_income_exceeds_threshold(): void
    {
        // Salary 3000 + Social 1000 + Citizen Account 500 = 4500 > 4000
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'citizen',
            monthlySalary: 3000,
            socialSecurityAmount: 1000,
            citizenAccountAmount: 500
        );

        $this->assertEquals($this->categoryDegree2->id, $categoryId);
    }

    public function test_assigns_degree_1_for_resident_when_salary_below_threshold(): void
    {
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'resident',
            monthlySalary: 3000
        );

        $this->assertEquals($this->categoryDegree1->id, $categoryId);
    }

    public function test_assigns_degree_2_for_resident_when_salary_exceeds_threshold(): void
    {
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'resident',
            monthlySalary: 5000
        );

        $this->assertEquals($this->categoryDegree2->id, $categoryId);
    }

    public function test_respects_custom_setting_threshold_from_database(): void
    {
        Setting::create([
            'key' => 'income_threshold_citizen',
            'value' => '6000',
        ]);

        // Income 5000 <= 6000 (custom threshold) => Degree 1
        $categoryId = $this->service->determineCategory(
            beneficiaryType: 'citizen',
            monthlySalary: 5000
        );

        $this->assertEquals($this->categoryDegree1->id, $categoryId);
    }
}
