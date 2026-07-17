<?php

use App\Enums\DebtStatus;
use App\Enums\OpnameSessionStatus;
use App\Enums\ReconciliationStatus;
use App\Jobs\SendDailyOwnerReportJob;
use App\Models\CashReconciliation;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\StockOpnameSession;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Reports\DailyOwnerReport;
use App\Services\WhatsApp\WhatsAppGateway;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create([
        'name' => 'Toko Barokah',
        'phone' => '6289999999999',
    ]);

    $this->outlet = Outlet::factory()->create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cabang Pusat',
    ]);

    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->category = Category::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
    ]);
});

it('generates a daily report with correct calculations', function () {
    $date = Carbon::parse('2026-07-17');

    $shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->user->id,
    ]);

    // 1. Create transactions for the target date
    Transaction::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $shift->id,
        'category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'quantity' => 2,
        'unit_price' => 15000,
        'total_amount' => 30000,
        'occurred_at' => $date->copy()->hour(10),
    ]);

    Transaction::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $shift->id,
        'category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'quantity' => 1,
        'unit_price' => 20000,
        'total_amount' => 20000,
        'occurred_at' => $date->copy()->hour(14),
    ]);

    // Transaction on another day (should not be counted)
    Transaction::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $shift->id,
        'category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'quantity' => 1,
        'unit_price' => 50000,
        'total_amount' => 50000,
        'occurred_at' => $date->copy()->subDay(),
    ]);

    // 2. Create cash reconciliation with a difference
    CashReconciliation::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $shift->id,
        'expected_cash' => 50000,
        'actual_cash' => 45000,
        'difference' => -5000,
        'status' => ReconciliationStatus::Explained,
        'reconciled_at' => $date->copy()->hour(20),
    ]);

    // 3. Create debts
    // New debt today
    Debt::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'amount' => 15000,
        'paid_amount' => 0,
        'status' => DebtStatus::Unpaid,
        'incurred_at' => $date,
        'created_by' => $this->user->id,
    ]);

    // Old unpaid debt (should be included in total unpaid but not today's new)
    Debt::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'amount' => 25000,
        'paid_amount' => 5000,
        'status' => DebtStatus::PartiallyPaid,
        'incurred_at' => $date->copy()->subDays(5),
        'created_by' => $this->user->id,
    ]);

    // 4. Create active stock opname session
    StockOpnameSession::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'status' => OpnameSessionStatus::Draft,
        'created_by' => $this->user->id,
    ]);

    // Generate the report
    $reportService = new DailyOwnerReport;
    $message = $reportService->generate($this->tenant, $date);

    // Verify output contents
    expect($message)->toContain('*LAPORAN HARIAN JURAGAN*')
        ->toContain('Toko Barokah')
        ->toContain('Cabang Pusat')
        ->toContain('Omzet: Rp 50.000') // 30k + 20k
        ->toContain('2 transaksi')
        ->toContain('Selisih Kas: Minus Rp 5.000')
        ->toContain('Bon Baru Hari Ini: Rp 15.000')
        ->toContain('Sisa Bon Belum Lunas: Rp 35.000') // 15k + (25k - 5k)
        ->toContain('Ada 1 sesi aktif/draft');
});

it('job dispatches and sends message via WhatsAppGateway', function () {
    $mockGateway = Mockery::mock(WhatsAppGateway::class);
    $mockGateway->shouldReceive('send')
        ->once()
        ->with('6289999999999', Mockery::on(function ($message) {
            return str_contains($message, '*LAPORAN HARIAN JURAGAN*') && str_contains($message, 'Toko Barokah');
        }));

    $this->app->instance(WhatsAppGateway::class, $mockGateway);

    $job = new SendDailyOwnerReportJob($this->tenant, now());
    $this->app->call([$job, 'handle']);
});
