import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Package, Clock, Gavel, User, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Listing {
  id: string;
  title: string;
  description: string;
  listing_type: string;
  status: string;
  condition: string;
  location: string;
  images: string[];
  fixed_price: number | null;
  starting_price: number | null;
  reserve_price: number | null;
  current_bid: number | null;
  bid_count: number;
  view_count: number;
  auction_ends_at: string | null;
  seller_id: string;
  created_at: string;
  public_profiles: {
    full_name: string;
    rating: number;
    total_reviews: number;
  };
}

interface Bid {
  id: string;
  amount: number;
  bidder_id: string;
  created_at: string;
  is_winning: boolean;
  public_profiles: {
    full_name: string;
  };
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    if (id) {
      fetchListing();
      fetchBids();
      incrementViewCount();
    }
  }, [id]);

  // Real-time bid updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`listing-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `listing_id=eq.${id}`,
        },
        () => {
          fetchBids();
          fetchListing(); // Refresh to get updated current_bid
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!listing?.auction_ends_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(listing.auction_ends_at!).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeRemaining("Auction ended");
        clearInterval(interval);
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [listing]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          public_profiles!seller_id (
            full_name,
            rating,
            total_reviews
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setListing(data);
    } catch (error) {
      console.error("Error fetching listing:", error);
      toast({
        title: "Error",
        description: "Failed to load listing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select(`
          *,
          public_profiles!bidder_id (
            full_name
          )
        `)
        .eq("listing_id", id)
        .order("amount", { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error("Error fetching bids:", error);
    }
  };

  const incrementViewCount = async () => {
    try {
      const { data: currentListing } = await supabase
        .from("listings")
        .select("view_count")
        .eq("id", id)
        .single();

      if (currentListing) {
        await supabase
          .from("listings")
          .update({ view_count: (currentListing.view_count || 0) + 1 })
          .eq("id", id);
      }
    } catch (error) {
      console.error("Error incrementing view count:", error);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to place a bid",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    const amount = parseFloat(bidAmount);
    const minimumBid = listing?.current_bid 
      ? listing.current_bid + 1 
      : listing?.starting_price || 0;

    if (amount < minimumBid) {
      toast({
        title: "Invalid bid",
        description: `Minimum bid is $${minimumBid.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (user.id === listing?.seller_id) {
      toast({
        title: "Invalid action",
        description: "You cannot bid on your own listing",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Mark all previous bids as not winning
      await supabase
        .from("bids")
        .update({ is_winning: false })
        .eq("listing_id", id);

      // Place new bid
      const { error: bidError } = await supabase
        .from("bids")
        .insert({
          listing_id: id,
          bidder_id: user.id,
          amount,
          is_winning: true,
        });

      if (bidError) throw bidError;

      // Update listing current_bid and bid_count
      const { error: updateError } = await supabase
        .from("listings")
        .update({
          current_bid: amount,
          bid_count: (listing?.bid_count || 0) + 1,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast({
        title: "Bid placed successfully",
        description: `Your bid of $${amount.toFixed(2)} has been placed`,
      });

      setBidAmount("");
      fetchListing();
      fetchBids();
    } catch (error: any) {
      toast({
        title: "Failed to place bid",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to make a purchase",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { listingId: id },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, "_blank");
        toast({
          title: "Redirecting to payment",
          description: "Opening Stripe checkout in a new tab",
        });
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user || !listing) return;

    try {
      // Check if conversation already exists
      const { data: existingConv, error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("buyer_id", user.id)
        .eq("seller_id", listing.seller_id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingConv) {
        // Navigate to existing conversation
        navigate(`/messages/${existingConv.id}`);
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            listing_id: listing.id,
            buyer_id: user.id,
            seller_id: listing.seller_id,
          })
          .select()
          .single();

        if (createError) throw createError;

        navigate(`/messages/${newConv.id}`);
      }
    } catch (error: any) {
      console.error("Error starting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertDescription>Listing not found</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const isAuction = listing.listing_type === "auction";
  const isOwner = user?.id === listing.seller_id;
  const currentPrice = isAuction 
    ? listing.current_bid || listing.starting_price 
    : listing.fixed_price;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Images and Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <Card>
                <CardContent className="p-0">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-96 object-cover rounded-t-lg"
                    />
                  ) : (
                    <div className="w-full h-96 bg-muted flex items-center justify-center rounded-t-lg">
                      <Package className="h-24 w-24 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                      {listing.status}
                    </Badge>
                    <Badge variant="outline">{listing.listing_type}</Badge>
                  </div>
                  <CardTitle className="text-3xl">{listing.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-base mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {listing.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {listing.condition}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{listing.view_count} views</span>
                    {isAuction && <span>{listing.bid_count} bids</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Seller Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Seller Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{listing.public_profiles.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {listing.public_profiles.rating.toFixed(1)} ★ ({listing.public_profiles.total_reviews} reviews)
                      </p>
                    </div>
                  </div>

                  {!isOwner && user && (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleContactSeller}
                    >
                      Contact Seller
                    </Button>
                  )}

                  {!user && (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => navigate("/auth")}
                    >
                      Sign in to Contact
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Bidding/Purchase */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">
                    ${currentPrice?.toFixed(2)}
                  </CardTitle>
                  <CardDescription>
                    {isAuction ? "Current bid" : "Fixed price"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isAuction && listing.auction_ends_at && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <Clock className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">Time remaining</p>
                        <p className="text-lg font-bold">{timeRemaining}</p>
                      </div>
                    </div>
                  )}

                  {isAuction && !isOwner && listing.status === "active" && (
                    <form onSubmit={handlePlaceBid} className="space-y-4">
                      <div>
                        <Label htmlFor="bidAmount">Your bid</Label>
                        <Input
                          id="bidAmount"
                          type="number"
                          step="0.01"
                          min={(listing.current_bid || listing.starting_price || 0) + 1}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder={`Min: $${((listing.current_bid || listing.starting_price || 0) + 1).toFixed(2)}`}
                          required
                        />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Placing bid...
                          </>
                        ) : (
                          <>
                            <Gavel className="mr-2 h-4 w-4" />
                            Place Bid
                          </>
                        )}
                      </Button>
                    </form>
                  )}

                  {!isAuction && !isOwner && listing.status === "active" && (
                    <Button onClick={handleBuyNow} disabled={submitting} className="w-full">
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Buy Now"
                      )}
                    </Button>
                  )}

                  {isOwner && (
                    <Alert>
                      <AlertDescription>This is your listing</AlertDescription>
                    </Alert>
                  )}

                  {!user && (
                    <Button onClick={() => navigate("/auth")} className="w-full">
                      Sign in to {isAuction ? "bid" : "buy"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Bid History for Auctions */}
              {isAuction && bids.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Bid History
                    </CardTitle>
                    <CardDescription>{bids.length} bids placed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {bids.map((bid) => (
                        <div
                          key={bid.id}
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            bid.is_winning ? "bg-primary/10 border border-primary" : "bg-muted"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">
                              {bid.public_profiles.full_name}
                              {bid.is_winning && (
                                <Badge variant="default" className="ml-2">
                                  Winning
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(bid.created_at).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-lg font-bold">${bid.amount.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
