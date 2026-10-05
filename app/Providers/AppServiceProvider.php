<?php

namespace App\Providers;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Services\Communications\FakeEmailProvider;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Communications\TaqnyatEmailProvider;
use App\Services\Communications\TaqnyatSmsProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use App\Support\AssociationIdentity;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $provider = config('services.communications.provider', 'fake');
        if (! in_array($provider, ['fake', 'taqnyat'], true)) {
            throw new \RuntimeException('Unsupported communication provider mode.');
        }

        $this->app->bind(SmsProviderInterface::class, $provider === 'taqnyat' ? TaqnyatSmsProvider::class : FakeSmsProvider::class);
        $this->app->bind(EmailProviderInterface::class, $provider === 'taqnyat' ? TaqnyatEmailProvider::class : FakeEmailProvider::class);
    }

    public function boot(): void
    {
        // Named limiters give each recovery step its own bucket; unnamed
        // throttles would share one domain+IP bucket across the endpoints.
        RateLimiter::for('password-recovery-request', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('password-recovery-verify', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('password-recovery-reset', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        View::composer('pdf.*', function ($view) {
            $view->with('associationName', AssociationIdentity::name());
        });
    }
}
