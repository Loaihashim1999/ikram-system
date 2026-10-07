<?php

/**
 * FSA local fixture router.
 *
 * Serves the Laravel app on a loopback-only PHP built-in server and exposes
 * a minimal /up readiness probe. All requests stay on 127.0.0.1.
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');

if ($uri === '/up') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok']);

    return;
}

$publicPath = dirname(__DIR__, 2).'/public';
if ($uri !== '/' && file_exists($publicPath.$uri)) {
    return false;
}

require $publicPath.'/index.php';
