<?php

namespace App\Services\Voice;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Voice parser powered by Google Gemini (multimodal LLM).
 *
 * Sends audio inline (base64) to the Gemini generateContent endpoint with a
 * structured prompt that asks the model to transcribe the recording and extract
 * warung transaction items, quantities, prices, and payment information.
 *
 * The model is instructed to return JSON matching the exact schema consumed by
 * VoiceParserController::augmentItem(), so the controller can category-match
 * and enrich items transparently.
 */
class GeminiVoiceParser implements VoiceParserService
{
    /**
     * Gemini REST API base URL.
     */
    private const string API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    /**
     * Map browser-originated MIME types to Gemini-supported equivalents.
     * Gemini accepts audio/* types directly; video/webm and video/ogg are
     * sometimes sent by MediaRecorder but contain audio-only streams.
     *
     * @var array<string, string>
     */
    private const array MIME_MAP = [
        'video/webm' => 'audio/webm',
        'video/ogg' => 'audio/ogg',
        'application/ogg' => 'audio/ogg',
        'audio/x-wav' => 'audio/wav',
        'audio/wave' => 'audio/wav',
    ];

    public function __construct(
        private readonly string $apiKey,
        private readonly string $model = 'gemini-2.0-flash',
    ) {
        if ($this->apiKey === '') {
            throw new VoiceParserUnavailableException(
                'Kunci API Gemini belum dikonfigurasi (GEMINI_API_KEY kosong).',
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function parse(UploadedFile $audio): array
    {
        $base64Audio = base64_encode(
            file_get_contents($audio->getRealPath()) ?: throw new RuntimeException('Gagal membaca file audio.'),
        );

        $mimeType = $this->normalizeMimeType($audio->getMimeType() ?? 'audio/webm');

        $response = Http::timeout(60)
            ->connectTimeout(15)
            ->retry(2, 1000, throw: false)
            ->withHeader('Content-Type', 'application/json')
            ->post($this->endpoint(), [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $this->buildPrompt()],
                            [
                                'inline_data' => [
                                    'mime_type' => $mimeType,
                                    'data' => $base64Audio,
                                ],
                            ],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.1,
                ],
            ]);

        if ($response->failed()) {
            Log::error('Gemini voice parse request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new VoiceParserUnavailableException(
                'Layanan pemrosesan suara sedang tidak tersedia. Coba lagi nanti.',
            );
        }

        return $this->extractResult($response->json());
    }

    /**
     * Build the Gemini API endpoint URL.
     */
    private function endpoint(): string
    {
        return sprintf(
            '%s/%s:generateContent?key=%s',
            self::API_BASE,
            $this->model,
            $this->apiKey,
        );
    }

    /**
     * Normalize browser MIME types to Gemini-compatible audio types.
     */
    private function normalizeMimeType(string $mimeType): string
    {
        return self::MIME_MAP[$mimeType] ?? $mimeType;
    }

    /**
     * Build the system prompt for warung transaction parsing.
     *
     * The prompt is in Bahasa Indonesia to match the audio language and uses
     * explicit JSON schema instructions so Gemini returns structured data that
     * maps directly to the frontend VoiceParseData type.
     */
    private function buildPrompt(): string
    {
        return <<<'PROMPT'
Kamu adalah asisten kasir warung Madura. Tugasmu mendengarkan rekaman suara penjaga warung yang menyebutkan belanjaan pembeli, lalu mengekstrak data transaksi dalam format JSON yang terstruktur.

ATURAN:
1. Transkripsikan audio ke teks Bahasa Indonesia terlebih dahulu.
2. Dari transkrip, ekstrak setiap item belanjaan beserta jumlah, satuan, dan harga satuan.
3. Jika penjaga menyebutkan nominal pembayaran (misal "bayar lima puluh ribu"), masukkan ke field payment.received.
4. Jika nominal pembayaran TIDAK disebutkan, isi payment.received dengan null.
5. Harga harus dalam Rupiah (bilangan bulat, tanpa desimal).
6. Jumlah (quantity) harus bilangan bulat positif minimal 1.
7. Jika ada item yang tidak jelas atau kamu tidak yakin, tetap masukkan tapi beri confidence rendah dan needs_review: true.
8. Kalau audio tidak bisa didengar atau bukan percakapan belanja, kembalikan status "failed" dengan items kosong.

FORMAT OUTPUT (JSON ketat, tanpa komentar):
{
  "status": "success" atau "failed",
  "transcript": "teks transkrip lengkap dari audio",
  "items": [
    {
      "name": "nama produk/barang",
      "quantity": 1,
      "unit": "satuan (bungkus/botol/sachet/liter/buah/pcs/item)",
      "unit_price": 15000,
      "total_price": 15000,
      "confidence": 0.95,
      "needs_review": false
    }
  ],
  "total_amount": 15000,
  "payment": {
    "received": 20000,
    "change_due": 5000
  },
  "confidence": 0.9,
  "warnings": []
}

CATATAN PENTING:
- "confidence" per item: 0.0–1.0, seberapa yakin kamu mengenali item tersebut.
- "confidence" global: rata-rata confidence semua item.
- Jika ada kata yang ambigu atau tidak jelas, isi warnings dengan penjelasan singkat.
- total_amount = jumlah semua total_price dari items.
- change_due = received - total_amount (jika received >= total_amount), atau 0 jika belum bayar.
- Untuk rokok, sebutkan merek lengkap jika terdengar (misal "Surya 16", "Sampoerna Mild", "Gudang Garam Filter").
- Untuk minuman, bedakan dingin/panas jika disebutkan.
- Istilah lokal: "ketengan" = eceran/batangan, "sachet" = kemasan kecil, "bungkus" = pak.
PROMPT;
    }

    /**
     * Extract the parsed transaction data from the Gemini API response.
     *
     * @param  array<string, mixed>|null  $response
     * @return array<string, mixed>
     */
    private function extractResult(?array $response): array
    {
        $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! is_string($text) || $text === '') {
            Log::warning('Gemini returned empty or unexpected response structure', [
                'response' => $response,
            ]);

            return $this->failedResult('Tidak ada hasil dari pemrosesan suara.');
        }

        // Strip markdown code fences if the model wraps JSON in ```json ... ```
        $text = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', $text) ?? $text;
        $text = trim($text);

        /** @var array<string, mixed>|null $parsed */
        $parsed = json_decode($text, true);

        if (! is_array($parsed)) {
            Log::warning('Gemini returned non-JSON text', ['text' => $text]);

            return $this->failedResult('Hasil pemrosesan suara tidak dapat dibaca.');
        }

        return $this->normalizeResult($parsed);
    }

