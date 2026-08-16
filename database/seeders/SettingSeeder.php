<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        // الحد الأقصى لدخل المواطن
        Setting::set('income_threshold_citizen', 4000, 'الحد الأقصى لإجمالي الدخل للمواطن ليُصنف كدرجة أولى');
        
        // الحد الأقصى لدخل المقيم
        Setting::set('income_threshold_resident', 4000, 'الحد الأقصى للراتب الشهري للمقيم ليُصنف كدرجة أولى');
    }
}