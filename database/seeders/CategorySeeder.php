<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'درجة أولى', 'description' => 'الفئة الأولى من المستفيدين (الدخل المالي منخفض)', 'basket_entitlement_per_period' => 1],
            ['name' => 'درجة ثانية', 'description' => 'الفئة الثانية من المستفيدين (الدخل المالي متوسط)', 'basket_entitlement_per_period' => 1],
            ['name' => 'ذوي الاحتياجات الخاصة', 'description' => 'مستفيدون من ذوي الإعاقة/الاحتياجات الخاصة', 'basket_entitlement_per_period' => 1],
            ['name' => 'كبار السن', 'description' => 'مستفيدون كبار السن (60 سنة فأكثر)', 'basket_entitlement_per_period' => 1],
            ['name' => 'عامل بالجمعية', 'description' => 'موظفو الجمعية', 'basket_entitlement_per_period' => 1],
        ];

        foreach ($categories as $category) {
            $existing = DB::table('categories')->where('name', $category['name'])->first();
            if ($existing) {
                DB::table('categories')->where('id', $existing->id)->update([
                    'description' => $category['description'],
                    'basket_entitlement_per_period' => $category['basket_entitlement_per_period'],
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('categories')->insert([
                    'id' => Str::uuid(),
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'basket_entitlement_per_period' => $category['basket_entitlement_per_period'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}