    /**
     * Normalize and sanitize the parsed result to match the expected schema.
     *
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function normalizeResult(array $result): array
    {
        $items = is_array($result['items'] ?? null) ? $result['items'] : [];
        $normalizedItems = [];
        $totalAmount = 0;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            $unitPrice = max(0, (int) ($item['unit_price'] ?? 0));
            $itemTotal = $quantity * $unitPrice;
            $totalAmount += $itemTotal;

            $normalizedItems[] = [
                'name' => is_string($item['name'] ?? null) ? $item['name'] : 'Item tidak diketahui',
                'quantity' => $quantity,
                'unit' => is_string($item['unit'] ?? null) ? $item['unit'] : 'item',
                'unit_price' => $unitPrice,
                'total_price' => $itemTotal,
                'confidence' => is_numeric($item['confidence'] ?? null)
                    ? round(min(1.0, max(0.0, (float) $item['confidence'])), 2)
                    : 0.5,
                'needs_review' => (bool) ($item['needs_review'] ?? false),
            ];
        }

        $payment = is_array($result['payment'] ?? null) ? $result['payment'] : [];
        $received = isset($payment['received']) && is_numeric($payment['received'])
            ? (int) $payment['received']
            : null;
        $changeDue = $received !== null
            ? max(0, $received - $totalAmount)
            : 0;

        return [
            'status' => is_string($result['status'] ?? null) ? $result['status'] : 'success',
            'transcript' => is_string($result['transcript'] ?? null) ? $result['transcript'] : '',
            'items' => $normalizedItems,
            'total_amount' => $totalAmount,
            'payment' => [
                'received' => $received,
                'change_due' => $changeDue,
            ],
            'confidence' => is_numeric($result['confidence'] ?? null)
                ? round(min(1.0, max(0.0, (float) $result['confidence'])), 2)
                : ($normalizedItems !== [] ? 0.8 : 0.0),
            'warnings' => is_array($result['warnings'] ?? null) ? array_values($result['warnings']) : [],
        ];
    }

    /**
     * Return a standardized failure result.
     *
     * @return array<string, mixed>
     */
    private function failedResult(string $warning): array
    {
        return [
            'status' => 'failed',
            'transcript' => '',
            'items' => [],
            'total_amount' => 0,
            'payment' => [
                'received' => null,
                'change_due' => 0,
            ],
            'confidence' => 0.0,
            'warnings' => [$warning],
        ];
    }
}
