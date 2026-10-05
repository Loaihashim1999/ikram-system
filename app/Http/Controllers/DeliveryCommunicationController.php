<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\Setting;
use App\Models\SupportDistribution;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\MessageTemplates;
use App\Services\Delivery\DriverAccessService;
use App\Services\Delivery\ReceiptVerificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryCommunicationController extends Controller
{
    public function settings(Request $request, MessageTemplates $templates)
    {
        abort_unless($request->user()->role === 'admin', 403);
        if ($request->isMethod('PUT')) {
            $allowed = array_keys($templates->definitions());
            $data = $request->validate(['templates' => 'required|array:'.implode(',', [...$allowed, 'association_name']), 'templates.association_name' => 'sometimes|string|max:150']);
            foreach ($data['templates'] as $key => $value) {
                if ($key !== 'association_name') {
                    validator([$key => $value], [$key => 'required|string'])->validate();
                    $templates->validate($key, $value);
                }
            }
            DB::transaction(function () use ($data) {
                foreach ($data['templates'] as $key => $value) {
                    Setting::set('communications.'.$key, $value);
                }
                AuditLog::create(['user_id' => request()->user()->id, 'action' => 'COMMUNICATION_TEMPLATES_UPDATED', 'target_table' => 'settings', 'target_id' => (string) Str::uuid(), 'details' => ['keys' => array_keys($data['templates'])]]);
            });
        }

        return response()->json(['data' => $templates->content(), 'definitions' => $templates->definitions(),
            'provider' => ['mode' => config('services.communications.provider', 'fake')]]);
    }

    public function preview(Request $request, MessageTemplates $templates)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['key' => 'required|string', 'template' => 'required|string|max:4000']);

        return response()->json(['data' => $templates->preview($data['key'], $data['template'])]);
    }

    public function messages(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);

        return response()->json(CommunicationMessage::latest()->paginate(30));
    }

    public function retry(Request $request, string $id, CommunicationService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $service->retry($id);

        return response()->json(['message' => 'تمت جدولة إعادة المحاولة.']);
    }

    public function issue(Request $request, string $id, ReceiptVerificationService $service)
    {
        return response()->json(['data' => $service->issue($id, $request->user()->id)]);
    }

    public function verify(Request $request, string $id, ReceiptVerificationService $service)
    {
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{4}$/D']]);
        $result = $service->verify($id, $data['code'], $request->user()->id);

        return response()->json($result, $result['status']);
    }

    public function previewReceipt(Request $request, string $id, ReceiptVerificationService $service)
    {
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{4}$/D']]);
        $result = $service->preview($id, $data['code'], $request->user()->id);

        return response()->json($result, $result['status'])->header('Cache-Control', 'no-store');
    }

    public function drivers(Request $request)
    {
        abort_unless($request->user()->role === 'admin', 403);
        if ($request->isMethod('POST')) {
            $data = $request->validate(['full_name' => 'required|string|max:150', 'phone' => ['required', 'regex:/^\+?[0-9]{9,15}$/D'], 'vehicle_info' => 'nullable|string|max:255', 'is_active' => 'sometimes|boolean']);
            $driver = DB::transaction(function () use ($request, $data) {
                $driver = Driver::create($data);
                AuditLog::create(['user_id' => $request->user()->id, 'action' => 'DRIVER_CREATED', 'target_table' => 'drivers', 'target_id' => $driver->id, 'details' => []]);

                return $driver;
            });

            return response()->json(['data' => $driver], 201);
        }

        $counts = SupportDistribution::where('fulfillment_method', 'delivery')->whereNotNull('driver_id')
            ->selectRaw('driver_id, status, COUNT(*) AS total')->groupBy('driver_id', 'status')->get()->groupBy('driver_id');
        $activity = DriverAssignment::selectRaw('driver_id, MAX(last_used_at) AS last_activity_at')->groupBy('driver_id')->pluck('last_activity_at', 'driver_id');
        $drivers = Driver::orderBy('full_name')->get()->map(function ($driver) use ($counts, $activity) {
            $states = ($counts->get($driver->id) ?? collect())->pluck('total', 'status');
            $assigned = (int) $states->sum();
            $completed = (int) ($states['completed'] ?? 0);
            $remaining = $assigned - $completed - (int) ($states['cancelled'] ?? 0);
            $driver->setAttribute('metrics', ['assigned' => $assigned, 'delivered' => $completed,
                'in_progress' => (int) ($states['in_delivery'] ?? 0), 'remaining' => $remaining,
                'all_completed' => $assigned > 0 && $remaining === 0 && $completed === $assigned,
                'last_activity_at' => $activity[$driver->id] ?? null]);
            foreach (['assigned_count' => $assigned, 'delivered_count' => $completed,
                'in_progress_count' => (int) ($states['in_delivery'] ?? 0), 'remaining_count' => $remaining,
                'all_completed' => $assigned > 0 && $completed === $assigned, 'last_activity' => $activity[$driver->id] ?? null] as $key => $value) {
                $driver->setAttribute($key, $value);
            }

            return $driver;
        });

        return response()->json(['data' => $drivers]);
    }

    public function updateDriver(Request $request, string $id)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['full_name' => 'sometimes|required|string|max:150',
            'phone' => ['sometimes', 'required', 'regex:/^\+?[0-9]{9,15}$/D'],
            'vehicle_info' => 'nullable|string|max:255', 'is_active' => 'sometimes|boolean']);
        $driver = DB::transaction(function () use ($request, $id, $data) {
            $driver = Driver::whereKey($id)->lockForUpdate()->firstOrFail();
            $driver->update($data);
            AuditLog::create(['user_id' => $request->user()->id, 'action' => $driver->is_active ? 'DRIVER_UPDATED' : 'DRIVER_DEACTIVATED',
                'target_table' => 'drivers', 'target_id' => $id, 'details' => ['fields' => array_keys($data)]]);

            return $driver;
        });

        return response()->json(['data' => $driver]);
    }

    public function assignments(Request $request, DriverAccessService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);
        if ($request->isMethod('POST')) {
            $data = $request->validate(['driver_id' => 'required|uuid', 'tasks' => 'required|array|min:1|max:100', 'tasks.*' => 'required|uuid|distinct', 'minutes' => 'required|integer']);

            $assignment = $service->assign($data['driver_id'], $data['tasks'], $data['minutes'], $request->user()->id);

            return $this->capabilityResponse(['data' => $assignment, 'access_url' => $service->currentUrl($assignment)], 201);
        }

        $page = DriverAssignment::with(['driver', 'tasks.items.inventoryItem'])->latest()->paginate(30);
        $page->getCollection()->each(function ($assignment) {
            $assignment->setAttribute('total', $assignment->tasks->count());
            $assignment->setAttribute('delivered', $assignment->tasks->where('status', 'completed')->count());
            $assignment->setAttribute('in_progress', $assignment->tasks->where('status', 'in_delivery')->count());
            $assignment->setAttribute('remaining', $assignment->tasks->whereNotIn('status', ['completed', 'cancelled'])->count());
        });

        return response()->json($page);
    }

    public function reassign(Request $request, DriverAccessService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['driver_id' => 'required|uuid', 'tasks' => 'required|array|min:1|max:100', 'tasks.*' => 'required|uuid|distinct', 'minutes' => 'required|integer']);

        $assignment = $service->reassign($data['driver_id'], $data['tasks'], $data['minutes'], $request->user()->id);

        return $this->capabilityResponse(['data' => $assignment, 'access_url' => $service->currentUrl($assignment)], 201);
    }

    public function resend(Request $request, string $id, DriverAccessService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $data = $request->validate(['minutes' => 'required|integer']);

        $assignment = $service->resend($id, $data['minutes'], $request->user()->id);

        return $this->capabilityResponse(['data' => $assignment, 'access_url' => $service->currentUrl($assignment)]);
    }

    public function link(Request $request, string $id, DriverAccessService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);

        return $this->capabilityResponse(['data' => ['access_url' => $service->reveal($id, $request->user()->id)]]);
    }

    private function capabilityResponse(array $payload, int $status = 200)
    {
        return response()->json($payload, $status)->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }

    public function revoke(Request $request, string $id, DriverAccessService $service)
    {
        abort_unless($request->user()->role === 'admin', 403);
        $service->revoke($id, $request->user()->id);

        return response()->json(['message' => 'تم إلغاء صلاحية الرابط.']);
    }

    public function driver(Request $request, DriverAccessService $service, ?string $id = null)
    {
        $code = $request->isMethod('POST') ? $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{4}$/D']])['code'] : null;
        $result = $service->access($request->header('X-Driver-Token', ''), $id, $code);

        return response()->json($result, $result['status'])->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }
}
