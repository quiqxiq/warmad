I’ll inspect the uncommitted diff and relevant new files without modifying anything, then trace the critical data flows across cashier, queues, offline sync, debts, batching, and reconciliation. I’ll prioritize finalization blockers and include exact paths with concise remediation.

The change set is broad and includes many untracked files, so I’m narrowing it to the requested domains and first checking the project’s authorization, validation, model, routing, and concurrency conventions. Then I’ll trace each write path end-to-end against its tests.

The backend flow already shows two high-risk areas to verify: reconciliation is computed without locking/closing the shift, and idempotency is checked only after current outlet/shift/category validation. I’m now checking database constraints, policies, and test coverage to distinguish proven blockers from lower-risk design concerns.

I’m shifting to the client-side persistence and synchronization paths next. The key review questions are whether queued audio/sales survive reloads, whether concurrent sync loops can double-submit or delete newer state, and whether UI acknowledgements can occur before durable storage or server confirmation.

Several concrete client/backend mismatches are now confirmed: shift creation omits required fields, the cashier page expects a different stats prop name, and the debts selector uses a query key the controller never reads. I’m checking component behavior and symbol usage now for reconciliation semantics, stale-shift attribution, queue deletion races, and compatibility files that have no live callers.

One additional blocker is architectural rather than cosmetic: the Inertia UI calls `routes/api.php` with session cookies, but those API routes currently have only `auth:sanctum` and bindings—no Sanctum stateful/session middleware is configured. The browser calls will therefore not share the authenticated web session even though API tests using `Sanctum::actingAs` pass. I’m doing a final pass against the implementation notes and remaining data lifecycle paths before ranking findings.

# Read-only review

**Recommendation: block finalization.** No files were edited.

## Finalization blockers

1. **Browser cashier API calls are not session-authenticated**
   - `bootstrap/app.php:18-25`
   - `routes/api.php:21-53`
   - `resources/js/lib/api.ts:116-121`
   - The Inertia client sends cookies but no bearer token, while the API stack lacks Sanctum’s stateful/session middleware. `route:list -vv` confirms only `Authenticate:sanctum` and bindings. Browser requests will return `401`; `Sanctum::actingAs()` tests mask this.
   - **Fix:** enable `$middleware->statefulApi()` with correct stateful domains/CSRF, or expose these same-origin mutations through authenticated web routes.

2. **Cashier page prop contract crashes active-shift rendering**
   - `app/Http/Controllers/CashierController.php:43-48`
   - `app/Http/Controllers/CashierController.php:77-90`
   - `resources/js/pages/cashier/index.tsx:89-101`
   - `resources/js/types/cashier.ts:32-36`
   - Backend returns `todayStats` with `sales_total`, `transactions_count`, etc.; frontend expects `stats.total_sales`, `stats.transaction_count`, etc. `CashierHeader` dereferences `stats`, which is undefined.
   - **Fix:** define one shared prop shape and align the controller, page, type, and tests.

3. **Starting a shift always fails validation**
   - `resources/js/pages/cashier/index.tsx:178-190`
   - `app/Http/Controllers/Api/ShiftController.php:42-47`
   - Client sends only `outlet_id` and `opening_cash`; API also requires `client_uuid` and `started_at`.
   - **Fix:** generate and durably persist an idempotency UUID plus capture timestamp before submission, or let the backend safely supply them.

4. **Legacy single-transaction endpoint can corrupt immutable financial data**
   - `app/Http/Controllers/Api/TransactionController.php:51-110`
   - `updateOrCreate()` modifies an existing transaction when a UUID is retried. If payment or total changes, the associated debt is not updated because debt handling only runs when `wasRecentlyCreated`. Concurrent first submissions can also race into the unique constraint.
   - **Fix:** remove/deprecate the duplicate single-item implementation or delegate it to the batch action. An existing idempotency key must return the immutable original or `409` on payload mismatch—never update it.

5. **Single transaction and shift endpoints permit cross-tenant relational contamination**
   - `app/Http/Controllers/Api/TransactionController.php:51-73`
   - `app/Http/Controllers/Api/ShiftController.php:42-52`
   - Raw `Rule::exists()` checks accept IDs from any tenant. `BelongsToTenant` fills the new row with the caller’s tenant while foreign keys can point to another tenant’s outlet, shift, or category.
   - **Fix:** use tenant- and accessibility-scoped validation, verify outlet/shift/category belong together, require the caller’s active shift, and add database-level composite integrity where practical.

