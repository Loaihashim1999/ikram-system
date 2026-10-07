<?php

/**
 * FSA persistence gate (Section 5): prove data persistence across a real
 * backend server-process restart and a new login.
 *
 * Workflow per entity: CREATE (app models) -> SAVE -> READ VIA API (server A)
 * -> STOP server A -> START server B on the SAME isolated persistent QA
 * database -> LOGIN AGAIN -> REOPEN VIA API -> FINAL raw-file verification.
 *
 * This proves persistence is database-backed (the SQLite file), not React
 * state, localStorage, session storage, or temporary fixture memory.
 */

require __DIR__.'/bootstrap.php';

use Illuminate\Support\Facades\DB;

$fsaRoot = dirname(__DIR__, 2);
$evidenceDir = $fsaRoot.'/.tmp/fsa/persistence-gate';
$dbFile = $fsaRoot.'/storage/fsa/persistence-'.bin2hex(random_bytes(6)).'.sqlite';
mkdir($evidenceDir, 0755, true) || true;
mkdir(dirname($dbFile), 0755, true) || true;
file_put_contents($dbFile, '');

$env = fsaEnv([
    'DB_DATABASE' => $dbFile,
    'SESSION_DRIVER' => 'file',
    'SESSION_DRIVER_FILE_PATH' => $evidenceDir.'/sessions',
]);
foreach (['FSA_DB_FILE' => $dbFile, 'FSA_EVIDENCE' => $evidenceDir] as $k => $v) {
    $env[$k] = $v;
}
$processEnv = array_merge(getenv(), $env);

$results = [];
$mark = function (string $name, bool $condition, string $detail = '') use (&$results) {
    $results[] = ['name' => $name, 'passed' => $condition, 'detail' => $detail];
    echo ($condition ? 'PASS' : 'FAIL').' '.$name.($detail !== '' ? ' '.$detail : '').PHP_EOL;
};
function fsaPhase(string $phase): void
{
    echo '[phase] '.$phase.PHP_EOL;
    @ob_flush();
    flush();
}

function fsaHttp(string $url, string $method, ?string $body = null, ?string $token = null): array
{
    $headers = ['Content-Type: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer '.$token;
    }
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body, 'ignore_errors' => true, 'timeout' => 30]]);
    $raw = @file_get_contents($url, false, $ctx);

    return ['status' => (int) (explode(' ', ($http_response_header[0] ?? 'HTTP/1.1 000'))[1] ?? 0), 'body' => $raw === false ? null : json_decode($raw, true)];
}

function containsPairs(array $node, array $pairs, ?array &$match = null): bool
{
    foreach ($node as $key => $value) {
        if (is_array($value)) {
            $sub = [];
            if (is_string($key) && array_key_exists($key, $pairs) && (string) $value === (string) $pairs[$key]) {
                $match = $node;

                return true;
            }
            if (containsPairs($value, $pairs, $match)) {
                return true;
            }
        } elseif (is_string($key) && array_key_exists($key, $pairs) && (string) $value === (string) $pairs[$key]) {
            $match = $node;

            return true;
        }
    }

    return false;
}

function verifyEntity(array $entity, array $response): array
{
    if (isset($entity['open']['find'])) {
        $match = null;
        if (! containsPairs($response['body'] ?? [], $entity['open']['find'], $match)) {
            return [false, 'finder key not found'];
        }
        $expected = array_merge($entity['open']['find'], $entity['expect']);
        if (! containsPairs($match, $expected)) {
            return [false, 'expected values missing on found record'];
        }

        return [true, ''];
    }
    $match = null;

    return containsPairs($response['body'] ?? [], $entity['expect'], $match) ? [true, ''] : [false, 'expected pairs missing'];
}

