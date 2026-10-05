<?php
namespace App\Http\Controllers;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
class NotificationController extends Controller
{
    private function records(Request $request) {
        abort_unless($request->user()->canReceiveNotifications(), 403);
        return Notification::where('recipient_id', $request->user()->id)->where('recipient_type', 'staff');
    }
    private function visibleIds(Request $request) {
        return $this->records($request)->latest()->orderBy('id')->get()
            ->filter(fn (Notification $notification) => NotificationService::recipientMaySeeTarget($request->user(), $notification))
            ->pluck('id');
    }
    public function index(Request $request) {
        $request->validate(['category' => 'nullable|in:warehouse_expiry,system_event,security', 'page' => 'nullable|integer|min:1']);
        $ids = $this->records($request)->when($request->category, fn ($q, $category) => $q->where('category', $category))->latest()->orderBy('id')->get()
            ->filter(fn (Notification $notification) => NotificationService::recipientMaySeeTarget($request->user(), $notification))
            ->pluck('id');
        return response()->json($this->records($request)->whereIn('id', $ids)->latest()->orderBy('id')->paginate(50));
    }
    public function unreadCount(Request $request) {
        return response()->json(['unread_count' => $this->records($request)->whereIn('id', $this->visibleIds($request))->whereNull('read_at')->count()]);
    }
    public function markAsRead(Request $request, $id) {
        $notification = $this->records($request)->findOrFail($id);
        abort_unless(NotificationService::recipientMaySeeTarget($request->user(), $notification), 404);
        if (!$notification->read_at) $notification->update(['read_at' => now()]);
        return response()->json(['success' => true]);
    }
    public function markAllRead(Request $request) {
        $this->records($request)->whereIn('id', $this->visibleIds($request))->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['success' => true]);
    }
}
