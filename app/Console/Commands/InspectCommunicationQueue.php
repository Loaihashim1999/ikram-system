<?php

namespace App\Console\Commands;

use App\Jobs\SendCommunication;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InspectCommunicationQueue extends Command
{
    protected $signature = 'communications:queue-inspect {--failed : Inspect failed jobs without printing exceptions or payloads}';

    protected $description = 'Read-only sanitized queue inventory; never deserialize or execute jobs';

    public function handle(): int
    {
        $driver = config('database.default');
        $connection = config('database.connections.'.$driver, []);
        $safe = app()->environment('testing') && $driver === 'sqlite' && ($connection['database'] ?? '') === ':memory:';
        $safe = $safe || ($driver === 'pgsql'
            && ($connection['host'] ?? '') === 'pg-ikram-prod-399c8d.postgres.database.azure.com'
            && ($connection['database'] ?? '') === 'ikram_prod' && empty($connection['url']));
        if (! $safe || config('queue.default') !== 'database') {
            $this->error('ABORT: database target or queue backend is outside the approved inventory scope.');

            return self::FAILURE;
        }

        try {
            DB::beginTransaction();
            if ($driver === 'pgsql') {
                DB::statement('SET TRANSACTION READ ONLY');
                DB::statement("SET LOCAL statement_timeout = '15s'");
            }
            $failed = (bool) $this->option('failed');
            $groups = [];
            $failures = [];
            DB::table($failed ? 'failed_jobs' : 'jobs')->orderBy('id')->chunk(100, function ($jobs) use (&$groups, &$failures, $failed) {
                foreach ($jobs as $job) {
                    $payload = json_decode($job->payload, true);
                    $type = ($payload['displayName'] ?? '') === SendCommunication::class ? 'SendCommunication' : 'UNCLASSIFIED';
                    $queue = in_array($job->queue, ['default', config('delivery.communication_queue')], true) ? $job->queue : 'OTHER';
                    $key = $queue.'|'.$type;
                    $timestamp = $failed ? strtotime($job->failed_at) : (int) $job->created_at;
                    $groups[$key] ??= ['queue' => $queue, 'type' => $type, 'count' => 0, 'oldest' => $timestamp, 'newest' => $timestamp, 'attempts_max' => 0];
                    $groups[$key]['count']++;
                    $groups[$key]['oldest'] = min($groups[$key]['oldest'], $timestamp);
                    $groups[$key]['newest'] = max($groups[$key]['newest'], $timestamp);
                    $groups[$key]['attempts_max'] = max($groups[$key]['attempts_max'], $failed ? 0 : $job->attempts);
                    if ($failed && count($failures) < 100) {
                        $reason = 'unclassified';
                        if ($type === 'SendCommunication' && preg_match('/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/', $payload['data']['command'] ?? '', $match)) {
                            $code = DB::table('communication_messages')->where('id', $match[1])->value('error_code');
                            if (in_array($code, ['send_outcome_unknown', 'worker_timeout', 'payload_expired', 'provider_rejected', 'provider_authentication', 'provider_rate_limited', 'provider_not_configured'], true)) {
                                $reason = $code;
                            }
                        }
                        $failures[] = ['uuid' => Str::isUuid($job->uuid) ? $job->uuid : 'invalid', 'queue' => $queue, 'type' => $type, 'failed_at' => $job->failed_at, 'reason' => $reason];
                    }
                }
            });
            DB::rollBack();
            $this->line(json_encode(['backend' => 'database', 'failed_backend' => config('queue.failed.driver'), 'retry_after' => config('queue.connections.database.retry_after'), 'failed' => $failed, 'groups' => array_values($groups), 'failures' => $failures], JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        } catch (\Throwable) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            $this->error('Inventory failed; exception details suppressed. No job was processed.');

            return self::FAILURE;
        }
    }
}
