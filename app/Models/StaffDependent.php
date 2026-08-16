<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffDependent extends Model
{
    use HasUuids;

    protected $table = 'staff_dependents';

    protected $fillable = [
        'staff_id',
        'name',
        'relationship',
        'date_of_birth',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}
