<?php

namespace App\Services\Otp;

enum OtpVerificationResult: string
{
    case Verified = 'verified';
    case Invalid = 'invalid';
    case Expired = 'expired';
    case LockedOut = 'locked_out';
}
