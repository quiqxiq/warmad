<?php

namespace App\Enums;

enum InputMethod: string
{
    case Scan = 'scan';
    case Voice = 'voice';
    case Manual = 'manual';
}
