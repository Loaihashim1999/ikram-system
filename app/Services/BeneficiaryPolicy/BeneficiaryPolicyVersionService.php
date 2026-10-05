<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\BeneficiaryPolicyVersion;
use Illuminate\Validation\ValidationException;

/**
 * BeneficiaryPolicyVersionService — policy version lifecycle (POLICY-A).
 *
 * Draft → approve → publish → retire, with:
 * - published configuration immutability (no in-place edits; clone/new draft only),
 * - one-active-policy rule (no overlapping effective published periods per scope),
 * - full policy change audit trail recorded on the existing AuditLog architecture.
 *
 * No live beneficiary recalculation happens here — that is later phases.
 */
class BeneficiaryPolicyVersionService
{
    public const AUDIT_TABLE = 'beneficiary_policy_versions';

    /**
     * Create a new draft version.
     */
    public function createDraft(array $data, string $actorId): BeneficiaryPolicyVersion
    {
        $configuration = PolicyConfigurationValidator::validate($data['configuration'] ?? []);

        $required = ['policy_name', 'version', 'policy_scope'];
        foreach ($required as $field) {
            if (blank($data[$field] ?? null)) {
                throw ValidationException::withMessages([$field => 'هذا الحقل مطلوب.']);
            }
        }
        if (! in_array($data['policy_scope'], BeneficiaryPolicyVersion::ALLOWED_SCOPES, true)) {
            throw ValidationException::withMessages(['policy_scope' => 'نطاق السياسة غير مدعوم بعد.']);
        }
        $this->assertVersionAvailable($data['policy_name'], $data['version'], null);

        $version = BeneficiaryPolicyVersion::create([
            'policy_name' => $data['policy_name'],
            'policy_scope' => $data['policy_scope'],
            'version' => $data['version'],
            'status' => BeneficiaryPolicyVersion::STATUS_DRAFT,
            'effective_from' => $data['effective_from'] ?? null,
            'effective_to' => $data['effective_to'] ?? null,
            'source_document_reference' => $data['source_document_reference'] ?? null,
            'source_document_version' => $data['source_document_version'] ?? null,
            'board_approval_reference' => $data['board_approval_reference'] ?? null,
            'board_approval_date' => $data['board_approval_date'] ?? null,
            'configuration' => $configuration,
            'parent_version_id' => $data['parent_version_id'] ?? null,
            'change_reason' => $data['change_reason'] ?? null,
        ]);

        $this->audit($actorId, 'POLICY_DRAFT_CREATED', $version, [
            'policy_name' => $version->policy_name,
            'version' => $version->version,
            'policy_scope' => $version->policy_scope,
        ]);

        return $version->fresh();
    }

    /**
     * Edit a draft's metadata/config. Published/retired versions are immutable.
     */
    public function updateDraft(string $id, array $data, string $actorId): BeneficiaryPolicyVersion
    {
        $version = $this->requireVersion($id);
        $this->assertMutable($version);

        $changes = [];
        $attributes = [
            'policy_name', 'policy_scope', 'version', 'effective_from', 'effective_to',
            'source_document_reference', 'source_document_version',
            'board_approval_reference', 'board_approval_date', 'change_reason',
        ];
        foreach ($attributes as $field) {
            if (array_key_exists($field, $data)) {
                $old = $version->{$field};
                $new = $data[$field];
                if ($old != $new) {
                    $changes[$field] = ['old' => $old, 'new' => $new];
                    $version->{$field} = $new;
                }
            }
        }

        if (array_key_exists('policy_scope', $data) && ! in_array($version->policy_scope, BeneficiaryPolicyVersion::ALLOWED_SCOPES, true)) {
            throw ValidationException::withMessages(['policy_scope' => 'نطاق السياسة غير مدعوم بعد.']);
        }
        if (array_key_exists('version', $data)) {
            $this->assertVersionAvailable($version->policy_name, $version->version, $id);
        }

        if (array_key_exists('configuration', $data)) {
            $normalized = PolicyConfigurationValidator::validate($data['configuration']);
            if ($normalized != $version->configuration) {
                $changes['configuration'] = ['old' => $version->configuration, 'new' => $normalized];
                $version->configuration = $normalized;
            }
        }

        if ($changes !== []) {
            $version->save();
            $this->audit($actorId, 'POLICY_DRAFT_UPDATED', $version, ['changes' => $changes]);
        }

        return $version->fresh();
    }

    /**
     * Clone any version into a new draft preserving the lineage (previous version remains intact).
     */
    public function cloneDraft(string $id, string $actorId): BeneficiaryPolicyVersion
    {
        $source = $this->requireVersion($id);
        $nextVersion = $this->nextAvailableVersion($source->policy_name);

        $draft = BeneficiaryPolicyVersion::create([
            'policy_name' => $source->policy_name,
            'policy_scope' => $source->policy_scope,
            'version' => $nextVersion,
            'status' => BeneficiaryPolicyVersion::STATUS_DRAFT,
            'effective_from' => null,
            'effective_to' => null,
            'source_document_reference' => $source->source_document_reference,
            'source_document_version' => $source->source_document_version,
            'configuration' => $source->configuration,
            'parent_version_id' => $source->id,
            'change_reason' => null,
        ]);

        $this->audit($actorId, 'POLICY_DRAFT_CREATED', $draft, [
            'cloned_from' => $source->id,
            'cloned_version' => $source->version,
            'policy_name' => $draft->policy_name,
            'version' => $draft->version,
        ]);

        return $draft->fresh();
    }

