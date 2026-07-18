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

export type VoiceNoteSaleState = 'open' | 'claimed' | 'consumed';

export type VoiceNote = {
    id: string;
    outletId: number;
    // Shift active when the note was recorded. Sales derived from this note are
    // attributed to this shift, not whichever shift is active at review time.
    shiftId: number | null;
    audio: Blob;
    mimeType: string;
    durationMs: number;
    status: VoiceQueueStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    result?: VoiceParseData;
    error?: string;
    // Stable UUID for the sale derived from this note, plus a claim lifecycle so
    // a note cannot be submitted twice (e.g. reopened after being held).
    saleUuid?: string;
    saleState?: VoiceNoteSaleState;
};

export type VoiceQueueCounts = Record<VoiceQueueStatus, number> & {
    total: number;
};
