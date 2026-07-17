<?php

namespace App\Http\Controllers\Api;

use App\Enums\InputMethod;
use App\Enums\OpnameSessionStatus;
use App\Http\Controllers\Controller;
use App\Models\StockOpnameItem;
use App\Models\StockOpnameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StockOpnameItemController extends Controller
{
    /**
     * List items of an opname session, grouped-ready by section.
     */
    public function index(StockOpnameSession $stockOpnameSession): JsonResponse
    {
        Gate::authorize('view', $stockOpnameSession);

        return response()->json([
            'data' => $stockOpnameSession->items()->orderBy('section')->get(),
        ]);
    }

    /**
     * Add or update a counted item. Idempotent on client_uuid so paused
     * sessions can resume and retry safely (PRD §6.2 & §8.3).
     */
    public function store(Request $request, StockOpnameSession $stockOpnameSession): JsonResponse
    {
        Gate::authorize('addItem', $stockOpnameSession);

        abort_if(
            $stockOpnameSession->status === OpnameSessionStatus::Final,
            422,
            'Sesi sudah final — item tidak bisa diubah.',
        );

        $validated = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'section' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'unit_price' => ['required', 'integer', 'min:0'],
            'input_method' => ['required', Rule::enum(InputMethod::class)],
            'photo_before_path' => ['nullable', 'string', 'max:255'],
            'photo_after_path' => ['nullable', 'string', 'max:255'],
            'dispute_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $item = StockOpnameItem::updateOrCreate(
            ['client_uuid' => $validated['client_uuid']],
            [
                ...$validated,
                'stock_opname_session_id' => $stockOpnameSession->id,
                'counted_by' => $request->user()->id,
            ],
        );

        return response()->json(['data' => $item], $item->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Remove an item from a non-final session.
     */
    public function destroy(StockOpnameSession $stockOpnameSession, StockOpnameItem $item): JsonResponse
    {
        Gate::authorize('addItem', $stockOpnameSession);

        abort_if(
            $stockOpnameSession->status === OpnameSessionStatus::Final,
            422,
            'Sesi sudah final — item tidak bisa dihapus.',
        );

        abort_unless($item->stock_opname_session_id === $stockOpnameSession->id, 404);

        $item->delete();

        return response()->json(status: 204);
    }
}
