<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

class Beneficiary extends Model
{
    use HasUuids;

    protected $fillable = [
        // أساسي (original DB column names)
        'beneficiary_type', 'full_name', 'national_id', 'phone',
        'date_of_birth', 'place_of_birth', 'nationality', 'profession',
        // عنوان
        'city', 'district', 'street',
        // الفئة والحالة
        'category_id', 'status', 'priority', 'has_special_needs',
        // أسرة
        'family_status', 'family_members_count', 'wives_count',
        'working_members_count', 'non_working_children_count',
        'father_status', 'mother_status', 'owns_house',
        // سكن ومالية
        'housing_type', 'annual_rent_amount',
        'income_sources', 'monthly_salary',
        'social_security_amount', 'citizen_account_amount',
        'retirement_pension', 'family_support', 'bank_name', 'iban_encrypted',
        'total_income',
        // موظف
        'is_employee', 'job_title', 'job_sector', 'national_address_image_url',
        // صور ووثائق
        'national_id_image_url', 'residence_id_image_url',
        'citizen_account_image_url', 'social_security_image_url',
        'rental_contract_image_url', 'electricity_bill_image_url',
        'salary_certificate_url',
        // OCR
        'ocr_extracted_data',
        // إنشاء
        'created_by',
    ];

    protected $casts = [
        'date_of_birth'          => 'date',
        'residence_issue_date'   => 'date',
        'residence_expiry_date'  => 'date',
        'has_special_needs'      => 'boolean',
        'is_employee'            => 'boolean',
        'owns_house'             => 'boolean',
        'monthly_salary'         => 'decimal:2',
        'social_security_amount' => 'decimal:2',
        'citizen_account_amount' => 'decimal:2',
        'retirement_pension'     => 'decimal:2',
        'family_support'         => 'decimal:2',
        'annual_rent_amount'     => 'decimal:2',
        'income_sources'         => 'array',
        'ocr_extracted_data'     => 'array',
        'total_income'           => 'decimal:2',
    ];

    // ─── Auto-compute total_income on save ──────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        $compute = function (self $b) {
            $b->total_income =
                (float)($b->monthly_salary ?? 0) +
                (float)($b->citizen_account_amount ?? 0) +
                (float)($b->social_security_amount ?? 0) +
                (float)($b->retirement_pension ?? 0) +
                (float)($b->family_support ?? 0);
        };

        static::creating($compute);
        static::updating($compute);
    }

    // ─── IBAN Accessors ──────────────────────────────────────────────────────

    /** Masked IBAN — safe to expose in JSON */
    public function getIbanMaskedAttribute(): ?string
    {
        if (!$this->iban_encrypted) return null;
        try {
            $plain = Crypt::decryptString($this->iban_encrypted);
            return str_repeat('*', max(0, strlen($plain) - 4)) . substr($plain, -4);
        } catch (\Exception) {
            return null;
        }
    }

    protected $appends = ['iban_masked'];
    protected $hidden  = ['iban_encrypted'];

    // ─── Relationships ───────────────────────────────────────────────────────

    public function dependents(): HasMany
    {
        return $this->hasMany(Dependent::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}