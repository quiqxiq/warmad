<?php

namespace App\Services\Voice;

use RuntimeException;

class VoiceParserUnavailableException extends RuntimeException
{
    public function __construct(string $message = 'Layanan pemrosesan suara belum tersedia. Coba lagi nanti.')
    {
        parent::__construct($message);
    }
}
