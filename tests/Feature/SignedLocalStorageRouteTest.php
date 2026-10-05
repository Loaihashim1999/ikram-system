<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class SignedLocalStorageRouteTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_signature_serves_only_the_requested_private_file(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('audit/target.txt', 'synthetic target bytes');
        Storage::disk('local')->put('audit/unrelated.txt', 'synthetic unrelated secret');

        $url = URL::temporarySignedRoute('storage.local', now()->addMinutes(5), ['path' => 'audit/target.txt'], false);
        $route = app('router')->getRoutes()->match(Request::create($url, 'GET'));
        $this->assertSame('storage.local', $route->getName());

        $response = $this->get($url)->assertOk();
        $this->assertSame('synthetic target bytes', $response->streamedContent());
        $this->assertStringStartsWith('text/plain', (string) $response->headers->get('Content-Type'));
        $cacheControl = $response->headers->get('Cache-Control');
        $this->assertStringContainsString('no-store', $cacheControl);
        $this->assertStringContainsString('max-age=0', $cacheControl);
        $this->assertStringContainsString('private', $cacheControl);

        $tampered = preg_replace('/signature=./', 'signature=0', $url, 1);
        $this->get($tampered)->assertForbidden();

        $expired = URL::temporarySignedRoute('storage.local', now()->subMinute(), ['path' => 'audit/target.txt'], false);
        $this->get($expired)->assertForbidden();

        $missing = URL::temporarySignedRoute('storage.local', now()->addMinutes(5), ['path' => 'audit/missing.txt'], false);
        $this->get($missing)->assertNotFound();

        $unrelatedByReusedSignature = str_replace('audit/target.txt', 'audit/unrelated.txt', $url);
        $this->get($unrelatedByReusedSignature)->assertForbidden();
        $this->get('/storage/audit/unrelated.txt')->assertForbidden();
        $this->assertSame('synthetic unrelated secret', Storage::disk('local')->get('audit/unrelated.txt'));
    }

    public function test_traversal_style_signed_path_never_serves_outside_content(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('outside.txt', 'outside sentinel');
        $url = URL::temporarySignedRoute('storage.local', now()->addMinutes(5), ['path' => '../outside.txt'], false);

        $response = $this->get($url);
        $this->assertContains($response->status(), [403, 404]);
        $this->assertNotSame('outside sentinel', $response->getContent());
        $this->assertSame('outside sentinel', Storage::disk('local')->get('outside.txt'));
    }

    public function test_spa_fallback_still_serves_frontend_routes(): void
    {
        $response = $this->get('/audit-local-browser-route')->assertOk();
        $this->assertStringContainsString('<div id="root"></div>', $response->getContent());
    }
}
