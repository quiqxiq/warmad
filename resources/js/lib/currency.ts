const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const compactRupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
});

export type QuickTenderOption = {
    label: string;
    amount: number;
};

export function formatRupiah(value: number): string {
    return rupiahFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatCompactRupiah(value: number): string {
    return compactRupiahFormatter.format(Number.isFinite(value) ? value : 0);
}

export function parseCurrencyInput(value: string): number {
    const digits = value.replace(/[^\d]/g, '');

    return digits === '' ? 0 : Number(digits);
}

export function getQuickTenderOptions(total: number): QuickTenderOption[] {
    return [
        { label: 'Uang pas', amount: Math.max(0, total) },
        { label: 'Rp10 rb', amount: 10_000 },
        { label: 'Rp20 rb', amount: 20_000 },
        { label: 'Rp50 rb', amount: 50_000 },
        { label: 'Rp100 rb', amount: 100_000 },
    ];
}
