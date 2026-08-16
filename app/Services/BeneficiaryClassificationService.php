<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Setting;

class BeneficiaryClassificationService
{
    /**
     * تحديد فئة المستفيد بناءً على الدخل والبيانات المالية
     *
     * @param string $beneficiaryType 'citizen' أو 'resident'
     * @param float $monthlySalary
     * @param float $socialSecurityAmount
     * @param float $citizenAccountAmount
     * @return string UUID الخاص بالفئة (category_id)
     */
    public function determineCategory(
        string $beneficiaryType,
        float $monthlySalary = 0,
        float $socialSecurityAmount = 0,
        float $citizenAccountAmount = 0,
        bool $hasSpecialNeeds = false
    ): string {
        if ($hasSpecialNeeds) {
            $category = Category::where('name', 'ذوي الاحتياجات الخاصة')->first();
            return $category ? $category->id : Category::first()->id;
        }

        // 1. جلب الحد الأقصى المسموح به من الإعدادات (الافتراضي 4000)
        $thresholdKey = $beneficiaryType === 'citizen' ? 'income_threshold_citizen' : 'income_threshold_resident';
        $threshold = (float) Setting::get($thresholdKey, 4000);

        // 2. حساب إجمالي الدخل الشهري
        $totalIncome = $monthlySalary;
        
        if ($beneficiaryType === 'citizen') {
            $totalIncome += $socialSecurityAmount + $citizenAccountAmount;
        }

        // 3. تحديد اسم الفئة بناءً على المقارنة
        // إذا كان الدخل أقل من أو يساوي الحد الأقصى -> درجة أولى
        // إذا كان الدخل أكبر من الحد الأقصى -> درجة ثانية
        $targetCategoryName = ($totalIncome <= $threshold) ? 'درجة أولى' : 'درجة ثانية';

        // 4. البحث عن الفئة في قاعدة البيانات وإرجاع الـ UUID الخاص بها
        $category = Category::where('name', $targetCategoryName)->first();

        // إذا لم نجد الفئة (لأي سبب)، نعيد الفئة الافتراضية الأولى
        return $category ? $category->id : Category::first()->id;
    }
}