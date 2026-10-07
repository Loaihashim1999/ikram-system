<?php

namespace Tests\Postgres;

use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\PolicyCExceptionsSnapshotAuthTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

class PolicyDPostgresTest extends PolicyCExceptionsSnapshotAuthTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_policy_d_tables_exist_on_pg(): void
    {
        $this->assertTrue(Schema::hasTable('social_assessments'));
        $this->assertTrue(Schema::hasTable('document_verifications'));
        $this->assertTrue(Schema::hasTable('medical_evidence'));
        $this->assertTrue(Schema::hasTable('policy_decisions'));
    }

    public function test_policy_d_document_rules_configured_on_pg(): void
    {
        $validated = PolicyConfigurationValidator::withDefaults([]);
        $this->assertArrayHasKey('documents', $validated);
        $this->assertNotEmpty($validated['documents']['rules']);
        $this->assertContains('family_record', array_column($validated['documents']['rules'], 'code'));
    }

    public function test_policy_d_document_verification_persisted_on_pg(): void
    {
        $b = $this->makeBeneficiary();
        $v = PolicyDocumentVerificationService::class;
        $service = app($v);
        $record = $service->verify($b->id, 'national_id', null, [
            'verified_by' => $this->admin->id,
            'verified_at' => now(),
            'evidence_reference' => 'documents/national_id_example.pdf',
        ]);
        $stored = DB::table('document_verifications')
            ->where('beneficiary_id', $b->id)
            ->where('document_code', 'national_id')
            ->first();
        $this->assertNotNull($stored);
        $this->assertSame('verified', $stored->verification_status);
    }
}
