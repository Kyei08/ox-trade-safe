// Persists Create Listing form progress (incl. uploaded image URLs) per-user.
// Image binaries live in Supabase Storage; we persist the resulting public URLs
// so they survive refreshes/returns. Drafts are mirrored to the `listing_drafts`
// table so progress syncs across devices.

import { supabase } from "@/integrations/supabase/client";

export interface CreateListingDraft {
  v: 1;
  savedAt: number;
  values: {
    title?: string;
    description?: string;
    category_id?: string;
    subcategory_id?: string;
    listing_type?: "fixed_price" | "auction";
    condition?: string;
    condition_option_id?: string;
    location?: string;
    delivery_options?: string[];
    fixed_price?: string;
    starting_price?: string;
    reserve_price?: string;
    auction_ends_at?: string;
  };
  uploadedImages: string[];
  selectedCondition: {
    optionId: string;
    optionName: string;
    optionSlug: string;
    groupId: string;
  } | null;
}

const keyFor = (userId: string) => `ox.createListingDraft.${userId}`;

export function loadDraft(userId: string): CreateListingDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateListingDraft;
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: Omit<CreateListingDraft, "v" | "savedAt">) {
  try {
    const payload: CreateListingDraft = { v: 1, savedAt: Date.now(), ...draft };
    localStorage.setItem(keyFor(userId), JSON.stringify(payload));
  } catch {
    // ignore quota/serialization errors
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

export function hasMeaningfulDraft(d: CreateListingDraft | null): boolean {
  if (!d) return false;
  const v = d.values || {};
  return Boolean(
    v.title ||
      v.description ||
      v.category_id ||
      v.location ||
      (v.delivery_options && v.delivery_options.length) ||
      v.fixed_price ||
      v.starting_price ||
      v.reserve_price ||
      v.auction_ends_at ||
      (d.uploadedImages && d.uploadedImages.length) ||
      d.selectedCondition,
  );
}

// ---------- Remote (cross-device) sync ----------

export async function fetchRemoteDraft(userId: string): Promise<CreateListingDraft | null> {
  try {
    const { data, error } = await supabase
      .from("listing_drafts")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data?.data) return null;
    const parsed = data.data as CreateListingDraft;
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function pushRemoteDraft(
  userId: string,
  draft: Omit<CreateListingDraft, "v" | "savedAt">,
): Promise<void> {
  try {
    const payload: CreateListingDraft = { v: 1, savedAt: Date.now(), ...draft };
    await supabase
      .from("listing_drafts")
      .upsert({ user_id: userId, data: payload as any }, { onConflict: "user_id" });
  } catch {
    // ignore network errors; localStorage still has the draft
  }
}

export async function clearRemoteDraft(userId: string): Promise<void> {
  try {
    await supabase.from("listing_drafts").delete().eq("user_id", userId);
  } catch {
    // ignore
  }
}

/**
 * Picks the freshest draft between local and remote, mirroring the winner
 * into local storage. Returns null when neither side has anything meaningful.
 */
export async function resolveDraft(userId: string): Promise<CreateListingDraft | null> {
  const local = loadDraft(userId);
  const remote = await fetchRemoteDraft(userId);

  const localMeaningful = hasMeaningfulDraft(local);
  const remoteMeaningful = hasMeaningfulDraft(remote);

  if (!localMeaningful && !remoteMeaningful) return null;
  if (remoteMeaningful && (!localMeaningful || (remote!.savedAt ?? 0) > (local?.savedAt ?? 0))) {
    // Remote wins — mirror into local cache
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(remote));
    } catch {
      // ignore
    }
    return remote;
  }
  return local;
}
