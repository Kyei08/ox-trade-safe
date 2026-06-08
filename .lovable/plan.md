# Seller Verification Onboarding

A multi-step verification flow gating listing creation, with two account types (Individual / Business), an admin review queue, and public trust badges on seller profiles.

## User-facing flow

New route: `/seller-verification` (multi-step wizard).

Step 1 — **Account type**: Individual Seller or Registered Business.

Step 2 — **Details form** (varies by type):
- Individual: full name, physical address, phone (for phone-verified badge later).
- Business: company name, registration number, VAT number (optional), representative name, business address.

Step 3 — **Document uploads** (varies by type):
- Individual: SA ID, selfie, proof of residence.
- Business: CIPC document, representative ID, proof of business address, proof of business banking.

Step 4 — **Review & submit**: shows summary, sets status to `pending_review`.

Status screen after submission shows current status with reason if `rejected` / `requires_more_info`, and allows re-upload of requested documents.

**Listing gate**: `CreateListing` checks `profiles.seller_verification_status`. If not `approved`, show a blocker card with a CTA to `/seller-verification`.

## Statuses

`not_started | pending_review | approved | rejected | requires_more_info`

## Admin

New route `/admin/sellers` (added to AdminLayout nav):
- Queue of submissions (filter by status, default pending).
- Detail panel: applicant info + signed-URL viewer for each uploaded document (image inline, PDF via link).
- Actions: Approve, Reject (with reason), Request more info (with note + which docs).

## Trust badges

Reusable `<TrustBadges profile={...} />` displayed on `SellerProfile` and listing seller cards:
- **Verified Seller** — `seller_verification_status = approved` and `seller_type = individual`.
- **Verified Business** — `approved` and `seller_type = business`.
- **Phone Verified** — `phone_verified_at not null`.
- **Address Verified** — `address_verified_at not null`.

## Technical details

### Schema (migration)

New enums:
- `seller_type`: `individual`, `business`.
- `seller_verification_status`: `not_started`, `pending_review`, `approved`, `rejected`, `requires_more_info`.

Add to `profiles`:
- `seller_type seller_type`
- `seller_verification_status seller_verification_status default 'not_started'`
- `phone_verified_at timestamptz`
- `address_verified_at timestamptz`

New table `seller_verifications`:
- `user_id uuid` (unique, FK to auth.users)
- `seller_type seller_type not null`
- Individual fields: `full_name`, `physical_address`
- Business fields: `company_name`, `registration_number`, `vat_number`, `representative_name`, `business_address`
- Document paths: `id_document_path`, `selfie_path`, `proof_of_residence_path`, `cipc_document_path`, `representative_id_path`, `proof_of_business_address_path`, `proof_of_business_banking_path`
- `status seller_verification_status not null default 'pending_review'`
- `review_notes text`, `requested_documents text[]`
- `reviewed_by uuid`, `reviewed_at timestamptz`
- `created_at`, `updated_at`

Grants + RLS:
- Owner can `select/insert/update` own row when status in (`pending_review`, `requires_more_info`).
- Admins (`has_role(auth.uid(),'admin')`) can `select/update` all.
- Trigger to sync `profiles.seller_verification_status` and `seller_type` when verification row changes.

New private storage bucket `seller-verification` with RLS:
- Owner can upload/read files under `{user_id}/...`.
- Admins can read all.

### Frontend

- `src/pages/SellerVerification.tsx` — wizard (uses existing `useAuth`, shadcn `Form`, `Stepper` pattern via simple state).
- `src/pages/AdminSellers.tsx` — queue + detail drawer; admin pulls signed URLs from storage.
- `src/components/TrustBadges.tsx` — shared badge component used in `SellerProfile.tsx`.
- `src/components/SellerVerificationGate.tsx` — wraps `CreateListing` content.
- Update `AdminLayout` nav to include "Sellers".
- Update `App.tsx` routes (`/seller-verification`, `/admin/sellers` wrapped in `AdminRoute`).

### Validation

- Client-side Zod schemas per step.
- File validation reuses existing pattern (size <5MB, image/jpeg|png|pdf, magic-number check via a new lightweight edge function `upload-seller-doc` mirroring `upload-kyc-document`).

## Out of scope (for this iteration)

- Actual phone OTP and address-verification integrations (badges driven by admin toggles for now).
- Email notifications on status change (can add later via existing notifications table — simple insert).
