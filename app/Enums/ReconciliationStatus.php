<?php

namespace App\Enums;

enum ReconciliationStatus: string
{
    case AutoApproved = 'auto_approved';
    case NeedsExplanation = 'needs_explanation';
    case Explained = 'explained';
}
