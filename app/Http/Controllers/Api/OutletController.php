<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class OutletController extends Controller
{
    /**
     * List all outlets for the authenticated tenant.
     */
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', Outlet::class);

        return response()->json([
            'data' => Outlet::query()->latest()->get(),
        ]);
    }

    /**
     * Store a newly created outlet.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Outlet::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $outlet = Outlet::create($validated);

        return response()->json(['data' => $outlet], 201);
    }

    /**
     * Display the specified outlet.
     */
    public function show(Outlet $outlet): JsonResponse
    {
        Gate::authorize('view', $outlet);

        return response()->json([
            'data' => $outlet->load('categories', 'users'),
        ]);
    }

    /**
     * Update the specified outlet.
     */
    public function update(Request $request, Outlet $outlet): JsonResponse
    {
        Gate::authorize('update', $outlet);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $outlet->update($validated);

        return response()->json(['data' => $outlet]);
    }

    /**
     * Remove the specified outlet.
     */
    public function destroy(Outlet $outlet): JsonResponse
    {
        Gate::authorize('delete', $outlet);

        $outlet->delete();

        return response()->json(status: 204);
    }
}
