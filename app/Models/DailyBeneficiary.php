<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DailyBeneficiary extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'daily_beneficiaries';

    protected $fillable = [
        'full_name',
        'national_id',
        'phone',
        'date_of_birth',
        'district',
        'category_id',
        'category_name',
        'status',
        'total_received_count',
        'last_delivery_date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'last_delivery_date' => 'datetime',
        'total_received_count' => 'integer',
    ];

    public function documents(): HasMany
    {
        return $this->hasMany(DailyBeneficiaryDocument::class, 'daily_beneficiary_id');
    }

    public function receivingTransactions(): HasMany
    {
        return $this->hasMany(DailyReceivingTransaction::class, 'daily_beneficiary_id')->latest('receiving_date');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeSearch($query, ?string $term)
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function ($q) use ($term) {
            $q->where('full_name', 'like', "%{$term}%")
              ->orWhere('national_id', 'like', "%{$term}%")
              ->orWhere('phone', 'like', "%{$term}%");
        });
    }
}
