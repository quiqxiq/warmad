<?php

namespace App\Providers;

use App\Services\Reports\DailyOwnerReport;
use App\Services\Voice\GeminiVoiceParser;
use App\Services\Voice\MockVoiceParser;
use App\Services\Voice\UnavailableVoiceParser;
use App\Services\Voice\VoiceParserService;
use App\Services\WhatsApp\FonnteWhatsAppGateway;
use App\Services\WhatsApp\LogWhatsAppGateway;
use App\Services\WhatsApp\WhatsAppGateway;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(DailyOwnerReport::class);

        $this->app->bind(VoiceParserService::class, function (): VoiceParserService {
            $driver = config('services.voice.driver')
                ?? ($this->app->environment('local', 'testing') ? 'mock' : null);

            return match ($driver) {
                'mock' => new MockVoiceParser,
                'gemini' => new GeminiVoiceParser(
                    apiKey: (string) config('services.gemini.key'),
                    model: (string) (config('services.gemini.model') ?? 'gemini-2.0-flash'),
                ),
                default => new UnavailableVoiceParser,
            };
        });

        $this->app->bind(WhatsAppGateway::class, function (): WhatsAppGateway {
            return match (config('services.whatsapp.driver')) {
                'fonnte' => new FonnteWhatsAppGateway(
                    token: (string) config('services.fonnte.token'),
                ),
                default => new LogWhatsAppGateway,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiters();
    }

    /**
     * Register named rate limiters for throttled endpoints.
     */
    protected function configureRateLimiters(): void
    {
        RateLimiter::for('voice-parse', function (Request $request): array {
            $user = $request->user();
            $key = $user !== null
                ? "user:{$user->id}"
                : 'ip:'.$request->ip();

            // Voice parsing is expensive (STT + LLM); cap per-user bursts and
            // keep a wider per-tenant ceiling so one device cannot starve a busy outlet.
            return [
                Limit::perMinute(20)->by($key),
                Limit::perMinute(60)->by('tenant:'.($user !== null ? $user->tenant_id : 'guest')),
            ];
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