function startServer(string $public, string $router, array $processEnv, int $port, string $log): array
{
    $proc = proc_open(['php', '-S', '127.0.0.1:'.$port, '-t', $public, $router], [1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, dirname($public, 2), $processEnv);
    $ready = false;
    for ($i = 0; $i < 75; $i++) {
        usleep(200000);
        $ctx = stream_context_create(['http' => ['timeout' => 1, 'ignore_errors' => true]]);
        $body = @file_get_contents('http://127.0.0.1:'.$port.'/up', false, $ctx);
        if ($body === '{"status":"ok"}') {
            $ready = true;
            break;
        }
    }

    return [$proc, $pipes, $ready];
}

function stopServer($proc): void
{
    if (! is_resource($proc)) {
        return;
    }
    $pid = proc_get_status($proc)['pid'] ?? null;
    proc_terminate($proc);
    for ($i = 0; $i < 25; $i++) {
        $status = proc_get_status($proc);
        if (! $status['running']) {
            break;
        }
        usleep(200000);
    }
    if (proc_get_status($proc)['running'] && $pid && PHP_OS_FAMILY === 'Windows') {
        @exec('taskkill /F /T /PID '.(int) $pid.' 2>NUL');
        usleep(300000);
    }
    @proc_close($proc);
}

try {
    // Preflight inside the resolved app.
    $safe = fsaBoot($env);
    $mark('preflight-safe-env', ($safe['DB_DRIVER'] ?? '') === 'sqlite' && ($safe['COMMUNICATION_PROVIDER'] ?? '') === 'fake' && ($safe['TELEMETRY_DISABLED'] ?? '') === 'YES');
} catch (Throwable $e) {
    $mark('preflight-safe-env', false, $e->getMessage());
}
unset($app);

// 1) Provision phase (separate process, same DB file).
$provisionOut = $evidenceDir.'/provision.out.log';
$provisionErr = $evidenceDir.'/provision.err.log';
$provision = proc_open(['php', 'tests/Fsa/persistence-provision.php'], [1 => ['file', $provisionOut, 'w'], 2 => ['file', $provisionErr, 'w']], $pipes, $fsaRoot, $processEnv);
$provisionStatus = proc_close($provision);
$provisionText = trim((is_file($provisionOut) ? file_get_contents($provisionOut) : '').(is_file($provisionErr) ? file_get_contents($provisionErr) : ''));
$mark('provision', $provisionStatus === 0 && str_contains($provisionText, 'PROVISION_OK'), trim($provisionText));
if ($provisionStatus !== 0) {
    echo "ABORT: provision failed.\n";
    exit(1);
}
$manifest = json_decode(file_get_contents($evidenceDir.'/manifest.json'), true, flags: JSON_THROW_ON_ERROR);
$entities = $manifest['entities'];
fsaPhase('provisioned');

$portProbe = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
$port = (int) parse_url(stream_socket_get_name($portProbe, false), PHP_URL_PORT);
fclose($portProbe);
$public = $fsaRoot.'/public';
$router = __DIR__.'/router.php';

// 2) Server cycle A — READ FROM API.
[$serverA, $pipesA, $readyA] = startServer($public, $router, $processEnv, $port, $evidenceDir.'/server-a.log');
$mark('server-cycle-a-started', $readyA);
$loginA = fsaHttp('http://127.0.0.1:'.$port.'/api/login', 'POST', json_encode(['username' => $manifest['username'], 'password' => $manifest['password']]));
$tokenA = $loginA['body']['data']['token'] ?? null;
$mark('cycle-a-login', $loginA['status'] === 200 && is_string($tokenA), 'status='.$loginA['status']);
$cycleA = [];
foreach ($entities as $entity) {
    $response = fsaHttp('http://127.0.0.1:'.$port.$entity['open']['endpoint'], 'GET', null, $tokenA);
    [$ok, $detail] = verifyEntity($entity, $response);
    $cycleA[$entity['name']] = ['status' => $response['status'], 'verified' => $ok, 'detail' => $detail];
}
stopServer($serverA);
$failedA = array_filter($cycleA, fn ($v) => ! $v['verified']);
$mark('after-api-reload', count($failedA) === 0, 'ok='.count($cycleA) - count($failedA).'/'.count($cycleA));
fsaPhase('server-a-stopped');

// 3) Server cycle B — SAME DB, NEW PROCESS, LOGIN AGAIN, REOPEN.
[$serverB, $pipesB, $readyB] = startServer($public, $router, $processEnv, $port, $evidenceDir.'/server-b.log');
$mark('server-cycle-b-started', $readyB);
$loginB = fsaHttp('http://127.0.0.1:'.$port.'/api/login', 'POST', json_encode(['username' => $manifest['username'], 'password' => $manifest['password']]));
$tokenB = $loginB['body']['data']['token'] ?? null;
$mark('cycle-b-new-login', $loginB['status'] === 200 && is_string($tokenB) && $tokenB !== $tokenA, 'status='.$loginB['status'].' new-token='.($tokenB !== $tokenA ? 'yes' : 'no'));
$cycleB = [];
foreach ($entities as $entity) {
    $response = fsaHttp('http://127.0.0.1:'.$port.$entity['open']['endpoint'], 'GET', null, $tokenB);
    [$ok, $detail] = verifyEntity($entity, $response);
    $cycleB[$entity['name']] = ['status' => $response['status'], 'verified' => $ok, 'detail' => $detail];
}
stopServer($serverB);
$failedB = array_filter($cycleB, fn ($v) => ! $v['verified']);
$mark('after-backend-restart-and-new-login', count($failedB) === 0, 'ok='.count($cycleB) - count($failedB).'/'.count($cycleB));
fsaPhase('server-b-stopped');

// 4) FINAL — raw file-backed proof (no app, no HTTP).
$pdo = new PDO('sqlite:'.$dbFile);
$tableProbes = [
    'citizen_beneficiary' => ['beneficiaries', 'id', $entities[0]['expect']['id'], 'full_name'],
    'resident_beneficiary' => ['beneficiaries', 'id', $entities[1]['expect']['id'], 'full_name'],
    'family_member' => ['dependents', 'beneficiary_id', $entities[0]['expect']['id'], 'name'],
    'user_account' => ['users', 'username', 'fsa_account_persist', 'full_name'],
    'staff' => ['staff', 'national_id', '1012345678', 'name'],
    'organization_rep' => ['neighborhood_reps', 'district_name', 'FSA DISTRICT', 'full_name'],
    'daily_beneficiary' => ['daily_beneficiaries', 'national_id', '2815000006', 'full_name'],
    'general_warehouse_item' => ['inventory_items', 'name', 'FSA WAREHOUSE ITEM', 'current_quantity'],
    'daily_inventory_item' => ['daily_inventory_items', 'name', 'FSA DAILY ITEM', 'current_quantity'],
    'support_distribution' => ['support_distributions', 'recipient_name', 'FSA CITIZEN PERSIST', 'status'],
    'driver' => ['drivers', 'phone', '0555555555', 'full_name'],
    'pickup_location' => ['pickup_locations', 'name', 'FSA PICKUP POINT', 'address'],
    'system_setting' => ['settings', 'key', 'fsa.persistence.test', 'value'],
    'active_sms_template' => ['settings', 'key', 'communications.driver_assignment_sms', 'value'],
];
$raw = [];
foreach ($tableProbes as $name => [$table, $whereCol, $whereVal, $valueCol]) {
    $row = $pdo->query("SELECT \"$valueCol\" AS v FROM \"$table\" WHERE \"$whereCol\" = ".$pdo->quote((string) $whereVal).' LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    $raw[$name] = $row !== false;
    $tableProbes[$name][] = $row['v'] ?? null;
}
$failedRaw = array_filter($raw, fn ($v) => ! $v);
$mark('final-database-backed', count($failedRaw) === 0, 'rows='.count($raw) - count($failedRaw).'/'.count($raw));

// Report table.
echo PHP_EOL.'ENTITY | CREATED | AFTER_API_RELOAD | AFTER_BACKEND_RESTART | AFTER_NEW_LOGIN | FINAL'.PHP_EOL;
echo '-------|---------|------------------|-----------------------|----------------|------'.PHP_EOL;
$entityNames = array_map(fn ($e) => $e['name'], $entities);
foreach ($entityNames as $i => $name) {
    $a = $cycleA[$name] ?? ['status' => 0, 'verified' => false];
    $b = $cycleB[$name] ?? ['status' => 0, 'verified' => false];
    printf("%-22s | %-7s | %-16s | %-21s | %-14s | %s\n", $name, 'yes', $a['verified'] ? 'PASS' : 'FAIL('.$a['status'].')', $b['verified'] ? 'PASS' : 'FAIL('.$b['status'].')', $b['verified'] ? 'PASS' : 'FAIL', $raw[$name] ? 'PASS' : 'FAIL');
}

$evidence = ['database' => basename($dbFile), 'entities' => $entities, 'cycle_a' => $cycleA, 'cycle_b' => $cycleB, 'raw_rows' => $raw, 'results' => $results];
file_put_contents($evidenceDir.'/evidence.json', json_encode($evidence, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
file_put_contents($evidenceDir.'/database.txt', $dbFile);

$passed = count(array_filter($results, fn ($r) => $r['passed']));
$allOk = $provisionStatus === 0 && $readyA && $readyB && is_string($tokenA) && is_string($tokenB) && count($failedA) === 0 && count($failedB) === 0 && count($failedRaw) === 0 && count($results) === $passed;
echo PHP_EOL.'TOTAL='.$passed.'/'.count($results).' PASSED='.$passed.' FAILED='.(count($results) - $passed).PHP_EOL;
echo 'PERSISTENCE_GATE='.($allOk ? 'PASS' : 'FAIL').PHP_EOL;
exit($allOk ? 0 : 1);
