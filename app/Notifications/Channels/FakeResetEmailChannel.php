<?php

namespace App\Notifications\Channels;

use App\Models\CommunicationMessage;
use App\Models\User;
use App\Notifications\ResetAccountPassword;
use App\Services\Communications\MessageTemplates;
use App\Services\NotificationService;

class FakeResetEmailChannel
{
    public function send(User $user, ResetAccountPassword $notification): void
    {
        CommunicationMessage::where('operation_type', 'password_reset')->where('operation_id', $user->id)->whereIn('status', ['pending', 'retrying', 'failed'])
            ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'superseded']);
        $expiry = now()->addMinutes(config('auth.passwords.users.expire'));
        // Fragment never reaches the HTTP server/access log. Client removes it immediately.
        $link = rtrim(config('app.url'), '/').'/reset-password#'.http_build_query(['token' => $notification->token, 'email' => $user->email]);
        $templates = app(MessageTemplates::class);
        $values = ['user_name' => $user->full_name, 'reset_link' => $link, 'reset_expiry' => $expiry->format('Y-m-d H:i')];
        NotificationService::queueCommunication('reset:'.hash('sha256', $notification->token), 'account', $user->id, 'password_reset', $user->id, $user->email,
            $templates->render('password_reset_body', $values), $expiry, $templates->render('password_reset_subject', $values));
    }
}
