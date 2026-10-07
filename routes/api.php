<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\Auth\FirstAdminSetupController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\PasswordRecoveryController;
use App\Http\Controllers\Beneficiaries\BeneficiaryController;
use App\Http\Controllers\Beneficiaries\CategoryController;
use App\Http\Controllers\BeneficiaryPolicy\BeneficiaryPolicyController;
use App\Http\Controllers\BeneficiaryPolicy\PolicyApplicationRunController;
use App\Http\Controllers\BeneficiaryPolicy\PolicyReviewController;
use App\Http\Controllers\DailyBeneficiaryController;
use App\Http\Controllers\DailyInventoryController;
use App\Http\Controllers\DailyReceivingController;
use App\Http\Controllers\DeliveryCommunicationController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\GovernanceReportController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\NeighborhoodRepController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PdfExportController;
use App\Http\Controllers\PickupLocationController;
use App\Http\Controllers\PrivateDocumentController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SmartImportController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\SupportDistributionController;
use App\Http\Controllers\TaqnyatSmsWebhookController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\ModulePermission;
use Illuminate\Support\Facades\Route;

// ─── المصادقة والتنزيلات العامة ──────────────────────────────────────────
Route::get('/', function () {
    return response()->json([
        'status' => 'online',
        'message' => 'Ikram System API Server is running',
        'version' => '1.0.0',
    ]);
});
Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:6,1')->name('login');
Route::get('/setup-admin/status', [FirstAdminSetupController::class, 'status'])->middleware('throttle:30,1');
Route::post('/setup-admin', [FirstAdminSetupController::class, 'store'])->middleware('throttle:5,1');
Route::post('/forgot-password', [PasswordRecoveryController::class, 'forgot'])->middleware('throttle:password-recovery-request');
Route::post('/forgot-password/verify', [PasswordRecoveryController::class, 'verifyOtp'])->middleware('throttle:password-recovery-verify');
Route::post('/reset-password', [PasswordRecoveryController::class, 'reset'])->middleware('throttle:password-recovery-reset');

Route::post('/webhooks/taqnyat/sms', [TaqnyatSmsWebhookController::class, 'sms'])
    ->middleware('throttle:30,1')
    ->name('webhooks.taqnyat.sms');

Route::get('/driver-access', [DeliveryCommunicationController::class, 'driver'])->middleware('throttle:60,1');
Route::get('/driver-access/tasks/{id}', [DeliveryCommunicationController::class, 'driver'])->middleware('throttle:60,1');
Route::post('/driver-access/tasks/{id}/confirm', [DeliveryCommunicationController::class, 'driver'])->middleware('throttle:20,1');

