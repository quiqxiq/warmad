<?php

namespace App\Services\Voice;

use Illuminate\Http\UploadedFile;

/**
 * Fail-closed parser used when no real voice provider is configured.
 * Prevents production from silently falling back to fixture output.
 */
class UnavailableVoiceParser implements VoiceParserService
{
    /**
     * @return array<string, mixed>
     */
    public function parse(UploadedFile $audio): array
    {
        throw new VoiceParserUnavailableException;
    }
}
