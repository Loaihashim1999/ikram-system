<?php
namespace App\Http\Controllers;
use App\Models\Notification;
use Illuminate\Http\Request;
class NotificationController extends Controller
{
    private function records(Request $request) {
        abort_unless($request->user()->canReceiveNotifications(), 403);
        return Notification::where('recipient_id', $request->user()->id)->where('recipient_type', 'staff');
    }
    public function index(Request $request) {
        $request->validate(['category' => 'nullable|in:warehouse_expiry,system_event,security', 'page' => 'nullable|integer|min:1']);
        return response()->json($this->records($request)->when($request->category, fn($q, $category) => $q->where('category', $category))->latest()->orderBy('id')->paginate(50));
    }
    public function unreadCount(Request $request) {
        return response()->json(['unread_count' => $this->records($request)->whereNull('read_at')->count()]);
    }
    public function markAsRead(Request $request, $id) {
        $notification = $this->records($request)->findOrFail($id);
        if (!$notification->read_at) $notification->update(['read_at' => now()]);
        return response()->json(['success' => true]);
    }
    public function markAllRead(Request $request) {
        $this->records($request)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['success' => true]);
    }
}
