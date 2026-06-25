/**
 * URL <-> condition-filter sync helpers.
 *
 * Hardens the `?conditions=...` query param so:
 *   - garbage values (non-UUID strings) are dropped instead of being shipped to the DB
 *   - duplicates are removed
 *   - order doesn't matter — we compare and serialize as a sorted set
 *
 * The canonical serialization (sorted, deduped, comma-joined) means that
 * back/forward navigation and chip toggles produce stable URLs and don't
 * trigger spurious refetches when the underlying set of selected options
 * is unchanged.
 */

// RFC 4122 v1-v5 UUID shape — same regex used across the codebase.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * Parse the raw `conditions=` value into a canonical, deduped, validated,
 * sorted array of UUIDs. Invalid tokens are dropped silently.
 */
export function parseConditionIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const v = part.trim().toLowerCase();
    if (!v || seen.has(v)) continue;
    if (!isUuid(v)) continue;
    seen.add(v);
  }
  return Array.from(seen).sort();
}

/**
 * Build a canonical `conditions=` string for the given ids (sorted, deduped).
 * Returns `null` when the list is empty so callers can `params.delete()`.
 */
export function serializeConditionIds(ids: readonly string[]): string | null {
  const parsed = parseConditionIds(ids.join(","));
  return parsed.length === 0 ? null : parsed.join(",");
}

/** Order-insensitive equality for two id lists. */
export function sameConditionSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const x of b) if (!set.has(x)) return false;
  return true;
}
