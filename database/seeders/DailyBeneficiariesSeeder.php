<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DailyBeneficiariesSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::first();
        $categories = Category::all();

        // 1. إنشاء أصناف مستودع المستفيدين اليوميين
        $itemsData = [
            [
                'name' => 'سلة الوجبات الساخنة اليومية',
                'unit' => 'وجبة',
                'current_quantity' => 75,
                'min_threshold' => 15,
                'category' => 'وجبات طازجة',
                'batch_number' => 'HOT-2026-09',
                'supplier' => 'مطابخ الإحسان الخيرية',
                'expiry_date' => Carbon::today()->addDays(2),
                'description' => 'وجبات غذائية ساخنة متكاملة مطبوخة يومياً',
                'status' => 'available',
            ],
            [
                'name' => 'سلة الخضار والفواكه الطازجة',
                'unit' => 'سلة',
                'current_quantity' => 45,
                'min_threshold' => 10,
                'category' => 'خضار وفواكه',
                'batch_number' => 'VEG-2026-09',
                'supplier' => 'أسواق الخضار المركزية',
                'expiry_date' => Carbon::today()->addDays(4),
                'description' => 'سلة تحتوي على تشكيلة خضار وفواكه طازجة',
                'status' => 'available',
            ],
            [
                'name' => 'طرد المواد التموينية الجافة',
                'unit' => 'طرد',
                'current_quantity' => 120,
                'min_threshold' => 20,
                'category' => 'مواد جافة',
                'batch_number' => 'DRY-2026-08',
                'supplier' => 'شركة التموين الموحد',
                'expiry_date' => Carbon::today()->addMonths(6),
                'description' => 'أرز، سكر، زيت، دقيق، مكرونة وحليب مجفف',
                'status' => 'available',
            ],
            [
                'name' => 'طرد التمور والمشروبات العاجل',
                'unit' => 'كرتون',
                'current_quantity' => 8, // Near low stock threshold
                'min_threshold' => 10,
                'category' => 'تمور ومشروبات',
                'batch_number' => 'DAT-2026-07',
                'supplier' => 'مزارع النخيل المباركة',
                'expiry_date' => Carbon::today()->addMonths(3),
                'description' => 'تمور فاخرة وعصائر ومياه شرب',
                'status' => 'available',
            ],
        ];

        $createdItems = [];
        foreach ($itemsData as $data) {
            $item = DailyInventoryItem::create($data);
            $createdItems[] = $item;

            // Log initial stock in movement
            DailyInventoryMovement::create([
                'daily_inventory_item_id' => $item->id,
                'type' => 'in',
                'quantity' => $item->current_quantity + 25, // initial intake was higher
                'reason' => 'رصيد افتتاحي وتوريد مستودع المستفيدين اليوميين',
                'user_id' => $user?->id,
            ]);
        }

        // 2. إنشاء مستفيدين يوميين واقعيين
        $dailyBeneficiariesData = [
            [
                'full_name' => 'إبراهيم سليمان المنصور',
                'national_id' => '1088443321',
                'phone' => '0551234567',
                'date_of_birth' => '1975-04-12',
                'district' => 'حي الصفا',
                'status' => 'active',
                'notes' => 'حالة عاجلة - يحتاج دعم غذائي يومي',
            ],
            [
                'full_name' => 'سارة بنت عبد الله السالم',
                'national_id' => '1099887766',
                'phone' => '0562345678',
                'date_of_birth' => '1982-11-20',
                'district' => 'حي الروضة',
                'status' => 'active',
                'notes' => 'أسرة متعففة بدون عائل',
            ],
            [
                'full_name' => 'محمد طارق العتيبي',
                'national_id' => '1022334455',
                'phone' => '0543456789',
                'date_of_birth' => '1990-06-15',
                'district' => 'حي العزيزية',
                'status' => 'active',
                'notes' => 'مريض عاجز عن العمل ولديه 4 أبناء',
            ],
            [
                'full_name' => 'فاطمة محمد الزهراني',
                'national_id' => '1033445566',
                'phone' => '0534567890',
                'date_of_birth' => '1968-08-30',
                'district' => 'حي النعيم',
                'status' => 'active',
                'notes' => 'أرملة وكبيرة سن',
            ],
            [
                'full_name' => 'عمر خالد الدوسري',
                'national_id' => '1044556677',
                'phone' => '0505678901',
                'date_of_birth' => '1985-02-18',
                'district' => 'حي الشاطئ',
                'status' => 'active',
                'notes' => 'مسرح من العمل مؤقتاً',
            ],
            [
                'full_name' => 'نورة عبد العزيز الحارثي',
                'national_id' => '1055667788',
                'phone' => '0556789012',
                'date_of_birth' => '1993-09-05',
                'district' => 'حي الجامعة',
                'status' => 'active',
                'notes' => 'مطلقة تعول أطفالاً صغاراً',
            ],
            [
                'full_name' => 'سلطان فهد القحطاني',
                'national_id' => '1066778899',
                'phone' => '0567890123',
                'date_of_birth' => '1979-12-10',
                'district' => 'حي الصفا',
                'status' => 'active',
                'notes' => 'ذوي احتياجات خاصة',
            ],
            [
                'full_name' => 'مريم يوسف الغامدي',
                'national_id' => '1077889900',
                'phone' => '0548901234',
                'date_of_birth' => '1988-03-25',
                'district' => 'حي الروضة',
                'status' => 'active',
                'notes' => 'حالة طارئة مسجلة هذا الأسبوع',
            ],
            [
                'full_name' => 'علي حسن البارقي',
                'national_id' => '1011223344',
                'phone' => '0539012345',
                'date_of_birth' => '1972-07-07',
                'district' => 'حي العزيزية',
                'status' => 'inactive',
                'notes' => 'تم تحسين وضعه المالي ونقل الدعم لغيره',
            ],
            [
                'full_name' => 'أمينة صالح الشهري',
                'national_id' => '1088990011',
                'phone' => '0500123456',
                'date_of_birth' => '1980-05-14',
                'district' => 'حي النعيم',
                'status' => 'active',
                'notes' => 'تستلم وجبات ساخنة بصورة متكررة',
            ],
        ];

        $docTypes = ['national_id', 'medical_report', 'housing_proof'];
        $docTitles = ['صورة الهوية الوطنية', 'تقرير طبي معتمد', 'عقد إيجار وإثبات سكن'];

        $createdBeneficiaries = [];
        foreach ($dailyBeneficiariesData as $i => $data) {
            $cat = $categories->isNotEmpty() ? $categories[$i % $categories->count()] : null;
            $data['category_id'] = $cat?->id;
            $data['category_name'] = $cat?->name ?? 'أسر متعففة';
            $data['created_by'] = $user?->id;
            $data['created_at'] = Carbon::now()->subDays(rand(5, 30));

            $beneficiary = DailyBeneficiary::create($data);
            $createdBeneficiaries[] = $beneficiary;

            // Create 1-2 sample documents
            $docType = $docTypes[$i % count($docTypes)];
            $docTitle = $docTitles[$i % count($docTitles)];
            $beneficiary->documents()->create([
                'document_type' => $docType,
                'file_name' => "{$docTitle}.pdf",
                'file_path' => "documents/daily/{$beneficiary->id}/sample.pdf",
                'file_url' => "/storage/documents/sample.pdf",
                'file_type' => 'application/pdf',
                'file_size' => rand(250000, 1500000),
                'uploaded_by' => $user?->id,
            ]);
        }

        // 3. إنشاء عمليات استلام تاريخية وحديثة
        $txCount = 1;
        $items = $createdItems;

        foreach ($createdBeneficiaries as $idx => $ben) {
            if ($ben->status === 'inactive') {
                continue;
            }

            // Distribute 1 to 4 past transactions across different dates
            $numTransactions = ($idx % 3) + 1;
            $lastDate = null;

            for ($t = 0; $t < $numTransactions; $t++) {
                $daysAgo = ($numTransactions - $t - 1) * 2; // e.g. 4 days ago, 2 days ago, today
                $txDate = Carbon::now()->subDays($daysAgo)->subHours(rand(1, 6));
                $selectedItem = $items[$t % count($items)];
                $qty = 1;

                $docNum = sprintf('DRV-%s-%04d', $txDate->format('Ymd'), $txCount++);

                $tx = DailyReceivingTransaction::create([
                    'document_number' => $docNum,
                    'daily_beneficiary_id' => $ben->id,
                    'daily_inventory_item_id' => $selectedItem->id,
                    'basket_type_name' => $selectedItem->name,
                    'quantity' => $qty,
                    'status' => 'received',
                    'receiving_date' => $txDate,
                    'authorized_user_id' => $user?->id,
                    'notes' => 'تم التسليم للمستفيد يداً بيد بمقر الجمعية',
                    'created_at' => $txDate,
                    'updated_at' => $txDate,
                ]);

                // Record movement
                DailyInventoryMovement::create([
                    'daily_inventory_item_id' => $selectedItem->id,
                    'type' => 'out',
                    'quantity' => $qty,
                    'reason' => "تسليم مساعدة يومية رقم ({$docNum}) للمستفيد {$ben->full_name}",
                    'notes' => 'صرف بموجب سند الاستلام المعتمد',
                    'user_id' => $user?->id,
                    'related_receiving_id' => $tx->id,
                    'created_at' => $txDate,
                    'updated_at' => $txDate,
                ]);

                $lastDate = $txDate;
            }

            $ben->update([
                'total_received_count' => $numTransactions,
                'last_delivery_date' => $lastDate,
            ]);
        }
    }
}
