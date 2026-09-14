<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class EnsureProductionAdmin extends Command
{
    protected $signature = 'app:ensure-production-admin';

    protected $description = 'Create the configured bootstrap administrator when no administrator exists';

    public function handle(): int
    {
        if (User::query()->where('role', 'admin')->exists()) {
            $this->info('An administrator already exists; no account was changed.');

            return self::SUCCESS;
        }

        $password = config('ikram.bootstrap_admin.password');
        if (! is_string($password) || $password === '') {
            $this->warn('IKRAM_ADMIN_PASSWORD is not configured; administrator creation was skipped.');

            return self::SUCCESS;
        }

        $username = (string) config('ikram.bootstrap_admin.username', 'admin');
        if (User::query()->where('username', $username)->exists()) {
            $this->error("The configured username '{$username}' belongs to a non-admin user.");

            return self::FAILURE;
        }

        User::query()->create([
            'username' => $username,
            'password' => $password,
            'email' => config('ikram.bootstrap_admin.email'),
            'full_name' => (string) config('ikram.bootstrap_admin.full_name', 'مدير النظام'),
            'role' => 'admin',
            'permissions' => [],
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);

        $this->info("Administrator '{$username}' was created.");

        return self::SUCCESS;
    }
}
