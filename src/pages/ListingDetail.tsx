import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import ReviewSubmitDialog from "@/components/ReviewSubmitDialog";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsList from "@/components/ReviewsList";
import ReportDialog from "@/components/ReportDialog";
import AuctionCountdown from "@/components/AuctionCountdown";
import BidHistory from "@/components/BidHistory";
import AuctionStatus from "@/components/AuctionStatus";
import ShareButtons from "@/components/ShareButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Package, Gavel, User, Star, Trash2, Pencil, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  delivery_options: string[] | null;
  public_profiles: {
    full_name: string | null;
    avatar_url: string | null;
    rating: number | null;
    total_reviews: number | null;
  };
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [winningBidderId, setWinningBidderId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchListing();
      incrementViewCount();
      checkReviewStatus();
    }
  }, [id, user]);

  // Real-time updates for listing changes (status updates when auction ends)
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`listing-updates-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `id=eq.${id}`,
        },
        () => {
          fetchListing();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Check auction end status
  useEffect(() => {
    if (!listing?.auction_ends_at) return;
    
    const checkAuctionEnd = () => {
      const now = new Date().getTime();
      const end = new Date(listing.auction_ends_at!).getTime();
      if (end <= now && !auctionEnded) {
        setAuctionEnded(true);
        // Trigger the finalize-auctions function
        supabase.functions.invoke("finalize-auctions").then(() => {
          fetchListing();
        });
      }
    };

    checkAuctionEnd();
    const interval = setInterval(checkAuctionEnd, 5000);
    return () => clearInterval(interval);
  }, [listing?.auction_ends_at, auctionEnded]);

  // Find winning bidder when listing is sold
  useEffect(() => {
    const findWinner = async () => {
      if (listing?.status === "sold" && listing.listing_type === "auction") {
        const { data } = await supabase
          .from("bids")
          .select("bidder_id")
          .eq("listing_id", id)
          .eq("is_winning", true)
          .maybeSingle();
        
        setWinningBidderId(data?.bidder_id || null);
      }
    };
    findWinner();
  }, [listing?.status, id]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          *,
          public_profiles!seller_id (
            full_name,
            avatar_url,
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

  const checkReviewStatus = async () => {
    if (!user || !id || !listing) return;

    try {
      // For auctions, check if user was the winning bidder
      let isWinningBidder = false;
      if (listing.listing_type === "auction") {
        const { data: winningBid } = await supabase
          .from("bids")
          .select("bidder_id")
          .eq("listing_id", id)
          .eq("bidder_id", user.id)
          .eq("is_winning", true)
          .maybeSingle();
        isWinningBidder = !!winningBid;
      }

      // Check if user can leave a review (was involved in a sold transaction)
      const canLeaveReview =
        listing.status === "sold" &&
        user.id !== listing.seller_id &&
        (listing.listing_type === "fixed_price" || isWinningBidder);

      setCanReview(canLeaveReview);

      // Check if user has already reviewed
      if (canLeaveReview) {
        const { data } = await supabase
          .from("reviews")
          .select("id")
          .eq("listing_id", id)
          .eq("reviewer_id", user.id)
          .eq("reviewed_user_id", listing.seller_id)
          .maybeSingle();

        setHasReviewed(!!data);
      }
    } catch (error) {
      console.error("Error checking review status:", error);
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
        description: `Minimum bid is ${formatZAR(minimumBid)}`,
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
        description: `Your bid of ${formatZAR(amount)} has been placed`,
      });

      setBidAmount("");
      fetchListing();
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

  const handleRemoveListing = async () => {
    if (!user || !listing || user.id !== listing.seller_id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({ status: "removed" as const })
        .eq("id", listing.id)
        .eq("seller_id", user.id);

      if (error) throw error;

      toast({
        title: "Listing removed",
        description: "Your listing has been removed successfully",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Failed to remove listing",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
                    <div className="flex items-center gap-2">
                      <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                        {listing.status}
                      </Badge>
                      <Badge variant="outline">{listing.listing_type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isOwner && (
                        <ReportDialog
                          reportType="listing"
                          reportedListingId={listing.id}
                          reportedUserId={listing.seller_id}
                          reportedName={listing.title}
                        />
                      )}
                      {!isOwner && <FavoriteButton listingId={listing.id} />}
                    </div>
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
                  
                  {/* Delivery Options */}
                  {listing.delivery_options && listing.delivery_options.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Delivery Options
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {listing.delivery_options.map((option) => (
                            <Badge key={option} variant="outline" className="capitalize">
                              {option === "collect" ? "Collection" : option === "courier" ? "Courier" : "Postal Service"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

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
                  <Link 
                    to={`/seller/${listing.seller_id}`}
                    className="flex items-center gap-4 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={listing.public_profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        {listing.public_profiles?.full_name?.charAt(0) || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold hover:text-primary transition-colors">
                        {listing.public_profiles?.full_name || "Anonymous Seller"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(listing.public_profiles?.rating || 0).toFixed(1)} ★ ({listing.public_profiles?.total_reviews || 0} reviews)
                      </p>
                    </div>
                  </Link>

                  {!isOwner && user && (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleContactSeller}
                    >
                      Contact Seller
                    </Button>
                  )}

                  {canReview && !hasReviewed && (
                    <ReviewSubmitDialog
                      listingId={id!}
                      reviewedUserId={listing.seller_id}
                      reviewedUserName={listing.public_profiles.full_name}
                      onReviewSubmitted={() => {
                        checkReviewStatus();
                        fetchListing();
                      }}
                    >
                      <Button variant="default" className="w-full">
                        <Star className="mr-2 h-4 w-4" />
                        Leave a Review
                      </Button>
                    </ReviewSubmitDialog>
                  )}

                  {hasReviewed && (
                    <Alert>
                      <AlertDescription>You have already reviewed this seller</AlertDescription>
                    </Alert>
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

              {/* Seller Reviews */}
              <Card>
                <CardHeader>
                  <CardTitle>Seller Reviews</CardTitle>
                  <CardDescription>
                    What others are saying about {listing.public_profiles.full_name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ReviewsList userId={listing.seller_id} />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Bidding/Purchase */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">
                    {formatZAR(currentPrice)}
                  </CardTitle>
                  <CardDescription>
                    {isAuction ? "Current bid" : "Fixed price"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isAuction && listing.auction_ends_at && (
                    <AuctionCountdown 
                      endTime={listing.auction_ends_at} 
                      onAuctionEnd={() => setAuctionEnded(true)}
                    />
                  )}

                  {isAuction && (
                    <AuctionStatus
                      status={listing.status}
                      currentBid={listing.current_bid}
                      reservePrice={listing.reserve_price}
                      winnerId={winningBidderId}
                      currentUserId={user?.id}
                      isOwner={isOwner}
                    />
                  )}

                  {isAuction && !isOwner && listing.status === "active" && !auctionEnded && (
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
                          placeholder={`Min: ${formatZAR((listing.current_bid || listing.starting_price || 0) + 1)}`}
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
                    <div className="space-y-3">
                      <Alert>
                        <AlertDescription>This is your listing</AlertDescription>
                      </Alert>
                      {(listing.status === "active" || listing.status === "draft") && (
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => navigate(`/edit-listing/${listing.id}`)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Listing
                        </Button>
                      )}
                      {listing.status !== "removed" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full" disabled={submitting}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Listing
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove your listing from the marketplace. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleRemoveListing}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}

                  {!user && listing.status === "active" && !auctionEnded && (
                    <Button onClick={() => navigate("/auth")} className="w-full">
                      Sign in to {isAuction ? "bid" : "buy"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Bid History for Auctions */}
              {isAuction && (
                <BidHistory 
                  listingId={id!} 
                  currentUserId={user?.id}
                  auctionEnded={auctionEnded || listing.status === "sold" || listing.status === "expired"}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
