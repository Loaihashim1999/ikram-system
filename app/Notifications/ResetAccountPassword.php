<?php

namespace App\Notifications;

use App\Notifications\Channels\FakeResetEmailChannel;
use Illuminate\Auth\Notifications\ResetPassword;

class ResetAccountPassword extends ResetPassword
{
    public function via($notifiable)
    {
        return [FakeResetEmailChannel::class];
    }
}
