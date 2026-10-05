<?php

namespace App\Services\Communications;

use App\Contracts\Communications\SmsProviderInterface;

class FakeSmsProvider extends FakeProvider implements SmsProviderInterface {}
