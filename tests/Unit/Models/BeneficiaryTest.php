<?php

namespace Tests\Unit\Models;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use App\Models\Distribution;
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
        ]);

        $this->assertEquals(4000.00, (float) $beneficiary->total_income);
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
        ]);

        $this->assertEquals(1500.00, (float) $beneficiary->total_income);

        $beneficiary->update([
            'monthly_salary' => 2500.00,
            'social_security_amount' => 500.00,
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
}