6. **Offline sales become permanently unsyncable after shift closure or catalog changes**
   - `app/Http/Requests/StoreTransactionBatchRequest.php:77-149`
   - `app/Actions/Transactions/CreateTransactionBatchAction.php:59-69`
   - Current active-shift/category/access validation runs before the idempotency lookup. A response-lost retry can fail after the shift closes, and a genuinely offline sale can never sync once its shift closes or category is deactivated.
   - **Fix:** design an explicit close protocol that drains pending sales or accepts bounded late sync for sales captured during that shift. Existing idempotency records should be resolved before mutable-state validation.

7. **Cash reconciliation is race-prone and does not close the register**
   - `app/Http/Controllers/Api/CashReconciliationController.php:45-83`
   - The shift is not locked, status-checked, ownership/access-checked, or closed. Transactions can be added after expected cash is calculated—or after reconciliation is created. Simultaneous requests can both pass validation, with one ending in a unique-key `500`.
   - **Fix:** inside one database transaction, lock the shift, authorize it, verify it is active and synchronized, calculate expected cash, create reconciliation, and mark the shift closed atomically.

8. **No cashier UI exists to close/reconcile a shift**
   - `resources/js/pages/cashier/index.tsx`
   - `resources/js/lib/offline-database.ts:19-24`
   - The page never calls shift close or cash reconciliation, and IndexedDB has no reconciliation queue despite cash close being an offline-first core operation.
   - **Fix:** add an end-shift/reconciliation workflow with durable local submission and conflict-safe server finalization.

9. **Held and voice sales can be assigned to the wrong shift and time**
   - `resources/js/pages/cashier/index.tsx:60-86`
   - `resources/js/pages/cashier/index.tsx:225-229`
   - `resources/js/pages/cashier/index.tsx:301-315`
   - `resources/js/types/offline.ts:3-9`
   - Voice drafts use review time instead of recording time and contain no original shift. Held sales store `shiftId`, but resume ignores it and submission uses the current shift. Old sales can therefore alter a later shift’s reconciliation.
   - **Fix:** persist tenant/user/outlet/shift and occurrence time at capture; submit only to the original shift or require an explicit audited transfer.

10. **Voice notes can generate duplicate sales**
    - `resources/js/pages/cashier/index.tsx:60-86`
    - `resources/js/pages/cashier/index.tsx:231-255`
    - Each review creates a new sale UUID. Holding a voice transaction does not remove or mark the source note consumed, so it can be reopened and submitted again under another UUID. Multiple tabs have the same risk.
    - **Fix:** assign one stable sale UUID to the voice note and introduce an atomic claimed/held/consumed state.

11. **Voice parsing is an unconditional production mock**
    - `app/Providers/AppServiceProvider.php:22-26`
    - `app/Services/Voice/MockVoiceParser.php:14-41`
    - Every recording produces the same hard-coded sale. The service interface also receives no outlet catalog or pricing context.
    - **Fix:** select a configured real parser outside tests/local development, pass the authorized outlet catalog, require structured output, and fail closed when the provider is unavailable.

12. **Unknown spoken payment is silently recorded as fully paid**
    - `resources/js/pages/cashier/index.tsx:65-81`
    - `payment.received === null` defaults to the sale total, allowing one-click confirmation of cash that was never spoken.
    - **Fix:** preserve “unknown” as a distinct state and require explicit payment entry, bon, or hold selection.

13. **Partially paid debts crash the debts page**
    - `app/Enums/DebtStatus.php:5-10`
    - `resources/js/types/debt.ts:3-14`
    - `resources/js/pages/debts/index.tsx:21-58`
    - Backend emits `partially_paid`; frontend expects `partial`. `statusDetails[status]` becomes undefined and accessing `detail.icon` throws.
    - **Fix:** align the enum values and add a defensive unknown-status fallback.

14. **Offline data is not isolated by authenticated tenant/user**
    - `resources/js/lib/offline-database.ts:9-24`
    - `resources/js/types/offline.ts:3-22`
    - `resources/js/types/voice.ts:40-52`
    - One static origin-wide database stores audio and financial payloads without tenant/user keys. Logout only clears Inertia history, so another account on the device can inherit records and workers can submit old data under the new session.
    - **Fix:** namespace records/database by tenant and user/device, enforce ownership before processing, define logout/account-switch handling, and meet the stated audio encryption/retention requirement.

## Important correctness issues

