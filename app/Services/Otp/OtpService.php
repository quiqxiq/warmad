<?php

namespace App\Services\Otp;

use App\Models\OtpCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Issues and verifies one-time passwords for phone-based login (PRD §6.1).
 */
class OtpService
{
    private const int CODE_LENGTH = 6;

    private const int EXPIRY_MINUTES = 5;

    private const int MAX_ATTEMPTS = 5;

    /**
     * Generate a fresh OTP for the phone, invalidating previous ones.
     * Returns the plain code so the caller can deliver it — it is never
     * stored unhashed.
     */
    public function issue(string $phone): string
    {
        $plainCode = str_pad((string) random_int(0, 999_999), self::CODE_LENGTH, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($phone, $plainCode) {
            OtpCode::query()
                ->where('phone', $phone)
                ->whereNull('consumed_at')
                ->delete();

            OtpCode::create([
                'phone' => $phone,
                'code' => Hash::make($plainCode),
                'expires_at' => now()->addMinutes(self::EXPIRY_MINUTES),
            ]);
        });

        return $plainCode;
    }

    /**
     * Verify a submitted code. Consumes the OTP on success; increments the
     * attempt counter on failure and locks after MAX_ATTEMPTS.
     */
    public function verify(string $phone, string $code): OtpVerificationResult
    {
        $otp = OtpCode::query()
            ->where('phone', $phone)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if ($otp === null || $otp->isExpired()) {
            return OtpVerificationResult::Expired;
        }

        if ($otp->attempts >= self::MAX_ATTEMPTS) {
            return OtpVerificationResult::LockedOut;
        }

        if (! Hash::check($code, $otp->code)) {
            $otp->increment('attempts');

            return $otp->attempts >= self::MAX_ATTEMPTS
                ? OtpVerificationResult::LockedOut
                : OtpVerificationResult::Invalid;
        }

        $otp->update(['consumed_at' => now()]);

        return OtpVerificationResult::Verified;
    }
}