    /**
     * Approve a draft (records board approval). Draft remains a draft until published.
     */
    public function approve(string $id, array $data, string $actorId): BeneficiaryPolicyVersion
    {
        $version = $this->requireVersion($id);
        if (! $version->isDraft()) {
            abort(409, 'لا يمكن اعتماد نسخة ليست في الحالة مسودة.');
        }
        if (blank($data['board_approval_reference'] ?? null) || blank($data['board_approval_date'] ?? null)) {
            throw ValidationException::withMessages(['board_approval_reference' => 'يجب إدخال مرجع قرار مجلس الإدارة وتاريخه عند الاعتماد.']);
        }

        $wasApproved = $version->approved_by !== null;
        $version->board_approval_reference = $data['board_approval_reference'];
        $version->board_approval_date = $data['board_approval_date'];
        $version->approved_by = $actorId;
        $version->approved_at = now();
        $version->save();

        if (! $wasApproved) {
            $this->audit($actorId, 'POLICY_APPROVED', $version, [
                'board_approval_reference' => $version->board_approval_reference,
                'board_approval_date' => $version->board_approval_date->format('Y-m-d'),
            ]);
        }

        return $version->fresh();
    }

    /**
     * Publish an approved draft, enforcing the one-active-policy (no overlapping effective
     * published periods for the same policy scope).
     */
    public function publish(string $id, string $actorId): BeneficiaryPolicyVersion
    {
        $version = $this->requireVersion($id);
        if (! $version->isDraft()) {
            abort(409, 'لا يمكن نشر نسخة ليست في الحالة مسودة.');
        }
        if ($version->approved_by === null) {
            abort(409, 'يجب اعتماد النسخة (قرار مجلس إدارة) قبل نشرها.');
        }

        $effectiveFrom = $version->effective_from ?? now()->toDateString();
        $effectiveTo = $version->effective_to;
        if ($effectiveTo !== null && $effectiveFrom > $effectiveTo) {
            throw ValidationException::withMessages(['effective_to' => 'تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.']);
        }

        $conflict = BeneficiaryPolicyVersion::query()
            ->where('policy_scope', $version->policy_scope)
            ->where('status', BeneficiaryPolicyVersion::STATUS_PUBLISHED)
            ->whereKeyNot($version->id)
            ->get()
            ->first(fn (BeneficiaryPolicyVersion $published) => self::rangesOverlap(
                $published->effective_from, $published->effective_to, $effectiveFrom, $effectiveTo
            ));

        if ($conflict !== null) {
            abort(409, 'توجد سياسة منشورة بسريان متداخل لنفس النطاق ('.$conflict->version.')؛ لا يمكن النشر قبل أرشفة النسخة المتعارضة أو إنهاء فترة سريانها.');
        }

        $version->effective_from = $effectiveFrom;
        $version->status = BeneficiaryPolicyVersion::STATUS_PUBLISHED;
        $version->published_by = $actorId;
        $version->published_at = now();
        $version->save();

        $this->audit($actorId, 'POLICY_PUBLISHED', $version, [
            'effective_from' => $effectiveFrom,
            'effective_to' => $effectiveTo,
            'configuration' => $version->configuration,
        ]);

        return $version->fresh();
    }

    /**
     * Retire a published policy (old versions are never destroyed).
     */
    public function retire(string $id, array $data, string $actorId): BeneficiaryPolicyVersion
    {
        $version = $this->requireVersion($id);
        if (! $version->isPublished()) {
            abort(409, 'يمكن أرشفة نسخة منشورة فقط.');
        }
        if (blank($data['change_reason'] ?? null)) {
            throw ValidationException::withMessages(['change_reason' => 'سبب الأرشفة مطلوب.']);
        }

        $version->status = BeneficiaryPolicyVersion::STATUS_RETIRED;
        $version->retired_by = $actorId;
        $version->retired_at = now();
        $version->change_reason = $data['change_reason'];
        $version->save();

        $this->audit($actorId, 'POLICY_RETIRED', $version, ['change_reason' => $version->change_reason]);

        return $version->fresh();
    }

    /** Effective-range overlap with null = unbounded (open-ended). */
    public static function rangesOverlap(?string $aStart, ?string $aEnd, ?string $bStart, ?string $bEnd): bool
    {
        $aStart ??= '0000-01-01';
        $aEnd ??= '9999-12-31';
        $bStart ??= '0000-01-01';
        $bEnd ??= '9999-12-31';

        return $aStart <= $bEnd && $bStart <= $aEnd;
    }

    private function requireVersion(string $id): BeneficiaryPolicyVersion
    {
        return BeneficiaryPolicyVersion::findOrFail($id);
    }

    private function assertMutable(BeneficiaryPolicyVersion $version): void
    {
        if ($version->isImmutable()) {
            abort(409, 'النسخ المنشورة أو المؤرشفة دائمة ولا يمكن تعديلها؛ أنشئ نسخة جديدة.');
        }
    }

    private function assertVersionAvailable(string $policyName, string $version, ?string $ignoreId): void
    {
        $exists = BeneficiaryPolicyVersion::query()
            ->where('policy_name', $policyName)
            ->where('version', $version)
            ->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages(['version' => 'رقم النسخة مستخدم مسبقاً لنفس اسم السياسة.']);
        }
    }

    private function nextAvailableVersion(string $policyName): string
    {
        $max = BeneficiaryPolicyVersion::query()
            ->where('policy_name', $policyName)
            ->get('version')
            ->map(fn ($v) => (int) preg_replace('/[^0-9].*$/', '', (string) $v->version))
            ->max() ?? 0;

        return (string) ($max + 1);
    }

    private function audit(string $actorId, string $action, BeneficiaryPolicyVersion $version, array $details): void
    {
        AuditLog::create([
            'user_id' => $actorId,
            'action' => $action,
            'target_table' => self::AUDIT_TABLE,
            'target_id' => $version->id,
            'details' => $details,
        ]);
    }
}
