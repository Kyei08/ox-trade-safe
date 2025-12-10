import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Clock, AlertTriangle } from "lucide-react";
import FavoriteButton from "./FavoriteButton";

interface FavoriteListing {
  id: string;
  title: string;
  description: string;
  listing_type: string;
  status: string;
  fixed_price: number | null;
  current_bid: number | null;
  starting_price: number | null;
  auction_ends_at: string | null;
  images: string[] | null;
}

interface Favorite {
  id: string;
  listing_id: string;
  created_at: string;
  listings: FavoriteListing;
}

interface FavoritesTabProps {
  userId: string;
}

const FavoritesTab = ({ userId }: FavoritesTabProps) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, [userId]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          listing_id,
          created_at,
          listings (
            id,
            title,
            description,
            listing_type,
            status,
            fixed_price,
            current_bid,
            starting_price,
            auction_ends_at,
            images
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites((data as unknown as Favorite[]) || []);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (listing: FavoriteListing) => {
    if (listing.listing_type === "fixed_price") {
      return listing.fixed_price;
    }
    return listing.current_bid || listing.starting_price;
  };

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return { text: "Ended", urgent: false };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 24) {
      return { text: `${hours}h left`, urgent: true };
    }
    if (days <= 3) {
      return { text: `${days}d left`, urgent: true };
    }
    return { text: `${days}d left`, urgent: false };
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">You haven't saved any favorites yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Browse listings and click the heart icon to save items you're interested in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {favorites.map((favorite) => {
        const listing = favorite.listings;
        if (!listing) return null;

        const price = getPrice(listing);
        const timeRemaining = listing.listing_type === "auction" 
          ? getTimeRemaining(listing.auction_ends_at) 
          : null;

        return (
          <Card
            key={favorite.id}
            className="group relative cursor-pointer hover:shadow-lg transition-shadow"
          >
            <Link to={`/listings/${listing.id}`}>
              {/* Image */}
              <div className="aspect-video relative overflow-hidden rounded-t-lg bg-muted">
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
                
                {/* Urgent indicator for ending soon */}
                {timeRemaining?.urgent && listing.status === "active" && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {timeRemaining.text}
                    </Badge>
                  </div>
                )}

                {/* Status badge for non-active */}
                {listing.status !== "active" && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary">{listing.status}</Badge>
                  </div>
                )}
              </div>

              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="line-clamp-1 text-lg">{listing.title}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {listing.description}
                    </CardDescription>
                  </div>
                  <Badge variant={listing.listing_type === "auction" ? "default" : "secondary"}>
                    {listing.listing_type === "auction" ? "Auction" : "Fixed"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {listing.listing_type === "auction" ? "Current Bid" : "Price"}
                    </p>
                    <p className="text-xl font-bold text-primary">
                      R {price?.toLocaleString() || "N/A"}
                    </p>
                  </div>
                  
                  {timeRemaining && !timeRemaining.urgent && listing.status === "active" && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {timeRemaining.text}
                    </div>
                  )}
                </div>
              </CardContent>
            </Link>

            {/* Favorite button - positioned absolutely */}
            <div className="absolute top-2 right-2 z-10">
              <FavoriteButton
                listingId={listing.id}
                className="bg-background/80 backdrop-blur-sm hover:bg-background"
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default FavoritesTab;