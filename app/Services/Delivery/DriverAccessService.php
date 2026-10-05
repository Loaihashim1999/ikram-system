<?php

namespace App\Services\Delivery;

use App\Models\AuditLog;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\SupportDistribution;
use App\Services\Communications\MessageTemplates;
use App\Services\NotificationService;
use App\Services\SupportDistributionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DriverAccessService
{
    public function assign(string $driverId, array $ids, int $minutes, string $actor): DriverAssignment
    {
        if ($minutes < 1 || $minutes > app(SecurityPolicy::class)->get('driver_max_minutes')) {
            throw ValidationException::withMessages(['minutes' => 'مدة التكليف خارج النطاق المسموح.']);
        }

        return DB::transaction(function () use ($driverId, $ids, $minutes, $actor) {
            $driver = Driver::whereKey($driverId)->lockForUpdate()->firstOrFail();
            abort_unless($driver->is_active, 422, 'السائق غير نشط.');
            $tasks = SupportDistribution::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            if (! $tasks->count() || $tasks->count() !== count(array_unique($ids))) {
                abort(422, 'مهام غير صالحة.');
            }
            foreach ($tasks as $task) {
                if ($task->fulfillment_method !== 'delivery' || $task->status !== 'ready' || DB::table('driver_assignment_tasks')->where('support_distribution_id', $task->id)->whereNull('released_at')->exists()) {
                    throw ValidationException::withMessages(['tasks' => 'يجب اختيار مهام توصيل جاهزة وغير مكلفة.']);
                }
            }
            $token = bin2hex(random_bytes(32));
            $assignment = DriverAssignment::create(['driver_id' => $driverId, 'created_by' => $actor, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes($minutes)]);
            $assignment->tasks()->attach($tasks->pluck('id'));
            foreach ($tasks as $task) {
                $task->update(['driver_id' => $driverId]);
                $dispatched = app(SupportDistributionService::class)->transition($task->id, 'dispatch', $actor);
                DB::afterCommit(fn () => NotificationService::notifyAll('support_delivery_assigned', 'تم تكليف سائق بمهمة توصيل.', $dispatched));
            }
            $this->rememberCapability($assignment, $token);
            $this->queueDriverNotice($assignment, $driver, $token, 'assignment:'.$assignment->id);
            $this->audit($assignment, 'DRIVER_LINK_CREATED');

            return $assignment;
        });
    }

    /** Every request revalidates token, driver, task ownership and lifecycle under the assignment lock. */
    public function access(string $token, ?string $taskId = null, ?string $code = null): array
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return ['status' => 401, 'message' => 'رابط الوصول غير صالح.'];
        }

        return DB::transaction(function () use ($token, $taskId, $code) {
            $assignment = DriverAssignment::where('token_hash', hash('sha256', $token))->lockForUpdate()->first();
            if (! $assignment) {
                return ['status' => 401, 'message' => 'رابط الوصول غير صالح.'];
            }
            // Lock the driver too, so an overlapping deactivation is serialized with confirmation.
            $driver = Driver::whereKey($assignment->driver_id)->lockForUpdate()->first();
            if (! $driver?->is_active || $assignment->revoked_at) {
                return ['status' => 403, 'message' => 'تم إلغاء صلاحية هذا التكليف.'];
            }
            if ($assignment->expires_at->lte(now())) {
                if (! $assignment->expiry_audited_at) {
                    $assignment->update(['expiry_audited_at' => now()]);
                    $this->audit($assignment, 'DRIVER_LINK_EXPIRED');
                }

                return ['status' => 410, 'message' => 'انتهت صلاحية رابط التكليف.'];
            }
            $tasks = $assignment->tasks()->with('items.inventoryItem')->orderBy('support_distributions.id')->get();
            if (! $assignment->completed_at && $tasks->isNotEmpty() && $tasks->every(fn ($task) => $task->status === 'completed')) {
                $assignment->update(['completed_at' => now()]);
                $this->audit($assignment, 'DRIVER_TASKS_COMPLETED');
            }
            if ($taskId !== null) {
                $task = $tasks->firstWhere('id', $taskId);
                if (! $task || $task->driver_id !== $driver->id) {
                    return ['status' => 404, 'message' => 'المهمة غير متاحة.'];
                }
                if ($code !== null) {
                    $result = app(ReceiptVerificationService::class)->verify($taskId, $code, $assignment->created_by, $assignment->id);
                    if ($result['status'] === 200 && ! $assignment->tasks()->where('status', '!=', 'completed')->exists()) {
                        if (! $assignment->completed_at) {
                            $assignment->update(['completed_at' => now()]);
                            $this->audit($assignment, 'DRIVER_TASKS_COMPLETED');
                        }
                        $result['completed'] = true;
                    }

                    return $result;
                }
            }
            $assignment->update(['last_used_at' => now()]);
            if (! $assignment->completed_at) {
                $this->audit($assignment, 'DRIVER_ACCESS');
            }

            return ['status' => 200, 'data' => [
                'driver_name' => $driver->full_name, 'total' => $tasks->count(), 'completed' => $tasks->where('status', 'completed')->count(),
                'remaining' => $tasks->where('status', '!=', 'completed')->count(), 'expires_at' => $assignment->expires_at->toIso8601String(),
                'all_completed' => $assignment->completed_at !== null,
                'tasks' => ($taskId ? $tasks->where('id', $taskId) : $tasks)->map(fn ($task) => $this->taskView($task))->values(),
            ]];
        });
    }

    private function taskView(SupportDistribution $task): array
    {
        $recipient = $task->{$task->recipient_type};

        return ['id' => $task->id, 'reference' => $task->id, 'recipient_reference' => $task->recipient_reference,
            'recipient_name' => $task->recipient_name, 'phone' => $task->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone,
            'city' => $recipient?->city, 'district' => $recipient?->district, 'address' => $recipient?->street ?? $recipient?->national_address,
            'location_url' => null, 'status' => $task->status, 'completed_at' => $task->completed_at?->toIso8601String(),
            'support_type' => $task->items->map(fn ($item) => $item->inventoryItem?->name)->filter()->implode('، '),
            'items' => $task->items->map(fn ($item) => ['name' => $item->inventoryItem?->name, 'quantity' => $item->requested_quantity, 'unit' => $item->unit_snapshot])->values()];
    }

    /**
     * Move in-delivery tasks to another driver. Previous membership and attribution stay;
     * the previous capability for those tasks ends immediately.
     */
    public function reassign(string $driverId, array $ids, int $minutes, string $actor): DriverAssignment
    {
        if ($minutes < 1 || $minutes > app(SecurityPolicy::class)->get('driver_max_minutes')) {
            throw ValidationException::withMessages(['minutes' => 'مدة التكليف خارج النطاق المسموح.']);
        }

        return DB::transaction(function () use ($driverId, $ids, $minutes, $actor) {
            $driver = Driver::whereKey($driverId)->lockForUpdate()->firstOrFail();
            abort_unless($driver->is_active, 422, 'السائق غير نشط.');
            $tasks = SupportDistribution::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            if (! $tasks->count() || $tasks->count() !== count(array_unique($ids))) {
                abort(422, 'مهام غير صالحة.');
            }
            foreach ($tasks as $task) {
                if ($task->fulfillment_method !== 'delivery' || $task->status !== 'in_delivery') {
                    throw ValidationException::withMessages(['tasks' => 'النقل متاح لمهام التوصيل الجارية فقط.']);
                }
                if ($task->driver_id === $driverId) {
                    throw ValidationException::withMessages(['driver_id' => 'السائق نفسه يُجدد رابطه دون نقل التكليف.']);
                }
            }
            $memberships = DB::table('driver_assignment_tasks')->whereIn('support_distribution_id', $ids)->whereNull('released_at')->lockForUpdate()->get();
            if ($memberships->count() !== $tasks->count()) {
                abort(409, 'لا يوجد تكليف نشط واحد لكل مهمة.');
            }
            $previous = DriverAssignment::whereIn('id', $memberships->pluck('driver_assignment_id')->unique())->orderBy('id')->lockForUpdate()->get();
            if ($previous->contains(fn ($assignment) => $assignment->completed_at !== null)) {
                abort(409, 'لا يمكن نقل مهمة من تكليف مكتمل.');
            }
            $releasedAt = now();
            DB::table('driver_assignment_tasks')->whereIn('id', $memberships->pluck('id'))->update(['released_at' => $releasedAt]);
            foreach ($previous as $assignment) {
                $stillActive = DB::table('driver_assignment_tasks')->where('driver_assignment_id', $assignment->id)->whereNull('released_at')->exists();
                if (! $stillActive && ! $assignment->revoked_at) {
                    $assignment->update(['revoked_at' => $releasedAt]);
                    $this->audit($assignment, 'DRIVER_LINK_REVOKED', $actor);
                }
            }
            $token = bin2hex(random_bytes(32));
            $assignment = DriverAssignment::create(['driver_id' => $driverId, 'created_by' => $actor, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes($minutes)]);
            $assignment->tasks()->attach($tasks->pluck('id'));
            foreach ($tasks as $task) {
                $task->update(['driver_id' => $driverId]);
            }
            $this->rememberCapability($assignment, $token);
            $this->queueDriverNotice($assignment, $driver, $token, 'assignment:'.$assignment->id);
            AuditLog::create(['user_id' => $actor, 'action' => 'DRIVER_TASK_REASSIGNED', 'target_table' => 'driver_assignments', 'target_id' => $assignment->id, 'details' => [
                'driver_id' => $driverId, 'previous_assignment_ids' => $previous->pluck('id')->values()->all(),
                'previous_driver_ids' => $previous->pluck('driver_id')->unique()->values()->all(), 'task_ids' => $tasks->pluck('id')->values()->all(),
            ]]);
            $this->audit($assignment, 'DRIVER_LINK_CREATED');

            return $assignment;
        });
    }

    /** Rotate only the scoped capability, retaining task membership and historical attribution. */
    public function resend(string $id, int $minutes, string $actor): DriverAssignment
    {
        if ($minutes < 1 || $minutes > app(SecurityPolicy::class)->get('driver_max_minutes')) {
            throw ValidationException::withMessages(['minutes' => 'مدة التكليف خارج النطاق المسموح.']);
        }

        return DB::transaction(function () use ($id, $minutes, $actor) {
            $assignment = DriverAssignment::whereKey($id)->lockForUpdate()->firstOrFail();
            $driver = Driver::whereKey($assignment->driver_id)->lockForUpdate()->firstOrFail();
            abort_unless($driver->is_active && ! $assignment->completed_at, 409, 'التكليف غير متاح لإعادة الإرسال.');
            $tasks = $assignment->tasks()->orderBy('support_distributions.id')->lockForUpdate()->get();
            abort_unless($tasks->contains(fn ($task) => $task->status === 'in_delivery'), 409, 'لا توجد مهام توصيل متبقية.');
            abort_if($tasks->contains(fn ($task) => $task->driver_id !== $driver->id || $task->fulfillment_method !== 'delivery'
                || ! in_array($task->status, ['in_delivery', 'completed'], true)), 409, 'ارتباط مهام التكليف غير صالح.');
            $wasRevoked = $assignment->revoked_at !== null;
            CommunicationMessage::where('operation_type', 'driver_assignment_sms')->where('operation_id', $id)
                ->whereIn('status', ['pending', 'retrying', 'failed'])->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'superseded']);
            $token = bin2hex(random_bytes(32));
            $assignment->update(['token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes($minutes),
                'revoked_at' => null, 'expiry_audited_at' => null]);
            $this->rememberCapability($assignment, $token);
            $this->queueDriverNotice($assignment, $driver, $token, 'assignment:'.$id.':'.Str::uuid());
            $this->audit($assignment, $wasRevoked ? 'DRIVER_LINK_REOPENED' : 'DRIVER_LINK_RESENT', $actor);

            return $assignment;
        });
    }

    /** Return the current capability URL without rotating or logging it. */
    public function currentUrl(DriverAssignment $assignment): ?string
    {
        $token = $assignment->capability_ciphertext;

        return is_string($token) && preg_match('/^[a-f0-9]{64}$/D', $token) ? $this->capabilityUrl($token) : null;
    }

    public function reveal(string $id, string $actor): string
    {
        $assignment = DriverAssignment::whereKey($id)->firstOrFail();
        abort_if($assignment->completed_at || $assignment->revoked_at, 409, 'الرابط غير متاح للنسخ.');
        $url = $this->currentUrl($assignment);
        abort_unless($url, 404, 'لا يوجد رابط محفوظ. التدوير ينشئ رابطاً جديداً.');
        $this->audit($assignment, 'DRIVER_LINK_VIEWED', $actor);

        return $url;
    }

    private function capabilityUrl(string $token): string
    {
        return rtrim((string) config('app.url'), '/').'/driver-access#'.$token;
    }

    private function rememberCapability(DriverAssignment $assignment, string $token): void
    {
        $assignment->forceFill(['capability_ciphertext' => $token])->save();
    }

    private function queueDriverNotice(DriverAssignment $assignment, Driver $driver, string $token, string $key): void
    {
        try {
            $body = app(MessageTemplates::class)->render('driver_assignment_sms', [
                'driver_name' => $driver->full_name,
                'temporary_driver_link' => $this->capabilityUrl($token),
                'link_expiry' => $assignment->expires_at->format('Y-m-d H:i'),
            ]);
            NotificationService::queueCommunication($key, 'driver', $driver->id, 'driver_assignment_sms', $assignment->id, $driver->phone, $body, $assignment->expires_at);
        } catch (\Throwable) {
            // The assignment and stored capability stay valid for manual sharing.
        }
    }

    public function revoke(string $id, string $actor): void
    {
        DB::transaction(function () use ($id, $actor) {
            $assignment = DriverAssignment::whereKey($id)->lockForUpdate()->firstOrFail();
            $assignment->update(['revoked_at' => now()]);
            $this->audit($assignment, 'DRIVER_LINK_REVOKED', $actor);
        });
    }

    private function audit(DriverAssignment $assignment, string $action, ?string $actor = null): void
    {
        if (in_array($action, ['DRIVER_LINK_REVOKED', 'DRIVER_TASKS_COMPLETED', 'DRIVER_LINK_EXPIRED'], true)) {
            CommunicationMessage::where('operation_type', 'driver_assignment_sms')->where('operation_id', $assignment->id)->whereIn('status', ['pending', 'retrying', 'failed'])
                ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'access_ended']);
        }
        AuditLog::create(['user_id' => $actor ?? $assignment->created_by, 'action' => $action, 'target_table' => 'driver_assignments', 'target_id' => $assignment->id, 'details' => ['driver_id' => $assignment->driver_id]]);
    }
}
