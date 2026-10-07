<?php

use App\Contracts\Communications\SmsProviderInterface;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Delivery\DriverAccessService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    config(['services.communications.provider' => 'fake']);
    app()->bind(SmsProviderInterface::class, FakeSmsProvider::class);
    Queue::fake();
    $input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    DB::statement("SET application_name = 'ekram_reassign_worker'");
    DB::statement("SET lock_timeout = '20s'");
    $assignment = app(DriverAccessService::class)->reassign($input['driver_id'], [$input['task_id']], 60, $input['actor']);
    echo 'RESULT=ok'.PHP_EOL;
    echo 'ASSIGNMENT='.$assignment->id.PHP_EOL;
} catch (Throwable) {
    fwrite(STDERR, "QA reassignment worker failed; sensitive exception details withheld.\n");
    exit(1);
}
