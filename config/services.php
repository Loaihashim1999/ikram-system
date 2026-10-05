<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'communications' => [
        // Safe default. Real traffic requires explicit `taqnyat` selection.
        'provider' => env('COMMUNICATION_PROVIDER', 'fake'),
    ],

    'taqnyat' => [
        'api_base_url' => env('TAQNYAT_API_BASE_URL', 'https://api.taqnyat.sa/'),
        'connect_timeout' => (int) env('TAQNYAT_CONNECT_TIMEOUT', 5),
        'timeout' => (int) env('TAQNYAT_TIMEOUT', 10),
        'sms' => [
            'token' => env('TAQNYAT_SMS_TOKEN'),
            'sender' => env('TAQNYAT_SMS_SENDER'),
        ],
        'email' => [
            'token' => env('TAQNYAT_EMAIL_TOKEN'),
            'from' => env('TAQNYAT_EMAIL_FROM'),
            'campaign' => env('TAQNYAT_EMAIL_CAMPAIGN', 'IKRAM account recovery'),
        ],
        'sms_webhook' => [
            // Stays off until an account-specific SMS delivery-report contract is verified.
            'enabled' => filter_var(env('TAQNYAT_SMS_WEBHOOK_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
            // Public acknowledgement phrase. It is not an authentication secret.
            'acknowledgement' => env('TAQNYAT_SMS_WEBHOOK_ACK', 'EKRAM_WEBHOOK_RECEIVED'),
            'max_body_bytes' => 8192,
        ],
    ],

];
