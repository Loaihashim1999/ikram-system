<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'username',
        'email',
        'password',
        'full_name',
        'phone',
        'role',
        'permissions',
        'is_active',
        'can_receive_notifications',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'is_active' => 'boolean',
        'can_receive_notifications' => 'boolean',
        'permissions' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function beneficiaries()
    {
        return $this->hasMany(Beneficiary::class, 'created_by');
    }

    public function distributions()
    {
        return $this->hasMany(Distribution::class, 'assigned_by');
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
    /**
     * Determine if the user has a given permission.
     * Admin role has full access.
     */
    public function hasPermission(string $permission): bool
    {
        // Admin role bypass
        if ($this->role === 'admin') {
            return true;
        }
        // Permissions stored as JSON array in `permissions` attribute
        $permissions = $this->permissions ?? [];
        return in_array($permission, $permissions);
    }

    /**
     * Check if user is eligible to receive operations alerts.
     * Admin always receives notifications; other roles require can_receive_notifications = true.
     */
    public function canReceiveNotifications(): bool
    {
        if ($this->role === 'admin') {
            return true;
        }
        if (isset($this->attributes['can_receive_notifications'])) {
            return (bool) $this->attributes['can_receive_notifications'];
        }
        $perms = $this->permissions ?? [];
        return !empty($perms['can_receive_notifications']);
    }
}

