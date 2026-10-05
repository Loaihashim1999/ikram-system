<?php

namespace App\Services\BeneficiaryPolicy;

/**
 * PolicyScoringInputs — canonical structured inputs for the POLICY-C scoring engine.
 *
 * Availability is explicit: a `null` field means "no canonical structured data
 * exists to evaluate this dimension" (NEVER an implied zero). The scoring engine
 * turns unavailable inputs into `review_required` components; policy rules
 * decide per dimension whether a present value scores zero (e.g. owned housing,
 * healthy head, no affected children).
 *
 * Only canonical/to-be-validated values enter the engine: verifier-supplied
 * disability percent, configured household condition, verified affected-child
 * count, etc. The provider hydrates what the repository can prove today; the
 * rest remain null until POLICY-D collects the required evidence.
 */
final class PolicyScoringInputs
{
    private function __construct(
        public readonly ?float $incomePerCapita,
        public readonly ?string $housingCondition,
        public readonly ?string $housingTenure,
        public readonly ?float $headDisabilityPercent,
        public readonly ?int $affectedChildrenCount,
        public readonly ?int $headAge,
    ) {}

    /**
     * Reference factory used by tests and later phases to supply canonical inputs.
     *
     * @param  array{income_per_capita?: float|null, housing_condition?: string|null, housing_tenure?: string|null, head_disability_percent?: float|null, affected_children_count?: int|null, head_age?: int|null}  $data
     */
    public static function fromStructured(array $data): self
    {
        return new self(
            incomePerCapita: isset($data['income_per_capita']) ? (float) $data['income_per_capita'] : null,
            housingCondition: $data['housing_condition'] ?? null,
            housingTenure: $data['housing_tenure'] ?? null,
            headDisabilityPercent: isset($data['head_disability_percent']) ? (float) $data['head_disability_percent'] : null,
            affectedChildrenCount: isset($data['affected_children_count']) ? (int) $data['affected_children_count'] : null,
            headAge: isset($data['head_age']) ? (int) $data['head_age'] : null,
        );
    }

    /**
     * Machine-readable input snapshot — only derived figures, no identity data.
     */
    public function toArray(): array
    {
        return [
            'income_per_capita' => $this->incomePerCapita,
            'housing_condition' => $this->housingCondition,
            'housing_tenure' => $this->housingTenure,
            'head_disability_percent' => $this->headDisabilityPercent,
            'affected_children_count' => $this->affectedChildrenCount,
            'head_age' => $this->headAge,
        ];
    }
}
