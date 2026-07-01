import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SelectedCondition } from "@/components/ConditionSelector";
import { CATEGORY_MISMATCH_ERROR } from "@/lib/listingValidation";
import { trackEvent } from "@/lib/analytics";

/**
 * Shared hook that derives the valid condition groups for a selected
 * category and reports mismatch/blocking state for both the Create Listing
 * and Edit Listing forms.
 *
 * Centralizing this here keeps client pre-validation identical across the
 * two pages and matches the server-side trigger
 * `enforce_single_select_listing_condition`.
 */
export interface ConditionGroupRef {
  id: string;
  category_id: string;
  name: string;
}

export interface UseConditionCategoryMatchArgs {
  /** Currently selected category on the form. */
  selectedCategoryId: string | null | undefined;
  /** Currently selected condition (option) on the form. */
  selectedCondition: SelectedCondition | null | undefined;
  /**
   * Whether the category exposes any condition groups (the ConditionSelector
   * reports this via `onGroupsLoaded`). When true, a selection is required.
   */
  hasConditionGroups: boolean;
  /** Source form for analytics segmentation (e.g. "create_listing"). */
  source?: string;
}


export interface UseConditionCategoryMatchResult {
  /** Valid condition groups for the selected category. */
  validGroups: ConditionGroupRef[];
  /** True while groups are being fetched for the selected category. */
  loadingGroups: boolean;
  /**
   * True when the selected condition's group belongs to a *different*
   * category than the currently selected category. Mirrors the server's
   * `condition_group_category_mismatch` check.
   */
  isMismatch: boolean;
  /** True when a condition is required (groups exist) but none is selected. */
  isMissingRequired: boolean;
  /** Combined flag: should the submit button be disabled? */
  blocksSubmit: boolean;
  /** Canonical mismatch message, identical to the server trigger's message. */
  mismatchMessage: string;
}

export function useConditionCategoryMatch({
  selectedCategoryId,
  selectedCondition,
  hasConditionGroups,
}: UseConditionCategoryMatchArgs): UseConditionCategoryMatchResult {
  const [validGroups, setValidGroups] = useState<ConditionGroupRef[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (!selectedCategoryId) {
      setValidGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGroups(true);
      const { data } = await supabase
        .from("category_condition_groups")
        .select("id, category_id, name")
        .eq("category_id", selectedCategoryId);
      if (cancelled) return;
      setValidGroups((data as ConditionGroupRef[] | null) ?? []);
      setLoadingGroups(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  const isMismatch = useMemo(() => {
    if (!selectedCondition?.groupCategoryId || !selectedCategoryId) return false;
    return selectedCondition.groupCategoryId !== selectedCategoryId;
  }, [selectedCondition?.groupCategoryId, selectedCategoryId]);

  const isMissingRequired = hasConditionGroups && !selectedCondition;
  const blocksSubmit = isMismatch || isMissingRequired;

  return {
    validGroups,
    loadingGroups,
    isMismatch,
    isMissingRequired,
    blocksSubmit,
    mismatchMessage: CATEGORY_MISMATCH_ERROR,
  };
}
