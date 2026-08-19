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
        'password',
        'full_name',
        'phone',
        'role',
        'permissions',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'is_active' => 'boolean',
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
}