// ─── المسارات المحمية ──────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', ModulePermission::class])->group(function () {
    Route::post('/change-password', [PasswordRecoveryController::class, 'change']);
    Route::match(['get', 'put'], '/settings/communications', [DeliveryCommunicationController::class, 'settings']);
    Route::post('/settings/communications/preview', [DeliveryCommunicationController::class, 'preview']);
    Route::get('/settings/communications/messages', [DeliveryCommunicationController::class, 'messages']);
    Route::post('/settings/communications/messages/{id}/retry', [DeliveryCommunicationController::class, 'retry']);
    Route::post('/support/distributions/{id}/receipt-code', [DeliveryCommunicationController::class, 'issue']);
    Route::post('/support/distributions/{id}/verify', [DeliveryCommunicationController::class, 'verify']);
    Route::post('/support/distributions/{id}/verify-preview', [DeliveryCommunicationController::class, 'previewReceipt'])->middleware('throttle:20,1');
    Route::get('/support/distributions/{id}/proof', [PdfExportController::class, 'exportSupportProof']);
    Route::match(['get', 'post'], '/support/drivers', [DeliveryCommunicationController::class, 'drivers']);
    Route::patch('/support/drivers/{id}', [DeliveryCommunicationController::class, 'updateDriver']);
    Route::match(['get', 'post'], '/support/assignments', [DeliveryCommunicationController::class, 'assignments']);
    Route::post('/support/assignments/reassign', [DeliveryCommunicationController::class, 'reassign']);
    Route::post('/support/assignments/{id}/revoke', [DeliveryCommunicationController::class, 'revoke']);
    Route::post('/support/assignments/{id}/resend', [DeliveryCommunicationController::class, 'resend']);
    Route::post('/support/assignments/{id}/send', [DeliveryCommunicationController::class, 'send']);
    Route::get('/support/assignments/{id}/link', [DeliveryCommunicationController::class, 'link']);
    Route::get('/support/history', [SupportDistributionController::class, 'history']);
    Route::get('/support/distributions', [SupportDistributionController::class, 'index']);
    Route::post('/support/distributions', [SupportDistributionController::class, 'store']);
    Route::get('/support/distributions/{id}', [SupportDistributionController::class, 'show']);
    Route::patch('/support/distributions/{id}', [SupportDistributionController::class, 'update']);
    Route::patch('/support/distributions/{id}/{action}', [SupportDistributionController::class, 'transition'])
        ->whereIn('action', ['approve', 'reserve', 'ready', 'dispatch', 'complete', 'cancel']);
    Route::get('/support/pickup-locations', [PickupLocationController::class, 'index']);
    Route::post('/support/pickup-locations', [PickupLocationController::class, 'store']);
    Route::patch('/support/pickup-locations/{id}', [PickupLocationController::class, 'update']);
    Route::delete('/support/pickup-locations/{id}', [PickupLocationController::class, 'destroy']);

    // ── محرك سياسة المستفيدين — إدارة إصدارات السياسة (POLICY-A فقط) ──────────
    Route::get('/beneficiary-policy/permissions', [BeneficiaryPolicyController::class, 'permissions']);
    Route::get('/beneficiary-policy/versions', [BeneficiaryPolicyController::class, 'index']);
    Route::post('/beneficiary-policy/versions', [BeneficiaryPolicyController::class, 'store']);
    Route::get('/beneficiary-policy/versions/{id}', [BeneficiaryPolicyController::class, 'show']);
    Route::patch('/beneficiary-policy/versions/{id}', [BeneficiaryPolicyController::class, 'update']);
    Route::get('/beneficiary-policy/versions/{id}/history', [BeneficiaryPolicyController::class, 'history']);
    Route::post('/beneficiary-policy/versions/{id}/clone', [BeneficiaryPolicyController::class, 'clone']);
    Route::post('/beneficiary-policy/versions/{id}/approve', [BeneficiaryPolicyController::class, 'approve']);
    Route::post('/beneficiary-policy/versions/{id}/publish', [BeneficiaryPolicyController::class, 'publish']);
    Route::post('/beneficiary-policy/versions/{id}/retire', [BeneficiaryPolicyController::class, 'retire']);

    // ── POLICY-E2/E3: نطاق التطبيق — المحاكاة (قراءة فقط) والتنفيذ المُتحكَّم به ──
    Route::post('/beneficiary-policy/versions/{version}/simulate', [PolicyApplicationRunController::class, 'simulateVersion']);
    Route::get('/beneficiary-policy/versions/{version}/application-runs', [PolicyApplicationRunController::class, 'index']);
    Route::post('/beneficiary-policy/versions/{version}/application-runs', [PolicyApplicationRunController::class, 'store']);
    Route::get('/beneficiary-policy/application-runs/{run}', [PolicyApplicationRunController::class, 'show']);
    Route::get('/beneficiary-policy/application-runs/{run}/items', [PolicyApplicationRunController::class, 'items']);
    Route::post('/beneficiary-policy/application-runs/{run}/simulate', [PolicyApplicationRunController::class, 'simulate']);
    Route::post('/beneficiary-policy/application-runs/{run}/approve-application', [PolicyApplicationRunController::class, 'approveApplication']);
    Route::post('/beneficiary-policy/application-runs/{run}/execute', [PolicyApplicationRunController::class, 'execute']);
    Route::post('/beneficiary-policy/application-runs/{run}/retry', [PolicyApplicationRunController::class, 'retry']);
    Route::post('/beneficiary-policy/application-runs/{run}/cancel', [PolicyApplicationRunController::class, 'cancel']);
    Route::get('/beneficiary-policy/beneficiaries/{beneficiary}/evaluations', [PolicyReviewController::class, 'index']);
    Route::prefix('beneficiary-policy/evaluations/{evaluation}')->group(function () {
        Route::get('/review', [PolicyReviewController::class, 'show']);
        Route::post('/documents/{code}', [PolicyReviewController::class, 'document']);
        Route::post('/medical-evidence', [PolicyReviewController::class, 'medical']);
        Route::put('/social-assessment', [PolicyReviewController::class, 'draft']);
        Route::post('/social-assessment/submit', [PolicyReviewController::class, 'submit']);
        Route::post('/social-assessment/review', [PolicyReviewController::class, 'review']);
        Route::post('/approve', [PolicyReviewController::class, 'approve']);
        Route::post('/reject', [PolicyReviewController::class, 'reject']);
    });
    // POLICY-B: single-record financial eligibility evaluation (granular `evaluate` permission).
    Route::post('/beneficiary-policy/evaluate', [BeneficiaryPolicyController::class, 'evaluate']);

    // تصدير PDF العام وتنزيل الشيتات
    Route::get('/documents/beneficiary/{id}/pdf', [PdfExportController::class, 'exportBeneficiaryCard']);
    Route::get('/documents/policy-evaluation/{id}/pdf', [PdfExportController::class, 'exportPolicyEvaluation']);
    Route::get('/documents/inventory/pdf', [PdfExportController::class, 'exportInventoryReport']);
    Route::get('/documents/drivers/pdf', [PdfExportController::class, 'exportDriverReport']);
    Route::get('/documents/drivers/excel', [PdfExportController::class, 'exportDriverExcel']);
    Route::get('/documents/individual-receipt/{id}/pdf', [PdfExportController::class, 'exportIndividualReceipt']);
    Route::get('/documents/receipt/{id}/pdf', [PdfExportController::class, 'exportIndividualReceipt']);
    Route::get('/documents/total-delivery/{id}/pdf', [PdfExportController::class, 'exportTotalDelivery']);
    Route::get('/documents/rep-receipt/{id}/pdf', [PdfExportController::class, 'exportRepresentativeReceipt']);
    Route::get('/documents/staff-receipt/{id}/pdf', [PdfExportController::class, 'exportStaffReceipt']);
    Route::get('/documents/daily-receiving/{id}/pdf', [PdfExportController::class, 'exportDailyReceivingVoucher']);
    Route::get('/reports/daily/pdf', [PdfExportController::class, 'exportDailyReport']);
    Route::get('/reports/comprehensive/excel', [PdfExportController::class, 'exportComprehensiveExcel']);
    Route::get('/reports/comprehensive/pdf', [PdfExportController::class, 'exportWeeklyComprehensiveReport']);
    Route::get('/neighborhood-reps/{id}/export-excel', [NeighborhoodRepController::class, 'exportLinkedBeneficiariesExcel']);
    Route::get('/beneficiaries/{beneficiary}/documents/{field}', [PrivateDocumentController::class, 'beneficiary'])
        ->name('beneficiaries.documents.download');
    Route::get('/daily-beneficiaries/{beneficiary}/documents/{document}/download', [PrivateDocumentController::class, 'dailyBeneficiary'])
        ->name('daily-beneficiaries.documents.download');
    Route::get('/neighborhood-reps/{representative}/documents/{field}', [PrivateDocumentController::class, 'representative'])
        ->name('neighborhood-reps.documents.download');

    // المصادقة
    Route::get('/me', [LoginController::class, 'me']);
    Route::post('/logout', [LogoutController::class, 'logout']);

    // ── إشعارات المستفيدين ──────────────────────────────────────────────────────
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/delete-selected', [NotificationController::class, 'destroySelected']);
    Route::post('/notifications/delete-read', [NotificationController::class, 'destroyRead']);
    Route::post('/notifications/purge', [NotificationController::class, 'purge']);
    Route::post('/notifications/{id}/mark-as-read', [NotificationController::class, 'markAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // ── المستفيدون ──────────────────────────────────────────────────────────
    Route::get('/beneficiaries/unified/export', [BeneficiaryController::class, 'unifiedExport']);
    Route::get('/beneficiaries/unified', [BeneficiaryController::class, 'unifiedIndex']);
    Route::get('/beneficiaries/check-national-id/{nationalId}',
        [BeneficiaryController::class, 'checkNationalId']);
    Route::post('/beneficiaries/extract-ocr-data',
        [BeneficiaryController::class, 'extractOcrData']);
    Route::post('/beneficiaries/import',
        [BeneficiaryController::class, 'importExcel']);

    Route::post('/beneficiaries/{beneficiary}', [BeneficiaryController::class, 'update']);
    Route::post('/beneficiaries/{beneficiary}/restore', [BeneficiaryController::class, 'restore']);
    Route::get('/beneficiaries/{beneficiary}/support-history', [BeneficiaryController::class, 'supportHistory']);
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
    Route::get('/drivers/deliveries', fn () => response()->json(['message' => 'تم إيقاف المسار القديم؛ استخدم تسليم الدعم الموحد.'], 410));
    Route::post('/distributions', [DistributionController::class, 'store']);
    Route::put('/distributions/{id}/received', fn () => response()->json(['message' => 'تم إيقاف المسار القديم؛ استخدم تسليم الدعم الموحد.'], 410));
    Route::post('/distributions/{id}/whatsapp', fn () => response()->json(['message' => 'تم إيقاف المسار القديم؛ استخدم تسليم الدعم الموحد.'], 410));
    Route::get('/distributions/{id}', [DistributionController::class, 'show']);

    // ── الموظفون ─────────────────────────────────────────────────────────────
    Route::post('/staff/import', [StaffController::class, 'importExcel']);
    Route::apiResource('staff', StaffController::class);

    Route::post('/smart-import/{entity}/preview', [SmartImportController::class, 'preview']);
    Route::post('/smart-import/{entity}', [SmartImportController::class, 'store']);

    // تابعون للموظف
    Route::post('/staff/{staff}/dependents', [StaffController::class, 'storeDependent']);
    Route::delete('/staff/{staff}/dependents/{dependent}', [StaffController::class, 'destroyDependent']);

    // ── مناديب الأحياء بالسائقين والمناديب ────────────────────────────────────
    Route::get('/representatives', [NeighborhoodRepController::class, 'index']);
    Route::get('/drivers', [UserController::class, 'drivers']);
    Route::get('/neighborhood-reps/driver-options', [NeighborhoodRepController::class, 'driverOptions']);
    Route::apiResource('neighborhood-reps', NeighborhoodRepController::class);
    Route::post('/neighborhood-reps/{id}', [NeighborhoodRepController::class, 'update']);
    Route::post('/neighborhood-reps/{id}/dispatch', [NeighborhoodRepController::class, 'dispatchSupport']);
    Route::get('/neighborhood-reps/{id}/export-excel', [NeighborhoodRepController::class, 'exportLinkedBeneficiariesExcel']);
    Route::put('/neighborhood-reps/{id}/status', [NeighborhoodRepController::class, 'toggleStatus']);

    // ── صفحة الاستلام (Receiver Page & Scanner) ────────────────────────────────
    Route::get('/receiver/scan/{code}', fn () => response()->json(['message' => 'تم إيقاف التحقق القديم؛ استخدم رمز الاستلام المكون من أربعة أرقام.'], 410));
    Route::post('/receiver/confirm/{code}', fn () => response()->json(['message' => 'تم إيقاف التحقق القديم؛ استخدم رمز الاستلام المكون من أربعة أرقام.'], 410));

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
    Route::get('/governance/analytics', [GovernanceReportController::class, 'index']);
});
