<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Otp\OtpService;
use App\Services\Otp\OtpVerificationResult;
use App\Services\WhatsApp\WhatsAppGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class OtpController extends Controller
{
    /**
     * Indonesian phone numbers in local (08…) or international (628…) form.
     */
    private const string PHONE_PATTERN = '/^(08|628)\d{7,12}$/';

    public function __construct(
        private readonly OtpService $otpService,
        private readonly WhatsAppGateway $whatsAppGateway,
    ) {}

    /**
     * Request an OTP to be sent to the phone via WhatsApp. Heavily rate
     * limited per phone and per IP (PRD §6.1).
     */
    public function request(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:'.self::PHONE_PATTERN],
        ]);

        $phone = $this->normalizePhone($validated['phone']);

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

        // Do not reveal whether the phone is registered — always respond OK.
        if (User::query()->where('phone', $phone)->exists()) {
            $code = $this->otpService->issue($phone);

            $this->whatsAppGateway->send(
                $phone,
                "Kode OTP Amanah kamu: {$code}. Berlaku 5 menit. Jangan bagikan ke siapa pun.",
            );
        }

        return response()->json([
            'message' => 'Jika nomor terdaftar, kode OTP telah dikirim via WhatsApp.',
        ]);
    }

    /**
     * Verify the OTP and issue a Sanctum token for the PWA/dashboard.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:'.self::PHONE_PATTERN],
            'code' => ['required', 'digits:6'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $phone = $this->normalizePhone($validated['phone']);

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

        $user = User::query()->where('phone', $phone)->firstOrFail();

        if ($user->phone_verified_at === null) {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }

        $token = $user->createToken($validated['device_name'] ?? 'otp-login');

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $user,
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
