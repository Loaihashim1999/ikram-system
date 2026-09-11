<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Beneficiaries\BeneficiaryController;
use App\Http\Controllers\Beneficiaries\CategoryController;
use App\Http\Controllers\DailyBeneficiaryController;
use App\Http\Controllers\DailyInventoryController;
use App\Http\Controllers\DailyReceivingController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\NeighborhoodRepController;
use App\Http\Controllers\PdfExportController;
use App\Http\Controllers\ReceiverController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// ─── المصادقة والتنزيلات العامة ──────────────────────────────────────────
Route::get('/', function () {
    return response()->json([
        'status' => 'online',
        'message' => 'Ikram System API Server is running',
        'version' => '1.0.0'
    ]);
});
Route::post('/login', [LoginController::class, 'login'])->name('login');

Route::get('/fix-admin', function () {
    $user = \App\Models\User::where('username', 'admin')->first();
    if (! $user) {
        $user = new \App\Models\User();
        $user->id = (string) \Illuminate\Support\Str::uuid();
        $user->username = 'admin';
        $user->full_name = 'مدير النظام';
        $user->phone = '0501234567';
        $user->role = 'admin';
    }
    $user->password = \Illuminate\Support\Facades\Hash::make('admin123');
    $user->is_active = true;
    $user->save();

    return response()->json([
        'success' => true,
        'message' => 'Admin user reset to admin / admin123 successfully',
        'user' => [
            'id' => $user->id,
            'username' => $user->username,
            'is_active' => $user->is_active,
            'role' => $user->role,
        ],
        'db_host' => config('database.connections.pgsql.host'),
        'db_database' => config('database.connections.pgsql.database'),
    ]);
});

Route::get('/seed-test-data', function () {
    try {
        \Illuminate\Support\Facades\Artisan::call('db:seed', [
            '--class' => 'ComprehensiveTestDataSeeder',
            '--force' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Comprehensive test data seeded successfully!',
            'output' => \Illuminate\Support\Facades\Artisan::output(),
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'success' => false,
            'error' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ], 500);
    }
});

// تصدير PDF العام وتنزيل الشيتات
Route::get('/documents/individual-receipt/{id}/pdf', [PdfExportController::class, 'exportIndividualReceipt']);
Route::get('/documents/receipt/{id}/pdf', [PdfExportController::class, 'exportIndividualReceipt']);
Route::get('/documents/total-delivery/{id}/pdf', [PdfExportController::class, 'exportTotalDelivery']);
Route::get('/documents/rep-receipt/{id}/pdf', [PdfExportController::class, 'exportRepresentativeReceipt']);
Route::get('/documents/staff-receipt/{id}/pdf', [PdfExportController::class, 'exportStaffReceipt']);
Route::get('/documents/daily-receiving/{id}/pdf', [PdfExportController::class, 'exportDailyReceivingVoucher']);
Route::get('/reports/daily/pdf', [PdfExportController::class, 'exportDailyReport']);
Route::get('/reports/comprehensive/pdf', [PdfExportController::class, 'exportWeeklyComprehensiveReport']);
Route::get('/neighborhood-reps/{id}/export-excel', [NeighborhoodRepController::class, 'exportLinkedBeneficiariesExcel']);

