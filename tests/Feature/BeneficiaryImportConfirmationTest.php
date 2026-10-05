<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class BeneficiaryImportConfirmationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Sanctum::actingAs(PolicyEScenario::actor());
    }

    private function payload(): array
    {
        return ['reviewed_confirmation' => true,
            'target' => 'permanent',
            'file' => UploadedFile::fake()->createWithContent('ekram-test.csv', "full_name,national_id,phone,nationality\nEKRAM-E2E-TEST import,1999999911,0501234567,سعودي\n"),
            'mapping' => json_encode(['full_name' => 'full_name', 'national_id' => 'national_id', 'phone' => 'phone', 'nationality' => 'nationality'])];
    }

    public function test_all_beneficiary_import_write_boundaries_require_review(): void
    {
        $this->postJson('/api/beneficiaries/import', ['rows' => []])->assertUnprocessable()->assertJsonValidationErrors('reviewed_confirmation');
        $this->postJson('/api/smart-import/beneficiaries', [])->assertUnprocessable()->assertJsonValidationErrors('reviewed_confirmation');
        $this->assertDatabaseCount('beneficiaries', 0);
    }

    public function test_smart_import_confirms_and_audits_without_exposing_identity_in_audit(): void
    {
        $this->post('/api/smart-import/beneficiaries', $this->payload(), ['Accept' => 'application/json'])->assertOk()->assertJsonPath('created', 1);
        $beneficiary = Beneficiary::firstOrFail();
        $this->assertNotNull($beneficiary->confirmed_at);
        $this->assertNotNull($beneficiary->confirmed_by);
        $audit = AuditLog::where('action', 'BENEFICIARY_REGISTRATION_CONFIRMED')->where('target_id', $beneficiary->id)->firstOrFail();
        $this->assertStringNotContainsString($beneficiary->national_id, json_encode($audit->details));
    }

    public function test_smart_import_rolls_back_confirmation_when_audit_fails(): void
    {
        AuditLog::creating(function ($audit) {
            if ($audit->action === 'BENEFICIARY_REGISTRATION_CONFIRMED') {
                throw new \RuntimeException('Synthetic audit failure');
            }
        });
        try {
            $this->post('/api/smart-import/beneficiaries', $this->payload(), ['Accept' => 'application/json'])->assertStatus(500);
            $this->assertDatabaseCount('beneficiaries', 0);
        } finally {
            AuditLog::flushEventListeners();
        }
    }
}
