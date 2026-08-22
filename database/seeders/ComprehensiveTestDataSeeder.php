<?php

namespace Database\Seeders;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\RepDistribution;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ComprehensiveTestDataSeeder extends Seeder
{
    public function run(): void
    {
        // 0. Ensure Admin & Driver Users Exist
        $admin = User::firstOrCreate(
            ['username' => 'admin'],
            [
                'id' => (string) Str::uuid(),
                'password' => Hash::make('admin123'),
                'full_name' => 'مدير النظام التنفيذي',
                'phone' => '0501234567',
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        $driver = User::firstOrCreate(
            ['username' => 'driver1'],
            [
                'id' => (string) Str::uuid(),
                'password' => Hash::make('driver123'),
                'full_name' => 'سائق التوصيل الميداني - أحمد العتيبي',
                'phone' => '0559988776',
                'role' => 'driver',
                'is_active' => true,
            ]
        );

        $firstClassCat = Category::firstOrCreate(['name' => 'درجة أولى'], ['description' => 'الأشد حاجة']);
        $specialNeedsCat = Category::firstOrCreate(['name' => 'ذوو الاحتياجات الخاصة'], ['description' => 'حالات إعاقة خاصة']);

        // 1. المستفيدون وتصنيفهم وإرفاق صور الوثائق والتابعين
        $ben1 = Beneficiary::updateOrCreate(
            ['national_id' => '1088776655'],
            [
                'beneficiary_type' => 'citizen',
                'full_name' => 'محمد عبد الله الشريف',
                'phone' => '0501122334',
                'date_of_birth' => '1982-05-15',
                'place_of_birth' => 'مكة المكرمة',
                'nationality' => 'سعودي',
                'profession' => 'متسبب',
                'city' => 'مكة المكرمة',
                'district' => 'النزهة',
                'street' => 'شارع الستين',
                'category_id' => $firstClassCat->id,
                'priority' => 'first_class',
                'has_special_needs' => false,
                'is_elderly' => false,
                'family_status' => 'poor',
                'family_members_count' => 4,
                'working_members_count' => 0,
                'non_working_children_count' => 2,
                'owns_house' => false,
                'housing_type' => 'rent',
                'annual_rent_amount' => 14000,
                'monthly_salary' => 1500,
                'social_security_amount' => 1100,
                'citizen_account_amount' => 720,
                'total_income' => 3320,
                'national_id_image_url' => 'https://ikram-system.pages.dev/assets/index-CgPc8WkY.css',
                'rental_contract_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'citizen_account_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'created_by' => $admin->id,
            ]
        );

        // تابعين المستفيد الأول
        Dependent::updateOrCreate(
            ['beneficiary_id' => $ben1->id, 'name' => 'سارة أحمد الشريف'],
            ['relationship' => 'زوجة', 'date_of_birth' => '1986-08-20']
        );
        Dependent::updateOrCreate(
            ['beneficiary_id' => $ben1->id, 'name' => 'عبد الله محمد الشريف'],
            ['relationship' => 'ابن', 'date_of_birth' => '2012-03-10']
        );
        Dependent::updateOrCreate(
            ['beneficiary_id' => $ben1->id, 'name' => 'مريم محمد الشريف'],
            ['relationship' => 'ابنة', 'date_of_birth' => '2016-11-05']
        );

        $ben2 = Beneficiary::updateOrCreate(
            ['national_id' => '1099887766'],
            [
                'beneficiary_type' => 'citizen',
                'full_name' => 'فاطمة أحمد هوساوي',
                'phone' => '0544332211',
                'date_of_birth' => '1975-09-12',
                'place_of_birth' => 'جدة',
                'nationality' => 'سعودية',
                'profession' => 'ربّة منزل',
                'city' => 'مكة المكرمة',
                'district' => 'الشوقية',
                'street' => 'حي المطور',
                'category_id' => $specialNeedsCat->id,
                'priority' => 'special_needs',
                'has_special_needs' => true,
                'is_special_needs' => true,
                'family_status' => 'widow_with_orphans',
                'family_members_count' => 3,
                'monthly_salary' => 0,
                'social_security_amount' => 1800,
                'total_income' => 1800,
                'national_id_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'social_security_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'created_by' => $admin->id,
            ]
        );

        Dependent::updateOrCreate(
            ['beneficiary_id' => $ben2->id, 'name' => 'خالد عمر هوساوي'],
            ['relationship' => 'ابن (ذوي إعاقة)', 'date_of_birth' => '2008-01-14']
        );

        $ben3 = Beneficiary::updateOrCreate(
            ['national_id' => '2244668800'],
            [
                'beneficiary_type' => 'resident',
                'full_name' => 'عمر عبد الله الخالد',
                'phone' => '0566778899',
                'date_of_birth' => '1989-02-28',
                'nationality' => 'مقيم',
                'city' => 'مكة المكرمة',
                'district' => 'الشرائع',
                'category_id' => $firstClassCat->id,
                'priority' => 'second_class',
                'family_status' => 'poor',
                'family_members_count' => 5,
                'monthly_salary' => 3500,
                'total_income' => 3500,
                'residence_id_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'created_by' => $admin->id,
            ]
        );

        // 2. إدخال بيانات مناديب الأحياء ووثائقهم ومرافقيهم
        $rep1 = NeighborhoodRep::updateOrCreate(
            ['national_id' => '1033221100'],
            [
                'full_name' => 'سعود بن فيصل العتيبي',
                'phone' => '0505544332',
                'date_of_birth' => '1980-04-12',
                'district_name' => 'حي النزهة والستين',
                'city' => 'مكة المكرمة',
                'status' => 'approved',
                'national_address' => 'مكة المكرمة - حي النزهة - مبنى 402',
                'id_document_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'support_letter_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'national_address_doc_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'dependents_ids_zip_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'beneficiaries_count' => 125,
            ]
        );

        $rep2 = NeighborhoodRep::updateOrCreate(
            ['national_id' => '1044556677'],
            [
                'full_name' => 'خالد بن فهد الزهراني',
                'phone' => '0554433221',
                'date_of_birth' => '1985-07-22',
                'district_name' => 'حي الشوقية والكعكية',
                'city' => 'مكة المكرمة',
                'status' => 'approved',
                'id_document_image_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'support_letter_url' => 'https://ikram-system.pages.dev/favicon.svg',
                'beneficiaries_count' => 84,
            ]
        );

        // 3. إضافة السلال والمواد بالمستودع
        $basket1 = Basket::updateOrCreate(
            ['id' => 'b1111111-1111-1111-1111-111111111111'],
            [
                'name' => 'سلة الخير البركة الشاملة',
                'description' => 'أرز 10كجم، زيت 3لتر، سكر 5كجم، طحين، حليب، معجون طماطم',
                'stock_quantity' => 150,
                'low_stock_threshold' => 20,
            ]
        );

        $basket2 = Basket::updateOrCreate(
            ['id' => 'b2222222-2222-2222-2222-222222222222'],
            [
                'name' => 'سلة ذوي الاحتياجات الخاصة والطفل',
                'description' => 'سلة مخصصة لاحتياجات الإعاقة والأطفال والمكملات الغذائية',
                'stock_quantity' => 85,
                'low_stock_threshold' => 15,
            ]
        );

        InventoryItem::updateOrCreate(
            ['name' => 'أرز بسمتي فاخر (10 كجم)'],
            ['unit' => 'كيس', 'current_quantity' => 1200, 'min_threshold' => 100, 'description' => 'مخزون الأرز الرئيسي']
        );
        InventoryItem::updateOrCreate(
            ['name' => 'زيت طعام (3 لتر)'],
            ['unit' => 'عبوة', 'current_quantity' => 850, 'min_threshold' => 80, 'description' => 'مخزون الزيت النباتي']
        );
        InventoryItem::updateOrCreate(
            ['name' => 'تمر سكري فاخر'],
            ['unit' => 'كرتون', 'current_quantity' => 500, 'min_threshold' => 50, 'description' => 'مخزون تمور مكة']
        );

        // 4. عمل تست للتوصيل مع الاستلام المباشر للمستفيد
        $dist1 = Distribution::updateOrCreate(
            ['barcode_code' => 'DEL-998822'],
            [
                'beneficiary_id' => $ben2->id, // فاطمة هوساوي (ذوي الاحتياجات)
                'basket_id' => $basket2->id,
                'assigned_by' => $admin->id,
                'driver_id' => $driver->id,
                'scheduled_at' => now()->subHours(5),
                'pickup_location' => 'مستودع الكعكية الرئيسي',
                'status' => 'delivered',
                'sms_status' => 'sent',
                'delivered_at' => now()->subHours(2),
            ]
        );

        $dist2 = Distribution::updateOrCreate(
            ['barcode_code' => 'DEL-776655'],
            [
                'beneficiary_id' => $ben1->id, // محمد الشريف (درجة أولى)
                'basket_id' => $basket1->id,
                'assigned_by' => $admin->id,
                'driver_id' => $driver->id,
                'scheduled_at' => now()->addHours(3),
                'pickup_location' => 'مستودع الكعكية الرئيسي',
                'status' => 'scheduled',
                'sms_status' => 'pending',
            ]
        );

        // 5. عمل تست لإرسال الدعم والاستلام لمناديب الأحياء
        RepDistribution::updateOrCreate(
            ['barcode_code' => 'REP-SUP-5500'],
            [
                'rep_id' => $rep1->id,
                'basket_id' => $basket1->id,
                'driver_id' => $driver->id,
                'basket_count' => 50,
                'target_beneficiaries_count' => 50,
                'scheduled_at' => now()->subDays(1),
                'status' => 'distributed',
                'picked_up_at' => now()->subDays(1)->addHours(4),
                'is_documented' => true,
            ]
        );

        RepDistribution::updateOrCreate(
            ['barcode_code' => 'REP-SUP-3300'],
            [
                'rep_id' => $rep2->id,
                'basket_id' => $basket1->id,
                'driver_id' => $driver->id,
                'basket_count' => 30,
                'target_beneficiaries_count' => 30,
                'scheduled_at' => now(),
                'status' => 'picked_up',
                'picked_up_at' => now()->subMinutes(30),
                'is_documented' => false,
            ]
        );
    }
}
