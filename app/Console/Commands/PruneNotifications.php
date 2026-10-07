<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class PruneNotifications extends Command
{
    protected $signature = 'notifications:prune {--days=} {--before=} {--dry-run} {--include-unread}';

    protected $description = 'Delete old read notifications in batches. Unread rows stay unless explicitly included.';

    public function handle(): int
    {
        $days = $this->option('days');
        $before = $this->option('before');
        if ($days !== null && (! ctype_digit((string) $days) || (int) $days < 1)) {
            $this->error('عدد الأيام يجب أن يكون رقماً أكبر من صفر.');

            return 1;
        }
        if ($before !== null && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $before)) {
            $this->error('استخدم تاريخاً بصيغة YYYY-MM-DD.');

            return 1;
        }
        $cutoff = $before
            ? Carbon::parse($before)->endOfDay()
            : now()->subDays((int) ($days ?: config('notifications.retention_days', 30)));
        $includeUnread = (bool) $this->option('include-unread');
        $query = Notification::query()->where('created_at', '<', $cutoff);
        if (! $includeUnread) {
            $query->whereNotNull('read_at');
        }
        $eligible = (clone $query)->count();
        $this->info('النطاق: '.($includeUnread ? 'كل الإشعارات القديمة' : 'الإشعارات المقروءة فقط'));
        $this->info('حد الحذف: '.$cutoff->toDateTimeString());
        $this->info('السجلات المطابقة: '.$eligible);
        if ($this->option('dry-run')) {
            $this->info('تشغيل تجريبي: لم يُحذف أي سجل.');

            return 0;
        }
        $deleted = NotificationService::deleteMatching($query);
        if ($deleted > 0) {
            AuditLog::create([
                'id' => (string) Str::uuid(),
                'user_id' => null,
                'action' => 'NOTIFICATIONS_PRUNED',
                'target_table' => 'notifications',
                'target_id' => (string) Str::uuid(),
                'details' => ['deleted_count' => $deleted, 'scope' => $includeUnread ? 'scheduled-unread' : 'scheduled-read', 'cutoff' => $cutoff->toDateString()],
            ]);
        }
        $this->info('تم حذف '.$deleted.' إشعاراً.');

        return 0;
    }
}
