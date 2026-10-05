<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Null deliberately means no authoritative delivery-time snapshot exists.
        // Existing receipt history must never be backfilled from current identities.
        Schema::table('support_receipts', fn (Blueprint $table) => $table->jsonb('proof_snapshot')->nullable());

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION ekram_support_receipt_snapshot_immutable() RETURNS trigger AS $$
BEGIN
    IF NEW.proof_snapshot IS DISTINCT FROM OLD.proof_snapshot THEN
        RAISE EXCEPTION 'Receipt proof snapshots are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER support_receipt_snapshot_immutable
BEFORE UPDATE OF proof_snapshot ON support_receipts
FOR EACH ROW EXECUTE FUNCTION ekram_support_receipt_snapshot_immutable();
SQL);
        }
    }

    public function down(): void
    {
        if (DB::table('support_receipts')->whereNotNull('proof_snapshot')->exists()) {
            throw new RuntimeException('Rollback refused: immutable receipt proof snapshots exist.');
        }
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS support_receipt_snapshot_immutable ON support_receipts; DROP FUNCTION IF EXISTS ekram_support_receipt_snapshot_immutable();');
        }
        Schema::table('support_receipts', fn (Blueprint $table) => $table->dropColumn('proof_snapshot'));
    }
};
