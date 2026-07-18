<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Phone-based accounts (PRD §6.1) replace email verification with phone
 * verification. A user reaches the app only after a successful OTP, which sets
 * phone_verified_at and binds them to a tenant.
 */
class EnsurePhoneVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->phone_verified_at === null || $user->tenant_id === null) {
            return $request->expectsJson()
                ? abort(403, 'Nomor belum terverifikasi.')
                : redirect()->route('login');
        }

        return $next($request);
    }
}
