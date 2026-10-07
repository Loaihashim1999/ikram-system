<?php

use App\Models\Beneficiary;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['candidate_ready'] ?? false) !== true || empty($input['expected_revision']) || getenv('CONTAINER_APP_REVISION') !== $input['expected_revision']) {
    throw new RuntimeException('ABORT: exact authorized candidate required');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('services.communications.provider') !== 'fake' || config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'ikram_prod') {
    throw new RuntimeException('ABORT: approved candidate environment required');
}
$manifest = $input['manifest'] ?? [];
$run = $manifest['run_id'] ?? '';
if (! preg_match('/^[a-f0-9-]{36}$/D', $run)) {
    throw new RuntimeException('ABORT: synthetic run ID required');
}
$marker = 'EKRAM-E2E-TEST '.$run;
$ids = $manifest['ids'] ?? [];
$actor = User::findOrFail($ids['actor'] ?? '');
$expectedUsername = 'EKRAM-E2E-TEST-'.substr(str_replace('-', '', $run), 0, 32);
if ($actor->username !== $expectedUsername || ! str_starts_with($actor->full_name, $marker)) {
    throw new RuntimeException('ABORT: original accounts must never be modified');
}
$beneficiaryIds = array_values(array_unique(array_merge($ids['beneficiaries'] ?? [], $manifest['additional_beneficiaries'] ?? [])));
$taskIds = array_values(array_unique(array_merge($ids['delivery'] ?? [], [$ids['pickup'] ?? ''], $ids['control_tasks'] ?? [], $manifest['additional_distributions'] ?? [])));
$taskIds = array_values(array_filter($taskIds));
$uploads = [];
$counts = DB::transaction(function () use ($run, $marker, $ids, $actor, $beneficiaryIds, $taskIds, &$uploads) {
    DB::statement("SET LOCAL statement_timeout = '30s'");
    DB::statement("SET LOCAL lock_timeout = '5s'");
    foreach ($beneficiaryIds as $id) {
        $record = Beneficiary::whereKey($id)->lockForUpdate()->firstOrFail();
        if (! str_starts_with($record->full_name, $marker) || $record->created_by !== $actor->id) {
            throw new RuntimeException('ABORT: beneficiary ownership mismatch');
        }
        foreach (['national_id_image_url', 'residence_id_image_url', 'national_address_image_url', 'rental_contract_image_url'] as $column) {
            $path = $record->getRawOriginal($column);
            if ($path && str_starts_with($path, 'beneficiaries/') && ! str_contains($path, '..')) {
                $uploads[] = $path;
            }
        }
    }
    foreach ($taskIds as $id) {
        $record = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
        if ($record->created_by !== $actor->id || ! in_array($record->beneficiary_id, $beneficiaryIds, true)) {
            throw new RuntimeException('ABORT: task ownership mismatch');
        }
    }
    foreach (['inventory_items' => ['inventory', 'name'], 'drivers' => ['driver', 'full_name'], 'pickup_locations' => ['pickup_location', 'name']] as $table => [$key, $field]) {
        $record = DB::table($table)->where('id', $ids[$key] ?? '')->lockForUpdate()->first();
        if (! $record || ! str_starts_with($record->{$field}, $marker)) {
            throw new RuntimeException('ABORT: synthetic parent ownership mismatch');
        }
    }
    // Refuse to remove test parents if any unlisted business record references them.
    if (DB::table('support_distributions')->where(fn ($q) => $q->whereIn('beneficiary_id', $beneficiaryIds)->orWhere('driver_id', $ids['driver'])->orWhere('pickup_location_id', $ids['pickup_location']))->whereNotIn('id', $taskIds)->exists()) {
        throw new RuntimeException('ABORT: unlisted dependent task');
    }
    if (DB::table('support_distribution_items')->where('inventory_item_id', $ids['inventory'])->whereNotIn('support_distribution_id', $taskIds)->exists()) {
        throw new RuntimeException('ABORT: unlisted stock reference');
    }
    if (! empty($ids['control_inventory'])) {
        $controlStock = DB::table('inventory_items')->where('id', $ids['control_inventory'])->lockForUpdate()->first();
        if (! $controlStock || $controlStock->name !== $marker.' Control Basket' || DB::table('support_distribution_items')->where('inventory_item_id', $ids['control_inventory'])->whereNotIn('support_distribution_id', $ids['control_tasks'])->exists()) {
            throw new RuntimeException('ABORT: control stock ownership mismatch');
        }
    }
    $assignmentIds = DB::table('driver_assignments')->where('driver_id', $ids['driver'])->where('created_by', $actor->id)->pluck('id')->all();
    $evaluationIds = DB::table('beneficiary_policy_evaluations')->whereIn('beneficiary_id', $beneficiaryIds)->pluck('id')->all();
    $policyId = $ids['policy'] ?? null;
    if ($policyId) {
        $policy = DB::table('beneficiary_policy_versions')->where('id', $policyId)->lockForUpdate()->first();
        if (! $policy || $policy->policy_name !== $marker.' TEST Policy') {
            throw new RuntimeException('ABORT: policy ownership mismatch');
        }
        if (DB::table('beneficiary_policy_evaluations')->where('policy_version_id', $policyId)->whereNotIn('id', $evaluationIds)->exists() || DB::table('beneficiary_policy_versions')->where('parent_version_id', $policyId)->exists() || DB::table('policy_application_runs')->where('policy_version_id', $policyId)->exists()) {
            throw new RuntimeException('ABORT: policy has foreign evaluation/version/run references');
        }
        foreach (['social_assessments', 'policy_decisions'] as $table) {
            if (DB::table($table)->where('policy_version_id', $policyId)->whereNotIn('evaluation_id', $evaluationIds)->exists()) {
                throw new RuntimeException('ABORT: foreign policy workflow reference');
            }
        }
    }
    if (DB::table('policy_application_run_items')->where(fn ($q) => $q->whereIn('source_evaluation_id', $evaluationIds)->orWhereIn('new_evaluation_id', $evaluationIds))->exists()) {
        throw new RuntimeException('ABORT: evaluation referenced by application run item');
    }
    $receiptIds = DB::table('support_receipts')->whereIn('support_distribution_id', $taskIds)->pluck('id')->all();
    $scope = array_values(array_unique(array_merge($beneficiaryIds, $taskIds, $assignmentIds, $evaluationIds, $receiptIds, [$actor->id, $ids['inventory'], $ids['driver'], $ids['pickup_location']])));
    $messageIds = DB::table('communication_messages')->whereIn('operation_id', array_merge($taskIds, $assignmentIds))->pluck('id')->all();
    foreach ($ids['messages'] ?? [] as $messageId) {
        $row = DB::table('communication_messages')->where('id', $messageId)->first();
        if ($row && ! in_array($row->operation_id, $scope, true) && $row->operation_id !== $marker && $row->operation_id !== $run) {
            throw new RuntimeException('ABORT: communication ownership mismatch');
        }
        if ($row) {
            $messageIds[] = $messageId;
        }
    }
    $deleted = [];
    $remove = function ($table, $column, $values) use (&$deleted) {
        if (Schema::hasTable($table) && $values) {
            $deleted[$table] = ($deleted[$table] ?? 0) + DB::table($table)->whereIn($column, $values)->delete();
        }
    };
    foreach (['jobs', 'failed_jobs'] as $table) {
        if (! Schema::hasTable($table)) {
            continue;
        }
        foreach (array_unique($messageIds) as $id) {
            $deleted[$table] = ($deleted[$table] ?? 0) + DB::table($table)->where('payload', 'like', '%SendCommunication%')->where('payload', 'like', '%'.$id.'%')->delete();
        }
    }
    // Real recipients may have transient TEST-target events. Remove only those
    // verified model/target/event tuples; never sweep their other notifications.
    $notificationIds = DB::table('notifications')->where(function ($query) use ($taskIds, $beneficiaryIds) {
        $query->where(fn ($q) => $q->where('related_record_type', SupportDistribution::class)->whereIn('related_record_id', $taskIds)->where('event_type', 'like', 'support_%'))
            ->orWhere(fn ($q) => $q->where('related_record_type', Beneficiary::class)->whereIn('related_record_id', $beneficiaryIds)->where('event_type', 'like', 'beneficiary_%'));
    })->where('recipient_type', 'staff')->pluck('id')->all();
    $systemEvents = ['support_delivery_assigned'];
    if (DB::table('communication_messages')->whereIn('id', $messageIds)->where('status', 'failed')->exists()) {
        $systemEvents[] = 'support_communication_failed';
    }
    $ownSystemIds = DB::table('notifications')->where('recipient_id', $actor->id)->where('recipient_type', 'staff')->where('related_record_type', 'System')->whereIn('event_type', $systemEvents)->where('created_at', '>=', $actor->created_at)->pluck('id')->all();
    $notificationIds = array_values(array_unique(array_merge($notificationIds, $ownSystemIds)));
    if (DB::table('notifications')->where('recipient_id', $actor->id)->whereNotIn('id', $notificationIds)->exists()) {
        throw new RuntimeException('ABORT: unlisted actor notification; preserve for review');
    }
    $remove('notifications', 'id', $notificationIds);
    $deleted['preserved_real_recipient_generic_system_notifications'] = DB::table('notifications')->where('recipient_type', 'staff')->where('recipient_id', '!=', $actor->id)->where('related_record_type', 'System')->whereIn('event_type', $systemEvents)->where('created_at', '>=', $actor->created_at)->count();
    // Time-window count is preservation evidence, not attribution of an event
    // to this run; System events carry no business target in the current service.
    $deleted['preserved_audit_records'] = DB::table('audit_logs')->where('user_id', $actor->id)->count();
    // Preserve every audit/security record, including synthetic evidence. The
    // existing nullable actor FK clears itself when the synthetic actor is deleted.
    $remove('communication_messages', 'id', array_unique($messageIds));
    $remove('support_receipts', 'id', $receiptIds);
    $remove('driver_assignment_tasks', 'driver_assignment_id', $assignmentIds);
    $remove('driver_assignments', 'id', $assignmentIds);
    $remove('receipt_challenges', 'support_distribution_id', $taskIds);
    $remove('inventory_movements', 'support_distribution_id', $taskIds);
    $remove('support_distribution_items', 'support_distribution_id', $taskIds);
    $remove('support_distributions', 'id', $taskIds);
    foreach (['social_assessments', 'document_verifications', 'medical_evidence'] as $table) {
        if (DB::table($table)->whereIn('evaluation_id', $evaluationIds)->whereNotIn('beneficiary_id', $beneficiaryIds)->exists()) {
            throw new RuntimeException('ABORT: foreign evaluation child');
        }
        $remove($table, 'evaluation_id', $evaluationIds);
    }
    $remove('policy_decisions', 'evaluation_id', $evaluationIds);
    $remove('beneficiary_policy_evaluations', 'id', $evaluationIds);
    if ($policyId) {
        $remove('beneficiary_policy_versions', 'id', [$policyId]);
    }
    $remove('beneficiaries', 'id', $beneficiaryIds);
    $remove('inventory_items', 'id', [$ids['inventory']]);
    if (! empty($ids['control_inventory'])) {
        $remove('inventory_items', 'id', [$ids['control_inventory']]);
    }
    $remove('drivers', 'id', [$ids['driver']]);
    $remove('pickup_locations', 'id', [$ids['pickup_location']]);
    $remove('personal_access_tokens', 'tokenable_id', [$actor->id]);
    $remove('sessions', 'user_id', [$actor->id]);
    $remove('users', 'id', [$actor->id]);

    return $deleted;
});
$fileFailures = 0;
foreach (array_unique($uploads) as $path) {
    try {
        if (! Storage::disk('public')->delete($path)) {
            $fileFailures++;
        }
    } catch (Throwable) {
        $fileFailures++;
    }
}
echo json_encode(['cleanup' => $fileFailures === 0 ? 'PASS' : 'FILE_CLEANUP_REQUIRES_REVIEW', 'deleted_counts' => $counts, 'file_failures' => $fileFailures, 'test_actor_remaining' => DB::table('users')->where('id', $ids['actor'])->exists(), 'test_beneficiaries_remaining' => DB::table('beneficiaries')->whereIn('id', $beneficiaryIds)->count(), 'test_tasks_remaining' => DB::table('support_distributions')->whereIn('id', $taskIds)->count()], JSON_THROW_ON_ERROR);
