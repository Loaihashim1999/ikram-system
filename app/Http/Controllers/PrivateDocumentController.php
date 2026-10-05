<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\DailyBeneficiary;
use App\Models\NeighborhoodRep;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PrivateDocumentController extends Controller
{
    private const BENEFICIARY_FIELDS = [
        'national_id_image_url',
        'residence_id_image_url',
        'citizen_account_image_url',
        'social_security_image_url',
        'pension_certificate_image_url',
        'national_address_image_url',
        'rental_contract_image_url',
        'electricity_bill_image_url',
        'salary_certificate_url',
    ];

    private const REPRESENTATIVE_FIELDS = [
        'id_document_image_url',
        'support_letter_url',
        'national_address_doc_url',
        'dependents_ids_zip_url',
    ];

    public function beneficiary(Request $request, string $beneficiary, string $field): JsonResponse|RedirectResponse|Response|StreamedResponse
    {
        abort_unless(in_array($field, self::BENEFICIARY_FIELDS, true), 404);

        $record = Beneficiary::findOrFail($beneficiary);

        return $this->deliver($request, $record->getRawOriginal($field));
    }

    public function dailyBeneficiary(Request $request, string $beneficiary, string $document): JsonResponse|RedirectResponse|Response|StreamedResponse
    {
        $owner = DailyBeneficiary::findOrFail($beneficiary);
        $record = $owner->documents()->findOrFail($document);

        return $this->deliver($request, $record->file_path);
    }

    public function representative(Request $request, string $representative, string $field): JsonResponse|RedirectResponse|Response|StreamedResponse
    {
        abort_unless(in_array($field, self::REPRESENTATIVE_FIELDS, true), 404);

        $record = NeighborhoodRep::findOrFail($representative);

        return $this->deliver($request, $record->getRawOriginal($field));
    }

    private function deliver(Request $request, mixed $path): JsonResponse|RedirectResponse|Response|StreamedResponse
    {
        abort_unless($this->isSafeStoragePath($path), 404);

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        abort_unless($disk->exists($path), 404);

        if (! $disk->providesTemporaryUrls()) {
            return $disk->download($path, basename($path), [
                'Cache-Control' => 'private, no-store, max-age=0',
                'Referrer-Policy' => 'no-referrer',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        $expiresAt = now()->addMinutes(5);
        $url = $disk->temporaryUrl($path, $expiresAt, [
            'httpHeaders' => [
                'cacheControl' => 'private, no-store, max-age=0',
                'contentDisposition' => 'attachment',
                'contentType' => 'application/octet-stream',
            ],
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'url' => $url,
                'expires_at' => $expiresAt->toIso8601String(),
            ])->header('Cache-Control', 'private, no-store, max-age=0')
                ->header('Referrer-Policy', 'no-referrer');
        }

        return redirect()->away($url, 302, [
            'Cache-Control' => 'private, no-store, max-age=0',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }

    private function isSafeStoragePath(mixed $path): bool
    {
        return is_string($path)
            && $path !== ''
            && ! str_contains($path, '://')
            && ! str_starts_with($path, '/')
            && ! str_contains($path, '\\')
            && ! preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $path);
    }
}
