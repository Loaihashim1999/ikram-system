<?php

namespace Tests\Feature\Phase4;

use App\Models\Beneficiary;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\OperationalMetricsService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationalMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cutoff_counts_operations_and_distinct_beneficiaries_independently(): void
    {
        $a = $this->beneficiary('A', '1900000201');
        $b = $this->beneficiary('B', '1900000202');
        $c = $this->beneficiary('C', '1900000203');
        $d = $this->beneficiary('D', '1900000204');
        $this->operation($a, 'completed', '2026-10-01 10:00:00', '2026-10-01 18:00:00');
        $this->operation($a, 'completed', '2026-10-02 10:00:00', '2026-10-05 12:00:00');
        $this->operation($b, 'ready', '2026-10-02 10:00:00', null);
        $this->operation($c, 'approved', '2026-10-02 10:00:00', null);
        $this->operation($d, 'cancelled', '2026-10-02 10:00:00', null);

        $metrics = app(OperationalMetricsService::class)->summarize(
            Carbon::parse('2026-10-01')->startOfDay(),
            Carbon::parse('2026-10-03')->endOfDay(),
        );

        $this->assertSame(3, $metrics['total_due']);
        $this->assertSame(1, $metrics['completed_by_cutoff']);
        $this->assertSame(1, $metrics['completed_in_period']);
        $this->assertSame(2, $metrics['not_completed']);
        $this->assertSame(2, $metrics['overdue']);
        $this->assertSame(2, $metrics['unique_due_beneficiaries']);
        $this->assertSame(1, $metrics['unique_completed_beneficiaries']);
        $this->assertSame(2, $metrics['unique_not_completed_beneficiaries']);
    }

    public function test_completion_after_cutoff_stays_overdue_for_that_cutoff(): void
    {
        $beneficiary = $this->beneficiary('Late', '1900000205');
        $this->operation($beneficiary, 'completed', '2026-10-01 09:00:00', '2026-10-05 09:00:00');

        $metrics = app(OperationalMetricsService::class)->summarize(
            Carbon::parse('2026-10-01')->startOfDay(),
            Carbon::parse('2026-10-03')->endOfDay(),
        );

        $this->assertSame(1, $metrics['not_completed']);
        $this->assertSame(1, $metrics['overdue']);
        $this->assertSame(0, $metrics['completed_by_cutoff']);
    }

    public function test_reversed_range_is_rejected_and_a_single_day_includes_that_day(): void
    {
        $beneficiary = $this->beneficiary('Day', '1900000206');
        $this->operation($beneficiary, 'ready', '2026-10-02 15:00:00', null);

        $day = app(OperationalMetricsService::class)->summarize(
            Carbon::parse('2026-10-02')->startOfDay(),
            Carbon::parse('2026-10-02')->endOfDay(),
        );
        $this->assertSame(1, $day['total_due']);
        $this->assertSame(0, $day['overdue']);

        $this->expectException(ValidationException::class);
        app(OperationalMetricsService::class)->summarize(
            Carbon::parse('2026-10-04')->startOfDay(),
            Carbon::parse('2026-10-03')->endOfDay(),
        );
    }

    public function test_receipt_history_date_uses_completion_not_due_date(): void
    {
        $beneficiary = $this->beneficiary('Filter', '1900000207');
        $inside = $this->operation($beneficiary, 'completed', '2026-09-01 10:00:00', '2026-10-02 10:00:00');
        $this->operation($beneficiary, 'completed', '2026-10-02 10:00:00', '2026-11-01 10:00:00');

        Sanctum::actingAs(User::create([
            'username' => 'ekram-e2e-metrics-'.Str::lower(Str::random(6)),
            'full_name' => 'EKRAM-E2E-TEST metrics',
            'email' => 'metrics-'.Str::lower(Str::random(6)).'@example.invalid',
            'password' => Str::random(24),
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => false,
        ]));
        $response = $this->getJson('/api/support/distributions?fulfillment_method=pickup&date_from=2026-10-01&date_to=2026-10-03');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $inside->id);
    }

    private function beneficiary(string $name, string $nationalId): Beneficiary
    {
        return Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'EKRAM-E2E-TEST '.$name,
            'national_id' => $nationalId,
            'phone' => '0500000201',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'status' => 'active',
        ]);
    }

    private function operation(Beneficiary $beneficiary, string $status, string $due, ?string $completed): SupportDistribution
    {
        return SupportDistribution::create([
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiary->id,
            'recipient_name' => $beneficiary->full_name,
            'fulfillment_method' => 'pickup',
            'status' => $status,
            'support_date' => $due,
            'completed_at' => $completed,
            'cancelled_at' => $status === 'cancelled' ? $due : null,
        ]);
    }
}
