<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dependent extends Model
{
    use HasUuids;

    protected $fillable = [
        'beneficiary_id',
        'name',
        'relationship',
        'date_of_birth',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }
}
