<?php

namespace App\Http\Middleware;

use App\Http\Controllers\BeneficiaryPolicy\PolicyReviewController;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class ModulePermission
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_unless($user && $user->is_active, 401);
        if ($user->must_change_password && ! in_array($request->path(), ['api/me', 'api/logout', 'api/change-password'], true)) {
            return response()->json(['code' => 'PASSWORD_CHANGE_REQUIRED', 'message' => 'يجب تغيير كلمة المرور المؤقتة قبل استخدام النظام.'], 403);
        }
        if ($request->path() === 'api/change-password') {
            return $next($request);
        }
        if (User::isDriverRole($user->role) && ! in_array($request->path(), ['api/me', 'api/logout'], true)) {
            abort(403, 'مهام السائق متاحة بالرابط المؤقت فقط.');
        }
        if ($user->role === 'admin') {
            return $next($request);
        }
        $path = $request->path();
        if (in_array($path, ['api/me', 'api/logout']) || str_starts_with($path, 'api/notifications')) {
            return $next($request);
        }
        $segment = explode('/', $path)[1] ?? '';
        $smartImportEntity = $segment === 'smart-import' ? (explode('/', $path)[2] ?? '') : null;
        $module = match ($segment) {
            'beneficiaries', 'categories' => 'beneficiaries',
            'daily-beneficiaries', 'daily-inventory', 'daily-receiving' => 'daily_beneficiaries',
            'inventory' => 'warehouse',
            'staff' => 'staff',
            'neighborhood-reps', 'representatives' => 'representatives',
            'distributions', 'drivers' => 'delivery',
            'receiver' => 'receiver',
            'analytics', 'governance', 'reports' => 'governance',
            'audit' => 'audit',
            'settings', 'users' => 'settings',
            'smart-import' => match ($smartImportEntity) {
                'beneficiaries' => 'beneficiaries',
                'staff' => 'staff',
                'organizations' => 'representatives',
                default => null,
            },
            'documents' => str_contains($path, 'daily-receiving') ? 'daily_beneficiaries' : (str_contains($path, 'staff-receipt') ? 'staff' : (str_contains($path, 'rep-receipt') ? 'representatives' : (str_contains($path, 'individual-receipt') || str_contains($path, '/receipt/') ? 'delivery' : 'beneficiaries'))),
            default => null,
        };
        if ($segment === 'support') {
            abort_if($user->role === 'readonly' && ! $request->isMethod('GET'), 403);
            if ($request->isMethod('GET') && $path === 'api/support/distributions' && ($request->boolean('all') || $request->integer('per_page') === -1)) {
                abort_unless(($user->permissions['support']['view'] ?? false) === true && ($user->permissions['support']['export'] ?? false) === true, 403);

                return $next($request);
            }
            if (preg_match('~^api/support/distributions/[^/]+/(receipt-code|verify|verify-preview)$~', $path)) {
                abort_unless(($user->permissions['support']['fulfill'] ?? false) === true && ! in_array($user->role, ['readonly', 'driver', 'delivery_driver'], true), 403);

                return $next($request);
            }
            $action = $request->isMethod('GET') ? 'view' : ($request->isMethod('POST') ? 'create' : 'edit');
            if ($request->isMethod('PATCH') && preg_match('~^api/support/distributions/[^/]+/(approve|reserve|ready|dispatch|complete|cancel)$~', $path, $matches)) {
                $action = match ($matches[1]) {
                    'approve' => 'approve', 'reserve' => 'reserve', 'cancel' => 'cancel', default => 'fulfill',
                };
            }
            abort_unless(($user->permissions['support'][$action] ?? false) === true, 403);

            return $next($request);
        }
        // Beneficiary policy engine (POLICY-A + POLICY-B): granular lifecycle permissions.
        if ($segment === 'beneficiary-policy') {
            if ($request->isMethod('GET') && preg_match('~^api/beneficiary-policy/beneficiaries/[^/]+/evaluations$~', $path)) {
                abort_unless(collect(PolicyReviewController::ACTIONS)->contains(fn ($permission) => ($user->permissions['beneficiary_policy'][$permission] ?? false) === true), 403);

                return $next($request);
            }
            if (preg_match('~^api/beneficiary-policy/evaluations/[^/]+/(.+)$~', $path, $match)) {
                $action = match (true) {
                    $request->isMethod('GET') && $match[1] === 'review' => 'view_documents',
                    str_starts_with($match[1], 'documents/') || $match[1] === 'medical-evidence' => 'verify_documents',
                    $match[1] === 'social-assessment/review' => 'review',
                    in_array($match[1], ['social-assessment', 'social-assessment/submit'], true) => 'social_assessment',
                    in_array($match[1], ['approve', 'reject'], true) => 'decide',
                    default => null,
                };
                $allowed = $action === 'view_documents'
                    ? collect(PolicyReviewController::ACTIONS)->contains(fn ($permission) => ($user->permissions['beneficiary_policy'][$permission] ?? false) === true)
                    : ($action && ($user->permissions['beneficiary_policy'][$action] ?? false) === true);
                abort_unless($allowed, 403);

                return $next($request);
            }
            // POLICY-E: application-scope simulation / run ledger permission contract.
            // (Endpoints arrive in POLICY-E2/E3/E5; the permission mapping is defined now.)
            if ($request->isMethod('POST') && preg_match('~^api/beneficiary-policy/versions/[^/]+/simulate$~', $path)) {
                abort_unless(($user->permissions['beneficiary_policy']['simulate'] ?? false) === true, 403);

                return $next($request);
            }
            if (preg_match('~^api/beneficiary-policy/versions/[^/]+/application-runs$~', $path)) {
                $action = $request->isMethod('POST') ? 'apply_scope' : 'view_application_runs';
                abort_unless(($user->permissions['beneficiary_policy'][$action] ?? false) === true, 403);

                return $next($request);
            }
            if (preg_match('~^api/beneficiary-policy/application-runs(?:/[^/]+(?:/(items|simulate|execute|retry|cancel|approve-application))?)?$~', $path, $runMatch)) {
                $suffix = $runMatch[1] ?? '';
                $action = match (true) {
                    // Reads (run + paginated impact detail + history) are view-only.
                    $request->isMethod('GET') => 'view_application_runs',
                    $suffix === 'simulate' => 'simulate',
                    in_array($suffix, ['execute', 'retry'], true) => 'execute_reevaluation',
                    // cancel / approve-application / run creation = apply authorization.
                    default => 'apply_scope',
                };
                abort_unless(($user->permissions['beneficiary_policy'][$action] ?? false) === true, 403);

                return $next($request);
            }
            $action = $request->isMethod('GET') ? 'view' : 'edit_draft';
            if ($request->isMethod('POST')) {
                $action = match (true) {
                    str_ends_with($path, '/evaluate') => 'evaluate',
                    str_ends_with($path, '/approve') => 'approve',
                    str_ends_with($path, '/publish') => 'publish',
                    str_ends_with($path, '/retire') => 'retire',
                    default => 'edit_draft', // create draft / clone
                };
            }
            abort_unless(($user->permissions['beneficiary_policy'][$action] ?? false) === true, 403);

            return $next($request);
        }
        if (str_starts_with($path, 'api/beneficiaries/unified')) {
            $tab = $request->query('tab', 'all');
            abort_unless(in_array($tab, ['all', 'permanent', 'daily'], true), 422);
            $action = str_contains($path, '/export') ? 'export' : 'view';
            $permissions = $user->permissions ?? [];
            foreach (array_filter([
                in_array($tab, ['all', 'permanent'], true) ? 'beneficiaries' : null,
                in_array($tab, ['all', 'daily'], true) ? 'daily_beneficiaries' : null,
            ]) as $unifiedModule) {
                abort_unless(($permissions[$unifiedModule]['view'] ?? false) === true, 403);
                abort_unless(($permissions[$unifiedModule][$action] ?? false) === true, 403);
            }

            return $next($request);
        }
        // Governance exports are independent capabilities. A viewer cannot
        // infer either export permission, and Excel never implies PDF.
        if (in_array($path, ['api/analytics', 'api/governance/analytics'], true)) {
            abort_unless(($user->permissions['governance']['view'] ?? false) === true, 403);

            return $next($request);
        }
        if ($path === 'api/reports/comprehensive/excel') {
            abort_unless(($user->permissions['governance']['export_excel'] ?? false) === true, 403);

            return $next($request);
        }
        if ($path === 'api/reports/comprehensive/pdf') {
            abort_unless(($user->permissions['governance']['export_pdf'] ?? false) === true, 403);

            return $next($request);
        }
        // Account administration is explicitly reserved to the administrator in the existing controller.
        if ($segment === 'users') {
            abort(403);
        }
        if ($segment === 'beneficiaries' && $request->isMethod('POST') && str_ends_with($path, '/restore')) {
            abort_unless(($user->permissions['beneficiaries']['delete'] ?? false) === true && ! in_array($user->role, ['readonly', 'driver', 'delivery_driver'], true), 403);

            return $next($request);
        }
        $action = $request->isMethod('GET') ? 'view' : ($request->isMethod('DELETE') ? 'delete' : 'create');
        if ($request->isMethod('PUT') || $request->isMethod('PATCH') || preg_match('~/(adjust|confirm|dispatch|status|received|whatsapp)(/|$)~', $path)
            || ($request->isMethod('POST') && preg_match('~^api/(beneficiaries|neighborhood-reps)/[^/]+$~', $path))) {
            $action = 'edit';
        }
        if ($segment === 'settings' && ! $request->isMethod('GET')) {
            $action = 'edit';
        }
        if (str_contains($path, '/import') || $segment === 'smart-import') {
            $action = 'import';
        }
        if (str_contains($path, 'export') || str_ends_with($path, '/excel')) {
            $action = 'export';
        }
        if ($segment === 'documents') {
            $action = 'issue_document';
        }
        if ($user->role === 'readonly' && $action !== 'view') {
            abort(403);
        }
        if (in_array($user->role, ['driver', 'delivery_driver'])) {
            abort_unless(in_array($module, ['delivery', 'receiver']), 403);
            abort_if($module === 'delivery' && ! in_array($action, ['view', 'issue_document'], true), 403);
        }
        // Role access mirrors frontend/src/App.jsx; nested permissions can further restrict it.
        $roles = match ($module) {
            'beneficiaries', 'daily_beneficiaries' => ['assistant_admin', 'reception', 'staff', 'readonly'],
            'warehouse' => ['assistant_admin', 'warehouse', 'staff', 'readonly'],
            'staff' => ['assistant_admin'],
            'representatives' => ['assistant_admin', 'staff'],
            'delivery' => ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
            'receiver' => ['assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'delivery_driver', 'driver'],
            'governance' => ['assistant_admin', 'readonly'],
            'settings' => ['assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'delivery_driver', 'driver'],
            default => [],
        };
        abort_unless(in_array($user->role, $roles, true), 403);
        $permissions = $user->permissions ?? [];
        if ($module && isset($permissions[$module])) {
            abort_unless(($permissions[$module]['view'] ?? false) && ($permissions[$module][$action] ?? false), 403);
        } elseif ($module === 'settings' && $action !== 'view') {
            abort(403);
        }

        return $next($request);
    }
}
