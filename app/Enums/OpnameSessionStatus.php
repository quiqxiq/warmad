<?php

namespace App\Enums;

enum OpnameSessionStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case PendingConfirmation = 'pending_confirmation';
    case Final = 'final';
}
