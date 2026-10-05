<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * POLICY-B — Financial Policy + Eligibility: additive schema extension.
 *
 * - beneficiaries: canonical registry storage for social insurance & other income
 *   (registry sources preserved; nullable so existing flows are untouched).
 * - dependents: is_active flag — active registered household members count
 *   toward the authoritative family size; inactive members are excluded.
 * - beneficiary_policy_evaluations: first-class intermediate eligibility result
 *   (decision + stable machine-readable reason codes). final_policy_decision
 *   stays unset until POLICY-C/D — no invented classification here.
 *
 * Reversible: down() drops only the added columns.
 */
return new class extends Migration
{
    private function driver(): string
    {
        return Schema::getConnection()->getDriverName();
    }

    private function jsonType(): string
    {
        return $this->driver() === 'pgsql' ? 'jsonb' : 'json';
    }

    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $t) {
            $t->decimal('social_insurance_amount', 14, 2)->nullable();
            $t->decimal('other_income_amount', 14, 2)->nullable();
            // Raw direct monthly rent captured at the input boundary. The legacy
            // monthly_rent column doubles as the computed PREVIEW (annual/12 XOR
            // direct), so POLICY-B direct-monthly mode reads this trusted input
            // column instead of the clobbered preview (see POLICY_B_FINANCIAL_CONTRACT_AUDIT).
            $t->decimal('monthly_rent_direct_input', 14, 2)->nullable();
        });

        Schema::table('dependents', function (Blueprint $t) {
            $t->boolean('is_active')->default(true);
        });

        Schema::table('beneficiary_policy_evaluations', function (Blueprint $t) {
            $t->string('eligibility_decision', 30)->nullable();
            $t->{$this->jsonType()}('eligibility_reasons')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('beneficiary_policy_evaluations', function (Blueprint $t) {
            $t->dropColumn(['eligibility_decision', 'eligibility_reasons']);
        });

        Schema::table('dependents', function (Blueprint $t) {
            $t->dropColumn('is_active');
        });

        Schema::table('beneficiaries', function (Blueprint $t) {
            $t->dropColumn(['social_insurance_amount', 'other_income_amount', 'monthly_rent_direct_input']);
        });
    }
};
