export type InputMethod = 'voice' | 'manual';
export type PaymentMode = 'cash' | 'debt' | 'hold';
export type ShiftStatus = 'active' | 'open' | 'closed' | 'cancelled';

export type Outlet = {
    id: number;
    name: string;
    address: string | null;
    is_active: boolean;
};

export type Category = {
    id: number;
    outlet_id: number;
    name: string;
    default_price: number;
    icon: string | null;
    position: number;
    is_active: boolean;
};

export type Shift = {
    id: number;
    outlet_id: number;
    user_id: number;
    status: ShiftStatus;
    opening_cash: number;
    started_at: string;
    ended_at: string | null;
};

export type CashierStats = {
    transaction_count: number;
    total_sales: number;
    outstanding_debt_count: number;
    outstanding_debt_amount: number;
};

export type CartItem = {
    id: string;
    category_id: number | null;
    name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    confidence?: number;
    needs_review?: boolean;
};

export type SaleDraft = {
    clientUuid: string;
    items: CartItem[];
    inputMethod: InputMethod;
    paymentMode: PaymentMode;
    paymentAmount: number;
    customerName: string;
    note: string;
    occurredAt: string;
    sourceVoiceNoteId?: string;
};

export type BatchTransactionItem = {
    category_id: number;
    quantity: number;
    unit_price: number;
};

export type BatchTransactionPayload = {
    client_uuid: string;
    outlet_id: number;
    shift_id: number;
    items: BatchTransactionItem[];
    payment_amount: number;
    customer_name: string | null;
    input_method: InputMethod;
    note: string | null;
    occurred_at: string;
};

export type CashierPageProps = {
    outlets: Outlet[];
    selectedOutlet: Outlet | null;
    categories: Category[];
    activeShift: Shift | null;
    stats: CashierStats;
};
