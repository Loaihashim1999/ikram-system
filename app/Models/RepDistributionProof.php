<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepDistributionProof extends Model
{
    use HasFactory;

    protected $table = 'rep_distribution_proofs';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'rep_distribution_id',
        'image_url',
        'uploaded_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقة
    public function repDistribution(): BelongsTo
    {
        return $this->belongsTo(RepDistribution::class);
    }
}