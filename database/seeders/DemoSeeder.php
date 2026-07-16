<?php

namespace Database\Seeders;

use App\Enums\OutletUserRole;
use App\Enums\ReconciliationStatus;
use App\Models\CashReconciliation;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\StockOpnameItem;
use App\Models\StockOpnameSession;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    /**
     * Default category buttons for a new outlet (PRD §6.3).
     *
     * @var list<array{name: string, default_price: int}>
     */
    private const array DEFAULT_CATEGORIES = [
        ['name' => 'Rokok', 'default_price' => 30_000],
        ['name' => 'Sembako', 'default_price' => 15_000],
        ['name' => 'Minuman Dingin', 'default_price' => 5_000],
        ['name' => 'Minuman Panas', 'default_price' => 5_000],
        ['name' => 'Snack', 'default_price' => 2_000],
        ['name' => 'Pulsa/PPOB', 'default_price' => 12_000],
        ['name' => 'Bensin Eceran', 'default_price' => 12_000],
        ['name' => 'Gas LPG', 'default_price' => 23_000],
        ['name' => 'Lain-lain', 'default_price' => 5_000],
    ];

    /**
     * Seed a demo tenant with one outlet and a full day of activity.
     */
    public function run(): void
    {
        $tenant = Tenant::factory()->create([
            'name' => 'Juragan Demo',
            'phone' => '+6281234567890',
        ]);

        Subscription::factory()->standard()->create(['tenant_id' => $tenant->id]);

        $owner = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Juragan Demo',
            'email' => 'juragan@example.com',
            'phone' => '+6281234567890',
        ]);
        $owner->assignRole(OutletUserRole::Owner->value);

        $penjaga = User::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Penjaga Demo',
            'email' => 'penjaga@example.com',
            'phone' => '+6281234567891',
        ]);
        $penjaga->assignRole(OutletUserRole::Penjaga->value);

        $outlet = Outlet::factory()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Warung Demo 24 Jam',
        ]);

        $outlet->users()->attach($owner, ['role' => OutletUserRole::Owner->value]);
        $outlet->users()->attach($penjaga, ['role' => OutletUserRole::Penjaga->value]);

        $categories = collect(self::DEFAULT_CATEGORIES)
            ->map(fn (array $category, int $index) => Category::factory()->create([
                'tenant_id' => $tenant->id,
                'outlet_id' => $outlet->id,
                'name' => $category['name'],
                'default_price' => $category['default_price'],
                'position' => $index,
            ]));

        $shift = Shift::factory()->closed()->create([
            'tenant_id' => $tenant->id,
            'outlet_id' => $outlet->id,
            'user_id' => $penjaga->id,
            'started_at' => now()->subHours(12),
        ]);

        $transactions = Transaction::factory()
            ->count(25)
            ->create([
                'tenant_id' => $tenant->id,
                'outlet_id' => $outlet->id,
                'shift_id' => $shift->id,
                'user_id' => $penjaga->id,
                'category_id' => fn () => $categories->random()->id,
            ]);

        $expectedCash = $shift->opening_cash + (int) $transactions->sum('total_amount');

        CashReconciliation::factory()->create([
            'tenant_id' => $tenant->id,
            'outlet_id' => $outlet->id,
            'shift_id' => $shift->id,
            'expected_cash' => $expectedCash,
            'actual_cash' => $expectedCash - 5_000,
            'difference' => -5_000,
            'status' => ReconciliationStatus::AutoApproved,
            'created_by' => $penjaga->id,
        ]);

        Debt::factory()->count(3)->create([
            'tenant_id' => $tenant->id,
            'outlet_id' => $outlet->id,
            'created_by' => $penjaga->id,
        ]);

        StockOpnameSession::factory()
            ->finalized()
            ->has(
                StockOpnameItem::factory()
                    ->count(15)
                    ->state(['counted_by' => $penjaga->id]),
                'items'
            )
            ->create([
                'tenant_id' => $tenant->id,
                'outlet_id' => $outlet->id,
                'incoming_user_id' => $penjaga->id,
                'created_by' => $owner->id,
            ]);
    }
}
