<?php

use App\Models\Tenant;
use App\Models\User;
use App\Services\Otp\OtpVerificationResult;
use App\Services\WhatsApp\WhatsAppGateway;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    RateLimiter::clear('otp-request:phone:6281234567890');
    RateLimiter::clear('otp-request:ip:127.0.0.1');

    $this->tenant = Tenant::factory()->create();
    $this->user = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'phone' => '6281234567890',
        'phone_verified_at' => null,
    ]);
});

it('can request and verify OTP successfully', function () {
    $code = null;
    $mockGateway = Mockery::mock(WhatsAppGateway::class);
    $mockGateway->shouldReceive('send')
        ->once()
        ->with('6281234567890', Mockery::on(function ($message) use (&$code) {
            if (preg_match('/Amanah kamu: (\d{6})/', $message, $matches)) {
                $code = $matches[1];
            }

            return true;
        }));

    $this->app->instance(WhatsAppGateway::class, $mockGateway);

    // 1. Request OTP
    $this->postJson('/api/auth/otp/request', [
        'phone' => '081234567890',
    ])->assertOk();

    expect($code)->not->toBeNull();

    // 2. Verify OTP
    $response = $this->postJson('/api/auth/otp/verify', [
        'phone' => '081234567890',
        'code' => $code,
    ])->assertOk();

    $response->assertJsonStructure(['token', 'user']);
    expect($this->user->fresh()->phone_verified_at)->not->toBeNull();
});

it('rejects expired OTP', function () {
    $code = null;
    $mockGateway = Mockery::spy(WhatsAppGateway::class);
    $mockGateway->shouldReceive('send')
        ->with('6281234567890', Mockery::on(function ($message) use (&$code) {
            if (preg_match('/Amanah kamu: (\d{6})/', $message, $matches)) {
                $code = $matches[1];
            }

            return true;
        }));

    $this->app->instance(WhatsAppGateway::class, $mockGateway);

    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertOk();

    // Move time forward by 6 minutes
    Carbon::setTestNow(now()->addMinutes(6));

    $this->postJson('/api/auth/otp/verify', [
        'phone' => '081234567890',
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('result', OtpVerificationResult::Expired->value);

    Carbon::setTestNow(); // Reset time
});

it('locks out after 5 failed attempts', function () {
    $code = null;
    $mockGateway = Mockery::spy(WhatsAppGateway::class);
    $mockGateway->shouldReceive('send')
        ->with('6281234567890', Mockery::on(function ($message) use (&$code) {
            if (preg_match('/Amanah kamu: (\d{6})/', $message, $matches)) {
                $code = $matches[1];
            }

            return true;
        }));

    $this->app->instance(WhatsAppGateway::class, $mockGateway);

    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertOk();

    $wrongCode = '999999';
    if ($wrongCode === $code) {
        $wrongCode = '111111';
    }

    // First 4 failed attempts should return Invalid
    for ($i = 0; $i < 4; $i++) {
        $this->postJson('/api/auth/otp/verify', [
            'phone' => '081234567890',
            'code' => $wrongCode,
        ])->assertStatus(422)
            ->assertJsonPath('result', OtpVerificationResult::Invalid->value);
    }

    // 5th failed attempt should trigger LockedOut
    $this->postJson('/api/auth/otp/verify', [
        'phone' => '081234567890',
        'code' => $wrongCode,
    ])->assertStatus(422)
        ->assertJsonPath('result', OtpVerificationResult::LockedOut->value);

    // Trying correct code now should still result in LockedOut
    $this->postJson('/api/auth/otp/verify', [
        'phone' => '081234567890',
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('result', OtpVerificationResult::LockedOut->value);
});

it('rate limits OTP requests', function () {
    $mockGateway = Mockery::spy(WhatsAppGateway::class);
    $this->app->instance(WhatsAppGateway::class, $mockGateway);

    // Request 1, 2, 3 - Success
    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertOk();
    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertOk();
    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertOk();

    // Request 4 - Rate limited (429)
    $this->postJson('/api/auth/otp/request', ['phone' => '081234567890'])->assertStatus(429);
});
