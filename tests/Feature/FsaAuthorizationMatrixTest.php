<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\Dependent;
use App\Models\Driver;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * FSA Section 6: representative ROLE x MODULE x ACTION authorization matrix
 * over real HTTP calls. EXPECTED is derived from the enforced ModulePermission
 * policy (the backend is authoritative). The test fails on any mismatch.
 */
class FsaAuthorizationMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const ROLES = ['guest', 'admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly'];

    private array $matrixRows = [];

    private array $ids = [];

    private const MODULE_ROLES = [
        'beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
        'daily_beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
        'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
        'staff' => ['assistant_admin'],
        'representatives' => ['assistant_admin', 'staff'],
        'delivery' => ['assistant_admin', 'staff'],
        'receiver' => ['assistant_admin', 'reception', 'staff', 'warehouse', 'readonly'],
        'governance' => ['assistant_admin', 'readonly'],
    ];

    private function fullPermissions(): array
    {
        $actions = ['view' => true, 'create' => true, 'edit' => true, 'delete' => true, 'export' => true, 'import' => true, 'issue_document' => true];

        return [
            'beneficiaries' => $actions,
            'daily_beneficiaries' => $actions,
            'warehouse' => $actions,
            'staff' => $actions,
            'representatives' => $actions,
            'delivery' => $actions,
            'receiver' => $actions,
            'support' => ['view' => true, 'create' => true, 'edit' => true, 'approve' => true, 'reserve' => true, 'cancel' => true, 'fulfill' => true, 'notifications' => true],
            'governance' => ['view' => true, 'export_excel' => true, 'export_pdf' => true],
            'settings' => ['view' => true, 'edit' => true, 'delete' => true],
        ];
    }

    private function roleUser(string $role): User
    {
        $suffix = substr(bin2hex(random_bytes(4)), 0, 8);

        return User::create([
            'username' => 'MATRIX_'.strtoupper($role).'_'.$suffix,
            'full_name' => 'MATRIX '.$role,
            'password' => 'matrix-password',
            'email' => 'matrix-'.$role.'-'.$suffix.'@example.invalid',
            'role' => $role,
            'permissions' => $this->fullPermissions(),
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $admin = $this->roleUser('admin');
        $category = Category::create(['name' => 'MATRIX CATEGORY']);
        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen', 'full_name' => 'MATRIX BENEFICIARY', 'national_id' => '1815999901',
            'phone' => '0559999001', 'category_id' => $category->id, 'city' => 'Riyadh', 'district' => 'MATRIX',
            'status' => 'active', 'family_members_count' => 0, 'working_members_count' => 0, 'non_working_children_count' => 0,
            'father_status' => 'alive', 'mother_status' => 'alive', 'monthly_salary' => 0, 'housing_type' => 'own',
            'social_security_amount' => 0, 'citizen_account_amount' => 0, 'created_by' => $admin->id,
        ]);
        Dependent::create(['beneficiary_id' => $beneficiary->id, 'name' => 'MATRIX DEPENDENT', 'relationship' => 'ابن']);
        $daily = DailyBeneficiary::create(['full_name' => 'MATRIX DAILY', 'national_id' => '2815999902', 'phone' => '0669999002', 'district' => 'MATRIX', 'status' => 'active', 'created_by' => $admin->id]);
        $item = InventoryItem::create(['name' => 'MATRIX ITEM', 'unit' => 'كرتون', 'current_quantity' => 30, 'min_threshold' => 5]);
        $dailyItem = DailyInventoryItem::create(['name' => 'MATRIX DAILY ITEM', 'unit' => 'سلة', 'current_quantity' => 20, 'min_threshold' => 5]);
        $staff = Staff::create(['name' => 'MATRIX STAFF', 'national_id' => '1012889903', 'phone' => '0559999003', 'job_title' => 'مراقب', 'hire_date' => '2024-01-01', 'status' => 'active']);
        $rep = NeighborhoodRep::create(['full_name' => 'MATRIX REP', 'phone' => '0559999004', 'district_name' => 'MATRIX', 'status' => 'active']);
        Driver::create(['full_name' => 'MATRIX DRIVER', 'phone' => '0559999005', 'vehicle_info' => 'CAR', 'is_active' => true]);
        $support = SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'recipient_name' => 'MATRIX BENEFICIARY', 'fulfillment_method' => 'pickup', 'status' => 'draft', 'created_by' => $admin->id]);
        $this->ids = [
            'beneficiary' => $beneficiary->id, 'daily' => $daily->id, 'item' => $item->id, 'daily_item' => $dailyItem->id,
            'staff' => $staff->id, 'rep' => $rep->id, 'support' => $support->id,
        ];
    }

    public static function matrixProvider(): array
    {
        $cases = [
            ['beneficiaries', 'view', 'GET /beneficiaries'],
            ['beneficiaries', 'create', 'POST /beneficiaries'],
            ['beneficiaries', 'edit', 'PUT /beneficiaries/{beneficiary}'],
            ['beneficiaries', 'delete', 'DELETE /beneficiaries/{beneficiary}'],
            ['beneficiaries', 'export', 'GET /beneficiaries/unified/export'],
            ['beneficiaries', 'import', 'POST /beneficiaries/import'],
            ['daily_beneficiaries', 'view', 'GET /daily-beneficiaries'],
            ['daily_beneficiaries', 'create', 'POST /daily-beneficiaries'],
            ['daily_beneficiaries', 'edit', 'PUT /daily-beneficiaries/{daily}'],
            ['daily_beneficiaries', 'delete', 'DELETE /daily-beneficiaries/{daily}'],
            ['daily_beneficiaries', 'special', 'POST /daily-inventory/{daily_item}/adjust'],
            ['warehouse', 'view', 'GET /inventory'],
            ['warehouse', 'create', 'POST /inventory'],
            ['warehouse', 'edit', 'PUT /inventory/{item}'],
            ['warehouse', 'delete', 'DELETE /inventory/{item}'],
            ['warehouse', 'special', 'POST /inventory/{item}/adjust'],
            ['staff', 'view', 'GET /staff'],
            ['staff', 'create', 'POST /staff'],
            ['staff', 'edit', 'PUT /staff/{staff}'],
            ['staff', 'delete', 'DELETE /staff/{staff}'],
            ['staff', 'import', 'POST /staff/import'],
            ['representatives', 'view', 'GET /neighborhood-reps'],
            ['representatives', 'create', 'POST /neighborhood-reps'],
            ['representatives', 'edit', 'POST /neighborhood-reps/{rep}'],
            ['representatives', 'delete', 'DELETE /neighborhood-reps/{rep}'],
            ['representatives', 'export', 'GET /neighborhood-reps/{rep}/export-excel'],
            ['support', 'view', 'GET /support/distributions'],
            ['support', 'create', 'POST /support/distributions'],
            ['support', 'edit', 'PATCH /support/distributions/{support}'],
            ['support', 'reserve', 'PATCH /support/distributions/{support}/reserve'],
            ['support', 'cancel', 'PATCH /support/distributions/{support}/cancel'],
            ['receiver', 'fulfill', 'POST /support/distributions/{support}/receipt-code'],
            ['delivery', 'view', 'GET /drivers'],
            ['governance', 'view', 'GET /governance/analytics'],
            ['governance', 'export_excel', 'GET /reports/comprehensive/excel'],
            ['governance', 'export_pdf', 'GET /reports/comprehensive/pdf'],
            ['notifications', 'view', 'GET /notifications'],
            ['notifications', 'mark_read', 'POST /notifications/00000000-0000-0000-0000-000000000000/mark-as-read'],
            ['accounts', 'view', 'GET /users'],
            ['accounts', 'create', 'POST /users'],
            ['audit', 'view', 'GET /audit'],
            ['settings', 'view', 'GET /settings'],
            ['settings', 'edit', 'POST /settings'],
        ];
        $rows = [];
        foreach (self::ROLES as $role) {
            foreach ($cases as [$module, $action, $endpoint]) {
                $rows[$role.'|'.$module.'|'.$action] = [$role, $module, $action, $endpoint];
            }
        }

        return $rows;
    }

    private function expected(string $role, string $module, string $action, string $endpoint): bool
    {
        if ($role === 'guest') {
            return false;
        }
        if ($role === 'admin') {
            return true;
        }
        if ($module === 'notifications') {
            return true;
        }
        if (in_array($module, ['accounts', 'audit'], true)) {
            return false;
        }
        if ($module === 'support') {
            return $role !== 'readonly' || $action === 'view';
        }
        if ($module === 'receiver') {
            return ! in_array($role, ['readonly', 'driver', 'delivery_driver'], true);
        }
        // Governance analytics/export paths and the unified beneficiary export are
        // permission-only branches (ModulePermission returns early): no role list,
        // no readonly guard. Every matrix user holds the full permission set.
        if ($module === 'governance') {
            return true;
        }
        if ($module === 'beneficiaries' && $action === 'export') {
            return true;
        }
        if ($module === 'settings') {
            return $action === 'view' || in_array($role, ['assistant_admin', 'reception', 'staff', 'warehouse'], true);
        }
        $roles = self::MODULE_ROLES[$module] ?? [];
        if (! in_array($role, $roles, true)) {
            return false;
        }
        if ($role === 'readonly' && $action !== 'view') {
            return false;
        }

        return true;
    }

    private function classify(int $status): string
    {
        if ($status >= 500) {
            return 'error'; // unhandled 5xx is always a finding, never a pass
        }

        return in_array($status, [401, 403], true) ? 'deny' : 'allow';
    }

    private function expand(string $template): string
    {
        return preg_replace_callback('/\{([a-z_]+)\}/', fn ($m) => $this->ids[$m[1]] ?? 'missing', $template);
    }

    #[DataProvider('matrixProvider')]
    public function test_matrix_cell(string $role, string $module, string $action, string $endpointSpec)
    {
        [$method, $uriTemplate] = explode(' ', $endpointSpec, 2);
        $uri = '/api/'.ltrim($this->expand($uriTemplate), '/');
        $expected = $this->expected($role, $module, $action, $endpointSpec);
        if ($role === 'guest') {
            $response = $this->call($method, $uri); // no actingAs: any protected route must answer 401
        } else {
            Sanctum::actingAs($this->roleUser($role));
            $response = $this->call($method, $uri);
        }
        $actual = $this->classify($response->getStatusCode());
        $this->matrixRows[] = ['role' => $role, 'module' => $module, 'action' => $action, 'expected' => $expected ? 'allow' : 'deny', 'actual' => $actual, 'status' => $response->getStatusCode(), 'endpoint' => $method.' '.$uri];
        $this->assertSame(
            $expected ? 'allow' : 'deny',
            $actual,
            "role={$role} module={$module} action={$action} endpoint={$method} {$uri} status={$response->getStatusCode()}"
        );
    }

    protected function tearDown(): void
    {
        $dir = base_path('.tmp/fsa');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($dir.'/authz-matrix.json', json_encode(['rows' => $this->matrixRows], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        parent::tearDown();
    }
}
