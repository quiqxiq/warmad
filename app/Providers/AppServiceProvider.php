<?php

namespace App\Providers;

use App\Services\WhatsApp\FonnteWhatsAppGateway;
use App\Services\WhatsApp\LogWhatsAppGateway;
use App\Services\WhatsApp\WhatsAppGateway;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
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
