<?php

namespace Tests\Unit\Models;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class BeneficiaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_auto_computes_total_income_on_creation(): void
    {
        $category = Category::create(['name' => 'درجة أولى']);

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'أحمد محمد',
            'national_id' => '1012345678',
            'phone' => '0501234567',
            'category_id' => $category->id,
            'monthly_salary' => 2000.00,
            'social_security_amount' => 1000.00,
            'citizen_account_amount' => 500.00,
            'retirement_pension' => 300.00,
            'family_support' => 200.00,
            'income_sources' => ['salary', 'social_security', 'citizen_account', 'retirement', 'family_support'],
        ]);

        // Citizen formula includes every explicitly selected valid source.
        $this->assertEquals(4000.00, (float) $beneficiary->total_income);

        $resident = Beneficiary::create([
            'beneficiary_type' => 'resident',
            'full_name' => 'كمال سليم',
            'national_id' => '2012345678',
            'phone' => '0501234599',
            'category_id' => $category->id,
            'monthly_salary' => 2000.00,
            'family_support' => 500.00,
            'social_security_amount' => 1000.00, // Should not be added for resident
            'income_sources' => ['salary', 'family_support', 'social_security'],
        ]);

        // Resident formula: monthly_salary (2000) + family_support (500) = 2500
        $this->assertEquals(2500.00, (float) $resident->total_income);
    }

    public function test_updates_total_income_when_financials_change(): void
    {
        $category = Category::create(['name' => 'درجة أولى']);

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'سارة علي',
            'national_id' => '1098765432',
            'phone' => '0551234567',
            'category_id' => $category->id,
            'monthly_salary' => 1500.00,
            'income_sources' => ['salary'],
        ]);

        $this->assertEquals(1500.00, (float) $beneficiary->total_income);

        $beneficiary->update([
            'monthly_salary' => 2500.00,
            'social_security_amount' => 500.00,
            'income_sources' => ['salary', 'social_security'],
        ]);

        $this->assertEquals(3000.00, (float) $beneficiary->refresh()->total_income);
    }

    public function test_masks_iban_correctly_when_iban_encrypted_is_set(): void
    {
        $category = Category::create(['name' => 'درجة أولى']);
        $plainIban = 'SA1234567890123456789012';

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'خالد عبدالله',
            'national_id' => '1022334455',
            'phone' => '0541234567',
            'category_id' => $category->id,
            'iban_encrypted' => Crypt::encryptString($plainIban),
        ]);

        $masked = $beneficiary->iban_masked;
        $this->assertNotNull($masked);
        $this->assertStringEndsWith('9012', $masked);
        $this->assertEquals(strlen($plainIban), strlen($masked));
    }

    public function test_has_many_dependents_relationship(): void
    {
        $category = Category::create(['name' => 'درجة أولى']);

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'محمد سعيد',
            'national_id' => '1033445566',
            'phone' => '0531234567',
            'category_id' => $category->id,
        ]);

        $dependent = Dependent::create([
            'beneficiary_id' => $beneficiary->id,
            'name' => 'عمر محمد',
            'relationship' => 'ابن',
            'national_id' => '1122334455',
        ]);

        $this->assertCount(1, $beneficiary->dependents);
        $this->assertEquals($dependent->id, $beneficiary->dependents->first()->id);
    }

    /**
     * Requirement 4: Test Non-Financial Edit Safety.
     * Editing non-financial fields (address, phone, name) must NOT reset or alter financial values.
     */
    public function test_non_financial_edits_preserve_financial_calculations(): void
    {
        Category::firstOrCreate(['name' => 'درجة أولى'], ['description' => 'الفئة الأولى']);
        $cat2 = Category::firstOrCreate(['name' => 'درجة ثانية'], ['description' => 'الفئة الثانية']);

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'resident',
            'full_name' => 'TEST RESIDENT WORKER',
            'national_id' => '2987654321',
            'phone' => '0555555555',
            'date_of_birth' => '1990-01-01',
            'nationality' => 'TEST',
            'city' => 'مكة المكرمة',
            'district' => 'الرصيفة',
            'street' => 'الشارع العام',
            'family_status' => 'poor',
            'family_members_count' => 3,
            'housing_type' => 'rent',
            'annual_rent_amount' => 12000.00, // monthly_rent = 1000.00
            'income_sources' => ['salary', 'family_support'],
            'monthly_salary' => 3000.00,
            'family_support' => 500.00, // total_income = 3500.00, net_income = 2500.00
            'category_id' => $cat2->id,
        ]);

        // Baseline financial values
        $this->assertEquals(3500.00, (float) $beneficiary->total_income);
        $this->assertEquals(1000.00, (float) $beneficiary->monthly_rent);
        $this->assertEquals(2500.00, (float) $beneficiary->net_income);
        $this->assertEquals('second_class', $beneficiary->priority);
        $this->assertEquals('severe_need', $beneficiary->need_level);
        $this->assertEquals(['salary', 'family_support'], $beneficiary->income_sources);

        // Edit 1: ONLY street & district (address)
        $beneficiary->update([
            'district' => 'العزيزية الجديدة',
            'street' => 'شارع المندوبين',
        ]);
        $beneficiary->refresh();

        $this->assertEquals('العزيزية الجديدة', $beneficiary->district);
        $this->assertEquals('شارع المندوبين', $beneficiary->street);
        $this->assertEquals(3500.00, (float) $beneficiary->total_income);
        $this->assertEquals(1000.00, (float) $beneficiary->monthly_rent);
        $this->assertEquals(2500.00, (float) $beneficiary->net_income);
        $this->assertEquals('second_class', $beneficiary->priority);
        $this->assertEquals('severe_need', $beneficiary->need_level);
        $this->assertEquals(['salary', 'family_support'], $beneficiary->income_sources);

        // Edit 2: ONLY phone
        $beneficiary->update([
            'phone' => '0566666666',
        ]);
        $beneficiary->refresh();

        $this->assertEquals('0566666666', $beneficiary->phone);
        $this->assertEquals(3500.00, (float) $beneficiary->total_income);
        $this->assertEquals(1000.00, (float) $beneficiary->monthly_rent);
        $this->assertEquals(2500.00, (float) $beneficiary->net_income);
        $this->assertEquals('second_class', $beneficiary->priority);
        $this->assertEquals('severe_need', $beneficiary->need_level);
        $this->assertEquals(['salary', 'family_support'], $beneficiary->income_sources);

        // Edit 3: ONLY full_name
        $beneficiary->update([
            'full_name' => 'TEST RESIDENT WORKER UPDATED',
        ]);
        $beneficiary->refresh();

        $this->assertEquals('TEST RESIDENT WORKER UPDATED', $beneficiary->full_name);
        $this->assertEquals(3500.00, (float) $beneficiary->total_income);
        $this->assertEquals(1000.00, (float) $beneficiary->monthly_rent);
        $this->assertEquals(2500.00, (float) $beneficiary->net_income);
        $this->assertEquals('second_class', $beneficiary->priority);
        $this->assertEquals('severe_need', $beneficiary->need_level);
        $this->assertEquals(['salary', 'family_support'], $beneficiary->income_sources);
    }
}
