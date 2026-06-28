/**
 * Centralized validation messages and error normalization for listing
 * operations. Keep these in sync with the database trigger
 * `enforce_single_select_listing_condition` so client pre-validation and
 * server-returned errors stay identical.
 *
 * The trigger raises errors with a stable `HINT` string we use as the
 * authoritative error key:
 *   - `condition_group_category_mismatch`
 *   - `single_select_violation`
 *
 * Always run server errors through {@link normalizeListingError} so the UI
 * surfaces one canonical message + stable code per failure mode.
 */

/** Stable error keys. Safe to switch on, log, and assert against in tests. */
export type ListingErrorCode =
  | "CATEGORY_MISMATCH"
  | "SINGLE_SELECT_VIOLATION"
  | "OPTION_NOT_FOUND"
  | "LISTING_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UNKNOWN";

export interface NormalizedListingError {
  /** Stable, machine-readable key. */
  code: ListingErrorCode;
  /** Short toast title. */
  title: string;
  /** User-facing message — identical for a given code regardless of source. */
  message: string;
  /** Original raw message from the server, for logging. */
  raw?: string;
}

/** Canonical user-facing copy keyed by {@link ListingErrorCode}. */
export const LISTING_ERROR_COPY: Record<
  ListingErrorCode,
  { title: string; message: string }
> = {
  CATEGORY_MISMATCH: {
    title: "Condition doesn't match category",
    message:
      "The selected condition belongs to a different category than this listing. Please pick a condition from this listing's category.",
  },
  SINGLE_SELECT_VIOLATION: {
    title: "Only one condition allowed",
    message: "Only one condition can be selected per listing.",
  },
  OPTION_NOT_FOUND: {
    title: "Condition no longer available",
    message:
      "That condition option no longer exists. Please pick another one.",
  },
  LISTING_NOT_FOUND: {
    title: "Listing not found",
    message: "We couldn't find this listing. It may have been removed.",
  },
  PERMISSION_DENIED: {
    title: "Permission denied",
    message:
      "You don't have permission to perform this action on this listing.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again.",
  },
};

/**
 * Canonical category-mismatch message. Equal to
 * `LISTING_ERROR_COPY.CATEGORY_MISMATCH.message` and to the exact string the
 * database trigger raises.
 */
export const CATEGORY_MISMATCH_ERROR =
  LISTING_ERROR_COPY.CATEGORY_MISMATCH.message;

/** Test whether a raw server message is the category mismatch error. */
export function isCategoryMismatchError(message: string): boolean {
  return /different category than this listing|does not belong to this listing's category|does not belong to the selected category|condition_group_category_mismatch/i.test(
    message
  );
}

interface PostgrestErrorLike {
  message?: string | null;
  hint?: string | null;
  code?: string | null;
  details?: string | null;
}

function asPgError(err: unknown): PostgrestErrorLike {
  if (err && typeof err === "object") return err as PostgrestErrorLike;
  return {};
}

/**
 * Classify any server / client error from a listing or listing_conditions
 * mutation into a stable {@link ListingErrorCode} + canonical copy. Prefers
 * the trigger's `HINT` string, then falls back to message regexes.
 */
export function normalizeListingError(err: unknown): NormalizedListingError {
  const pg = asPgError(err);
  const raw =
    (typeof pg.message === "string" && pg.message) ||
    (err instanceof Error ? err.message : "") ||
    "";
  const hint = (pg.hint || "").toLowerCase();
  const haystack = `${raw} ${hint} ${pg.details ?? ""}`.toLowerCase();

  let code: ListingErrorCode = "UNKNOWN";

  if (
    hint.includes("condition_group_category_mismatch") ||
    isCategoryMismatchError(raw)
  ) {
    code = "CATEGORY_MISMATCH";
  } else if (
    hint.includes("single_select_violation") ||
    /only one condition can be selected|only have one condition selected|single-select/i.test(
      raw
    )
  ) {
    code = "SINGLE_SELECT_VIOLATION";
  } else if (/condition option no longer exists/i.test(raw)) {
    code = "OPTION_NOT_FOUND";
  } else if (/listing not found/i.test(raw)) {
    code = "LISTING_NOT_FOUND";
  } else if (
    pg.code === "42501" ||
    haystack.includes("row-level security") ||
    haystack.includes("permission denied")
  ) {
    code = "PERMISSION_DENIED";
  }

  const copy = LISTING_ERROR_COPY[code];
  return { code, title: copy.title, message: copy.message, raw };
}
