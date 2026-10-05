<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Database\QueryException;

/**
 * Single text identity for official documents and the association_name placeholder.
 * Audit: 11_PDF_REPORT_DESIGN_AUDIT.md — competing hardcoded names.
 */
final class AssociationIdentity
{
    public static function name(): string
    {
        $configured = null;
        try {
            $configured = Setting::get('communications.association_name');
        } catch (QueryException) {
            $configured = null;
        }

        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        return (string) config('association.document_name');
    }
}
