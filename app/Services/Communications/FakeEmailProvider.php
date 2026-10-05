<?php

namespace App\Services\Communications;

use App\Contracts\Communications\EmailProviderInterface;

class FakeEmailProvider extends FakeProvider implements EmailProviderInterface {}
