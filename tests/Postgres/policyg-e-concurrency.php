<?php

use App\Http\Exceptions\StableCodeException;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\PolicyApplicationRun;
use App\Services\BeneficiaryPolicy\PolicyApplicationExecutionService;
use Illuminate\Support\Facades\DB;
use Tests\Support\PolicyEScenario as Scenario;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $role = $argv[1] ?? 'parent';
    $folder = dirname(__DIR__, 2).'/.tmp/policyg-e-concurrency';
    if (! is_dir($folder)) {
        mkdir($folder, 0777, true);
    }

    if ($role !== 'parent') {
        [$script, $role, $runId, $actorId, $barrier] = $argv;
        DB::select("SELECT set_config('application_name', ?, false)", ['policyg_e_'.$barrier.'_'.$role]);
        try {
            if ($role === 'A') {
                DB::beginTransaction();
                PolicyApplicationRun::whereKey($runId)->lockForUpdate()->firstOrFail();
                file_put_contents($folder.'/'.$barrier.'.locked', 'locked');
                $deadline = microtime(true) + 25;
                while (! is_file($folder.'/'.$barrier.'.release')) {
                    if (microtime(true) > $deadline) {
                        throw new RuntimeException('Barrier timeout');
                    }
                    usleep(20000);
                }
            }
            app(PolicyApplicationExecutionService::class)->execute(PolicyApplicationRun::findOrFail($runId), $actorId);
            if ($role === 'A') {
                DB::commit();
            }
            $outcome = 'executed';
        } catch (StableCodeException $e) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            $outcome = 'conflict_'.$e->stableCode;
        }
        file_put_contents($folder.'/'.$barrier.'.'.$role.'.json', json_encode(['pid' => getmypid(), 'outcome' => $outcome]));
        exit(0);
    }

    $barrier = 'race_'.bin2hex(random_bytes(5));
    $actor = Scenario::actor();
    $beneficiary = Scenario::beneficiary();
    $version = Scenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
    $run = Scenario::simulate(Scenario::run($version, [], $actor), $actor);
    $run = app(PolicyApplicationExecutionService::class)->approveApplication($run, $actor->id);
    $spawn = fn (string $worker) => proc_open(
        [PHP_BINARY, __FILE__, $worker, $run->id, $actor->id, $barrier],
        [0 => ['pipe', 'r'], 1 => ['file', $folder.'/'.$barrier.'.'.$worker.'.log', 'w'], 2 => ['file', $folder.'/'.$barrier.'.'.$worker.'.log', 'a']],
        $pipes,
    );
    $workerA = $spawn('A');
    $deadline = microtime(true) + 15;
    while (! is_file($folder.'/'.$barrier.'.locked')) {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Worker A did not lock');
        }
        usleep(20000);
    }
    $workerB = $spawn('B');
    $blocked = false;
    $deadline = microtime(true) + 15;
    while (microtime(true) < $deadline) {
        $row = DB::selectOne('SELECT wait_event_type FROM pg_stat_activity WHERE application_name = ?', ['policyg_e_'.$barrier.'_B']);
        if ($row && $row->wait_event_type === 'Lock') {
            $blocked = true;
            break;
        }
        usleep(20000);
    }
    file_put_contents($folder.'/'.$barrier.'.release', 'release');
    $exitA = proc_close($workerA);
    $exitB = proc_close($workerB);
    $a = json_decode(file_get_contents($folder.'/'.$barrier.'.A.json'), true);
    $b = json_decode(file_get_contents($folder.'/'.$barrier.'.B.json'), true);
    $run->refresh();
    $evaluations = BeneficiaryPolicyEvaluation::where('beneficiary_id', $beneficiary->id)->where('policy_version_id', $version->id)->count();
    $newEvaluations = $run->items()->whereNotNull('new_evaluation_id')->count();
    if (! $blocked || $exitA !== 0 || $exitB !== 0 || $a['pid'] === $b['pid'] || $a['outcome'] !== 'executed'
        || ! str_starts_with($b['outcome'], 'conflict_') || $evaluations !== 1 || $newEvaluations !== 1 || $run->status !== 'completed') {
        throw new RuntimeException('Concurrent POLICY-E execution assertion failed');
    }
    echo json_encode(['test' => 'policy_e_two_process_execution', 'result' => 'PASS', 'worker_a' => $a, 'worker_b' => $b,
        'postgres_lock_wait_observed' => $blocked, 'evaluations' => $evaluations, 'run_item_evaluations' => $newEvaluations], JSON_PRETTY_PRINT).PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'POLICY-E concurrency QA failed: '.get_class($e).PHP_EOL);
    exit(1);
}
