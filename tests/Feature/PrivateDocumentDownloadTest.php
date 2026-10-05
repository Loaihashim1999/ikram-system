<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyBeneficiaryDocument;
use App\Models\NeighborhoodRep;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrivateDocumentDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_beneficiary_download_returns_a_short_lived_blob_url(): void
    {
        $user = $this->user('admin');
        Sanctum::actingAs($user);

        $beneficiary = $this->beneficiary('1999999001');
        $path = 'beneficiaries/private-id.png';
        $beneficiary->forceFill(['national_id_image_url' => $path])->save();

        Storage::fake('public');
        Storage::disk('public')->put($path, 'private test content');
        $expiration = null;
        $urlOptions = [];
        Storage::disk('public')->buildTemporaryUrlsUsing(function ($storedPath, $expiresAt, $options) use (&$expiration, &$urlOptions) {
            $expiration = $expiresAt;
            $urlOptions = $options;

            return 'https://private.blob.example/'.$storedPath.'?sig=short-lived';
        });

        $response = $this->getJson("/api/beneficiaries/{$beneficiary->id}/documents/national_id_image_url");

        $response->assertOk()
            ->assertJsonPath('url', 'https://private.blob.example/beneficiaries/private-id.png?sig=short-lived')
            ->assertHeader('Cache-Control')
            ->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertNotNull($expiration);
        $this->assertTrue($expiration->between(now()->addMinutes(4), now()->addMinutes(5)));
        $this->assertSame('application/octet-stream', $urlOptions['httpHeaders']['contentType']);

        $this->get("/api/beneficiaries/{$beneficiary->id}/documents/national_id_image_url")
            ->assertRedirect('https://private.blob.example/beneficiaries/private-id.png?sig=short-lived');
    }

    public function test_beneficiary_document_requires_the_module_view_permission(): void
    {
        $beneficiary = $this->beneficiary('1999999002');
        $user = $this->user('reception', ['beneficiaries' => ['view' => false]]);
        Sanctum::actingAs($user);

        $this->getJson("/api/beneficiaries/{$beneficiary->id}/documents/national_id_image_url")
            ->assertForbidden();
    }

    public function test_document_download_requires_authentication(): void
    {
        $beneficiary = $this->beneficiary('1999999005');

        $this->getJson("/api/beneficiaries/{$beneficiary->id}/documents/national_id_image_url")
            ->assertUnauthorized();
    }

    public function test_document_endpoint_rejects_unapproved_fields_and_external_legacy_urls(): void
    {
        $user = $this->user('admin');
        Sanctum::actingAs($user);

        $beneficiary = $this->beneficiary('1999999003');
        $beneficiary->forceFill([
            'national_id_image_url' => 'https://untrusted.example/private.png',
        ])->save();

        $this->getJson("/api/beneficiaries/{$beneficiary->id}/documents/created_by")
            ->assertNotFound();
        $this->getJson("/api/beneficiaries/{$beneficiary->id}/documents/national_id_image_url")
            ->assertNotFound();
    }

    public function test_beneficiary_api_exposes_a_protected_endpoint_not_the_storage_path(): void
    {
        $beneficiary = $this->beneficiary('1999999004');
        $beneficiary->forceFill([
            'national_id_image_url' => 'beneficiaries/private-id.png',
        ])->save();

        $this->assertSame(
            route('beneficiaries.documents.download', [
                'beneficiary' => $beneficiary->id,
                'field' => 'national_id_image_url',
            ]),
            $beneficiary->fresh()->toArray()['national_id_image_url'],
        );
        $this->assertStringNotContainsString(
            'beneficiaries/private-id.png',
            json_encode($beneficiary->fresh(), JSON_THROW_ON_ERROR),
        );
    }

    public function test_daily_beneficiary_and_representative_documents_use_private_endpoints(): void
    {
        Sanctum::actingAs($this->user('admin'));
        Storage::fake('public');
        Storage::disk('public')->put('documents/daily/test.pdf', 'daily document');
        Storage::disk('public')->put('reps/test.pdf', 'representative document');
        Storage::disk('public')->buildTemporaryUrlsUsing(
            fn ($path) => 'https://private.blob.example/'.$path.'?sig=short-lived',
        );

        $daily = DailyBeneficiary::create([
            'full_name' => 'Daily document test',
            'national_id' => '2999999001',
            'phone' => '0509999002',
            'district' => 'Test',
            'status' => 'active',
        ]);
        $document = DailyBeneficiaryDocument::create([
            'daily_beneficiary_id' => $daily->id,
            'document_type' => 'national_id',
            'file_name' => 'test.pdf',
            'file_path' => 'documents/daily/test.pdf',
        ]);
        $otherDaily = DailyBeneficiary::create([
            'full_name' => 'Other daily document test',
            'national_id' => '2999999004',
            'phone' => '0509999004',
            'district' => 'Test',
            'status' => 'active',
        ]);
        $representative = NeighborhoodRep::create([
            'full_name' => 'Representative document test',
            'phone' => '0509999003',
            'district_name' => 'Test',
            'status' => 'active',
            'support_letter_url' => 'reps/test.pdf',
        ]);

        $this->getJson("/api/daily-beneficiaries/{$daily->id}/documents/{$document->id}/download")
            ->assertOk()
            ->assertJsonPath('url', 'https://private.blob.example/documents/daily/test.pdf?sig=short-lived');

        $this->getJson("/api/daily-beneficiaries/{$otherDaily->id}/documents/{$document->id}/download")
            ->assertNotFound();

        $this->getJson("/api/neighborhood-reps/{$representative->id}/documents/support_letter_url")
            ->assertOk()
            ->assertJsonPath('url', 'https://private.blob.example/reps/test.pdf?sig=short-lived');

        $this->assertSame(
            route('daily-beneficiaries.documents.download', [
                'beneficiary' => $daily->id,
                'document' => $document->id,
            ]),
            $document->fresh()->toArray()['file_url'],
        );
        $this->assertSame(
            route('neighborhood-reps.documents.download', [
                'representative' => $representative->id,
                'field' => 'support_letter_url',
            ]),
            $representative->fresh()->toArray()['support_letter_url'],
        );
        $this->assertStringNotContainsString(
            'documents/daily/test.pdf',
            json_encode($document->fresh(), JSON_THROW_ON_ERROR),
        );
    }

    private function user(string $role, array $permissions = []): User
    {
        static $sequence = 0;
        $sequence++;

        return User::create([
            'username' => 'private_document_'.$sequence,
            'full_name' => 'Private document test',
            'password' => 'test-password',
            'role' => $role,
            'permissions' => $permissions,
            'is_active' => true,
        ]);
    }

    private function beneficiary(string $nationalId): Beneficiary
    {
        $category = Category::create([
            'name' => 'Private document tests',
            'description' => 'Private document test fixture',
        ]);

        return Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'Private document test',
            'national_id' => $nationalId,
            'phone' => '0509999001',
            'category_id' => $category->id,
        ]);
    }
}
