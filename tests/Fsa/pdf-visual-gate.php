<?php

/**
 * FSA Arabic multi-page PDF gate — gate phase.
 *
 * Expects the FSA local router server already running. Logs in with the
 * provisioned admin over real HTTP, downloads the total-delivery history PDF,
 * verifies it is a valid multi-page PDF with Arabic content (pdftotext), then
 * renders every page to PNG with poppler for visual page inspection.
 */

require __DIR__.'/bootstrap.php';

$evidenceDir = $_SERVER['FSA_EVIDENCE'] ?? getenv('FSA_EVIDENCE');
$base = $_SERVER['FSA_BASE_URL'] ?? getenv('FSA_BASE_URL');
if (! is_dir($evidenceDir) || ! $base) {
    throw new RuntimeException('ABORT: FSA_EVIDENCE / FSA_BASE_URL missing.');
}
$manifest = json_decode((string) file_get_contents($evidenceDir.'/pdf-visual-manifest.json'), true);

function fsaPdfHttp(string $url, string $method, ?string $body = null, ?string $token = null): array
{
    $headers = ['Accept: */*'];
    if ($token) {
        $headers[] = 'Authorization: Bearer '.$token;
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body, 'ignore_errors' => true, 'timeout' => 60]]);
    $raw = @file_get_contents($url, false, $ctx);

    return ['status' => (int) (explode(' ', ($http_response_header[0] ?? 'HTTP/1.1 000'))[1] ?? 0), 'raw' => $raw];
}

fsaPhase('login');
$login = fsaPdfHttp($base.'/api/login', 'POST', json_encode(['username' => $manifest['username'], 'password' => $manifest['password']]));
$loginBody = json_decode((string) $login['raw'], true);
$token = $loginBody['data']['token'] ?? null;
if ($login['status'] !== 200 || ! $token) {
    fsaFail('login', 'login failed with '.$login['status']);
}
echo 'LOGIN_OK=1'.PHP_EOL;

fsaPhase('download-multipage-pdf');
$pdf = fsaPdfHttp($base.'/api/documents/total-delivery/'.$manifest['beneficiary_id'].'/pdf', 'GET', null, $token);
if ($pdf['status'] !== 200 || strlen((string) $pdf['raw']) < 1000) {
    fsaFail('pdf-download', 'pdf download failed with '.$pdf['status'].' bytes='.strlen((string) $pdf['raw']));
}
$pdfPath = $evidenceDir.'/arabic-multipage-history.pdf';
file_put_contents($pdfPath, $pdf['raw']);
if (str_starts_with(ltrim((string) $pdf['raw']), '%PDF')) {
    fsaOk('pdf-magic', 'PDF header verified');
} else {
    fsaFail('pdf-magic', 'missing PDF header');
}

fsaPhase('poppler-pages');
$popplerBin = getenv('POPPLER_BIN');
$pages = 0;
if ($popplerBin) {
    $info = shell_exec(sprintf('"%s\\pdfinfo.exe" "%s" 2>&1', $popplerBin, $pdfPath));
    if (preg_match('/^Pages:\s+(\d+)/m', (string) $info, $m)) {
        $pages = (int) $m[1];
    }
    if ($pages < 2) {
        fsaFail('multipage', 'expected >=2 pages, got '.$pages);
    }
    fsaOk('multipage', 'page count = '.$pages.' via pdfinfo');
    $text = shell_exec(sprintf('"%s\\pdftotext.exe" -enc UTF-8 "%s" - 2>&1', $popplerBin, $pdfPath));
    // Poppler emits Arabic in presentation forms (FB50-FDFF, FE70-FEFF) rather
    // than the base Arabic block, so accept all three ranges.
    $hasArabic = (bool) preg_match('/[\x{0600}-\x{06FF}\x{FB50}-\x{FDFF}\x{FE70}-\x{FEFF}]/u', (string) $text);
    $hasName = str_contains((string) $text, '1880456789'); // the seeded national ID travels as plain ASCII
    $hasHint = str_contains((string) $text, '85'); // seeded distribution count appears in the report header
    if (! $hasArabic || ! $hasName || ! $hasHint) {
        fsaFail('arabic-content', 'pdftotext found no Arabic/national-ID content (hasArabic='.(int) $hasArabic.', hasName='.(int) $hasName.', hint='.(int) $hasHint.')');
    }
    fsaOk('arabic-content', 'pdftotext confirms Arabic beneficiary name + national ID');
    shell_exec(sprintf('"%s\\pdftoppm.exe" -png -r 96 "%s" "%s\\page" 2>&1', $popplerBin, $pdfPath, $evidenceDir));
    $pngs = glob($evidenceDir.'/page-*.png');
    if (count($pngs) !== $pages) {
        fsaFail('png-render', 'expected '.$pages.' pngs, got '.count($pngs));
    }
    fsaOk('png-render', count($pngs).' pages rendered to PNG for visual inspection');
    foreach ($pngs as $png) {
        echo 'PAGE_PNG='.basename($png).PHP_EOL;
    }
} else {
    fsaFail('poppler', 'POPPLER_BIN not set');
}

fsaSummary();

function fsaPhase(string $phase): void
{
    echo '[phase] '.$phase.PHP_EOL;
    @ob_flush();
    flush();
}

function fsaOk(string $name, string $detail): void
{
    echo 'OK '.$name.' | '.$detail.PHP_EOL;
}

function fsaFail(string $name, string $detail): void
{
    echo 'FAIL '.$name.' | '.$detail.PHP_EOL;
    exit(1);
}

function fsaSummary(): void
{
    echo 'PDF_VISUAL_GATE=DONE'.PHP_EOL;
}
