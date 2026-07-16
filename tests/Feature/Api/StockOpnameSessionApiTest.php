<?php

use App\Enums\OpnameSessionStatus;
use App\Models\Outlet;
use App\Models\StockOpnameSession;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->outgoing = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->incoming = User::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->session = StockOpnameSession::factory()->handover()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'outgoing_user_id' => $this->outgoing->id,
        'incoming_user_id' => $this->incoming->id,
    ]);
});

it('does not finalize a handover with only one confirmation', function () {
    Sanctum::actingAs($this->outgoing);

    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm")
        ->assertOk()
        ->assertJsonPath('data.status', OpnameSessionStatus::Draft->value);

    expect($this->session->refresh()->outgoing_confirmed_at)->not->toBeNull()
        ->and($this->session->incoming_confirmed_at)->toBeNull();
});

it('finalizes a handover once both parties confirm', function () {
    Sanctum::actingAs($this->outgoing);
    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm")->assertOk();

    Sanctum::actingAs($this->incoming);
    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm")
        ->assertOk()
        ->assertJsonPath('data.status', OpnameSessionStatus::Final->value);

    expect($this->session->refresh()->finalized_at)->not->toBeNull();
});

it('rejects confirmation from an uninvolved user', function () {
    $bystander = User::factory()->create(['tenant_id' => $this->tenant->id]);

    Sanctum::actingAs($bystander);

    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm")
        ->assertForbidden();
});

it('locks items once the session is final', function () {
    Sanctum::actingAs($this->outgoing);
    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm");

    Sanctum::actingAs($this->incoming);
    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/confirm");

    $this->postJson("/api/stock-opname-sessions/{$this->session->id}/items", [
        'client_uuid' => (string) Str::uuid7(),
        'section' => 'Rak 1',
        'name' => 'Indomie Goreng',
        'quantity' => 10,
        'unit_price' => 3_500,
        'input_method' => 'manual',
    ])->assertUnprocessable();
});
