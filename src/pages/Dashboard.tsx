import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Gavel, User, Star, Calendar, DollarSign } from "lucide-react";
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

interface Profile {
  full_name: string | null;
  email: string;
  bio: string | null;
  phone: string | null;
  rating: number;
  total_reviews: number;
  kyc_status: string;
  kyc_verified_at: string | null;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
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
          <Tabs defaultValue="listings" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="listings">
                <Package className="w-4 h-4 mr-2" />
                Listings
              </TabsTrigger>
              <TabsTrigger value="bids">
                <Gavel className="w-4 h-4 mr-2" />
                Bids
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
            </TabsList>

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
                    <Card key={listing.id}>
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
                              ${listing.listing_type === "fixed_price" 
                                ? listing.fixed_price?.toFixed(2) 
                                : listing.current_bid?.toFixed(2) || listing.starting_price?.toFixed(2)}
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
                        <Button variant="outline" className="w-full mt-4">
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
                    <Card key={bid.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{bid.listing.title}</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Your Bid:</span>
                                <p className="font-semibold text-lg">${bid.amount.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Current Bid:</span>
                                <p className="font-semibold text-lg">
                                  ${bid.listing.current_bid?.toFixed(2)}
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

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Profile Settings</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Manage your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <p className="text-lg">{profile?.full_name || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <p className="text-lg">{profile?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <p className="text-lg">{profile?.phone || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Bio</label>
                    <p className="text-muted-foreground">{profile?.bio || "No bio yet"}</p>
                  </div>
                  <Button variant="outline" className="mt-4">Edit Profile</Button>
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
