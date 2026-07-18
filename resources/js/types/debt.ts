import type { Outlet } from './outlet';

export type DebtStatus = 'paid' | 'partially_paid' | 'unpaid';

export type Debt = {
    id: number;
    client_uuid?: string;
    outlet_id?: number;
    customer_name: string;
    amount: number;
    paid_amount: number;
    remaining_amount?: number;
    status: DebtStatus;
    incurred_at: string;
    paid_at?: string | null;
    note?: string | null;
    outlet?: Pick<Outlet, 'id' | 'name'> | null;
};
