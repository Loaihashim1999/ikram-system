<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    /**
     * List all notifications for the authenticated user.
     * Admin always receives alerts; other users only if canReceiveNotifications() is true.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->canReceiveNotifications()) {
            return response()->json([]);
        }

        $notifications = Notification::where(function ($q) use ($user) {
            $q->where('recipient_id', $user->id);
            if ($user->role === 'admin') {
                $q->orWhere('recipient_type', 'admin');
            }
        })
        ->latest()
        ->take(50)
        ->get();

        return response()->json($notifications);
    }

    /**
     * Get unread notifications count.
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->canReceiveNotifications()) {
            return response()->json(['unread_count' => 0]);
        }

        $count = Notification::where(function ($q) use ($user) {
            $q->where('recipient_id', $user->id);
            if ($user->role === 'admin') {
                $q->orWhere('recipient_type', 'admin');
            }
        })
        ->where('status', 'unread')
        ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead($id)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => 'unauthorized'], 401);
        }

        $notification = Notification::where('id', $id)
            ->where(function ($q) use ($user) {
                $q->where('recipient_id', $user->id);
                if ($user->role === 'admin') {
                    $q->orWhere('recipient_type', 'admin');
                }
            })
            ->first();

        if ($notification) {
            $notification->update(['status' => 'sent']); // or 'read'
        }

        return response()->json(['status' => 'marked as read']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => 'unauthorized'], 401);
        }

        Notification::where(function ($q) use ($user) {
            $q->where('recipient_id', $user->id);
            if ($user->role === 'admin') {
                $q->orWhere('recipient_type', 'admin');
            }
        })
        ->where('status', 'unread')
        ->update(['status' => 'sent']);

        return response()->json(['status' => 'all marked as read']);
    }
}
