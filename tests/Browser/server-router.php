<?php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');

if ($uri === '/__qa-fixture-check') {
    $database = getenv('DB_DATABASE');
    $safe = getenv('APP_ENV') === 'testing'
        && getenv('DB_CONNECTION') === 'sqlite'
        && is_string($database)
        && str_contains($database, 'qa-isolated-');
    $count = 0;
    if ($safe && is_file($database)) {
        $count = (int) (new PDO('sqlite:'.$database))->query('select count(*) from users')->fetchColumn();
    }
    header('Content-Type: application/json');
    echo json_encode(['safe' => $safe, 'users' => $count]);
    return;
}

$publicPath = dirname(__DIR__, 2).'/public';
if ($uri !== '/' && file_exists($publicPath.$uri)) {
    return false;
}

require $publicPath.'/index.php';
