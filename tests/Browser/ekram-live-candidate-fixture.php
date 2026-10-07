<?php

// Execute only inside the explicitly selected zero-traffic candidate. Input/output
// contain transient test credentials/capabilities and must stay in orchestrator memory.
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\InventoryItem;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyRegistrationEvaluationService;
use App\Services\Delivery\DriverAccessService;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['candidate_ready'] ?? false) !== true || empty($input['expected_revision'])
    || getenv('CONTAINER_APP_REVISION') !== $input['expected_revision']) {
    throw new RuntimeException('ABORT: exact candidate revision readiness authorization required.');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('services.communications.provider') !== 'fake' || config('database.default') !== 'pgsql'
    || config('database.connections.pgsql.database') !== 'ikram_prod') {
    throw new RuntimeException('ABORT: candidate must use approved PostgreSQL database and ordinary fake communications.');
}
Queue::fake();
if (($input['mode'] ?? 'create') !== 'create') {
    throw new RuntimeException('Unsupported fixture mode');
}
$run = $input['run_id'] ?? (string) Str::uuid();
$actorUsername = 'EKRAM-E2E-TEST-'.substr(str_replace('-', '', $run), 0, 32);
if (! preg_match('/^[a-f0-9-]{36}$/D', $run) || User::where('username', $actorUsername)->exists()) {
    throw new RuntimeException('ABORT: invalid or already-created synthetic run; recover known IDs rather than retry creation');
}
$marker = 'EKRAM-E2E-TEST '.$run;
$password = $input['actor_password'] ?? bin2hex(random_bytes(24));
if (! is_string($password) || strlen($password) < 32) {
    throw new RuntimeException('ABORT: strong transient actor password required');
}
$result = DB::transaction(function () use ($run, $marker, $password, $actorUsername) {
    DB::statement("SET LOCAL statement_timeout = '30s'");
    DB::statement("SET LOCAL lock_timeout = '5s'");
    $actor = User::create(['username' => $actorUsername, 'full_name' => $marker.' Admin', 'password' => $password, 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => true]);
    $registration = app(PolicyRegistrationEvaluationService::class);
    $probe = new Beneficiary(['beneficiary_type' => 'citizen']);
    $probe->created_at = now();
    $beforePolicy = $registration->applicableVersion($probe)?->id;
    if ($beforePolicy !== null) {
        throw new RuntimeException('ABORT: expected no currently applicable policy');
    }
    $policyService = app(BeneficiaryPolicyVersionService::class);
    $configuration = PolicyConfigurationValidator::withDefaults([]);
    $configuration['application_scope'] = ['applies_to' => 'effective_from_date', 'effective_from_date' => '2099-01-01'];
    // Policy version is varchar(30); keep the run-derived unique suffix within it.
    $policy = $policyService->createDraft(['policy_name' => $marker.' TEST Policy', 'version' => 'TEST-'.substr(str_replace('-', '', $run), 0, 24), 'policy_scope' => 'citizen_beneficiaries', 'effective_from' => '2099-01-01', 'effective_to' => '2099-01-02', 'configuration' => $configuration, 'source_document_reference' => $marker.' TEST ONLY', 'change_reason' => $marker.' synthetic evaluation only'], $actor->id);
    $policyService->approve($policy->id, ['board_approval_reference' => $marker.' TEST ONLY NOT AN ACTUAL BOARD APPROVAL', 'board_approval_date' => now()->toDateString()], $actor->id);
    $policyService->publish($policy->id, $actor->id);
    $afterPolicy = $registration->applicableVersion($probe)?->id;
    if ($afterPolicy !== $beforePolicy) {
        throw new RuntimeException('ABORT: current registration policy changed');
    }
    $GLOBALS['ekramRegistrationProbe'] = ['before' => $beforePolicy, 'after' => $afterPolicy];
    $stock = InventoryItem::create(['name' => $marker.' Basket', 'unit' => 'سلة', 'current_quantity' => 20, 'min_threshold' => 0]);
    $location = PickupLocation::create(['name' => $marker.' Pickup', 'location_url' => 'https://example.test/EKRAM-E2E-TEST']);
    $driver = Driver::create(['full_name' => $marker.' Driver', 'phone' => '0574917155', 'is_active' => true]);
    $beneficiaries = [];
    $tasks = [];
    $codes = [];
    foreach (['delivery', 'delivery', 'pickup'] as $i => $method) {
        do {
            $identity = '1'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        } while (Beneficiary::where('national_id', $identity)->exists());
        $beneficiary = Beneficiary::create(['full_name' => $marker.' Recipient '.($i + 1), 'national_id' => $identity, 'phone' => '050000100'.($i + 1), 'beneficiary_type' => 'citizen', 'status' => 'active', 'confirmed_at' => now(), 'confirmed_by' => $actor->id, 'created_by' => $actor->id, 'city' => 'مكة المكرمة', 'district' => $marker.' District', 'street' => $marker.' Address', 'family_members_count' => 1, 'housing_type' => 'own', 'date_of_birth' => '1980-01-01']);
        $beneficiaries[] = $beneficiary->id;
        $service = app(SupportDistributionService::class);
        $task = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'fulfillment_method' => $method, 'pickup_location_id' => $method === 'pickup' ? $location->id : null, 'notes' => $marker, 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1.00']]], $actor->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $task = $service->transition($task->id, $action, $actor->id);
        }
        app(ReceiptVerificationService::class)->issue($task->id, $actor->id);
        $message = CommunicationMessage::where('operation_id', $task->id)->latest()->firstOrFail();
        if (! preg_match('/رمز الاستلام: ([0-9]{4})/', $message->encrypted_payload['body'] ?? '', $match)) {
            throw new RuntimeException('Synthetic receipt code extraction failed');
        }
        $codes[$task->id] = $match[1];
        $tasks[$method][] = $task->id;
    }
    $assignment = app(DriverAccessService::class)->assign($driver->id, $tasks['delivery'], 120, $actor->id);
    $driverMessage = CommunicationMessage::where('operation_id', $assignment->id)->latest()->firstOrFail();
    if (! preg_match('/driver-access#([a-f0-9]{64})/', $driverMessage->encrypted_payload['body'] ?? '', $match)) {
        throw new RuntimeException('Synthetic driver capability extraction failed');
    }
    $mainToken = $match[1];
    $controlStock = InventoryItem::create(['name' => $marker.' Control Basket', 'unit' => 'سلة', 'current_quantity' => 2, 'min_threshold' => 0]);
    $controlTasks = [];
    $controlAssignments = [];
    $controlTokens = [];
    foreach (['expired', 'revoked'] as $control) {
        $service = app(SupportDistributionService::class);
        $task = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiaries[0], 'fulfillment_method' => 'delivery', 'notes' => $marker.' '.$control.' control', 'items' => [['inventory_item_id' => $controlStock->id, 'requested_quantity' => '1.00']]], $actor->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $task = $service->transition($task->id, $action, $actor->id);
        }
        $controlAssignment = app(DriverAccessService::class)->assign($driver->id, [$task->id], $control === 'expired' ? 1 : 120, $actor->id);
        $controlMessage = CommunicationMessage::where('operation_id', $controlAssignment->id)->latest()->firstOrFail();
        if (! preg_match('/driver-access#([a-f0-9]{64})/', $controlMessage->encrypted_payload['body'] ?? '', $tokenMatch)) {
            throw new RuntimeException('Control capability extraction failed');
        }
        $controlTokens[$control] = $tokenMatch[1];
        if ($control === 'revoked') {
            app(DriverAccessService::class)->revoke($controlAssignment->id, $actor->id);
        }
        $controlTasks[] = $task->id;
        $controlAssignments[] = $controlAssignment->id;
    }
    $GLOBALS['ekramControls'] = ['tokens' => $controlTokens, 'tasks' => $controlTasks, 'assignments' => $controlAssignments, 'stock' => $controlStock->id];
    $messages = CommunicationMessage::whereIn('operation_id', array_merge($tasks['delivery'], $tasks['pickup'], [$assignment->id], $controlTasks, $controlAssignments))->get();
    // All writes are still uncommitted: the ordinary worker never sees an unheld intent.
    foreach ($messages as $message) {
        $message->update(['next_attempt_at' => now()->addDays(1)]);
    }

    return ['run_id' => $run, 'marker' => $marker, 'actor' => ['id' => $actor->id, 'username' => $actor->username, 'password' => $password], 'auth' => ['token' => $actor->createToken('EKRAM-E2E-TEST')->plainTextToken, 'user' => $actor->toArray()], 'ids' => ['actor' => $actor->id, 'inventory' => $stock->id, 'pickup_location' => $location->id, 'driver' => $driver->id, 'beneficiaries' => $beneficiaries, 'delivery' => $tasks['delivery'], 'pickup' => $tasks['pickup'][0], 'assignment' => $assignment->id, 'messages' => $messages->pluck('id')->all(), 'driver_message' => $driverMessage->id], 'codes' => $codes, 'driver_token' => $match[1], 'initial_stock' => '20.00'];
});
$result['ids']['policy'] = BeneficiaryPolicyVersion::where('policy_name', $marker.' TEST Policy')->sole()->id;
$result['registration_applicable_version'] = $GLOBALS['ekramRegistrationProbe'];
$result['control_tokens'] = $GLOBALS['ekramControls']['tokens'];
$result['ids']['control_tasks'] = $GLOBALS['ekramControls']['tasks'];
$result['ids']['control_assignments'] = $GLOBALS['ekramControls']['assignments'];
$result['ids']['control_inventory'] = $GLOBALS['ekramControls']['stock'];
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
