<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OutletController extends Controller
{
    /**
     * List the tenant's outlets on the owner dashboard.
     */
    public function index(): Response
    {
        return Inertia::render('outlets/index', [
            'outlets' => Outlet::query()
                ->withCount('shifts')
                ->latest()
                ->get(),
        ]);
    }

    /**
     * Store a newly created outlet.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        Outlet::create($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Outlet berhasil dibuat.')]);

        return to_route('outlets.index');
    }
}
