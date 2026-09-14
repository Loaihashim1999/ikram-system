<?php

use Illuminate\Support\Facades\Route;

Route::get('/reset-password/{token}', function () {
    return view('app');
})->name('password.reset');

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
