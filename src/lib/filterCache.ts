/**
 * Lightweight in-memory TTL cache for filter lookups.
 *
 * Used to avoid re-running the listing_conditions → listing_id
 * resolution on every keystroke / chip toggle / pagination tick.
 * Keys are stable string fingerprints; values are arbitrary JSON.
 *
 * Scope: per-tab, per-session. Cleared on full reload.
 */

type Entry<V> = { value: V; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** Default TTL for filter-set caches. Short enough to stay fresh after new listings appear. */
export const FILTER_CACHE_TTL_MS = 30_000;

/** Hard cap so the cache cannot grow unbounded as users explore many filter combinations. */
const MAX_ENTRIES = 64;

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Drop the oldest insertion (Map preserves insertion order).
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) store.delete(firstKey);
}

export function cacheGet<V>(key: string): V | null {
  const hit = store.get(key) as Entry<V> | undefined;
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet<V>(key: string, value: V, ttlMs = FILTER_CACHE_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}

export function cacheInvalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Build a stable cache key for the (category, subcategory, conditions) tuple.
 * Sorting ensures option order doesn't fragment the cache.
 */
export function filterKey(parts: {
  scope: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  optionIds?: string[];
}): string {
  const cat = parts.categoryId ?? "all";
  const sub = parts.subcategoryId ?? "all";
  const opts = [...(parts.optionIds ?? [])].sort().join(",");
  return `${parts.scope}|cat=${cat}|sub=${sub}|opts=${opts}`;
}

/** Test helper. */
export function __cacheSize() {
  return store.size;
}
