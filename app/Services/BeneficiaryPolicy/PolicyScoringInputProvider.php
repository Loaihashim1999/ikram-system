<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\Beneficiary;

/**
 * PolicyScoringInputProvider — hydrates canonical POLICY-C scoring inputs from the
 * authoritative repository model (POLICY-B financials + structured beneficiary data).
 *
 * Honesty rules (POLICY-C0 audit §2):
 * - income_per_capita comes ONLY from the authoritative POLICY-B financial result;
 * - housing tenure maps the canonical `housing_type` enum (rent → rented, own → owned);
 * - age is derived from date_of_birth (never a client-supplied age);
 * - housing condition, verified disability % and affected-children count have NO
 *   canonical structured field in the current repository → they stay null and the
 *   engine returns review_required instead of inventing values.
 */
final class PolicyScoringInputProvider
{
    private const TENURE_MAP = ['rent' => 'rented', 'own' => 'owned'];

    public function fromBeneficiary(Beneficiary $beneficiary, array $financials): PolicyScoringInputs
    {
        return PolicyScoringInputs::fromStructured([
            'income_per_capita' => isset($financials['net_income_per_capita'])
                ? (float) $financials['net_income_per_capita']
                : null,
            // no structured housing-condition field exists — never invented
            'housing_condition' => null,
            'housing_tenure' => self::TENURE_MAP[$beneficiary->housing_type] ?? null,
            // only boolean special-needs flags exist — a flag is NOT a verified percentage
            'head_disability_percent' => null,
            // dependents carry no health/disability field — not invented
            'affected_children_count' => null,
            'head_age' => $beneficiary->date_of_birth ? $beneficiary->date_of_birth->age : null,
        ]);
    }
}
