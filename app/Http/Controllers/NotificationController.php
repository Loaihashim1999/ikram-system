<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    private function visible(Request $request): Builder
    {
        abort_unless($request->user()->canReceiveNotifications(), 403);

        return NotificationService::visibleQuery($request->user());
    }

    private function filtered(Request $request): Builder
    {
        $filters = $request->validate([
            'category' => 'nullable|in:warehouse_expiry,system_event,security',
            'event_type' => 'nullable|string|max:100',
            'read' => 'nullable|in:read,unread',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);
        if (! empty($filters['date_from']) && ! empty($filters['date_to'])) {
            $request->validate(['date_to' => 'after_or_equal:date_from']);
        }
        $query = $this->visible($request);
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (! empty($filters['event_type'])) {
            $query->where('event_type', $filters['event_type']);
        }
        if (($filters['read'] ?? null) === 'read') {
            $query->whereNotNull('read_at');
        }
        if (($filters['read'] ?? null) === 'unread') {
            $query->whereNull('read_at');
        }
        foreach (['date_from' => '>=', 'date_to' => '<='] as $field => $operator) {
            if (! empty($filters[$field])) {
                $query->whereDate('created_at', $operator, $filters[$field]);
            }
        }

        return $query;
    }

    public function index(Request $request)
    {
        $perPage = (int) ($request->input('per_page') ?: 20);
        $page = $this->filtered($request)->latest()->orderBy('id')->paginate(min($perPage, 50));
        NotificationService::decorateTargets($page->getCollection());

        return response()->json($page->toArray() + ['unread_count' => $this->unreadTotal($request)]);
    }

    public function unreadCount(Request $request)
    {
        return response()->json(['unread_count' => $this->unreadTotal($request)]);
    }

    public function markAsRead(Request $request, $id)
    {
        $notification = $this->visible($request)->whereKey($id)->first();
        abort_unless($notification, 404);
        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json(['success' => true, 'unread_count' => $this->unreadTotal($request)]);
    }

    public function markAllRead(Request $request)
    {
        $this->visible($request)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['success' => true, 'unread_count' => 0]);
    }

    public function destroy(Request $request, $id)
    {
        abort_unless($request->user()->canDeleteOwnNotifications(), 403);
        $notification = $this->visible($request)->whereKey($id)->first();
        abort_unless($notification, 404);
        $notification->delete();
        $this->audit($request, 1, 'one');

        return response()->json([
            'deleted_count' => 1,
            'unread_count' => $this->unreadTotal($request),
            'remaining_count' => $this->visible($request)->count(),
        ]);
    }

    public function destroySelected(Request $request)
    {
        abort_unless($request->user()->canDeleteOwnNotifications(), 403);
        $ids = $request->validate([
            'ids' => 'required|array|min:1|max:100',
            'ids.*' => 'required|uuid|distinct',
        ])['ids'];
        $deleted = NotificationService::deleteMatching($this->visible($request)->whereIn('id', $ids));
        $this->audit($request, $deleted, 'selected');

        return response()->json([
            'deleted_count' => $deleted,
            'unread_count' => $this->unreadTotal($request),
            'remaining_count' => $this->visible($request)->count(),
        ]);
    }

    public function destroyRead(Request $request)
    {
        abort_unless($request->user()->canDeleteOwnNotifications(), 403);
        $deleted = NotificationService::deleteMatching($this->visible($request)->whereNotNull('read_at'));
        $this->audit($request, $deleted, 'read');

        return response()->json([
            'deleted_count' => $deleted,
            'unread_count' => $this->unreadTotal($request),
            'remaining_count' => $this->visible($request)->count(),
        ]);
    }

    public function purge(Request $request)
    {
        abort_unless($request->user()->canPurgeNotifications(), 403);
        $data = $request->validate([
            'days' => 'nullable|integer|min:1|max:3650',
            'before' => 'nullable|date',
            'include_unread' => 'sometimes|boolean',
            'confirmation' => 'nullable|string|max:40',
        ]);
        $includeUnread = (bool) ($data['include_unread'] ?? false);
        if ($includeUnread && ($data['confirmation'] ?? '') !== 'purge-unread') {
            abort(422, 'حذف الإشعارات غير المقروءة يتطلب تأكيداً صريحاً.');
        }
        $cutoff = $this->cutoff($data);
        $query = Notification::query()->where('created_at', '<', $cutoff);
        if (! $includeUnread) {
            $query->whereNotNull('read_at');
        }
        $deleted = NotificationService::deleteMatching($query);
        $this->audit($request, $deleted, $includeUnread ? 'purge-unread' : 'purge-read', $cutoff->toDateString());

        return response()->json(['deleted_count' => $deleted, 'cutoff' => $cutoff->toDateString()]);
    }

    private function unreadTotal(Request $request): int
    {
        return $this->visible($request)->whereNull('read_at')->count();
    }

    private function cutoff(array $data): Carbon
    {
        if (! empty($data['before'])) {
            $cutoff = Carbon::parse($data['before'])->endOfDay();
            abort_if($cutoff->isFuture(), 422, 'تاريخ التنظيف يجب أن يكون اليوم أو قبله.');

            return $cutoff;
        }
        $days = (int) ($data['days'] ?? config('notifications.retention_days', 30));

        return now()->subDays($days);
    }

    private function audit(Request $request, int $deleted, string $scope, ?string $cutoff = null): void
    {
        if ($deleted < 1) {
            return;
        }
        AuditLog::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'action' => 'NOTIFICATIONS_DELETED',
            'target_table' => 'notifications',
            'target_id' => (string) Str::uuid(),
            'details' => ['deleted_count' => $deleted, 'scope' => $scope, 'cutoff' => $cutoff],
        ]);
    }
}
