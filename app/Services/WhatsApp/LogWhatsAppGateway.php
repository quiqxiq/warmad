<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Log;

/**
 * Development gateway: writes the message to the application log instead
 * of sending a real WhatsApp message.
 */
class LogWhatsAppGateway implements WhatsAppGateway
{
    public function send(string $phone, string $message): void
    {
        Log::info('WhatsApp message (log driver)', [
            'phone' => $phone,
            'message' => $message,
        ]);
    }
}