15. **The debts outlet selector uses the wrong query key and “all” is not implemented**
    - `app/Http/Controllers/DebtPageController.php:19-42`
    - `resources/js/pages/debts/index.tsx:82-87`
    - Controller reads `outlet`; client sends `outlet_id`. With no parameter, the controller selects the first outlet rather than all outlets.
    - **Fix:** standardize the parameter and explicitly support either one accessible outlet or all accessible outlets.

16. **Debt summary figures only cover the latest 100 rows**
    - `app/Http/Controllers/DebtPageController.php:35-42`
    - `resources/js/pages/debts/index.tsx:75-80`
    - Client labels aggregates as totals, but calculates them from the capped result set.
    - **Fix:** return database aggregates separately and paginate the list.

17. **Cashier “transaction count” counts line items, not sales**
    - `app/Http/Controllers/CashierController.php:65-80`
    - A two-item batch creates two transaction rows, so one customer sale displays as two transactions.
    - **Fix:** count sale headers/distinct `sale_uuid`, with an explicit legacy-row strategy.

18. **UI accepts decimal quantities while backend rejects them**
    - `resources/js/components/cashier/transaction-item-row.tsx:131-142`
    - `app/Http/Requests/StoreTransactionBatchRequest.php:62-63`
    - UI advertises `0.01` increments, but API and schema require integers.
    - **Fix:** either restrict UI to whole units or introduce an appropriate fixed-decimal quantity column and validation.

19. **Online submission is not write-ahead durable**
    - `resources/js/hooks/use-offline-sales.ts:175-197`
    - Online sales are sent before being written to IndexedDB. A tab/process termination while the request is in flight can lose a manual sale.
    - **Fix:** always persist `pending` first, then send and delete only after a confirmed idempotent response.

20. **“Automatic sync” only runs while the selected cashier page is mounted**
    - `resources/js/hooks/use-offline-sales.ts:202-210`
    - `resources/js/layouts/cashier-layout.tsx:16-23`
    - No service worker/background-sync implementation exists. Other-outlet sales are skipped, and server connectivity recovery without an `online` event requires manual retry or remount.
    - **Fix:** use one global sync coordinator with retry/backoff and, if offline-first is required, service-worker Background Sync.

21. **Cross-tab sync has no lease or compare-and-delete protection**
    - `resources/js/hooks/use-offline-sales.ts:20-38`
    - `resources/js/hooks/use-offline-sales.ts:125-159`
    - The in-flight map is tab-local. One tab can unconditionally delete a record that another tab requeued or updated while the first request was running.
    - **Fix:** add an IndexedDB/Web Locks lease and record revision; delete only when the stored revision still matches the submitted revision.

22. **Debt repayments cannot be reconciled accurately**
    - `app/Http/Controllers/Api/DebtController.php:73-93`
    - `app/Http/Controllers/Api/CashReconciliationController.php:57-60`
    - Debt updates overwrite an aggregate paid amount but record no shift-level cash receipt, so cash collected from debt settlement cannot be included in expected cash.
    - **Fix:** use an append-only debt payment ledger linked to shift, user, amount, and timestamp, then include cash receipts in reconciliation.

23. **Voice parsing endpoint has no cost/concurrency rate limit**
    - `routes/api.php:53`
    - It accepts uploads up to 10 MB and is intended to call external AI/STT.
    - **Fix:** add a tenant/user keyed limiter and concurrency ceiling before enabling a real provider.

24. **Debts UI is absent from application navigation**
    - `resources/js/components/app-navigation.tsx:25-45`
    - The page exists but has no navigation entry.
    - **Fix:** add the debts route for appropriate roles.

## Duplicate/dead implementations

- `resources/js/lib/cashier-db.ts` — unused compatibility facade over `offline-database.ts`.
- `resources/js/hooks/use-pending-sale-sync.ts` — unused alias for `useOfflineSales`.
- `resources/js/lib/money.ts` and `resources/js/lib/currency.ts` — competing import surfaces; `getQuickTenderAmounts()` is unused.
- `resources/js/components/cashier/held-sales-panel.tsx` only renames `HeldTransactions`, leaving two names for one component.
- `resources/js/layouts/cashier-layout.tsx:22` and `resources/js/pages/cashier/index.tsx:99` instantiate separate offline sync hooks, producing duplicate listeners/workers.
- `POST /api/transactions` duplicates the newer batch sale/debt implementation and has materially different idempotency/payment semantics.

I did not rerun the test/build suite. The only command-level verification was read-only route middleware inspection; no project files were changed.
