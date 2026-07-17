/**
 * Persist the last successful checkout attempt (idempotency key + Checkout
 * Session URL) per (listing, user) so a refresh or return-visit can resume
 * the same Stripe Checkout Session instead of creating a new one.
 *
 * Stripe honours an idempotency key for ~24h; we conservatively expire our
 * cached entry after 23h.
 */

const STORAGE_PREFIX = "ox:checkout:";
const TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

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
