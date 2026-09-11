<?php

/** @var \Illuminate\Database\Eloquent\Factory \$factory */

use App\Models\Beneficiary;
use Faker\Generator as Faker;

/** @var \Illuminate\Database\Eloquent\Factory $factory */
$factory->define(Beneficiary::class, function (Faker $faker) {
    static $counter = 1;
    $seq = str_pad($counter++, 3, '0', STR_PAD_LEFT);
    return [
        'beneficiary_type' => $faker->randomElement(['individual', 'family']),
        'full_name' => "TEST_BENEFICIARY_{$seq}",
        'national_id' => $faker->ean13,
        'phone' => $faker->phoneNumber,
        'date_of_birth' => $faker->date('Y-m-d'),
        'place_of_birth' => $faker->city,
        'nationality' => $faker->country,
        'profession' => $faker->jobTitle,
        'city' => $faker->city,
        'district' => $faker->streetName,
        'street' => $faker->streetAddress,
        'category_id' => 1, // adjust as needed
        'status' => $faker->randomElement(['active', 'inactive']),
        'priority' => $faker->randomElement(['high', 'medium', 'low']),
        'has_special_needs' => $faker->boolean,
        'is_elderly' => $faker->boolean,
        'is_special_needs' => $faker->boolean,
        'family_status' => $faker->randomElement(['single', 'married']),
        'family_members_count' => $faker->numberBetween(1, 6),
        'wives_count' => $faker->numberBetween(0, 2),
        'working_members_count' => $faker->numberBetween(0, 4),
        'non_working_children_count' => $faker->numberBetween(0, 4),
        'father_status' => $faker->randomElement(['alive', 'deceased']),
        'mother_status' => $faker->randomElement(['alive', 'deceased']),
        'owns_house' => $faker->boolean,
        'housing_type' => $faker->randomElement(['owned', 'rented']),
        'annual_rent_amount' => $faker->randomFloat(2, 0, 20000),
        'monthly_rent' => $faker->randomFloat(2, 0, 2000),
        'income_sources' => [],
        'monthly_salary' => $faker->randomFloat(2, 0, 5000),
        'social_security_amount' => $faker->randomFloat(2, 0, 2000),
        'citizen_account_amount' => $faker->randomFloat(2, 0, 2000),
        'retirement_pension' => $faker->randomFloat(2, 0, 2000),
        'family_support' => $faker->randomFloat(2, 0, 2000),
        'bank_name' => $faker->bank,
        'iban_encrypted' => null,
        // totals will be computed by model events
    ];
});
?>
