<?php

namespace App\Enums;

enum SubscriptionTier: string
{
    case Free = 'free';
    case Standard = 'standard';
    case Pro = 'pro';
}
