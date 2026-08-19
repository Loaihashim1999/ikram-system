<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InventoryItem extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'name', 'unit', 'current_quantity', 'min_threshold', 'description',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    // دالة مساعدة لتحديد حالة المخزون
    public function getStockStatusAttribute()
    {
        if ($this->current_quantity == 0) {
            return 'out_of_stock';
        }
        if ($this->current_quantity <= $this->min_threshold) {
            return 'low_stock';
        }

        return 'in_stock';
    }
}
