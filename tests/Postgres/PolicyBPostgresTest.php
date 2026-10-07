<?php

namespace Tests\Postgres;

use App\Services\FinancialCalculationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\PolicyBEvaluationAndEligibilityTest;

/**
 * Isolated PostgreSQL QA for POLICY-B (JSONB eligibility storage, numeric
 * monetary columns, dependents.is_active default, additive registry columns,
 * rollback / re-migrate).
 *
 * Guarded by verifyPhase2aTarget() — refuses to run outside ikram_phase2a_qa
 * on 127.0.0.1:5432. Never run against an operational database.
 */
if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

class PolicyBPostgresTest extends PolicyBEvaluationAndEligibilityTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_policy_b_eligibility_reasons_stored_as_jsonb(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $evaluation = $this->evaluate($b, $this->publishVersion());

        $type = DB::selectOne(
            "SELECT data_type FROM information_schema.columns WHERE table_name = 'beneficiary_policy_evaluations' AND column_name = 'eligibility_reasons'"
        );
        $this->assertSame('jsonb', $type->data_type);

        $row = DB::selectOne('SELECT eligibility_reasons::jsonb AS reasons FROM beneficiary_policy_evaluations WHERE id = ?', [$evaluation->id]);
        $this->assertNotNull($row);
        $this->assertContains('POLICY_DOCUMENT_REVIEW_REQUIRED', json_decode($row->reasons, true));
    }

    public function test_policy_b_decimal_columns_are_numeric_on_pg(): void
    {
        $checks = [
            ['beneficiary_policy_evaluations', 'gross_counted_income'],
            ['beneficiary_policy_evaluations', 'adjusted_net_household_income'],
            ['beneficiary_policy_evaluations', 'net_income_per_capita'],
            ['beneficiaries', 'social_insurance_amount'],
            ['beneficiaries', 'other_income_amount'],
        ];
        foreach ($checks as [$table, $column]) {
            $col = DB::selectOne(
                'SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
                [$table, $column]
            );
            $this->assertNotNull($col, "Column {$table}.{$column} must exist.");
            $this->assertSame('numeric', $col->data_type, "{$table}.{$column} must be numeric on PostgreSQL.");
            $this->assertSame(14, (int) $col->numeric_precision, "{$table}.{$column} precision must be 14.");
            $this->assertSame(2, (int) $col->numeric_scale, "{$table}.{$column} scale must be 2.");
        }
    }

    public function test_policy_b_dependents_is_active_boolean_default_true(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $b->dependents()->create(['name' => 'طفل تجريبي', 'relationship' => 'ابن', 'date_of_birth' => '2010-01-01']);

        $dependent = $b->dependents()->firstOrFail();
        $this->assertTrue($dependent->is_active);

        $row = DB::selectOne('SELECT is_active FROM dependents WHERE id = ?', [$dependent->id]);
        $this->assertTrue($row->is_active);

        $default = DB::selectOne(
            "SELECT column_default FROM information_schema.columns WHERE table_name = 'dependents' AND column_name = 'is_active'"
        );
        $this->assertStringContainsString('true', strtolower((string) $default->column_default));
    }

    public function test_policy_b_registry_amount_columns_round_trip(): void
    {
        $b = $this->makeBeneficiary([
            'housing_type' => 'own',
            'social_insurance_amount' => 250.5,
            'other_income_amount' => 75.25,
        ]);
        $this->assertSame('250.50', $b->social_insurance_amount);
        $this->assertSame('75.25', $b->other_income_amount);

        $calculator = app(FinancialCalculationService::class);
        $res = $calculator->calculatePolicyFinancials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary', 'social_insurance', 'other']]]));
        // salary 3000 + social_insurance 250.50 + other 75.25 = 3325.75
        $this->assertSame('3325.75', $this->money($res['counted_gross_monthly_income']));
    }

    public function test_policy_b_rollback_recreates_policy_b_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('beneficiary_policy_evaluations', 'eligibility_reasons'));

        $migration = require database_path('migrations/2026_09_21_020000_policy_b_financial_eligibility_extension.php');

        $migration->down();
        $this->assertFalse(Schema::hasColumn('beneficiary_policy_evaluations', 'eligibility_reasons'));
        $this->assertFalse(Schema::hasColumn('beneficiary_policy_evaluations', 'eligibility_decision'));
        $this->assertFalse(Schema::hasColumn('dependents', 'is_active'));
        $this->assertFalse(Schema::hasColumn('beneficiaries', 'social_insurance_amount'));
        $this->assertFalse(Schema::hasColumn('beneficiaries', 'other_income_amount'));

        $migration->up();
        $this->assertTrue(Schema::hasColumn('beneficiary_policy_evaluations', 'eligibility_reasons'));
        $this->assertTrue(Schema::hasColumn('beneficiary_policy_evaluations', 'eligibility_decision'));
        $this->assertTrue(Schema::hasColumn('dependents', 'is_active'));
        $this->assertTrue(Schema::hasColumn('beneficiaries', 'social_insurance_amount'));
        $this->assertTrue(Schema::hasColumn('beneficiaries', 'other_income_amount'));
    }
}
