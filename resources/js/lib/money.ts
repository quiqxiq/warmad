export {
    formatCompactRupiah,
    formatRupiah,
    getQuickTenderOptions,
    parseCurrencyInput,
    parseCurrencyInput as parseMoney,
} from './currency';

export function getQuickTenderAmounts(total: number): number[] {
    return [total, 10_000, 20_000, 50_000, 100_000];
}