// ─── المسارات المحمية ──────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // المصادقة
    Route::get('/me', [LoginController::class, 'me']);
    Route::post('/logout', [LogoutController::class, 'logout']);

    // ── إشعارات المستفيدين ──────────────────────────────────────────────────────
    Route::get('/notifications', [App\Http\Controllers\NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [App\Http\Controllers\NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/mark-as-read', [App\Http\Controllers\NotificationController::class, 'markAsRead']);
    Route::post('/notifications/mark-all-read', [App\Http\Controllers\NotificationController::class, 'markAllRead']);

    // ── المستفيدون ──────────────────────────────────────────────────────────
    Route::get('/beneficiaries/check-national-id/{nationalId}',
        [BeneficiaryController::class, 'checkNationalId']);
    Route::post('/beneficiaries/extract-ocr-data',
        [BeneficiaryController::class, 'extractOcrData']);
    Route::post('/beneficiaries/import',
        [BeneficiaryController::class, 'importExcel']);

    Route::post('/beneficiaries/{beneficiary}', [BeneficiaryController::class, 'update']);
    Route::apiResource('beneficiaries', BeneficiaryController::class);

    // تابعون (معالون) للمستفيد
    Route::post('/beneficiaries/{beneficiary}/dependents',
        [BeneficiaryController::class, 'storeDependent']);
    Route::delete('/beneficiaries/{beneficiary}/dependents/{dependent}',
        [BeneficiaryController::class, 'destroyDependent']);

    // ── الفئات ──────────────────────────────────────────────────────────────
    Route::apiResource('categories', CategoryController::class);

    // ── التوزيع / الدعم ──────────────────────────────────────────────────────
    Route::get('/distributions', [DistributionController::class, 'index']);
    Route::post('/distributions', [DistributionController::class, 'store']);
    Route::put('/distributions/{id}/received', [DistributionController::class, 'markReceived']);
    Route::post('/distributions/{id}/whatsapp', [DistributionController::class, 'sendWhatsapp']);
    Route::get('/distributions/{id}', [DistributionController::class, 'show']);

    // ── الموظفون ─────────────────────────────────────────────────────────────
    Route::post('/staff/import', [StaffController::class, 'importExcel']);
    Route::apiResource('staff', StaffController::class);

    // تابعون للموظف
    Route::post('/staff/{staff}/dependents', [StaffController::class, 'storeDependent']);
    Route::delete('/staff/{staff}/dependents/{dependent}', [StaffController::class, 'destroyDependent']);

    // ── مناديب الأحياء بالسائقين والمناديب ────────────────────────────────────
    Route::get('/representatives', [NeighborhoodRepController::class, 'index']);
    Route::get('/drivers', [UserController::class, 'drivers']);
    Route::apiResource('neighborhood-reps', NeighborhoodRepController::class);
    Route::post('/neighborhood-reps/{id}', [NeighborhoodRepController::class, 'update']);
    Route::post('/neighborhood-reps/{id}/dispatch', [NeighborhoodRepController::class, 'dispatchSupport']);
    Route::get('/neighborhood-reps/{id}/export-excel', [NeighborhoodRepController::class, 'exportLinkedBeneficiariesExcel']);
    Route::put('/neighborhood-reps/{id}/status', [NeighborhoodRepController::class, 'toggleStatus']);

    // ── صفحة الاستلام (Receiver Page & Scanner) ────────────────────────────────
    Route::get('/receiver/scan/{code}', [ReceiverController::class, 'scan']);
    Route::post('/receiver/confirm/{code}', [ReceiverController::class, 'confirm']);

    // ── التدقيق ──────────────────────────────────────────────────────────────
    Route::get('/audit', [AuditController::class, 'index']);

    // ── المستودع ─────────────────────────────────────────────────────────────
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/inventory', [InventoryController::class, 'store']);
    Route::put('/inventory/{id}', [InventoryController::class, 'update']);
    Route::delete('/inventory/{id}', [InventoryController::class, 'destroy']);
    Route::post('/inventory/{id}/adjust', [InventoryController::class, 'adjustStock']);

    // ── إدارة المستخدمين ─────────────────────────────────────────
    Route::post('/users/{id}/toggle-notifications', [UserController::class, 'toggleNotifications']);
    Route::apiResource('users', UserController::class);

    // ── إعدادات النظام ─────────────────────────────────────────
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::post('/settings', [SettingsController::class, 'update']);

    // ── المستفيدون اليوميون ─────────────────────────────────────────
    Route::get('/daily-beneficiaries/check-national-id/{nationalId}', [DailyBeneficiaryController::class, 'checkNationalId']);
    Route::get('/daily-beneficiaries/{id}/receiving-history', [DailyBeneficiaryController::class, 'receivingHistory']);
    Route::post('/daily-beneficiaries/{id}/documents', [DailyBeneficiaryController::class, 'uploadDocument']);
    Route::delete('/daily-beneficiaries/documents/{docId}', [DailyBeneficiaryController::class, 'deleteDocument']);
    Route::apiResource('daily-beneficiaries', DailyBeneficiaryController::class);

    // ── مستودع المستفيدين اليوميين ─────────────────────────────────
    Route::get('/daily-inventory/movements', [DailyInventoryController::class, 'movements']);
    Route::post('/daily-inventory/{id}/adjust', [DailyInventoryController::class, 'adjustStock']);
    Route::apiResource('daily-inventory', DailyInventoryController::class);

    // ── تسليم واستلام المستفيدين اليوميين ──────────────────────────
    Route::apiResource('daily-receiving', DailyReceivingController::class)->only(['index', 'store', 'show']);

    // ── الحوكمة والتحليلات الشاملة ─────────────────────────────────
    Route::get('/analytics', [AnalyticsController::class, 'index']);
    Route::get('/governance/analytics', [AnalyticsController::class, 'index']);
});
