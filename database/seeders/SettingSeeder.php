<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        // Canonical classification keys — read by FinancialCalculationService (ADR-002/ADR-003)
        Setting::set('first_class_max_income', 3000, 'الحد الأقصى لصافي الدخل الشهري للمواطن ليُصنف درجة أولى');

        Setting::set('second_class_max_income', 6000, 'الحد الأقصى لصافي الدخل الشهري للمواطن ضمن الدرجة الثانية');

        Setting::set('resident_need_threshold', 3000, 'المقيمون دائماً درجة ثانية؛ صافي الدخل الأقل من أو يساوي هذا الحد يُصنف احتياج شديد، وإلا احتياج عادي');

        // Legacy keys — consumed only by the deprecated BeneficiaryClassificationService
        Setting::set('income_threshold_citizen', 4000, 'الحد الأقصى لإجمالي الدخل للمواطن ليُصنف كدرجة أولى');

        Setting::set('income_threshold_resident', 4000, 'الحد الأقصى للراتب الشهري للمقيم ليُصنف كدرجة أولى');
    }
}
