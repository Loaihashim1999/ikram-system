<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'status' => 'online',
        'message' => 'Ikram System API Server is running',
        'version' => '1.0.0'
    ]);
});
