import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import ReviewsList from "@/components/ReviewsList";
import AvatarUpload from "@/components/AvatarUpload";
import ImageGalleryManager from "@/components/ImageGalleryManager";
import SellerAnalytics from "@/components/SellerAnalytics";
import FavoritesTab from "@/components/FavoritesTab";
import InvoiceDialog from "@/components/InvoiceDialog";
import SellerOrderManagement from "@/components/SellerOrderManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Gavel, User, Star, MapPin, Phone, MessageSquare, Image, BarChart3, Heart, Pencil, ShoppingBag, Truck } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import TrustBadges from "@/components/TrustBadges";

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
  created_at: string;
}

interface Bid {
  id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
  listing: {
    id: string;
    title: string;
    listing_type: string;
    current_bid: number | null;
    auction_ends_at: string | null;
  };
}

interface Order {
  id: string;
  listing_id: string;
  amount: number;
  status: string;
  tracking_number: string | null;
  invoice_number: string | null;
  delivery_option: string | null;
  created_at: string;
  updated_at: string;
  listings: {
    id: string;
    title: string;
    images: string[] | null;
    listing_type: string;
  };
  seller_profile: {
    full_name: string | null;
  } | null;
}

interface Profile {
  full_name: string | null;
  email: string;
  bio: string | null;
  phone: string | null;
  location: string | null;
  rating: number;
  total_reviews: number;
  kyc_status: string;
  kyc_verified_at: string | null;
  avatar_url: string | null;
  seller_type: "individual" | "business" | null;
  seller_verification_status: string | null;
  phone_verified_at: string | null;
  address_verified_at: string | null;
}

