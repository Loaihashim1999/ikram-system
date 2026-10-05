<?php

namespace Tests\Feature;

use App\Http\Controllers\NeighborhoodRepController;
use App\Models\NeighborhoodRep;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class RepresentativeRequestFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['hashing.bcrypt.rounds' => 4]);
        Http::preventStrayRequests();
        Mail::fake();
        Queue::fake();
        $this->assertSame('sqlite', DB::connection()->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }

    public static function allowedRoles(): array
    {
        return ['admin' => ['admin'], 'assistant_admin' => ['assistant_admin'], 'staff' => ['staff']];
    }

    public static function deniedRoles(): array
    {
        return ['reception' => ['reception'], 'warehouse' => ['warehouse'], 'readonly' => ['readonly']];
    }

    private function fixtures(string $role): array
    {
        $actor = PolicyEScenario::actor([], $role);
        $actor->permissions = ['representatives' => ['view' => true]];
        $actor->save();
        $this->assertTrue($actor->fresh()->permissions['representatives']['view']);
        Sanctum::actingAs($actor);
        $a = NeighborhoodRep::create(['full_name' => 'Synthetic Alpha', 'national_id' => '1777777777', 'phone' => '0507777777', 'district_name' => 'ALPHA', 'city' => 'CITYA', 'license_number' => 'LICENSEA', 'status' => 'active']);
        $b = NeighborhoodRep::create(['full_name' => 'Synthetic Omega', 'national_id' => '1888888888', 'phone' => '0508888888', 'district_name' => 'OMEGA', 'city' => 'CITYB', 'license_number' => 'LICENSEB', 'status' => 'active']);
        PolicyEScenario::beneficiary(['full_name' => 'Synthetic family A', 'district' => 'ALPHA']);
        PolicyEScenario::beneficiary(['full_name' => 'Synthetic family B', 'district' => 'OMEGA']);
        $this->assertDatabaseHas('neighborhood_reps', ['id' => $a->id, 'license_number' => 'LICENSEA']);
        $this->assertDatabaseHas('neighborhood_reps', ['id' => $b->id, 'license_number' => 'LICENSEB']);

        return [$a, $b];
    }

    private function snapshot(): array
    {
        $out = [];
        foreach (DB::getSchemaBuilder()->getTableListing() as $table) {
            $out[$table] = hash('sha256', json_encode(DB::table($table)->get(), JSON_THROW_ON_ERROR));
        }

        return $out;
    }

    #[DataProvider('allowedRoles')]
    public function test_existing_routed_filters_and_unfiltered_contract(string $role): void
    {
        [$a, $b] = $this->fixtures($role);
        $before = $this->snapshot();
        $r = $this->getJson('/api/representatives');
        $r->assertOk();
        $this->assertEqualsCanonicalizing([$a->id, $b->id], array_column($r->json('data'), 'id'));
        foreach ($r->json('data') as $rep) {
            $this->assertSame(1, $rep['linked_beneficiaries_count']);
            $this->assertSame(0, $rep['rep_distributions_count']);
        }
        foreach ([
            [['search' => 'LICENSEA'], [$a->id]],
            [['search' => 'Synthetic Omega'], [$b->id]],
            [['search' => 'NONEXISTENT'], []],
            [['district' => 'ALPHA'], [$a->id]],
            [['city' => 'CITYB'], [$b->id]],
            [['search' => 'LICENSEA', 'district' => 'ALPHA', 'city' => 'CITYA'], [$a->id]],
            [['search' => 'LICENSEA', 'city' => 'CITYB'], []],
            [['city' => 'all', 'district' => 'all'], [$a->id, $b->id]],
        ] as [$query, $expected]) {
            $r = $this->getJson('/api/representatives?'.http_build_query($query));
            $r->assertOk();
            $this->assertEqualsCanonicalizing($expected, array_column($r->json('data'), 'id'));
            $this->assertSame($before, $this->snapshot());
        }
    }

    #[DataProvider('deniedRoles')]
    public function test_explicit_grant_does_not_bypass_role_denial(string $role): void
    {
        [$a, $b] = $this->fixtures($role);
        $before = $this->snapshot();
        $r = $this->getJson('/api/representatives?search=LICENSEA&district=ALPHA&city=CITYA');
        $r->assertForbidden();
        foreach ([$a->id, $b->id, 'Synthetic Alpha', 'Synthetic Omega', 'LICENSEA', 'LICENSEB'] as $secret) {
            $this->assertStringNotContainsString($secret, $r->getContent());
        }
        $this->assertSame($before, $this->snapshot());
    }

    public function test_explicit_request_direct_call_remains_supported(): void
    {
        [$a] = $this->fixtures('admin');
        $before = $this->snapshot();
        $response = app(NeighborhoodRepController::class)->index(Request::create('/api/representatives', 'GET', ['search' => 'LICENSEA']));
        $this->assertSame([$a->id], array_column($response->getData(true)['data'], 'id'));
        $this->assertSame($before, $this->snapshot());
    }
}
