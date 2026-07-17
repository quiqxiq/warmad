<?php

namespace App\Services\Reports;

use App\Enums\DebtStatus;
use App\Enums\OpnameSessionStatus;
use App\Models\Tenant;
use Carbon\CarbonInterface;

class DailyOwnerReport
{
    /**
     * Generate daily report message for a tenant on a specific date.
     */
    public function generate(Tenant $tenant, CarbonInterface $date): string
    {
        $dateStr = $date->translatedFormat('d F Y');

        $message = "*LAPORAN HARIAN JURAGAN*\n";
        $message .= "============================\n";
        $message .= "Tanggal: {$dateStr}\n";
        $message .= "Tenant: *{$tenant->name}*\n";
        $message .= "============================\n\n";

        $outlets = $tenant->outlets()->withoutGlobalScope('tenant')->get();

        if ($outlets->isEmpty()) {
            $message .= "Belum ada outlet terdaftar untuk tenant ini.\n";

            return $message;
        }

        foreach ($outlets as $outlet) {
            $message .= "• *Outlet: {$outlet->name}*\n";

            // 1 & 2. Omzet & Jumlah Transaksi
            $transactions = $outlet->transactions()
                ->withoutGlobalScope('tenant')
                ->whereDate('occurred_at', $date)
                ->get();

            $omzet = (int) $transactions->sum('total_amount');
            $transactionCount = $transactions->count();

            $message .= '  - Omzet: Rp '.number_format($omzet, 0, ',', '.')." ({$transactionCount} transaksi)\n";

            // 3. Selisih Kas (dari CashReconciliation harian)
            $reconciliations = $outlet->cashReconciliations()
                ->withoutGlobalScope('tenant')
                ->whereDate('reconciled_at', $date)
                ->get();

            if ($reconciliations->isEmpty()) {
                $message .= "  - Selisih Kas: Belum tutup kasir\n";
            } else {
                $totalDifference = (int) $reconciliations->sum('difference');
                $diffText = $totalDifference === 0
                    ? 'Aman (Pas)'
                    : ($totalDifference > 0 ? 'Surplus Rp '.number_format($totalDifference, 0, ',', '.') : 'Minus Rp '.number_format(abs($totalDifference), 0, ',', '.'));

                $message .= "  - Selisih Kas: {$diffText}\n";
            }

            // 4. Bon Baru & Total Bon Belum Lunas
            $newDebts = (int) $outlet->debts()
                ->withoutGlobalScope('tenant')
                ->whereDate('incurred_at', $date)
                ->sum('amount');

            $unpaidDebts = (int) $outlet->debts()
                ->withoutGlobalScope('tenant')
                ->whereIn('status', [DebtStatus::Unpaid, DebtStatus::PartiallyPaid])
                ->get()
                ->sum(fn ($debt) => $debt->amount - $debt->paid_amount);

            $message .= '  - Bon Baru Hari Ini: Rp '.number_format($newDebts, 0, ',', '.')."\n";
            $message .= '  - Sisa Bon Belum Lunas: Rp '.number_format($unpaidDebts, 0, ',', '.')."\n";

            // 5. Status Opname Berjalan
            $activeSessionsCount = $outlet->stockOpnameSessions()
                ->withoutGlobalScope('tenant')
                ->whereIn('status', [
                    OpnameSessionStatus::Draft,
                    OpnameSessionStatus::InProgress,
                    OpnameSessionStatus::PendingConfirmation,
                ])
                ->count();

            $opnameText = $activeSessionsCount > 0
                ? "Ada {$activeSessionsCount} sesi aktif/draft"
                : 'Tidak ada sesi aktif';

            $message .= "  - Status Opname: {$opnameText}\n\n";
        }

        $message .= 'Laporan digenerate otomatis oleh sistem Amanah.';

        return $message;
    }
}
