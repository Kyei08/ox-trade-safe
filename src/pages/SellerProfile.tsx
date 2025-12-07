import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewsList from "@/components/ReviewsList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShieldCheck, MapPin, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

interface PublicProfile {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  kyc_status: string | null;
  created_at: string | null;
}

interface Listing {
  id: string;
  title: string;
  images: string[] | null;
  listing_type: string;
  status: string;
  fixed_price: number | null;
  current_bid: number | null;
  starting_price: number | null;
}

const SellerProfile = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerData = async () => {
      if (!sellerId) return;

      const [profileRes, listingsRes] = await Promise.all([
        supabase
          .from("public_profiles")
          .select("*")
          .eq("id", sellerId)
          .single(),
        supabase
          .from("listings")
          .select("id, title, images, listing_type, status, fixed_price, current_bid, starting_price")
          .eq("seller_id", sellerId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }
      if (listingsRes.data) {
        setListings(listingsRes.data);
      }
      setLoading(false);
    };

    fetchSellerData();
  }, [sellerId]);

  const getInitials = (name: string | null) => {
    if (!name) return "S";
    return name.charAt(0).toUpperCase();
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return `R ${price.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-foreground">Seller not found</h1>
            <p className="text-muted-foreground mt-2">This seller profile doesn't exist.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <Avatar className="h-24 w-24 border-4 border-primary/20">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || "Seller"} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {profile.full_name || "Anonymous Seller"}
                    </h1>
                    {profile.kyc_status === "verified" && (
                      <Badge variant="secondary" className="w-fit mx-auto sm:mx-0">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  
                  {profile.bio && (
                    <p className="text-muted-foreground">{profile.bio}</p>
                  )}
                  
                  <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                    {profile.rating !== null && profile.rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-foreground">{profile.rating.toFixed(1)}</span>
                        <span>({profile.total_reviews} reviews)</span>
                      </div>
                    )}
                    {profile.created_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Member since {format(new Date(profile.created_at), "MMM yyyy")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Listings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Active Listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No active listings at the moment.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listings.map((listing) => (
                    <Link
                      key={listing.id}
                      to={`/listing/${listing.id}`}
                      className="group block"
                    >
                      <Card className="overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
                        <div className="aspect-square bg-muted relative overflow-hidden">
                          {listing.images && listing.images[0] ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              No image
                            </div>
                          )}
                          <Badge
                            variant={listing.listing_type === "auction" ? "default" : "secondary"}
                            className="absolute top-2 right-2"
                          >
                            {listing.listing_type === "auction" ? "Auction" : "Fixed Price"}
                          </Badge>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {listing.title}
                          </h3>
                          <p className="text-primary font-semibold mt-1">
                            {listing.listing_type === "auction"
                              ? formatPrice(listing.current_bid || listing.starting_price)
                              : formatPrice(listing.fixed_price)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews */}
          {sellerId && <ReviewsList userId={sellerId} />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerProfile;
