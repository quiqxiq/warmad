<?php

namespace App\Services\WhatsApp;

interface WhatsAppGateway
{
    /**
     * Send a WhatsApp message to a phone number in E.164-ish local format
     * (e.g. "628123456789").
     */
    public function send(string $phone, string $message): void;
}
