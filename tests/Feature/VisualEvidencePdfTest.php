<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\Driver;
use App\Models\InventoryItem;
use App\Models\PolicyDecision;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisualEvidencePdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_write_safe_visual_pdf_samples(): void
    {
        $admin = User::create([
            'username' => 'TEST_visual_'.Str::random(6),
            'full_name' => 'موظف EKRAM-VISUAL-PREVIEW',
            'password' => 'test-password',
            'role' => 'admin',
            'permissions' => [],
            'is_active' => true,
        ]);
        $beneficiary = Beneficiary::create([
            'full_name' => 'مستفيد EKRAM-VISUAL-PREVIEW',
            'national_id' => '1000000001',
            'phone' => '0501111000',
            'beneficiary_type' => 'citizen',
            'status' => 'active',
            'family_status' => 'poor',
            'city' => 'مكة المكرمة',
            'district' => 'العزيزية',
            'street' => 'شارع المعاينة',
            'family_members_count' => 4,
            'housing_type' => 'rent',
        ]);
        $version = BeneficiaryPolicyVersion::create([
            'policy_name' => 'سياسة المعاينة',
            'version' => 'EKRAM-VISUAL-PREVIEW',
            'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2026-01-01',
            'status' => 'retired',
        ]);
        $evaluation = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $version->id,
            'evaluation_status' => 'completed',
            'evaluated_at' => now()->subDay(),
            'gross_counted_income' => 1000,
            'monthly_rent' => 200,
            'family_size' => 4,
            'adjusted_net_household_income' => 800,
            'net_income_per_capita' => 200,
            'income_category' => 'B',
            'policy_score' => 42,
            'score_category' => 'A',
            'scoring_snapshot' => ['breakdown' => [[
                'rule_id' => 'income', 'label' => 'الدخل', 'value' => '1000', 'condition' => 'حد الدخل',
                'awarded_points' => 8, 'max_points' => 10, 'reason' => 'مطابق',
            ]], 'blockers' => []],
        ]);
        PolicyDecision::create([
            'evaluation_id' => $evaluation->id,
            'policy_version_id' => $version->id,
            'decision' => 'eligible',
            'human_readable_reason' => 'مؤهل وفق اللقطة المحفوظة',
            'decided_at' => now()->subDay(),
            'decided_by' => $admin->id,
        ]);
        InventoryItem::create(['name' => 'صنف EKRAM-VISUAL-PREVIEW', 'unit' => 'حبة', 'current_quantity' => 12, 'min_threshold' => 2]);
        Driver::create(['full_name' => 'سائق EKRAM-VISUAL-PREVIEW', 'phone' => '966574917155', 'is_active' => true]);
        $pickup = $this->support($beneficiary, 'pickup');
        $delivery = $this->support($beneficiary, 'delivery');
        Sanctum::actingAs($admin);

        $this->savePdf('/api/documents/beneficiary/'.$beneficiary->id.'/pdf', 'beneficiary-sample.pdf');
        $this->savePdf('/api/documents/policy-evaluation/'.$evaluation->id.'/pdf', 'policy-sample.pdf');
        $this->savePdf('/api/support/distributions/'.$pickup->id.'/proof', 'direct-handover-sample.pdf');
        $this->savePdf('/api/support/distributions/'.$delivery->id.'/proof', 'home-delivery-sample.pdf');
        $this->savePdf('/api/documents/inventory/pdf', 'inventory-sample.pdf');
        $this->savePdf('/api/documents/drivers/pdf', 'driver-report-sample.pdf');
        $this->savePdf('/api/reports/comprehensive/pdf?period_type=custom&start_date=2026-09-01&end_date=2026-10-07', 'governance-sample.pdf');
        $this->assertFileExists(base_path('reports/visual-evidence/governance-sample.pdf'));
    }

    private function support(Beneficiary $beneficiary, string $method): SupportDistribution
    {
        $support = SupportDistribution::create([
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiary->id,
            'recipient_name' => 'اسم قديم',
            'recipient_reference' => 'EKRAM-VISUAL-PREVIEW',
            'fulfillment_method' => $method,
            'status' => 'completed',
            'support_date' => now()->toDateString(),
            'completed_at' => now(),
        ]);
        SupportReceipt::create([
            'support_distribution_id' => $support->id,
            'confirmed_by' => User::query()->value('id'),
            'confirmed_at' => now(),
            'proof_snapshot' => [
                'task_reference' => 'EKRAM-VISUAL-PREVIEW',
                'fulfillment_method' => $method,
                'verification_method' => 'receipt_code',
                'final_status' => 'completed',
                'source' => 'confirmation',
                'confirmed_at' => now()->toIso8601String(),
                'recipient' => [
                    'display_name' => 'مستفيد EKRAM-VISUAL-PREVIEW',
                    'phone' => '0501111000',
                    'full_address' => 'مكة المكرمة، العزيزية، شارع المعاينة',
                    'reference' => 'EKRAM-VISUAL-PREVIEW',
                    'type' => 'beneficiary',
                ],
                'pickup_location' => 'مقر الجمعية',
                'driver' => ['name' => 'سائق EKRAM-VISUAL-PREVIEW'],
                'employee' => ['name' => 'موظف EKRAM-VISUAL-PREVIEW'],
                'items' => [['name' => 'سلة غذائية', 'quantity' => 1, 'unit' => 'حبة']],
            ],
        ]);

        return $support;
    }

    private function savePdf(string $url, string $name): void
    {
        $response = $this->get($url);
        $response->assertOk();
        $bytes = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $bytes);
        $directory = base_path('reports/visual-evidence');
        if (! is_dir($directory)) {
            mkdir($directory, 0750, true);
        }
        file_put_contents($directory.DIRECTORY_SEPARATOR.$name, $bytes);
    }
}
