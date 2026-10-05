<?php

namespace Tests\Feature\Phase2;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\CommunicationMessage;
use App\Models\DailyReceivingTransaction;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\PickupLocation;
use App\Models\ReceiptChallenge;
use App\Models\SupportDistribution;
use App\Models\SupportDistributionItem;
use App\Models\SupportReceipt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DirectHandoverReplayTest extends TestCase
{
    use RefreshDatabase;

    public function test_ready_pickup_confirms_once_and_replay_does_not_double_count(): void
    {
        $operator = $this->user([
            'support' => [
                'view' => true,
                'create' => true,
                'edit' => true,
                'approve' => true,
                'reserve' => true,
                'fulfill' => true,
                'cancel' => true,
            ],
        ], 'EKRAM-E2E-TEST handover operator');
        $denied = $this->user([
            'support' => [
                'view' => true,
                'create' => true,
                'edit' => true,
                'approve' => true,
                'reserve' => true,
                'fulfill' => false,
            ],
        ], 'EKRAM-E2E-TEST handover denied');
        Sanctum::actingAs($operator);

        $beneficiary = $this->beneficiary();
        $stock = InventoryItem::create([
            'name' => 'EKRAM-E2E-TEST handover stock',
            'unit' => 'kg',
            'current_quantity' => '1.00',
            'reserved_quantity' => '0.00',
            'min_threshold' => 0,
        ]);
        $location = PickupLocation::create([
            'name' => 'EKRAM-E2E-TEST pickup',
            'is_active' => true,
        ]);

        $created = $this->postJson('/api/support/distributions', [
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiary->id,
            'fulfillment_method' => 'pickup',
            'pickup_location_id' => $location->id,
            'items' => [[
                'inventory_item_id' => $stock->id,
                'requested_quantity' => '1.00',
            ]],
        ])->assertCreated();

        $id = $created->json('data.id');
        $this->assertNotEmpty($id);
        $this->assertSame('draft', $created->json('data.status'));
        $this->assertSame('pickup', $created->json('data.fulfillment_method'));
        $this->assertNull($created->json('data.driver_id'));
        $this->assertSame(0, $this->completedReceiptCount($beneficiary->id));
        $this->assertStock($stock, '1.00', '0.00');

        foreach (['approve', 'reserve', 'ready'] as $action) {
            $this->patchJson('/api/support/distributions/'.$id.'/'.$action)->assertOk();
        }

        $ready = SupportDistribution::findOrFail($id);
        $this->assertSame('ready', $ready->status);
        $this->assertSame('pickup', $ready->fulfillment_method);
        $this->assertNull($ready->driver_id);
        $this->assertNull($ready->completed_at);
        $this->assertSame(0, SupportReceipt::count());
        $this->assertSame(0, InventoryMovement::count());
        $this->assertSame(0, DB::table('drivers')->count());
        $this->assertSame(0, DB::table('driver_assignments')->count());
        $this->assertStock($stock, '1.00', '1.00');

        $this->patchJson('/api/support/distributions/'.$id.'/complete')->assertStatus(409);
        $ready->refresh();
        $this->assertSame('ready', $ready->status);
        $this->assertSame(0, SupportReceipt::count());
        $this->assertSame(0, InventoryMovement::count());
        $this->assertStock($stock, '1.00', '1.00');

        Queue::fake();
        $this->postJson('/api/support/distributions/'.$id.'/receipt-code')->assertOk();
        $code = $this->issuedCode($id);

        Sanctum::actingAs($denied);
        $previewDenied = $this->postJson('/api/support/distributions/'.$id.'/verify-preview', ['code' => $code]);
        $verifyDenied = $this->postJson('/api/support/distributions/'.$id.'/verify', ['code' => $code]);
        $previewDenied->assertForbidden();
        $verifyDenied->assertForbidden();
        $this->assertNotSame(404, $previewDenied->status());
        $this->assertNotSame(404, $verifyDenied->status());
        $this->assertNull(ReceiptChallenge::where('support_distribution_id', $id)->value('consumed_at'));
        $this->assertSame(0, (int) ReceiptChallenge::where('support_distribution_id', $id)->value('failed_attempts'));
        $this->assertSame(0, SupportReceipt::count());
        $this->assertSame('ready', $ready->fresh()->status);
        $this->assertStock($stock, '1.00', '1.00');

        Sanctum::actingAs($operator);
        $preview = $this->postJson('/api/support/distributions/'.$id.'/verify-preview', ['code' => $code])->assertOk();
        $preview->assertJsonPath('data.id', $id);
        $preview->assertJsonPath('data.status', 'ready');
        $this->assertSame(0, SupportReceipt::count());
        $this->assertSame(0, InventoryMovement::count());
        $this->assertNull(ReceiptChallenge::where('support_distribution_id', $id)->value('consumed_at'));
        $this->assertSame('ready', $ready->fresh()->status);
        $this->assertStock($stock, '1.00', '1.00');

        $confirmed = $this->postJson('/api/support/distributions/'.$id.'/verify', ['code' => $code])->assertOk();
        $confirmed->assertJsonMissingPath('already_completed');
        $receiptId = $confirmed->json('receipt_id');
        $this->assertNotEmpty($receiptId);
        $this->assertSame(1, SupportReceipt::count());
        $this->assertSame(1, $this->completedReceiptCount($beneficiary->id));
        $this->assertSame(1, InventoryMovement::where('support_distribution_id', $id)->count());
        $this->assertSame('completed', $ready->fresh()->status);
        $this->assertNull($ready->fresh()->driver_id);
        $this->assertStock($stock, '0.00', '0.00');

        $receipt = SupportReceipt::findOrFail($receiptId);
        $this->assertSame($id, $receipt->support_distribution_id);
        $this->assertNull($receipt->driver_assignment_id);
        $this->assertSame($operator->id, $receipt->confirmed_by);
        $this->assertSame($ready->fresh()->completed_at->toIso8601String(), $receipt->confirmed_at->toIso8601String());
        $item = SupportDistributionItem::where('support_distribution_id', $id)->firstOrFail();
        $this->assertSame('1.00', $item->fulfilled_quantity);
        $this->assertSame('0.00', $item->reserved_quantity);
        $movement = InventoryMovement::where('support_distribution_id', $id)->firstOrFail();
        $this->assertSame('out', $movement->type);
        $this->assertSame('1.00', $movement->quantity);
        $this->assertSame('0.00', $movement->balance_after);
        $this->assertSame(0, DailyReceivingTransaction::count());
        $this->assertSame(0, DB::table('drivers')->count());
        $this->assertSame(1, AuditLog::where('target_id', $id)->where('action', 'COMPLETED')->count());
        $this->assertSame(1, AuditLog::where('target_id', $id)->where('action', 'RECEIPT_VERIFIED')->count());

        $snapshot = $receipt->proof_snapshot;
        $this->assertSame([
            'schema_version', 'source', 'task_reference', 'fulfillment_method', 'recipient', 'driver',
            'pickup_location', 'employee', 'confirmed_at', 'verification_method', 'final_status', 'items',
        ], array_keys($snapshot));
        $this->assertSame(1, $snapshot['schema_version']);
        $this->assertSame('confirmation', $snapshot['source']);
        $this->assertSame($id, $snapshot['task_reference']);
        $this->assertSame('pickup', $snapshot['fulfillment_method']);
        $this->assertSame('beneficiary', $snapshot['recipient']['type']);
        $this->assertSame($beneficiary->id, $snapshot['recipient']['id']);
        $this->assertSame('EKRAM-E2E-TEST handover beneficiary', $snapshot['recipient']['display_name']);
        $this->assertSame($beneficiary->id, $snapshot['recipient']['reference']);
        $this->assertArrayHasKey('phone', $snapshot['recipient']);
        $this->assertArrayHasKey('city', $snapshot['recipient']);
        $this->assertArrayHasKey('district', $snapshot['recipient']);
        $this->assertArrayHasKey('address', $snapshot['recipient']);
        $this->assertArrayHasKey('full_address', $snapshot['recipient']);
        $this->assertNull($snapshot['driver']);
        $this->assertSame('EKRAM-E2E-TEST pickup', $snapshot['pickup_location']);
        $this->assertSame($operator->id, $snapshot['employee']['id']);
        $this->assertSame('EKRAM-E2E-TEST handover operator', $snapshot['employee']['name']);
        $this->assertSame($receipt->confirmed_at->toIso8601String(), $snapshot['confirmed_at']);
        $this->assertSame('receipt_code', $snapshot['verification_method']);
        $this->assertSame('completed', $snapshot['final_status']);
        $this->assertSame($stock->id, $snapshot['items'][0]['inventory_item_id']);
        $this->assertSame('EKRAM-E2E-TEST handover stock', $snapshot['items'][0]['name']);
        $this->assertSame('1.00', $snapshot['items'][0]['quantity']);
        $this->assertSame('kg', $snapshot['items'][0]['unit']);
        $consumedAt = ReceiptChallenge::where('support_distribution_id', $id)->firstOrFail()->consumed_at->toIso8601String();

        $replay = $this->postJson('/api/support/distributions/'.$id.'/verify', ['code' => $code])->assertOk();
        $replay->assertJsonPath('already_completed', true);
        $replay->assertJsonPath('receipt_id', $receiptId);
        $this->assertSame(1, SupportReceipt::count());
        $this->assertSame(1, $this->completedReceiptCount($beneficiary->id));
        $this->assertSame(1, InventoryMovement::where('support_distribution_id', $id)->count());
        $this->assertSame(1, AuditLog::where('target_id', $id)->where('action', 'COMPLETED')->count());
        $this->assertSame(1, AuditLog::where('target_id', $id)->where('action', 'RECEIPT_VERIFIED')->count());
        $this->assertSame('completed', $ready->fresh()->status);
        $this->assertNull($ready->fresh()->driver_id);
        $this->assertSame($snapshot, $receipt->fresh()->proof_snapshot);
        $this->assertSame($consumedAt, ReceiptChallenge::where('support_distribution_id', $id)->firstOrFail()->consumed_at->toIso8601String());
        $this->assertSame('1.00', $item->fresh()->fulfilled_quantity);
        $this->assertStock($stock, '0.00', '0.00');
        $this->assertSame(0, DailyReceivingTransaction::count());
        $this->assertSame(0, DB::table('drivers')->count());
        $this->assertSame(0, DB::table('driver_assignments')->count());
    }

    private function completedReceiptCount(string $beneficiaryId): int
    {
        return SupportReceipt::query()
            ->join('support_distributions', 'support_distributions.id', '=', 'support_receipts.support_distribution_id')
            ->where('support_distributions.beneficiary_id', $beneficiaryId)
            ->where('support_distributions.recipient_type', 'beneficiary')
            ->where('support_distributions.status', 'completed')
            ->count();
    }

    private function assertStock(InventoryItem $stock, string $current, string $reserved): void
    {
        $stock->refresh();
        $this->assertSame($current, (string) $stock->current_quantity);
        $this->assertSame($reserved, (string) $stock->reserved_quantity);
        $this->assertGreaterThanOrEqual(0, (float) $stock->current_quantity);
        $this->assertGreaterThanOrEqual(0, (float) $stock->reserved_quantity);
    }

    private function issuedCode(string $distributionId): string
    {
        $message = CommunicationMessage::query()
            ->where('operation_type', 'receipt')
            ->where('operation_id', $distributionId)
            ->firstOrFail();
        $body = (string) ($message->encrypted_payload['body'] ?? '');
        $this->assertSame(1, preg_match('/رمز الاستلام: ([0-9]{4})/', $body, $match));

        return $match[1];
    }

    private function user(array $permissions, string $name): User
    {
        $suffix = Str::lower(Str::random(8));

        return User::create([
            'username' => 'ekram-e2e-test-'.$suffix,
            'full_name' => $name,
            'email' => 'ekram-e2e-test-'.$suffix.'@example.invalid',
            'password' => Str::random(24),
            'role' => 'staff',
            'is_active' => true,
            'can_receive_notifications' => false,
            'permissions' => $permissions,
        ]);
    }

    private function beneficiary(): Beneficiary
    {
        return Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'nationality' => 'سعودي',
            'full_name' => 'EKRAM-E2E-TEST handover beneficiary',
            'national_id' => '1900000801',
            'phone' => '0500000801',
            'date_of_birth' => '1980-05-05',
            'city' => 'مكة',
            'district' => 'العزيزية',
            'street' => 'EKRAM-E2E-TEST street',
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
        ]);
    }
}
