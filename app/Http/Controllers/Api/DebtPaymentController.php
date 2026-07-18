<?php

namespace App\Http\Controllers\Api;

use App\Actions\Debts\RecordDebtPaymentAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDebtPaymentRequest;
use App\Models\Debt;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DebtPaymentController extends Controller
{
    public function store(
        StoreDebtPaymentRequest $request,
        Debt $debt,
        RecordDebtPaymentAction $recordDebtPayment,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $result = $recordDebtPayment->handle($debt, $request->payload(), $user);

        return response()->json([
            'data' => $result['payment'],
            'debt' => $result['debt'],
        ], $result['created'] ? 201 : 200);
    }
}
