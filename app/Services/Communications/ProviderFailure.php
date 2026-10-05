<?php

namespace App\Services\Communications;

use RuntimeException;

class ProviderFailure extends RuntimeException
{
    public function __construct(
        public readonly string $category,
        public readonly bool $retryable,
        public readonly array $diagnostics = [],
    ) {
        parent::__construct($category);
    }
}
