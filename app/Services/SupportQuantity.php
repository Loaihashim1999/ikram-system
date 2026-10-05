<?php

namespace App\Services;

use Brick\Math\BigDecimal;

class SupportQuantity
{
    public static function add($left, $right): string
    {
        return (string) BigDecimal::of($left)->plus($right)->toScale(2);
    }

    public static function subtract($left, $right): string
    {
        return (string) BigDecimal::of($left)->minus($right)->toScale(2);
    }

    public static function compare($left, $right): int
    {
        return BigDecimal::of($left)->compareTo($right);
    }
}
