# Roadmap

## Done
- [x] Advanced filters + search on /admin/orders (buyer, seller, payment status, fulfilment status, date range, tracking number). Typecheck passed.
- [x] PayFast reconciliation page `/admin/reconciliation` ("Reconciliation" in admin nav) — compares PayFast confirmations with orders, flags missing confirmations, duplicates, amount mismatches, stale pending orders, and unknown transactions. Typecheck passed.
- [x] `payfast-itn` edge function updated to record every validated PayFast confirmation into the `payfast_transactions` ledger (upsert on PayFast payment ID + status + amount).

## Blocked — Lovable Cloud database is paused (resume disabled from this side)
- [ ] Apply `payfast_transactions` migration (ledger table + admin-only read policy). Retry `supabase--migration` once the backend is ACTIVE_HEALTHY.
- [ ] Deploy updated `payfast-itn` (ledger writes) via `supabase--deploy_edge_functions`.
- [ ] Browser verification of /admin/orders filters and /admin/reconciliation (also blocked earlier: admin session mint failed because backend was down).
- [ ] Regenerate/sync `types.ts` once migration applies — AdminReconciliation currently casts `supabase as any` for the ledger query; revert to typed client after.

## Carried over
- [ ] `analyze-payment-risk` deploy confirmation.
- [ ] PayFast ITN enablement in the merchant's PayFast settings (user-side, passphrase provided).
- [ ] Sandbox vs live PayFast decision (credentials are live).

- [ ] Deploy diagnose-payment-discrepancy function (blocked: backend paused)
- [ ] Deploy draft-resolution-message function (blocked: backend paused)
- [ ] Deploy triage-payment-discrepancies function (built, typecheck passed; blocked: backend paused)

- [ ] PayFast callback log: apply supabase/pending/payfast_itn_events.sql, deploy payfast-itn + retry-payfast-itn (blocked: backend paused)

- [x] Unpaid checkouts hidden from buyer purchases, buyer dashboard and seller sales (only paid/shipped/delivered shown); sellers can no longer set cancelled/refunded.
- [ ] Apply supabase/pending/order_payment_guard.sql — orders default to pending, buyers can't insert orders, sellers only see paid orders, only PayFast confirmation/admin can mark paid (blocked: backend paused)
