<?php

namespace App\Http\Controllers\Api\Auth;

use App\Actions\Auth\RegisterOwner;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Otp\OtpService;
use App\Services\Otp\OtpVerificationResult;
use App\Services\WhatsApp\WhatsAppGateway;
use App\Support\HomeRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Owner self-signup via phone + WhatsApp OTP (PRD §6.1). Penjaga never reach
 * this flow — their owner creates them from inside the app.
 */
class RegisterController extends Controller
{
    /**
     * Indonesian phone numbers in local (08…) or international (628…) form.
     */
    private const string PHONE_PATTERN = '/^(08|628)\d{7,12}$/';

    public function __construct(
        private readonly OtpService $otpService,
        private readonly WhatsAppGateway $whatsAppGateway,
        private readonly RegisterOwner $registerOwner,
    ) {}

    /**
     * Send an OTP for a NEW owner. Unlike login, the phone must not already
     * belong to a user, and we surface that conflict directly since the caller
     * is trying to create an account, not authenticate.
     */
    public function requestOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:'.self::PHONE_PATTERN],
        ]);

        $phone = $this->normalizePhone($validated['phone']);

        if (User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => 'Nomor ini sudah terdaftar. Silakan masuk.',
            ]);
        }

        $phoneKey = "otp-request:phone:{$phone}";
        $ipKey = "otp-request:ip:{$request->ip()}";

        if (RateLimiter::tooManyAttempts($phoneKey, 3) || RateLimiter::tooManyAttempts($ipKey, 10)) {
            $seconds = max(RateLimiter::availableIn($phoneKey), RateLimiter::availableIn($ipKey));

            return response()->json([
                'message' => "Terlalu banyak permintaan OTP. Coba lagi dalam {$seconds} detik.",
            ], 429);
        }

        RateLimiter::hit($phoneKey, 300);
        RateLimiter::hit($ipKey, 300);

        $code = $this->otpService->issue($phone);

        $this->whatsAppGateway->send(
            $phone,
            "Kode OTP Amanah kamu: {$code}. Berlaku 5 menit. Jangan bagikan ke siapa pun.",
        );

        return response()->json([
            'message' => 'Kode OTP telah dikirim via WhatsApp.',
        ]);
    }

    /**
     * Verify the OTP, create the owner + tenant + first outlet, and log in.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:'.self::PHONE_PATTERN],
            'code' => ['required', 'digits:6'],
            'business_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'outlet_name' => ['nullable', 'string', 'max:255'],
        ]);

        $phone = $this->normalizePhone($validated['phone']);

        if (User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => 'Nomor ini sudah terdaftar. Silakan masuk.',
            ]);
        }

        $result = $this->otpService->verify($phone, $validated['code']);

        if ($result !== OtpVerificationResult::Verified) {
            return response()->json([
                'message' => match ($result) {
                    OtpVerificationResult::Expired => 'Kode OTP kedaluwarsa. Minta kode baru.',
                    OtpVerificationResult::LockedOut => 'Terlalu banyak percobaan salah. Minta kode baru.',
                    default => 'Kode OTP salah.',
                },
                'result' => $result->value,
            ], 422);
        }

        $user = $this->registerOwner->create([
            'business_name' => $validated['business_name'],
            'name' => $validated['name'],
            'phone' => $phone,
            'outlet_name' => $validated['outlet_name'] ?? null,
        ]);

        if ($request->hasSession()) {
            Auth::login($user, remember: true);
            $request->session()->regenerate();
        }

        $token = $user->createToken('owner-signup');

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $user,
            'redirect' => HomeRoute::for($user),
        ]);
    }

    /**
     * Normalize 08xxxx to 628xxxx so lookups and delivery use one format.
     */
    private function normalizePhone(string $phone): string
    {
        return str_starts_with($phone, '08')
            ? '62'.substr($phone, 1)
            : $phone;
    }
}
