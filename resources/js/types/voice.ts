export type VoiceParseItem = {
    category_id: number | null;
    name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    confidence: number;
    needs_review: boolean;
};

export type VoiceParsePayment = {
    received: number | null;
    change_due: number;
};

export type VoiceParseData = {
    status: string;
    transcript: string;
    items: VoiceParseItem[];
    total_amount: number;
    payment: VoiceParsePayment;
    confidence: number;
    warnings: string[];
};

export type VoiceParseResponse = {
    data: VoiceParseData;
};

export type VoiceQueueStatus =
    | 'queued'
    | 'waiting_network'
    | 'uploading'
    | 'processing'
    | 'ready'
    | 'needs_review'
    | 'failed';

export type VoiceNote = {
    id: string;
    outletId: number;
    audio: Blob;
    mimeType: string;
    durationMs: number;
    status: VoiceQueueStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    result?: VoiceParseData;
    error?: string;
};

export type VoiceQueueCounts = Record<VoiceQueueStatus, number> & {
    total: number;
};
