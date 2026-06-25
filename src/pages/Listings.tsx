import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Search, Filter, Clock, MapPin, Eye, User, ArrowUp, ArrowDown } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { trackEvent } from "@/lib/analytics";
import DynamicConditionFilters from "@/components/DynamicConditionFilters";

interface Listing {
  id: string;
  title: string;
  description: string;
  listing_type: string;
  status: string;
  fixed_price: number | null;
  current_bid: number | null;
  starting_price: number | null;
  bid_count: number;
  view_count: number;
  location: string;
  condition: string;
  auction_ends_at: string | null;
  created_at: string;
  category_id: string;
  seller_id: string;
  images: string[] | null;
  public_profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}


interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

const PAGE_SIZE = 24;

type SortField = "created_at" | "auction_ends_at" | "fixed_price";
type Cursor = { sortField: SortField; sortValue: string | number; id: string } | null;

const Listings = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");
  const [selectedSubcategory, setSelectedSubcategory] = useState(searchParams.get("subcategory") || "all");
  const [listingType, setListingType] = useState(searchParams.get("type") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    (searchParams.get("conditions") || "").split(",").filter(Boolean)
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchListings("replace", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedSubcategory, listingType, sortBy, selectedOptionIds]);

  // Sync search params -> state (e.g. when arriving via homepage category card or back/forward nav)
  useEffect(() => {
    const cat = searchParams.get("category") || "all";
    const sub = searchParams.get("subcategory") || "all";
    setSelectedCategory(cat);
    setSelectedSubcategory(sub);

    const urlConditions = (searchParams.get("conditions") || "")
      .split(",")
      .filter(Boolean);
    setSelectedOptionIds((prev) => {
      if (
        prev.length === urlConditions.length &&
        prev.every((id, i) => id === urlConditions[i])
      ) {
        return prev;
      }
      return urlConditions;
    });
  }, [searchParams]);

  // Load subcategories whenever the selected category changes
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (selectedCategory === "all") {
        setSubcategories([]);
        return;
      }
      const { data } = await supabase
        .from("subcategories")
        .select("id, category_id, name, slug, sort_order")
        .eq("category_id", selectedCategory)
        .order("sort_order", { ascending: true });
      setSubcategories(data || []);
    };
    fetchSubcategories();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, icon")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error("Failed to load categories:", error);
    }
  };


  const getSortConfig = (): { field: SortField; ascending: boolean; excludeNull: boolean } => {
    switch (sortBy) {
      case "ending-soon":
        return { field: "auction_ends_at", ascending: true, excludeNull: true };
      case "price-low":
        return { field: "fixed_price", ascending: true, excludeNull: true };
      case "price-high":
        return { field: "fixed_price", ascending: false, excludeNull: true };
      case "newest":
      default:
        return { field: "created_at", ascending: false, excludeNull: false };
    }
  };

  const fetchListings = async (
    mode: "replace" | "append" = "replace",
    cursorArg: Cursor = null
  ) => {
    try {
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);

      // If condition chips are selected, look up matching listing_ids first.
      // The covering index (option_id, listing_id) on listing_conditions keeps this index-only.
      let conditionListingIds: string[] | null = null;
      if (selectedOptionIds.length > 0) {
        const uniqueOptionIds = Array.from(new Set(selectedOptionIds));
        const { data: lc, error: lcError } = await supabase
          .from("listing_conditions")
          .select("listing_id")
          .in("option_id", uniqueOptionIds)
          .limit(5000);
        if (lcError) throw lcError;
        conditionListingIds = Array.from(new Set((lc || []).map((r: any) => r.listing_id)));
        if (conditionListingIds.length === 0) {
          if (mode === "replace") setListings([]);
          setHasMore(false);
          setCursor(null);
          return;
        }
      }

      const { field, ascending, excludeNull } = getSortConfig();

      let query = supabase
        .from("listings")
        .select(`
          *,
          public_profiles!seller_id (
            full_name,
            avatar_url
          )
        `)
        .eq("status", "active");

      if (conditionListingIds) {
        query = query.in("id", conditionListingIds);
      }

      if (selectedCategory !== "all") {
        query = query.eq("category_id", selectedCategory);
      }
      if (selectedSubcategory !== "all") {
        query = query.eq("subcategory_id", selectedSubcategory);
      }
      if (listingType === "fixed_price" || listingType === "auction") {
        query = query.eq("listing_type", listingType);
      }
      if (excludeNull) {
        query = query.not(field, "is", null);
      }

      // Keyset cursor: (sort_field, id) tuple, id as deterministic tiebreaker
      if (cursorArg && cursorArg.sortField === field) {
        const op = ascending ? "gt" : "lt";
        const v = cursorArg.sortValue;
        const idOp = ascending ? "gt" : "lt";
        // (field op v) OR (field = v AND id idOp cursor.id)
        query = query.or(
          `${field}.${op}.${v},and(${field}.eq.${v},id.${idOp}.${cursorArg.id})`
        );
      }

      query = query
        .order(field, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .limit(PAGE_SIZE);

      const { data, error } = await query;
      if (error) throw error;

      let pageData = (data || []) as Listing[];

      // Client-side search filter (page-scoped, same as before)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        pageData = pageData.filter(
          (l) =>
            l.title.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            l.location.toLowerCase().includes(q)
        );
      }

      const rawCount = (data || []).length;
      const more = rawCount === PAGE_SIZE;
      setHasMore(more);
      if (more) {
        const last: any = (data as any[])[rawCount - 1];
        setCursor({ sortField: field, sortValue: last[field], id: last.id });
      } else {
        setCursor(null);
      }

      setListings((prev) => (mode === "append" ? [...prev, ...pageData] : pageData));
    } catch (error: any) {
      toast.error("Failed to load listings");
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    fetchListings("append", cursor);
  };


  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedSubcategory !== "all") params.set("subcategory", selectedSubcategory);
    if (listingType !== "all") params.set("type", listingType);
    if (sortBy !== "newest") params.set("sort", sortBy);
    setSearchParams(params);
    setCursor(null);
    setHasMore(true);
    fetchListings("replace", null);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubcategory("all"); // reset subcategory when category changes
    setSelectedOptionIds([]); // reset condition chips when category changes
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    params.delete("subcategory");
    params.delete("conditions");
    setSearchParams(params);
  };

  const toggleConditionOption = (
    optionId: string,
    context?: { isMultiSelect: boolean; siblingIds: string[] }
  ) => {
    setSelectedOptionIds((prev) => {
      const wasActive = prev.includes(optionId);
      let next: string[];
      if (context && !context.isMultiSelect) {
        // Single-select: drop any sibling in the same group, then toggle this one
        const withoutSiblings = prev.filter((id) => !context.siblingIds.includes(id));
        next = wasActive ? withoutSiblings : [...withoutSiblings, optionId];
      } else {
        next = wasActive ? prev.filter((id) => id !== optionId) : [...prev, optionId];
      }
      const params = new URLSearchParams(searchParams);
      if (next.length === 0) {
        params.delete("conditions");
      } else {
        params.set("conditions", next.join(","));
      }
      setSearchParams(params);
      trackEvent("listings_condition_toggled", { option_id: optionId, active: !wasActive });
      return next;
    });
  };


  const handleSubcategoryChange = (value: string) => {
    setSelectedSubcategory(value);
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("subcategory");
    } else {
      params.set("subcategory", value);
    }
    setSearchParams(params);
  };

  const handleTypeChange = (value: string) => {
    setListingType(value);
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    setSearchParams(params);
  };


  const handleSortChange = (value: string) => {
    setSortBy(value);
    const params = new URLSearchParams(searchParams);
    if (value === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }
    setSearchParams(params);
    trackEvent("listings_sort_changed", { sort_by: value });
  };

  const handlePriceSortClick = () => {
    if (sortBy === "price-low") {
      handleSortChange("price-high");
    } else {
      handleSortChange("price-low");
    }
  };

  const getPrice = (listing: Listing) => {
    if (listing.listing_type === "fixed_price") {
      return formatZAR(listing.fixed_price);
    }
    return formatZAR(listing.current_bid ?? listing.starting_price);
  };

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-muted/30 pt-16 sm:pt-32 pb-12">
        <div className="container px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Browse Listings</h1>
            <p className="text-muted-foreground mt-1">
              Discover amazing deals and unique items across South Africa
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="space-y-4 mb-8">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 py-6 bg-card shadow-sm border-border"
                />
              </div>
              <Button onClick={handleSearch} className="px-8 py-6 font-semibold">
                Search
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filters:</span>
              </div>

              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-auto min-w-[160px] rounded-full bg-card shadow-sm border-border">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={listingType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-auto min-w-[140px] rounded-full bg-card shadow-sm border-border">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                  <SelectItem value="auction">Auction</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-muted-foreground font-medium text-sm hidden sm:inline">Sort:</span>
                <button
                  type="button"
                  onClick={() => handleSortChange("newest")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    sortBy === "newest"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Newest
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange("ending-soon")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1 ${
                    sortBy === "ending-soon"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Ending Soon
                </button>
                <button
                  type="button"
                  onClick={handlePriceSortClick}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1 ${
                    sortBy === "price-low" || sortBy === "price-high"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  Price
                  {sortBy === "price-low" && <ArrowUp className="w-3 h-3" />}
                  {sortBy === "price-high" && <ArrowDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Subcategory chips */}
            {selectedCategory !== "all" && subcategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => handleSubcategoryChange("all")}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedSubcategory === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  All
                </button>
                {subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubcategoryChange(sub.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedSubcategory === sub.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* Dynamic Condition Filters */}
            <DynamicConditionFilters
              categoryId={selectedCategory}
              selectedOptionIds={selectedOptionIds}
              onToggle={toggleConditionOption}
            />
          </div>


          {/* Results Count */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground font-medium">
              {loading ? "Loading..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {/* Listings Grid */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-10 w-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No listings found</p>
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setListingType("all");
                  setSortBy("newest");
                  setSelectedOptionIds([]);
                  setSearchParams({});
                  fetchListings();
                }}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => {
                const isAuction = listing.listing_type === "auction";
                const cover = listing.images?.[0];
                const conditionLabel = listing.condition?.replace(/_/g, " ") || "";
                return (
                  <div
                    key={listing.id}
                    onClick={() => navigate(`/listings/${listing.id}`)}
                    className="group cursor-pointer bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                  >
                    {/* Image */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {cover ? (
                        <img
                          src={cover}
                          alt={listing.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className={`px-2 py-1 backdrop-blur rounded text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                          isAuction
                            ? "bg-accent/95 text-accent-foreground"
                            : "bg-card/90 text-primary"
                        }`}>
                          {isAuction ? "Auction" : "Fixed Price"}
                        </span>
                        {conditionLabel && (
                          <span className="px-2 py-1 bg-card/90 backdrop-blur rounded text-[10px] font-bold uppercase tracking-wider text-foreground/80 shadow-sm">
                            {conditionLabel}
                          </span>
                        )}
                      </div>

                      {/* Favorite */}
                      <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton
                          listingId={listing.id}
                          className="bg-card/90 backdrop-blur shadow-sm hover:bg-card"
                        />
                      </div>

                      {/* Auction timer overlay */}
                      {isAuction && listing.auction_ends_at && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-foreground/80 backdrop-blur rounded text-[11px] font-semibold text-background">
                          <Clock className="w-3 h-3" />
                          {getTimeRemaining(listing.auction_ends_at)}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {listing.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {listing.description}
                      </p>

                      <div className="mt-4 flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {isAuction ? "Current Bid" : "Price"}
                        </span>
                        <span className="text-2xl font-bold text-foreground">
                          {getPrice(listing)}
                        </span>
                        {isAuction && (
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {listing.bid_count} bid{listing.bid_count !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          {listing.location}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {listing.view_count}
                        </div>
                      </div>

                      {/* Seller */}
                      <Link
                        to={`/seller/${listing.seller_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 flex items-center gap-2 group/seller"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={listing.public_profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {listing.public_profiles?.full_name?.charAt(0) || <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-muted-foreground group-hover/seller:text-foreground truncate">
                          {listing.public_profiles?.full_name || "Anonymous"}
                        </span>
                        <span className="ml-auto h-2 w-2 rounded-full bg-success" />
                      </Link>

                      <Button variant="accent" className="w-full mt-5 font-bold">
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default Listings;