const VERIFICATION_LABEL: Record<string, string> = {
  not_started: "Not verified",
  pending_review: "Pending review",
  approved: "Verified seller",
  rejected: "Rejected",
  requires_more_info: "More info needed",
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [retrying, setRetrying] = useState(false);


  const TAB_ORDER = ["analytics", "listings", "favorites", "purchases", "sales", "bids", "reviews", "images", "profile"];
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem("dashboard_active_tab");
    return saved && TAB_ORDER.includes(saved) ? saved : "analytics";
  });
  const tabHydrated = useRef(false);
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const idx = TAB_ORDER.indexOf(activeTab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
    if (dx > 0 && idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
  };

  useEffect(() => {
    const el = tabsListRef.current?.querySelector<HTMLElement>(`[data-state="active"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTab]);

  // Load saved tab from server profile once user is available
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dashboard_active_tab")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const serverTab = (data as any)?.dashboard_active_tab as string | null;
      if (serverTab && TAB_ORDER.includes(serverTab)) {
        setActiveTab(serverTab);
      }
      tabHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist tab changes locally (fast) and to the server (cross-device)
  useEffect(() => {
    localStorage.setItem("dashboard_active_tab", activeTab);
    if (!user || !tabHydrated.current) return;
    supabase
      .from("profiles")
      .update({ dashboard_active_tab: activeTab })
      .eq("id", user.id)
      .then(() => {});
  }, [activeTab, user]);


  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const failed: string[] = [];

      // Fetch user's listings
      const listingsRes = await supabase
        .from("listings")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (listingsRes.error) {
        console.error("listings load error", listingsRes.error);
        failed.push("listings");
      } else {
        setListings(listingsRes.data || []);
      }

      // Fetch user's bids with listing details
      const bidsRes = await supabase
        .from("bids")
        .select(`
          id,
          amount,
          is_winning,
          created_at,
          listing:listings(id, title, listing_type, current_bid, auction_ends_at)
        `)
        .eq("bidder_id", user!.id)
        .order("created_at", { ascending: false });
      if (bidsRes.error) {
        console.error("bids load error", bidsRes.error);
        failed.push("bids");
      } else {
        setBids(bidsRes.data || []);
      }

      // Fetch user's orders (purchases)
      const ordersRes = await supabase
        .from("orders")
        .select(`
          id,
          listing_id,
          seller_id,
          amount,
          status,
          tracking_number,
          invoice_number,
          delivery_option,
          created_at,
          updated_at,
          listings(id, title, images, listing_type)
        `)
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (ordersRes.error) {
        console.error("orders load error", ordersRes.error);
        failed.push("purchases");
      }

      // Fetch seller orders (orders where user is the seller)
      const sellerOrdersRes = await supabase
        .from("orders")
        .select(`
          id,
          listing_id,
          buyer_id,
          amount,
          status,
          tracking_number,
          shipping_address,
          delivery_option,
          invoice_number,
          notes,
          created_at,
          updated_at,
          listings(id, title, images)
        `)
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (sellerOrdersRes.error) {
        console.error("seller orders load error", sellerOrdersRes.error);
        failed.push("sales");
      }

      // public_profiles is a view (no FK), so fetch related profiles separately
      const ordersData = ordersRes.data || [];
      const sellerOrdersData = sellerOrdersRes.data || [];
      const sellerIds = Array.from(new Set(ordersData.map((o: any) => o.seller_id).filter(Boolean)));
      const buyerIds = Array.from(new Set(sellerOrdersData.map((o: any) => o.buyer_id).filter(Boolean)));
      const allIds = Array.from(new Set([...sellerIds, ...buyerIds]));

      let profilesMap: Record<string, { full_name: string | null }> = {};
      if (allIds.length > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("public_profiles")
          .select("id, full_name")
          .in("id", allIds);
        if (profilesErr) {
          console.error("public_profiles load error", profilesErr);
        } else {
          profilesMap = Object.fromEntries((profilesData || []).map((p: any) => [p.id, { full_name: p.full_name }]));
        }
      }

      setOrders((ordersData as any[]).map((o) => ({
        ...o,
        seller_profile: profilesMap[o.seller_id] || { full_name: null },
      })) as any);

      setSellerOrders((sellerOrdersData as any[]).map((o) => ({
        ...o,
        buyer_profile: profilesMap[o.buyer_id] || { full_name: null },
      })) as any);

      // Fetch user profile (use maybeSingle to avoid hard error on missing row)
      const profileRes = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (profileRes.error) {
        console.error("profile load error", profileRes.error);
        failed.push("profile");
      } else {
        setProfile(profileRes.data as any);
      }

      setSectionErrors(failed);
      if (failed.length > 0) {
        toast.error(`Couldn't load: ${failed.join(", ")}`, {
          description: "Tap retry to try again.",
          action: { label: "Retry", onClick: () => fetchDashboardData() },
        });
      }
    } catch (error: any) {
      console.error("Dashboard load failed", error);
      const msg = error?.message || "Something went wrong loading your dashboard.";
      setLoadError(msg);
      toast.error("Failed to load dashboard", {
        description: msg,
        action: { label: "Retry", onClick: () => fetchDashboardData() },
      });
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const handleRetry = () => {
    setRetrying(true);
    fetchDashboardData();
  };


  const getInitials = (email: string, name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
          <div className="container px-4">
            <Skeleton className="h-12 w-64 mb-8" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  if (loadError) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
          <div className="container px-4 max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle>We couldn't load your dashboard</CardTitle>
                <CardDescription>{loadError}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button onClick={handleRetry} disabled={retrying}>
                  {retrying ? "Retrying…" : "Try again"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12 overflow-x-hidden">
        <div className="container px-4 max-w-full">
          {sectionErrors.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <span className="text-destructive">
                Some sections didn't load: {sectionErrors.join(", ")}.
              </span>
              <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
                {retrying ? "Retrying…" : "Retry"}
              </Button>
            </div>
          )}


          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8 text-center sm:text-left">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl">
                {getInitials(user.email || "U", profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold mb-1 truncate">
                {profile?.full_name || "User Dashboard"}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                <Badge variant={profile?.seller_verification_status === "approved" ? "default" : "secondary"}>
                  {VERIFICATION_LABEL[profile?.seller_verification_status || "not_started"]}
                </Badge>
                {profile && profile.total_reviews > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{profile.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({profile.total_reviews})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList ref={tabsListRef} className="flex w-full overflow-x-auto no-scrollbar h-auto flex-nowrap justify-start md:justify-center gap-1 p-1">

              <TabsTrigger value="analytics" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="listings" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Listings</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Favorites</span>
              </TabsTrigger>
              <TabsTrigger value="purchases" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Purchases</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <Truck className="w-4 h-4" />
                <span className="hidden sm:inline">Sales</span>
              </TabsTrigger>
              <TabsTrigger value="bids" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <Gavel className="w-4 h-4" />
                <span className="hidden sm:inline">Bids</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Reviews</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <Image className="w-4 h-4" />
                <span className="hidden sm:inline">Images</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex-shrink-0 gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:px-3">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
            </TabsList>

            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="touch-pan-y">
            {/* Analytics Tab */}

            <TabsContent value="analytics" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Seller Analytics</h2>
              <SellerAnalytics userId={user.id} />
            </TabsContent>

            {/* Listings Tab */}
            <TabsContent value="listings" className="mt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h2 className="text-xl sm:text-2xl font-semibold">My Listings</h2>
                <Button variant="accent" size="sm" className="sm:size-default" onClick={() => navigate("/create-listing")}>
                  Create New Listing
                </Button>
              </div>
              {listings.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">You haven't created any listings yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <Card 
                      key={listing.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/listings/${listing.id}`)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                            {listing.status}
                          </Badge>
                          <Badge variant="outline">{listing.listing_type}</Badge>
                        </div>
                        <CardTitle className="line-clamp-1">{listing.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {listing.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold">
                              {formatZAR(listing.listing_type === "fixed_price" 
                                ? listing.fixed_price 
                                : listing.current_bid || listing.starting_price)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Views:</span>
                            <span>{listing.view_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bids:</span>
                            <span>{listing.bid_count}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/listings/${listing.id}`);
                            }}
                          >
                            View Details
                          </Button>
                          {(listing.status === "active" || listing.status === "draft") && (
                            <Button 
                              variant="secondary" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/edit-listing/${listing.id}`);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">My Favorites</h2>
              <FavoritesTab userId={user.id} />
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent value="purchases" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">My Purchases</h2>
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">You haven't made any purchases yet.</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/listings")}>
                      Browse Listings
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const statusColors: Record<string, string> = {
                      pending: "secondary",
                      paid: "default",
                      shipped: "default",
                      delivered: "default",
                      cancelled: "destructive",
                      refunded: "secondary",
                    };
                    return (
                      <Card
                        key={order.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate(`/listings/${order.listing_id}`)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex flex-col sm:flex-row gap-4">
                            {order.listings?.images?.[0] ? (
                              <img
                                src={order.listings.images[0]}
                                alt={order.listings.title}
                                className="w-full sm:w-20 h-40 sm:h-20 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full sm:w-20 h-40 sm:h-20 bg-muted rounded-lg flex items-center justify-center">
                                <Package className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-base sm:text-lg truncate">{order.listings?.title}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Purchased {new Date(order.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge variant={statusColors[order.status] as any || "secondary"} className="shrink-0">
                                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <p className="text-lg font-bold text-primary">{formatZAR(order.amount)}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {order.tracking_number && (
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                      Tracking: {order.tracking_number}
                                    </p>
                                  )}
                                  {order.invoice_number && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <InvoiceDialog
                                        data={{
                                          invoiceNumber: order.invoice_number,
                                          orderDate: order.created_at,
                                          buyerName: profile?.full_name || "Buyer",
                                          buyerEmail: profile?.email || "",
                                          sellerName: order.seller_profile?.full_name || "Seller",
                                          listingTitle: order.listings?.title || "Item",
                                          amount: order.amount,
                                          deliveryOption: order.delivery_option,
                                          status: order.status,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Order Management</h2>
              <SellerOrderManagement orders={sellerOrders} onOrderUpdated={fetchDashboardData} />
            </TabsContent>

            <TabsContent value="bids" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">My Bids</h2>
              {bids.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Gavel className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">You haven't placed any bids yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bids.map((bid) => (
                    <Card 
                      key={bid.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/listings/${bid.listing.id}`)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{bid.listing.title}</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Your Bid:</span>
                                <p className="font-semibold text-lg">{formatZAR(bid.amount)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Current Bid:</span>
                                <p className="font-semibold text-lg">
                                  {formatZAR(bid.listing.current_bid)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {bid.is_winning && (
                              <Badge className="mb-2">Winning</Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(bid.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">My Reviews</h2>
              <ReviewsList userId={user.id} />
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">My Images</h2>
              <ImageGalleryManager userId={user.id} />
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Profile Settings</h2>
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                    <div>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>Manage your account details</CardDescription>
                    </div>
                    <AvatarUpload
                      userId={user.id}
                      currentAvatarUrl={profile?.avatar_url || null}
                      userInitial={getInitials(user.email || "U", profile?.full_name)}
                      onAvatarUpdate={(url) => {
                        if (profile) {
                          setProfile({ ...profile, avatar_url: url });
                        }
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="text-lg font-medium mt-1">{profile?.full_name || "Not set"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-lg font-medium mt-1">{profile?.email}</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone Number
                      </label>
                      <p className="text-lg font-medium mt-1">{profile?.phone || "Not set"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Location
                      </label>
                      <p className="text-lg font-medium mt-1">{profile?.location || "Not set"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Bio</label>
                    <p className="mt-1 text-foreground whitespace-pre-wrap">
                      {profile?.bio || "No bio yet - tell others about yourself!"}
                    </p>
                  </div>

                  <ProfileEditDialog
                    userId={user.id}
                    currentProfile={{
                      full_name: profile?.full_name || null,
                      phone: profile?.phone || null,
                      location: profile?.location || null,
                      bio: profile?.bio || null,
                    }}
                    onProfileUpdate={fetchDashboardData}
                  >
                    <Button variant="default" className="w-full md:w-auto">
                      Edit Profile
                    </Button>
                  </ProfileEditDialog>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Seller Verification</CardTitle>
                  <CardDescription>
                    Verify your identity (and business details) to unlock selling on OX
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Verification Status</label>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={profile?.seller_verification_status === "approved" ? "default" : "secondary"}>
                        {VERIFICATION_LABEL[profile?.seller_verification_status || "not_started"]}
                      </Badge>
                      {profile && (
                        <TrustBadges
                          profile={{
                            seller_type: profile.seller_type,
                            seller_verification_status: profile.seller_verification_status,
                            phone_verified_at: profile.phone_verified_at,
                            address_verified_at: profile.address_verified_at,
                          }}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                  {profile?.seller_verification_status !== "approved" && (
                    <Link to="/seller-verification">
                      <Button className="w-full">
                        {profile?.seller_verification_status === "rejected"
                          ? "Resubmit verification"
                          : profile?.seller_verification_status === "requires_more_info"
                          ? "Provide more information"
                          : profile?.seller_verification_status === "pending_review"
                          ? "View verification status"
                          : "Start verification"}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            </div>
          </Tabs>

        </div>
      </main>
    </>
  );
};

export default Dashboard;
