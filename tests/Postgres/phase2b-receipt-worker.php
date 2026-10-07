<?php

use App\Services\Delivery\ReceiptVerificationService;
use Illuminate\Support\Facades\DB;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    DB::statement("SET application_name = 'phase2b_receipt_worker'");
    $result = app(ReceiptVerificationService::class)->verify($input['id'], $input['code'], $input['actor']);
    echo 'RESULT='.$result['status'].PHP_EOL;
    echo 'REPLAY='.(int) ($result['already_completed'] ?? false).PHP_EOL;
} catch (Throwable) {
    fwrite(STDERR, "QA worker failed; sensitive exception details withheld.\n");
    exit(1);
}
