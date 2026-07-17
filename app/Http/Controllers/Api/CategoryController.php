<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * List categories, optionally filtered by outlet.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Category::class);

        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
        ]);

        $categories = Category::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->orderBy('position')
            ->get();

        return response()->json(['data' => $categories]);
    }

    /**
     * Store a newly created category.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Category::class);

        $validated = $request->validate([
            'outlet_id' => ['required', 'integer', Rule::exists('outlets', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'default_price' => ['required', 'integer', 'min:0'],
            'icon' => ['nullable', 'string', 'max:255'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ]);

        $category = Category::create($validated);

        return response()->json(['data' => $category], 201);
    }

    /**
     * Display the specified category.
     */
    public function show(Category $category): JsonResponse
    {
        Gate::authorize('view', $category);

        return response()->json(['data' => $category]);
    }

    /**
     * Update the specified category.
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        Gate::authorize('update', $category);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'default_price' => ['sometimes', 'integer', 'min:0'],
            'icon' => ['nullable', 'string', 'max:255'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($validated);

        return response()->json(['data' => $category]);
    }

    /**
     * Remove the specified category.
     */
    public function destroy(Category $category): JsonResponse
    {
        Gate::authorize('delete', $category);

        $category->delete();

        return response()->json(status: 204);
    }
}
