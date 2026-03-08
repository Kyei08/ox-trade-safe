const STORAGE_KEY = "ox_recently_viewed";
const MAX_ITEMS = 12;

export interface RecentlyViewedItem {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  listing_type: string;
  viewedAt: number;
}

export const addRecentlyViewed = (item: Omit<RecentlyViewedItem, "viewedAt">) => {
  try {
    const existing = getRecentlyViewed();
    const filtered = existing.filter((i) => i.id !== item.id);
    const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
};

export const getRecentlyViewed = (): RecentlyViewedItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
