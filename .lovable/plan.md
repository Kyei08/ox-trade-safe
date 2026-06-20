## OX Logistics — UI-First Module (Phase 1)

Goal: Recreate the attached Logistics prototype inside this project as a new module. Reuse existing auth, profiles, address, verification, payments, and design tokens. No new database tables or business logic yet — that comes in Phase 2 after we confirm the UI matches.

### Architecture (light restructure)

Keep current marketplace paths untouched. Add two new folders:

```text
src/
├── pages/                    (existing marketplace pages — unchanged)
├── components/               (existing marketplace components — unchanged)
├── shared/                   NEW — cross-module primitives
│   ├── EcosystemNav.tsx      Top-level switcher: Marketplace | Logistics | Services (soon) | Account
│   └── LocationPicker.tsx    Shared SA town/city selector (reused later by Marketplace)
└── modules/
    └── logistics/            NEW — all Logistics UI lives here
        ├── pages/
        │   ├── LogisticsHome.tsx        (Move screen — image 1)
        │   ├── LogisticsProviders.tsx   (Provider comparison — images 2 & 3)
        │   ├── LogisticsOrders.tsx      (placeholder)
        │   └── LogisticsAccount.tsx     (re-exports marketplace account)
        └── components/
            ├── PickupDropoffCard.tsx
            ├── ItemCategoryGrid.tsx     (Parcel, Documents, Food, Furniture, Appliances, Electronics, Building Materials, Vehicle Parts, Bulk Goods)
            ├── SizeUrgencySelectors.tsx (Small/Med/Large/XL · ASAP/Same Day/Scheduled)
            ├── NotesPhotosDimensions.tsx (collapsible)
            ├── ProviderCard.tsx         (matches image 2/3 exactly)
            ├── ProviderFilters.tsx      (price, rating, availability, coverage, vehicle, capability)
            ├── SortTabs.tsx             (Recommended · Lowest price · Top rated · Fastest ETA)
            ├── CoverageBadge.tsx        (Local / City / Provincial / National)
            ├── AvailabilityBadge.tsx    (Available Today / Tomorrow / Busy)
            ├── VehicleIcon.tsx          (Bike / Car / Van / Bakkie / Truck)
            └── LogisticsBottomNav.tsx   (Move · Orders · Account)
```

### Routes (added to `src/App.tsx`)

- `/logistics` → LogisticsHome (Move flow)
- `/logistics/providers` → LogisticsProviders (comparison)
- `/logistics/orders` → LogisticsOrders (placeholder list)
- `/logistics/account` → reuse existing Dashboard

Existing marketplace routes stay as-is. Add `EcosystemNav` to the marketplace `Header` so users can jump to Logistics without re-auth (shared `useAuth` already covers this).

### Design system reuse

All Logistics components use existing semantic tokens from `index.css` and the existing shadcn primitives (Card, Button, Badge, Sheet, Tabs, Collapsible). No new colors. The "OX Logistics" wordmark in the header mirrors the marketplace logo treatment (dark square + label). Orange accent already in the palette is used for the "Sign in" CTA and price text — matches the prototype.

### Phase 1 scope (this plan)

UI only, with mock provider data in a local `mockProviders.ts`:
1. Move screen with pickup/drop-off card, item category grid, size + urgency selects, collapsible notes section.
2. Providers screen with location title, "In your area" badge, count + Filters button, sort tabs, list of `ProviderCard`s with Request Quote / Instant Book buttons.
3. Bottom nav (Move / Orders / Account) on mobile; ecosystem nav on desktop.
4. Filters sheet (mobile drawer) wired to local state.

### Out of scope (Phase 2 — after you approve UI)

- DB schema (shipments, providers, courier_profiles, quotes)
- Courier role + KYC reuse from marketplace
- Real provider listings + Edge Function for quote requests
- Marketplace → Logistics handoff (prefill pickup/drop-off from a paid order)
- Payments wiring (reuse existing Stripe create-payment function)

I will ask about Phase 2 (DB, courier role, handoff trigger) once the UI is in and you've confirmed it matches your prototype.

### Confirmations needed before I build

1. Folder layout above (`src/modules/logistics/*` + `src/shared/*`) — OK?
2. Marketplace header gets a small "Logistics" link (ecosystem switch). OK, or keep it bottom-nav-only on mobile?
