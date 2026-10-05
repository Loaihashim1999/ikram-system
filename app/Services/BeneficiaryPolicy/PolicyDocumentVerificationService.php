<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\DocumentVerification;
use App\Models\MedicalEvidence;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

final class PolicyDocumentVerificationService
{
    public function medical(array $data): MedicalEvidence
    {
        Validator::make($data, [
            'verification_status' => ['required', Rule::in(['verified', 'rejected', 'under_review'])],
            'verified_disability_percentage' => ['required_if:verification_status,verified', 'nullable', 'numeric', 'between:0,100', 'decimal:0,2'],
        ])->validate();
        if ($data['verification_status'] !== 'verified') {
            $data['verified_disability_percentage'] = null;
        }
        $record = MedicalEvidence::create($data);
        AuditLog::create([
            'user_id' => $data['verified_by'], 'action' => 'MEDICAL_EVIDENCE_'.strtoupper($data['verification_status']),
            'target_table' => 'medical_evidence', 'target_id' => $record->id,
            'details' => ['evaluation_id' => $data['evaluation_id']],
        ]);

        return $record;
    }

    public function verify(string $beneficiaryId, string $documentCode, ?string $documentId, array $data): DocumentVerification
    {
        $result = DocumentVerification::create(array_merge($data, [
            'beneficiary_id' => $beneficiaryId,
            'document_code' => $documentCode,
            'document_id' => $documentId,
            'verification_status' => 'verified',
        ]));
        AuditLog::create([
            'user_id' => $data['verified_by'] ?? null,
            'action' => 'DOCUMENT_VERIFIED',
            'target_table' => 'document_verifications',
            'target_id' => $result->id,
            'details' => ['document_code' => $documentCode, 'beneficiary_id' => $beneficiaryId, 'status' => 'verified'],
        ]);

        return $result;
    }

    public function reject(string $beneficiaryId, string $documentCode, ?string $documentId, array $data): DocumentVerification
    {
        $result = DocumentVerification::create(array_merge($data, [
            'beneficiary_id' => $beneficiaryId,
            'document_code' => $documentCode,
            'document_id' => $documentId,
            'verification_status' => 'rejected',
        ]));
        AuditLog::create([
            'user_id' => $data['verified_by'] ?? null,
            'action' => 'DOCUMENT_REJECTED',
            'target_table' => 'document_verifications',
            'target_id' => $result->id,
            'details' => ['document_code' => $documentCode, 'beneficiary_id' => $beneficiaryId, 'status' => 'rejected', 'rejection_reason' => $data['rejection_reason'] ?? null],
        ]);

        return $result;
    }

    public function markUnderReview(string $beneficiaryId, string $documentCode, ?string $documentId, array $data = []): DocumentVerification
    {
        return DocumentVerification::create(array_merge($data, [
            'beneficiary_id' => $beneficiaryId,
            'document_code' => $documentCode,
            'document_id' => $documentId,
            'verification_status' => 'under_review',
        ]));
    }
}
