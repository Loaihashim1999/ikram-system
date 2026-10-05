<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * POLICY-E2/E3 — additive extension of the POLICY-E1 run ledger.
 *
 * - simulation_summary (JSONB): the E2 impact summary (counts, category
 *   histograms, delta counters) — sanitized aggregates only, never PII.
 * - approved_by / approved_at: the separate POLICY-E3 apply authorization
 *   (`beneficiary_policy:apply_scope`) stamped when a simulated run is
 *   approved for execution; distinct from simulation and execution actors.
 *
 * E1 tables/columns/state machines are not rebuilt or altered semantically.
 */
return new class extends Migration
{
    public function up(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        Schema::table('policy_application_runs', function (Blueprint $table) use ($pgsql) {
            $table->jsonb('simulation_summary')->nullable()->after('candidate_set_hash');
            $table->dateTime('approved_at')->nullable()->after('simulated_at');
            if ($pgsql) {
                $table->foreignUuid('approved_by')->nullable()->after('simulation_created_by')
                    ->constrained('users')->nullOnDelete();
            } else {
                // SQLite cannot add an FK in place; a rebuild would silently drop
                // the E1 inline enum CHECK constraints (verified). The ledger is
                // extended with a plain column there and the state machines guard it.
                $table->uuid('approved_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        $pgsql = Schema::getConnection()->getDriverName() === 'pgsql';

        Schema::table('policy_application_runs', function (Blueprint $table) use ($pgsql) {
            if ($pgsql) {
                $table->dropConstrainedForeignId('approved_by');
            } else {
                $table->dropColumn('approved_by');
            }
            $table->dropColumn(['simulation_summary', 'approved_at']);
        });
    }
};
