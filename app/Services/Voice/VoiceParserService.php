<?php

namespace App\Services\Voice;

use Illuminate\Http\UploadedFile;

interface VoiceParserService
{
    /**
     * Parse an audio file and return a structured JSON representing the transaction.
     *
     * @return array<string, mixed>
     */
    public function parse(UploadedFile $audio): array;
}
