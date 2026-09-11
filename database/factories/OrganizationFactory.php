<?php

/** @var \Illuminate\Database\Eloquent\Factory $factory */

use App\Models\Organization;
use Faker\Generator as Faker;

$factory->define(Organization::class, function (Faker $faker) {
    static $counter = 1;
    $seq = str_pad($counter++, 3, '0', STR_PAD_LEFT);
    return [
        'name' => "Test Organization {$seq}",
        'code' => "TEST_ORG_{$seq}",
        'contact' => $faker->phoneNumber,
        'status' => $faker->randomElement(['active', 'inactive']),
    ];
});
?>
