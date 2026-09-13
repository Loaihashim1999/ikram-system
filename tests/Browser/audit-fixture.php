<?php
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('testing') || config('database.default') !== 'sqlite' || !str_contains(config('database.connections.sqlite.database'), 'qa-isolated-')) exit(2);
Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
foreach ($credentials as $role => $data) {
 $account = App\Models\User::create(['username'=>$data['username'],'password'=>$data['password'],'role'=>$role,'full_name'=>'TEST_ACCOUNT_'.$role,'is_active'=>true]);
 if ($role === 'admin') $admin = $account;
}
$category = App\Models\Category::create(['name'=>'درجة أولى']);
for ($i=1;$i<=50;$i++) {
 App\Models\Beneficiary::create(['full_name'=>sprintf('TEST_BENEFICIARY_%03d',$i),'national_id'=>'9'.str_pad($i,9,'0',STR_PAD_LEFT),'phone'=>'0500000000','category_id'=>$category->id,'district'=>'TEST_DISTRICT_'.($i%5),'city'=>'مكة المكرمة','status'=>'active','family_members_count'=>1+$i%6,'monthly_salary'=>1500+$i*20]);
 App\Models\Staff::create(['name'=>sprintf('TEST_EMPLOYEE_%03d',$i),'national_id'=>'8'.str_pad($i,9,'0',STR_PAD_LEFT),'phone'=>'0500000000','job_title'=>'TEST_JOB','hire_date'=>now()->toDateString(),'status'=>'active']);
 App\Models\Organization::create(['name'=>sprintf('TEST_ORGANIZATION_%03d',$i),'code'=>'TEST_ORG_'.$i,'status'=>'active']);
}
App\Models\DailyInventoryItem::create(['name'=>'TEST_DAILY_STOCK','unit'=>'سلة','current_quantity'=>5,'min_threshold'=>10,'expiry_date'=>now()->addDays(3),'status'=>'active']);
app(App\Services\InventoryAlertService::class)->scan();
echo json_encode(['token'=>$admin->createToken('browser-audit')->plainTextToken,'user'=>$admin->only(['id','username','full_name','role'])]);
