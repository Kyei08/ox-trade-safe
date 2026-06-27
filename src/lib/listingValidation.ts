/**
 * Centralized validation messages for listing operations.
 * Keep these in sync with the database trigger
 * `enforce_single_select_listing_condition` so client pre-validation and server
 * errors stay identical.
 */

/** Raised when a selected condition option belongs to a different category than the listing. */
export const CATEGORY_MISMATCH_ERROR =
  "The selected condition belongs to a different category than this listing. Please pick a condition from this listing's category.";

/** Test whether a raw server message is the category mismatch error. */
export function isCategoryMismatchError(message: string): boolean {
  return /different category than this listing|does not belong to this listing's category|does not belong to the selected category/i.test(
    message
  );
}
