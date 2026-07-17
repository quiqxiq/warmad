<?php

use App\Enums\InputMethod;
use App\Enums\OpnameSessionStatus;
use App\Enums\OpnameSessionType;
use App\Enums\ReconciliationStatus;
use App\Models\AuditLog;
use App\Models\CashReconciliation;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\StockOpnameItem;
use App\Models\StockOpnameSession;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);

    Sanctum::actingAs($this->user);
});

it('creates an audit log when cash reconciliation is created', function () {
    $shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->user->id,
    ]);

    $reconciliation = CashReconciliation::create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $shift->id,
        'expected_cash' => 10000,
        'actual_cash' => 10000,
        'difference' => 0,
        'status' => ReconciliationStatus::AutoApproved,
        'created_by' => $this->user->id,
        'reconciled_at' => now(),
    ]);

    $this->assertDatabaseHas('audit_logs', [
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id,
        'auditable_type' => CashReconciliation::class,
        'auditable_id' => $reconciliation->id,
        'action' => 'created',
    ]);

    $log = AuditLog::where('auditable_id', $reconciliation->id)->first();
    expect($log->old_values)->toBeNull()
        ->and($log->new_values['actual_cash'])->toBe(10000);
});

it('creates an audit log when stock opname session is updated', function () {
    $session = StockOpnameSession::create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'type' => OpnameSessionType::Handover,
        'status' => OpnameSessionStatus::Draft,
        'incoming_user_id' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    // Clear initial "created" audit log to focus on "updated"
    AuditLog::truncate();

    $session->update([
        'note' => 'Catatan diperbarui',
        'status' => OpnameSessionStatus::InProgress,
    ]);

    $this->assertDatabaseHas('audit_logs', [
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id,
        'auditable_type' => StockOpnameSession::class,
        'auditable_id' => $session->id,
        'action' => 'updated',
    ]);

    $log = AuditLog::where('auditable_id', $session->id)->first();
    expect($log->old_values['note'])->toBeNull()
        ->and($log->old_values['status'])->toBe(OpnameSessionStatus::Draft->value)
        ->and($log->new_values['note'])->toBe('Catatan diperbarui')
        ->and($log->new_values['status'])->toBe(OpnameSessionStatus::InProgress->value);
});

it('creates an audit log when stock opname item is deleted', function () {
    $session = StockOpnameSession::create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'type' => OpnameSessionType::Handover,
        'status' => OpnameSessionStatus::Draft,
        'incoming_user_id' => $this->user->id,
        'created_by' => $this->user->id,
    ]);

    $item = StockOpnameItem::create([
        'stock_opname_session_id' => $session->id,
        'section' => 'Rak A',
        'name' => 'Kopi Kapal Api',
        'quantity' => 10,
        'unit_price' => 2000,
        'input_method' => InputMethod::Manual,
        'counted_by' => $this->user->id,
    ]);

    AuditLog::truncate();

    $item->delete();

    $this->assertDatabaseHas('audit_logs', [
        'tenant_id' => $this->tenant->id, // Resolved via relationship fallback in Auditable trait
        'user_id' => $this->user->id,
        'auditable_type' => StockOpnameItem::class,
        'auditable_id' => $item->id,
        'action' => 'deleted',
    ]);

    $log = AuditLog::where('auditable_id', $item->id)->first();
    expect($log->old_values['name'])->toBe('Kopi Kapal Api')
        ->and($log->new_values)->toBeNull();
});

it('prevents audit log records from being updated', function () {
    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id,
        'auditable_type' => 'App\Models\Dummy',
        'auditable_id' => 1,
        'action' => 'created',
    ]);

    expect(fn () => $log->update(['action' => 'updated']))
        ->toThrow(Exception::class, 'Audit logs are append-only.');
});

it('prevents audit log records from being deleted', function () {
    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->user->id,
        'auditable_type' => 'App\Models\Dummy',
        'auditable_id' => 1,
        'action' => 'created',
    ]);

    expect(fn () => $log->delete())
        ->toThrow(Exception::class, 'Audit logs are append-only.');
});
