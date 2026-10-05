<?php

namespace App\Models;

use App\Events\BeneficiaryChanged;
use App\Services\FinancialCalculationService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

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
        'category_id', 'status', 'priority', 'has_special_needs', 'is_elderly', 'is_special_needs',
        // أسرة
        'family_status', 'family_members_count', 'wives_count',
        'working_members_count', 'non_working_children_count',
        'father_status', 'mother_status', 'owns_house',
        // سكن ومالية
        'housing_type', 'annual_rent_amount', 'monthly_rent',
        'income_sources', 'monthly_salary',
        'social_security_amount', 'citizen_account_amount',
        'retirement_pension', 'family_support',
        'social_insurance_amount', 'other_income_amount', 'monthly_rent_direct_input',
        'bank_name', 'iban_encrypted',
        'total_income', 'net_income',
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
        'created_by', 'confirmed_at', 'confirmed_by', 'archived_at', 'archived_by', 'archive_reason',
    ];

    protected $casts = [
        'confirmed_at' => 'datetime', 'archived_at' => 'datetime',
        'date_of_birth' => 'date:Y-m-d',
        'residence_issue_date' => 'date:Y-m-d',
        'residence_expiry_date' => 'date:Y-m-d',
        'has_special_needs' => 'boolean',
        'is_employee' => 'boolean',
        'owns_house' => 'boolean',
        'monthly_salary' => 'decimal:2',
        'social_security_amount' => 'decimal:2',
        'citizen_account_amount' => 'decimal:2',
        'retirement_pension' => 'decimal:2',
        'family_support' => 'decimal:2',
        'annual_rent_amount' => 'decimal:2',
        'monthly_rent' => 'decimal:2',
        'income_sources' => 'array',
        'ocr_extracted_data' => 'array',
        'total_income' => 'decimal:2',
        'net_income' => 'decimal:2',
        'social_insurance_amount' => 'decimal:2',
        'other_income_amount' => 'decimal:2',
        'monthly_rent_direct_input' => 'decimal:2',
    ];

    /**
     * Exact سعودي is citizen. Any other non-empty nationality is resident.
     * A submitted beneficiary_type or type that disagrees is rejected.
     *
     * @return array{nationality: string, beneficiary_type: string}
     */
    public static function classificationFromNationality(mixed $nationality, mixed $beneficiaryType = null, mixed $aliasType = null): array
    {
        $trimmed = is_string($nationality) || is_numeric($nationality) ? trim((string) $nationality) : '';
        if ($trimmed === '') {
            throw ValidationException::withMessages([
                'nationality' => ['الجنسية مطلوبة.'],
            ]);
        }
        if (mb_strlen($trimmed) > 100) {
            throw ValidationException::withMessages([
                'nationality' => ['الجنسية يجب ألا تتجاوز 100 حرف.'],
            ]);
        }

        $derived = $trimmed === 'سعودي' ? 'citizen' : 'resident';
        foreach ([$beneficiaryType, $aliasType] as $submitted) {
            if ($submitted === null) {
                continue;
            }
            $normalized = strtolower(trim((string) $submitted));
            if ($normalized === '') {
                continue;
            }
            if ($normalized !== $derived) {
                throw ValidationException::withMessages([
                    'beneficiary_type' => ['صفة المستفيد لا تطابق الجنسية المدخلة.'],
                ]);
            }
        }

        return ['nationality' => $trimmed, 'beneficiary_type' => $derived];
    }

    // ─── Auto-compute total_income, monthly_rent & net_income on save ────────

    protected static function boot(): void
    {
        parent::boot();

        $compute = function (self $b) {
            $calcService = app(FinancialCalculationService::class);
            $res = $calcService->calculate($b->getAttributes());
            $b->total_income = $res['total_income'];
            $b->monthly_rent = $res['monthly_rent'];
            $b->net_income = $res['net_income'];
            $b->priority = $res['priority'];
            $b->category_id = $res['category_id'];
        };

        static::creating($compute);
        static::updating($compute);
        static::created(function ($b) {
            BeneficiaryChanged::dispatch($b);
        });
        static::updated(function ($b) {
            BeneficiaryChanged::dispatch($b);
        });
    }

    // ─── Accessors ───────────────────────────────────────────────────────────

    /** Masked IBAN — safe to expose in JSON */
    public function getIbanMaskedAttribute(): ?string
    {
        if (! $this->iban_encrypted) {
            return null;
        }
        try {
            $plain = Crypt::decryptString($this->iban_encrypted);

            return str_repeat('*', max(0, strlen($plain) - 4)).substr($plain, -4);
        } catch (\Exception) {
            return null;
        }
    }

    /** Resident Need Level (مستوى احتياج المقيم: شديد / عادي) */
    public function getNeedLevelAttribute(): ?string
    {
        if ($this->getAttribute('beneficiary_type') !== 'resident') {
            return null;
        }
        $calcService = app(FinancialCalculationService::class);
        $res = $calcService->calculate($this->getAttributes());

        return $res['need_level'] ?? null;
    }

    /** Resident Need Level Label (المسمى العربي لمستوى الاحتياج) */
    public function getNeedLevelLabelAttribute(): ?string
    {
        if ($this->getAttribute('beneficiary_type') !== 'resident') {
            return null;
        }
        $calcService = app(FinancialCalculationService::class);
        $res = $calcService->calculate($this->getAttributes());

        return $res['need_level_label'] ?? null;
    }

    protected $appends = ['iban_masked', 'need_level', 'need_level_label'];

    protected $hidden = ['iban_encrypted'];

    public function getNationalIdImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('national_id_image_url');
    }

    public function getResidenceIdImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('residence_id_image_url');
    }

    public function getCitizenAccountImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('citizen_account_image_url');
    }

    public function getSocialSecurityImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('social_security_image_url');
    }

    public function getPensionCertificateImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('pension_certificate_image_url');
    }

    public function getNationalAddressImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('national_address_image_url');
    }

    public function getRentalContractImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('rental_contract_image_url');
    }

    public function getElectricityBillImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('electricity_bill_image_url');
    }

    public function getSalaryCertificateUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('salary_certificate_url');
    }

    private function privateDocumentUrl(string $field): ?string
    {
        $path = $this->getRawOriginal($field);
        if (! is_string($path) || $path === '' || str_contains($path, '://') || str_starts_with($path, '/')) {
            return null;
        }

        return route('beneficiaries.documents.download', [
            'beneficiary' => $this->getKey(),
            'field' => $field,
        ]);
    }

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
