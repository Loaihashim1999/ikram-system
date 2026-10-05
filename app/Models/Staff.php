<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Staff extends Model
{
    protected $table = 'staff';

    protected $fillable = [
        'name', 'national_id', 'phone', 'email',
        'birth_date', 'national_address',
        'job_title', 'department', 'hire_date', 'salary', 'status',
        'family_members_count', 'wives_count',
        'father_status', 'mother_status', 'owns_house',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'birth_date' => 'date',
        'salary' => 'decimal:2',
        'owns_house' => 'boolean',
    ];

    public function dependents(): HasMany
    {
        return $this->hasMany(StaffDependent::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(StaffDistribution::class, 'staff_member_id');
    }
}
