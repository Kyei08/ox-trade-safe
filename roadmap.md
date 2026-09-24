# Roadmap

## Done
- [x] Advanced filters + search on /admin/orders (buyer, seller, payment status, fulfilment status, date range, tracking number). Typecheck passed; visual verification pending (backend was waking).

## In progress
- [ ] PayFast reconciliation view: compare PayFast transactions (ITN ledger) with paid orders; flag missing, duplicated, and mismatched payments.

## Blocked
- [ ] Browser verification of order filters + reconciliation page — blocked on backend pooler waking up (SUPABASE_POOLER_UNAVAILABLE).
- [ ] `analyze-payment-risk` deploy confirmation + PayFast ITN enablement (user-side PayFast settings) — carried over from earlier.
