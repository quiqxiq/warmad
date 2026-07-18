<?php

namespace App\Services\Voice;

use Illuminate\Http\UploadedFile;

class MockVoiceParser implements VoiceParserService
{
    /**
     * Parse an audio file and return a mocked structured JSON representing the transaction.
     *
     * @return array<string, mixed>
     */
    public function parse(UploadedFile $audio): array
    {
        return [
            'status' => 'success',
            'transcript' => 'Satu bungkus Rokok Surya 16 dan dua sachet Kopi Kapal Api, bayar tiga puluh lima ribu.',
            'items' => [
                [
                    'name' => 'Rokok Surya 16',
                    'quantity' => 1,
                    'unit' => 'bungkus',
                    'unit_price' => 30000,
                    'total_price' => 30000,
                ],
                [
                    'name' => 'Kopi Kapal Api',
                    'quantity' => 2,
                    'unit' => 'sachet',
                    'unit_price' => 1500,
                    'total_price' => 3000,
                ],
            ],
            'total_amount' => 33000,
            'payment' => [
                'received' => 35000,
                'change_due' => 2000,
            ],
            'confidence' => 0.95,
        ];
    }
}
