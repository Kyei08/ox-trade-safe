import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Gavel, User, Star, MapPin, Phone, MessageSquare, Image, BarChart3, Heart, Pencil, ShoppingBag } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";

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
  created_at: string;
  updated_at: string;
  listings: {
    id: string;
    title: string;
    images: string[] | null;
    listing_type: string;
  };
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
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Fetch user's listings
      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });

      if (listingsError) throw listingsError;
      setListings(listingsData || []);

      // Fetch user's bids with listing details
      const { data: bidsData, error: bidsError } = await supabase
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

      if (bidsError) throw bidsError;
      setBids(bidsData || []);

      // Fetch user's orders (purchases)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          listing_id,
          amount,
          status,
          tracking_number,
          created_at,
          updated_at,
          listings(id, title, images, listing_type)
        `)
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

    } catch (error: any) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (email: string, name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-24 pb-12">
          <div className="container px-4">
            <Skeleton className="h-12 w-64 mb-8" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container px-4">
          {/* Dashboard Header */}
          <div className="flex items-center gap-6 mb-8">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {getInitials(user.email || "U", profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {profile?.full_name || "User Dashboard"}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={profile?.kyc_status === "verified" ? "default" : "secondary"}>
                  {profile?.kyc_status || "pending"}
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
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="grid w-full grid-cols-7 max-w-5xl">
              <TabsTrigger value="analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="listings">
                <Package className="w-4 h-4 mr-2" />
                Listings
              </TabsTrigger>
              <TabsTrigger value="favorites">
                <Heart className="w-4 h-4 mr-2" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="bids">
                <Gavel className="w-4 h-4 mr-2" />
                Bids
              </TabsTrigger>
              <TabsTrigger value="reviews">
                <MessageSquare className="w-4 h-4 mr-2" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="w-4 h-4 mr-2" />
                Images
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Seller Analytics</h2>
              <SellerAnalytics userId={user.id} />
            </TabsContent>

            {/* Listings Tab */}
            <TabsContent value="listings" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Listings</h2>
                <Button variant="accent" onClick={() => navigate("/create-listing")}>
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

            {/* Bids Tab */}
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
                  <CardTitle>KYC Verification</CardTitle>
                  <CardDescription>Verify your identity to unlock full platform features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Verification Status</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={profile?.kyc_status === "verified" ? "default" : "secondary"}>
                          {profile?.kyc_status || "pending"}
                        </Badge>
                        {profile?.kyc_status === "verified" && profile.kyc_verified_at && (
                          <span className="text-sm text-muted-foreground">
                            Verified on {new Date(profile.kyc_verified_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {profile?.kyc_status !== "verified" && (
                    <Link to="/kyc">
                      <Button className="w-full">
                        {profile?.kyc_status === "rejected" ? "Resubmit KYC" : "Start Verification"}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
};

export default Dashboard;
