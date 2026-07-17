<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Fonnte HTTP gateway for the MVP (PRD §8.2). Swappable for the official
 * WhatsApp Business API later without touching call sites.
 */
class FonnteWhatsAppGateway implements WhatsAppGateway
{
    public function __construct(
        private readonly string $token,
        private readonly string $baseUrl = 'https://api.fonnte.com',
    ) {}

    public function send(string $phone, string $message): void
    {
        $response = Http::withHeaders(['Authorization' => $this->token])
            ->asForm()
            ->post("{$this->baseUrl}/send", [
                'target' => $phone,
                'message' => $message,
            ]);

        if ($response->failed()) {
            throw new RuntimeException(
                "Fonnte send failed with status {$response->status()}: {$response->body()}"
            );
        }
    }
}
