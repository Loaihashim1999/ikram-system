<?php

$root = dirname(__DIR__, 2);
$build = getenv('FSA_BUILD_DIR') ?: $root.'/.tmp/uiux-gate/build';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
if (str_starts_with($uri, '/api/') || $uri === '/up') {
    require __DIR__.'/server-router.php';

    return;
}
$file = realpath($build.rawurldecode($uri));
$resolved = realpath($build);
if (! $file || ! $resolved || ! str_starts_with($file, $resolved.DIRECTORY_SEPARATOR) || ! is_file($file)) {
    $file = $build.'/index.html';
}
$types = ['html' => 'text/html', 'js' => 'application/javascript', 'css' => 'text/css', 'png' => 'image/png', 'svg' => 'image/svg+xml', 'woff2' => 'font/woff2'];
header('Content-Type: '.($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
readfile($file);
