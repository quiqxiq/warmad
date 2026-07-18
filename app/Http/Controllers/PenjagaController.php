<?php

namespace App\Http\Controllers;

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Owners manage the penjaga (cashiers) of their tenant here. Penjaga never
 * self-register; the owner creates the account and the penjaga then logs in
 * with phone + OTP (PRD §6.1).
 */
class PenjagaController extends Controller
{
    /**
     * List the tenant's penjaga and outlets for the management screen.
     */
    public function index(Request $request): Response
    {
        $this->authorizeOwner($request);

        $penjaga = User::query()
            ->whereBelongsTo($request->user()->tenant)
            ->whereHas('roles', fn ($query) => $query->where('name', OutletUserRole::Penjaga->value))
            ->with(['outlets:id,name'])
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'name', 'phone', 'phone_verified_at', 'created_at']);

        return Inertia::render('penjaga/index', [
            'penjaga' => $penjaga,
            'outlets' => Outlet::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /**
     * Create a penjaga bound to the owner's tenant and attach to an outlet.
     */
    public function store(Request $request): RedirectResponse
    {
        $this->authorizeOwner($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => [
                'required',
                'string',
                'regex:/^(08|628)\d{7,12}$/',
                Rule::unique('users', 'phone'),
            ],
            'outlet_id' => [
                'required',
                'integer',
                // Scoped to the tenant's active outlets via the current query.
                Rule::exists('outlets', 'id')->where('is_active', true),
            ],
        ]);

        $phone = $this->normalizePhone($validated['phone']);

        // Re-check uniqueness after normalization (08.. and 628.. collide).
        if (User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => 'Nomor ini sudah terdaftar.',
            ]);
        }

        $outlet = Outlet::query()->whereKey($validated['outlet_id'])->firstOrFail();

        DB::transaction(function () use ($request, $validated, $phone, $outlet): void {
            $penjaga = User::create([
                'tenant_id' => $request->user()->tenant_id,
                'name' => $validated['name'],
                'phone' => $phone,
            ]);

            $penjaga->assignRole(OutletUserRole::Penjaga->value);
            $outlet->users()->attach($penjaga, ['role' => OutletUserRole::Penjaga->value]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Penjaga berhasil ditambahkan.')]);

        return to_route('penjaga.index');
    }

    /**
     * Remove a penjaga from the tenant.
     */
    public function destroy(Request $request, User $penjaga): RedirectResponse
    {
        $this->authorizeOwner($request);

        // BelongsToTenant does not scope the User model, so verify ownership
        // explicitly before deleting.
        if ($penjaga->tenant_id !== $request->user()->tenant_id
            || ! $penjaga->hasRole(OutletUserRole::Penjaga->value)) {
            throw new AuthorizationException;
        }

        $penjaga->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Penjaga dihapus.')]);

        return to_route('penjaga.index');
    }

    /**
     * Only owners may manage penjaga.
     */
    private function authorizeOwner(Request $request): void
    {
        if (! $request->user()?->hasRole(OutletUserRole::Owner->value)) {
            throw new AuthorizationException;
        }
    }

    /**
     * Normalize 08xxxx to 628xxxx so lookups and delivery use one format.
     */
    private function normalizePhone(string $phone): string
    {
        return str_starts_with($phone, '08')
            ? '62'.substr($phone, 1)
            : $phone;
    }
}
