<?php

namespace Tests\Support;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyApplicationRunService;
use App\Services\BeneficiaryPolicy\PolicyApplicationSimulationService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use Illuminate\Support\Facades\DB;

/**
 * POLICY-E test scenario builder (E2/E3/E4 suites).
 *
 * Builds REAL published versions, beneficiaries, runs and simulations through the
 * production services — never by writing rows that the engine should have created.
 */
final class PolicyEScenario
{
    public static function actor(array $permissions = [], string $role = 'admin'): User
    {
        $suffix = strtoupper(substr(md5(uniqid('', true)), 0, 8));

        return User::create([
            'username' => 'TEST_POLICYE_'.$suffix,
            'full_name' => 'TEST POLICY E',
            'password' => 'test-password',
            'email' => 'policye-'.$suffix.'@example.invalid',
            'role' => $role,
            'permissions' => ['beneficiary_policy' => array_fill_keys($permissions, true)],
            'is_active' => true,
        ]);
    }

    public static function version(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        return BeneficiaryPolicyVersion::create(array_merge([
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'policy_scope' => 'citizen_beneficiaries',
            'version' => (string) mt_rand(100000, 999999),
            'effective_from' => '2026-01-01',
            'configuration' => PolicyConfigurationValidator::withDefaults($config),
        ], $overrides));
    }

    public static function published(User $actor, array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        $version = self::version($config, $overrides);
        $versions = app(BeneficiaryPolicyVersionService::class);
        $versions->approve($version->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-01-01'], $actor->id);
        $versions->publish($version->id, $actor->id);

        return $version->fresh();
    }

    public static function beneficiary(array $overrides = []): Beneficiary
    {
        $beneficiary = Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => 'TEST POLICY E BENEFICIARY',
            'national_id' => '1'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'income_sources' => ['salary'],
            'monthly_salary' => 500,
            'social_security_amount' => 0,
            'citizen_account_amount' => 0,
            'retirement_pension' => 0,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));

        return $beneficiary;
    }

    /** Backdate the canonical registration instant (never updated_at). */
    public static function registeredAt(Beneficiary $beneficiary, string $timestamp): Beneficiary
    {
        DB::table('beneficiaries')->where('id', $beneficiary->id)->update(['created_at' => $timestamp]);

        return $beneficiary->refresh();
    }

    public static function run(BeneficiaryPolicyVersion $version, array $parameters, User $actor): PolicyApplicationRun
    {
        return app(PolicyApplicationRunService::class)->create($version, $parameters, $actor->id);
    }

    public static function simulate(PolicyApplicationRun $run, User $actor): PolicyApplicationRun
    {
        return app(PolicyApplicationSimulationService::class)->simulate($run, $actor->id);
    }
}
