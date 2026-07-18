/**
 * Persist the last successful checkout attempt (idempotency key + Checkout
 * Session URL) per (listing, user) so a refresh or return-visit can resume
 * the same Stripe Checkout Session instead of creating a new one.
 *
 * Stripe honours an idempotency key for ~24h; we conservatively expire our
 * cached entry after 23h.
 */

const STORAGE_PREFIX = "ox:checkout:";
const TTL_MS = 23 * 60 * 60 * 1000; // 23 hours — how long we keep the cache

// Stripe Checkout Sessions expire ~24h after creation. We warn the buyer
// when less than this remains, and treat the session as expired past it.
export const CHECKOUT_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const CHECKOUT_EXPIRING_SOON_MS = 2 * 60 * 60 * 1000;

export type CheckoutExpiryStatus = "fresh" | "expiring_soon" | "expired";

export type CheckoutExpiryInfo = {
  status: CheckoutExpiryStatus;
  msRemaining: number;
  expiresAt: number;
};

export function getCheckoutExpiry(
  createdAt: number,
  now: number = Date.now(),
): CheckoutExpiryInfo {
  const expiresAt = createdAt + CHECKOUT_SESSION_LIFETIME_MS;
  const msRemaining = Math.max(0, expiresAt - now);
  let status: CheckoutExpiryStatus = "fresh";
  if (msRemaining <= 0) status = "expired";
  else if (msRemaining <= CHECKOUT_EXPIRING_SOON_MS) status = "expiring_soon";
  return { status, msRemaining, expiresAt };
}

export function formatCheckoutTimeRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return "expired";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  if (minutes >= 1) return `${minutes}m`;
  return "less than a minute";
}

export type PendingCheckout = {
  idempotencyKey: string;
  url: string;
  createdAt: number; // epoch ms
};

const storageKey = (listingId: string, userId: string) =>
  `${STORAGE_PREFIX}${listingId}:${userId}`;

const safeStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadPendingCheckout(
  listingId: string | undefined,
  userId: string | undefined,
): PendingCheckout | null {
  if (!listingId || !userId) return null;
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey(listingId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckout>;
    if (
      !parsed ||
      typeof parsed.idempotencyKey !== "string" ||
      typeof parsed.url !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      store.removeItem(storageKey(listingId, userId));
      return null;
    }
    if (Date.now() - parsed.createdAt > TTL_MS) {
      store.removeItem(storageKey(listingId, userId));
      return null;
    }
    return parsed as PendingCheckout;
  } catch {
    return null;
  }
}

export function savePendingCheckout(
  listingId: string | undefined,
  userId: string | undefined,
  value: PendingCheckout,
): void {
  if (!listingId || !userId) return;
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(storageKey(listingId, userId), JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearPendingCheckout(
  listingId: string | undefined,
  userId: string | undefined,
): void {
  if (!listingId || !userId) return;
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(storageKey(listingId, userId));
  } catch {
    /* ignore */
  }
}
