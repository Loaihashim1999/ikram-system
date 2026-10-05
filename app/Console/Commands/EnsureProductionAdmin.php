<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class EnsureProductionAdmin extends Command
{
    protected $signature = 'app:ensure-production-admin';

    protected $description = 'Interactively create the first administrator and permanently close setup';

    public function handle(): int
    {
        if (User::query()->where('role', 'admin')->exists()) {
            $this->info('An administrator already exists; no account was changed.');

            return self::SUCCESS;
        }

        if (! $this->input->isInteractive()) {
            $this->error('First administrator setup requires an interactive operator session.');

            return self::FAILURE;
        }

        $data = [
            'full_name' => trim((string) $this->ask('Full name')),
            'username' => Str::lower(trim((string) $this->ask('Username'))),
            'email' => Str::lower(trim((string) $this->ask('Email'))),
            'password' => $this->secret('Password', false),
            'password_confirmation' => $this->secret('Confirm password', false),
        ];
        $validator = Validator::make($data, [
            'full_name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'email:rfc', 'max:100', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        if ($validator->fails()) {
            $this->error('Invalid administrator details: '.implode(', ', $validator->errors()->keys()));

            return self::FAILURE;
        }
        if (! $this->confirm('Create the first administrator and permanently close setup?', false)) {
            return self::FAILURE;
        }

        $created = DB::transaction(function () use ($data): bool {
            $state = DB::table('system_initializations')->where('key', 'first_admin')->lockForUpdate()->first();
            if (! $state || $state->completed_at !== null || User::query()->where('role', 'admin')->exists()) {
                return false;
            }
            $admin = User::query()->create([
                ...collect($data)->except('password_confirmation')->all(),
                'role' => 'admin',
                'permissions' => [],
                'is_active' => true,
                'can_receive_notifications' => true,
            ]);
            DB::table('system_initializations')->where('key', 'first_admin')->update([
                'completed_at' => now(), 'updated_at' => now(),
            ]);
            AuditLog::query()->create([
                'user_id' => $admin->id, 'action' => 'FIRST_ADMIN_INITIALIZED',
                'target_table' => 'users', 'target_id' => $admin->id,
                'details' => ['event' => 'initialization_completed', 'method' => 'console'],
            ]);

            return true;
        }, 3);

        if (! $created) {
            $this->error('First administrator setup is closed or unavailable.');

            return self::FAILURE;
        }
        $this->info('Administrator created; first administrator setup is now closed.');

        return self::SUCCESS;
    }
}
