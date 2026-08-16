<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Beneficiaries\BeneficiaryController;
use App\Http\Controllers\Beneficiaries\CategoryController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StaffController;
use Illuminate\Support\Facades\Route;

// ─── المصادقة (عامة) ───────────────────────────────────────────────────────
Route::post('/login', [LoginController::class, 'login']);

// ─── المسارات المحمية ──────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // المصادقة
    Route::get('/me',     [LoginController::class, 'me']);
    Route::post('/logout', [LogoutController::class, 'logout']);

    // ── المستفيدون ──────────────────────────────────────────────────────────
    Route::get('/beneficiaries/check-national-id/{nationalId}',
        [BeneficiaryController::class, 'checkNationalId']);
    Route::post('/beneficiaries/extract-ocr-data',
        [BeneficiaryController::class, 'extractOcrData']);
    Route::post('/beneficiaries/import',
        [BeneficiaryController::class, 'importExcel']);

    Route::apiResource('beneficiaries', BeneficiaryController::class);

    // تابعون (معالون) للمستفيد
    Route::post('/beneficiaries/{beneficiary}/dependents',
        [BeneficiaryController::class, 'storeDependent']);
    Route::delete('/beneficiaries/{beneficiary}/dependents/{dependent}',
        [BeneficiaryController::class, 'destroyDependent']);

    // ── الفئات ──────────────────────────────────────────────────────────────
    Route::apiResource('categories', CategoryController::class);

    // ── التوزيع / الدعم ──────────────────────────────────────────────────────
    Route::get('/distributions',                  [DistributionController::class, 'index']);
    Route::post('/distributions',                 [DistributionController::class, 'store']);
    Route::put('/distributions/{id}/received',    [DistributionController::class, 'markReceived']);
    Route::post('/distributions/{id}/whatsapp',   [DistributionController::class, 'sendWhatsapp']);
    Route::get('/distributions/{id}',             [DistributionController::class, 'show']);

    // ── الموظفون ─────────────────────────────────────────────────────────────
    Route::post('/staff/import', [StaffController::class, 'importExcel']);
    Route::apiResource('staff', StaffController::class);

    // تابعون للموظف
    Route::post('/staff/{staff}/dependents',               [StaffController::class, 'storeDependent']);
    Route::delete('/staff/{staff}/dependents/{dependent}', [StaffController::class, 'destroyDependent']);

    // ── المستودع ─────────────────────────────────────────────────────────────
    Route::get('/inventory',                  [InventoryController::class, 'index']);
    Route::post('/inventory',                 [InventoryController::class, 'store']);
    Route::put('/inventory/{id}',             [InventoryController::class, 'update']);
    Route::delete('/inventory/{id}',          [InventoryController::class, 'destroy']);
    Route::post('/inventory/{id}/adjust',     [InventoryController::class, 'adjustStock']);

    // ── إعدادات النظام ─────────────────────────────────────────
    Route::get('/settings',  [SettingsController::class, 'index']);
    Route::post('/settings', [SettingsController::class, 'update']);
});