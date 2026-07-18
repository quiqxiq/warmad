<?php

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Otp\OtpService;
use App\Services\WhatsApp\WhatsAppGateway;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    RateLimiter::clear('otp-request:phone:6289900001111');
    RateLimiter::clear('otp-request:ip:127.0.0.1');
});

it('registers a new owner, tenant, and first outlet via OTP', function () {
    $code = null;
    $gateway = Mockery::mock(WhatsAppGateway::class);
    $gateway->shouldReceive('send')
        ->once()
        ->with('6289900001111', Mockery::on(function ($message) use (&$code) {
            if (preg_match('/Amanah kamu: (\d{6})/', $message, $matches)) {
                $code = $matches[1];
            }

            return true;
        }));
    $this->app->instance(WhatsAppGateway::class, $gateway);

    $this->postJson('/api/auth/register/request-otp', [
        'phone' => '089900001111',
    ])->assertOk();

    expect($code)->not->toBeNull();

    $response = $this->withHeader('Origin', config('app.url'))
        ->postJson('/api/auth/register/verify', [
            'phone' => '089900001111',
            'code' => $code,
            'business_name' => 'Warung Bu Sri',
            'name' => 'Bu Sri',
        ])->assertOk();

    $response->assertJsonStructure(['token', 'user', 'redirect']);

    $user = User::query()->where('phone', '6289900001111')->firstOrFail();

    expect($user->tenant_id)->not->toBeNull();
    expect($user->hasRole(OutletUserRole::Owner->value))->toBeTrue();
    expect($user->phone_verified_at)->not->toBeNull();
    expect(Tenant::query()->where('name', 'Warung Bu Sri')->exists())->toBeTrue();

    $outlet = Outlet::withoutGlobalScopes()->where('tenant_id', $user->tenant_id)->first();
    expect($outlet)->not->toBeNull();
    expect($outlet->name)->toBe('Warung Bu Sri');
    expect($this->isAuthenticated())->toBeTrue();
});

it('uses a custom outlet name when provided', function () {
    $code = null;
    $gateway = Mockery::mock(WhatsAppGateway::class);
    $gateway->shouldReceive('send')->once()
        ->with('6289900001111', Mockery::on(function ($message) use (&$code) {
            if (preg_match('/Amanah kamu: (\d{6})/', $message, $matches)) {
                $code = $matches[1];
            }

            return true;
        }));
    $this->app->instance(WhatsAppGateway::class, $gateway);

    $this->postJson('/api/auth/register/request-otp', ['phone' => '089900001111'])->assertOk();

    $this->postJson('/api/auth/register/verify', [
        'phone' => '089900001111',
        'code' => $code,
        'business_name' => 'Toko Makmur',
        'name' => 'Pak Budi',
        'outlet_name' => 'Cabang Pasar',
    ])->assertOk();

    $tenant = Tenant::query()->where('name', 'Toko Makmur')->firstOrFail();
    $outlet = Outlet::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
    expect($outlet->name)->toBe('Cabang Pasar');
});

it('rejects registration for an already-registered phone', function () {
    $tenant = Tenant::factory()->create();
    User::factory()->create(['tenant_id' => $tenant->id, 'phone' => '6289900001111']);

    $this->postJson('/api/auth/register/request-otp', [
        'phone' => '089900001111',
    ])->assertStatus(422)->assertJsonValidationErrorFor('phone');
});

it('does not create an account when the OTP is wrong', function () {
    $gateway = Mockery::spy(WhatsAppGateway::class);
    $this->app->instance(WhatsAppGateway::class, $gateway);

    app(OtpService::class)->issue('6289900001111');

    $this->postJson('/api/auth/register/verify', [
        'phone' => '089900001111',
        'code' => '000000',
        'business_name' => 'Warung Gagal',
        'name' => 'Siapa',
    ])->assertStatus(422);

    expect(User::query()->where('phone', '6289900001111')->exists())->toBeFalse();
    expect(Tenant::query()->where('name', 'Warung Gagal')->exists())->toBeFalse();
});
