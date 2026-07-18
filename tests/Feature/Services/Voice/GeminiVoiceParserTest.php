<?php

use App\Services\Voice\GeminiVoiceParser;
use App\Services\Voice\VoiceParserUnavailableException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/**
 * Create a fake audio file with actual content so file_get_contents succeeds.
 */
function fakeAudioFile(): UploadedFile
{
    return UploadedFile::fake()->createWithContent(
        'voicenote.webm',
        str_repeat("\x00", 128), // dummy audio bytes
    );
}

it('sends audio to gemini and returns parsed transaction data', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'status' => 'success',
                                    'transcript' => 'Satu bungkus Surya 16, bayar lima puluh ribu.',
                                    'items' => [
                                        [
                                            'name' => 'Surya 16',
                                            'quantity' => 1,
                                            'unit' => 'bungkus',
                                            'unit_price' => 30000,
                                            'total_price' => 30000,
                                            'confidence' => 0.95,
                                            'needs_review' => false,
                                        ],
                                    ],
                                    'total_amount' => 30000,
                                    'payment' => [
                                        'received' => 50000,
                                        'change_due' => 20000,
                                    ],
                                    'confidence' => 0.95,
                                    'warnings' => [],
                                ]),
                            ],
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $result = $parser->parse(fakeAudioFile());

    expect($result)
        ->toHaveKey('status', 'success')
        ->toHaveKey('transcript', 'Satu bungkus Surya 16, bayar lima puluh ribu.')
        ->toHaveKey('total_amount', 30000)
        ->toHaveKey('confidence', 0.95);

    expect($result['items'])->toHaveCount(1);
    expect($result['items'][0])
        ->name->toBe('Surya 16')
        ->quantity->toBe(1)
        ->unit_price->toBe(30000);

    expect($result['payment'])
        ->received->toBe(50000)
        ->change_due->toBe(20000);

    Http::assertSentCount(1);
});

it('normalizes malformed gemini response into valid schema', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'items' => [
                                        [
                                            'name' => 'Es Teh',
                                            'quantity' => 'dua',
                                            'unit_price' => '3000',
                                        ],
                                    ],
                                ]),
                            ],
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $result = $parser->parse(fakeAudioFile());

    // Quantity should be normalized to integer (min 1)
    expect($result['items'][0]['quantity'])->toBe(1);
    // Unit price should be int
    expect($result['items'][0]['unit_price'])->toBe(3000);
    // Status defaults to 'success'
    expect($result['status'])->toBe('success');
    // total_amount is recalculated
    expect($result['total_amount'])->toBe(3000);
    // confidence defaults to 0.5 when not provided per item
    expect($result['items'][0]['confidence'])->toBe(0.5);
});

it('handles null payment received without crashing', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'status' => 'success',
                                    'transcript' => 'Aqua satu',
                                    'items' => [
                                        [
                                            'name' => 'Aqua',
                                            'quantity' => 1,
                                            'unit' => 'botol',
                                            'unit_price' => 3000,
                                            'total_price' => 3000,
                                            'confidence' => 0.9,
                                            'needs_review' => false,
                                        ],
                                    ],
                                    'total_amount' => 3000,
                                    'payment' => [
                                        'received' => null,
                                        'change_due' => 0,
                                    ],
                                    'confidence' => 0.9,
                                    'warnings' => [],
                                ]),
                            ],
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $result = $parser->parse(fakeAudioFile());

    expect($result['payment']['received'])->toBeNull();
    expect($result['payment']['change_due'])->toBe(0);
});

it('throws unavailable exception when gemini api returns an error', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(['error' => 'quota exceeded'], 429),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $parser->parse(fakeAudioFile());
})->throws(VoiceParserUnavailableException::class);

it('throws unavailable exception when api key is empty', function () {
    new GeminiVoiceParser(apiKey: '');
})->throws(VoiceParserUnavailableException::class);

it('returns failed result when gemini response has no text', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            ['text' => ''],
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $result = $parser->parse(fakeAudioFile());

    expect($result['status'])->toBe('failed');
    expect($result['items'])->toBeEmpty();
    expect($result['warnings'])->not->toBeEmpty();
});

it('strips markdown code fences from gemini output', function () {
    $json = json_encode([
        'status' => 'success',
        'transcript' => 'Indomie goreng satu',
        'items' => [
            [
                'name' => 'Indomie Goreng',
                'quantity' => 1,
                'unit' => 'bungkus',
                'unit_price' => 3500,
                'total_price' => 3500,
                'confidence' => 0.9,
                'needs_review' => false,
            ],
        ],
        'total_amount' => 3500,
        'payment' => ['received' => null, 'change_due' => 0],
        'confidence' => 0.9,
        'warnings' => [],
    ]);

    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            ['text' => "```json\n{$json}\n```"],
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $parser = new GeminiVoiceParser(apiKey: 'test-key');
    $result = $parser->parse(fakeAudioFile());

    expect($result['status'])->toBe('success');
    expect($result['items'])->toHaveCount(1);
    expect($result['items'][0]['name'])->toBe('Indomie Goreng');
});
