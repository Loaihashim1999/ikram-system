<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ModulePermission
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_unless($user && $user->is_active, 401);
        if ($user->role === 'admin') return $next($request);
        $path = $request->path();
        if (in_array($path, ['api/me', 'api/logout']) || str_starts_with($path, 'api/notifications')) return $next($request);
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
        // Account administration is explicitly reserved to the administrator in the existing controller.
        if ($segment === 'users') abort(403);
        $action = $request->isMethod('GET') ? 'view' : ($request->isMethod('DELETE') ? 'delete' : 'create');
        if ($request->isMethod('PUT') || $request->isMethod('PATCH') || preg_match('~/(adjust|confirm|dispatch|status|received|whatsapp)(/|$)~', $path)
            || ($request->isMethod('POST') && preg_match('~^api/(beneficiaries|neighborhood-reps)/[^/]+$~', $path))) $action = 'edit';
        if ($segment === 'settings' && !$request->isMethod('GET')) $action = 'edit';
        if (str_contains($path, '/import') || $segment === 'smart-import') $action = 'import';
        if (str_contains($path, 'export') || str_ends_with($path, '/excel')) $action = 'export';
        if ($segment === 'documents') $action = 'issue_document';
        if ($user->role === 'readonly' && $action !== 'view') abort(403);
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
