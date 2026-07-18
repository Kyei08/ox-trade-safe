import { useState, useEffect, useCallback, useRef } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
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
import SimilarListings from "@/components/SimilarListings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Package, Gavel, User, Star, Trash2, Pencil, Truck, ChevronLeft, ChevronRight, X, ZoomIn, Share2 } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  clearPendingCheckout,
  formatCheckoutTimeRemaining,
  getCheckoutExpiry,
  loadPendingCheckout,
  savePendingCheckout,
  type PendingCheckout,
} from "@/lib/pendingCheckout";
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
  category_id: string | null;
  created_at: string;
  delivery_options: string[] | null;
  public_profiles: {
    full_name: string | null;
    avatar_url: string | null;
    rating: number | null;
    total_reviews: number | null;
  };
}

function ImageCarousel({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef<number | null>(null);

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStart.current = null;
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, images.length]);

  return (
    <>
      <div className="relative" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img
          src={images[current]}
          alt={`${title} - Image ${current + 1}`}
          className="w-full h-96 object-cover rounded-t-lg transition-opacity duration-300 cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        />
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute top-3 left-3 bg-background/80 hover:bg-background rounded-full p-2 shadow-md transition-colors"
          aria-label="View fullscreen"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow-md transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === current ? "bg-primary" : "bg-background/60"
                  }`}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
            <div className="absolute top-3 right-3 bg-background/80 text-foreground text-xs px-2 py-1 rounded-full">
              {current + 1} / {images.length}
            </div>
          </>
        )}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                  i === current ? "border-primary" : "border-transparent"
                }`}
              >
                <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 bg-background/20 hover:bg-background/40 rounded-full p-2 transition-colors z-10"
            aria-label="Close lightbox"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {current + 1} / {images.length}
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 rounded-full p-3 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 rounded-full p-3 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}
          <img
            src={images[current]}
            alt={`${title} - Image ${current + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                    i === current ? "border-white" : "border-white/30"
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
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
  const [bidConfirmOpen, setBidConfirmOpen] = useState(false);
  const [buyNowConfirmOpen, setBuyNowConfirmOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [checkoutNow, setCheckoutNow] = useState<number>(() => Date.now());
  const checkoutExpiry = pendingCheckout
    ? getCheckoutExpiry(pendingCheckout.createdAt, checkoutNow)
    : null;
  const checkoutExpired = checkoutExpiry?.status === "expired";
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [winningBidderId, setWinningBidderId] = useState<string | null>(null);
  const { addRecentlyViewed } = useRecentlyViewed();

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

  // Resume any in-progress Stripe Checkout for this (listing, user).
  useEffect(() => {
    if (!id || !user?.id) {
      setPendingCheckout(null);
      checkoutIdempotencyKeyRef.current = null;
      return;
    }
    // Only fixed-price active listings can be resumed via Buy Now.
    if (!listing || listing.status !== "active" || listing.listing_type !== "fixed_price") {
      clearPendingCheckout(id, user.id);
      setPendingCheckout(null);
      checkoutIdempotencyKeyRef.current = null;
      return;
    }
    const existing = loadPendingCheckout(id, user.id);
    if (existing) {
      setPendingCheckout(existing);
      // Reuse the same idempotency key so any retry hits the same Stripe session.
      checkoutIdempotencyKeyRef.current = existing.idempotencyKey;
    } else {
      setPendingCheckout(null);
      checkoutIdempotencyKeyRef.current = null;
    }
  }, [id, user?.id, listing?.status, listing?.listing_type, listing]);

  // Keep the expiry countdown fresh while a pending checkout is on screen.
  useEffect(() => {
    if (!pendingCheckout) return;
    setCheckoutNow(Date.now());
    const interval = setInterval(() => setCheckoutNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [pendingCheckout]);




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

      // Track recently viewed
      addRecentlyViewed({
        id: data.id,
        title: data.title,
        image: data.images?.[0] || null,
        price: data.listing_type === "fixed_price" ? data.fixed_price : (data.current_bid || data.starting_price),
        listing_type: data.listing_type,
      });
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

  const openBidConfirmation = (e: React.FormEvent) => {
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

    setBidConfirmOpen(true);
  };

  const handleConfirmBid = async () => {
    if (!user || !listing || !id) return;

    const amount = parseFloat(bidAmount);
    const minimumBid = listing.current_bid
      ? listing.current_bid + 1
      : listing.starting_price || 0;

    if (amount < minimumBid || user.id === listing.seller_id) {
      setBidConfirmOpen(false);
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
          bid_count: (listing.bid_count || 0) + 1,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast({
        title: "Bid placed successfully",
        description: `Your bid of ${formatZAR(amount)} has been placed`,
      });

      setBidAmount("");
      setBidConfirmOpen(false);
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

  const openBuyNowConfirmation = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to make a purchase",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setCheckoutError(null);
    // If we already have a live, non-expired pending checkout for this listing,
    // reuse its idempotency key so Stripe returns the same Checkout Session.
    // If it's expired, discard it and mint a fresh key so we start clean.
    if (pendingCheckout?.idempotencyKey && !checkoutExpired) {
      checkoutIdempotencyKeyRef.current = pendingCheckout.idempotencyKey;
    } else {
      if (checkoutExpired && id && user?.id) {
        clearPendingCheckout(id, user.id);
        setPendingCheckout(null);
      }
      checkoutIdempotencyKeyRef.current = crypto.randomUUID();
    }
    setBuyNowConfirmOpen(true);
  };

  const resumePendingCheckout = () => {
    if (!pendingCheckout?.url) return;
    if (checkoutExpired) {
      if (id && user?.id) clearPendingCheckout(id, user.id);
      setPendingCheckout(null);
      checkoutIdempotencyKeyRef.current = null;
      toast({
        title: "Checkout session expired",
        description: "Start a new secure checkout to continue.",
        variant: "destructive",
      });
      return;
    }
    window.open(pendingCheckout.url, "_blank");
    toast({
      title: "Resuming secure checkout",
      description: "Reopening your existing payment session in a new tab",
    });
  };

  const discardPendingCheckout = () => {
    if (!id || !user?.id) return;
    clearPendingCheckout(id, user.id);
    setPendingCheckout(null);
    checkoutIdempotencyKeyRef.current = null;
    toast({
      title: "Checkout cleared",
      description: "You can start a fresh purchase now.",
    });
  };

  const handleBuyNow = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Guarantee an idempotency key exists even if the dialog was opened
    // through an unexpected code path.
    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = checkoutIdempotencyKeyRef.current;

    setSubmitting(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { listingId: id, idempotencyKey },
        headers: { "x-idempotency-key": idempotencyKey },
      });

      if (error) throw error;

      if (data?.url) {
        // Persist so a refresh / return-visit can resume the same session.
        if (id && user?.id) {
          const record: PendingCheckout = {
            idempotencyKey,
            url: data.url,
            createdAt: Date.now(),
          };
          savePendingCheckout(id, user.id, record);
          setPendingCheckout(record);
        }
        // Open Stripe checkout in new tab
        window.open(data.url, "_blank");
        toast({
          title: "Redirecting to secure checkout",
          description: "Opening escrow-protected payment in a new tab",
        });
        setBuyNowConfirmOpen(false);
      } else {
        throw new Error("Checkout could not be started. No payment URL was returned.");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      const message =
        error?.message ||
        "We couldn't reach the secure checkout service. Please check your connection and try again.";
      setCheckoutError(message);
      toast({
        title: "Payment failed",
        description: message,
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
      <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Images and Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image Carousel */}
              <Card>
                <CardContent className="p-0 relative">
                  {listing.images && listing.images.length > 0 ? (
                    <ImageCarousel images={listing.images} title={listing.title} />
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const url = `${window.location.origin}/listings/${listing.id}`;
                          if (navigator.share) {
                            try {
                              await navigator.share({ title: listing.title, url });
                            } catch {}
                          } else {
                            await navigator.clipboard.writeText(url);
                            toast({ title: "Link copied!", description: "Listing link copied to clipboard." });
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
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
                    <form onSubmit={openBidConfirmation} className="space-y-4">
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
                          disabled={submitting}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full"
                      >
                        <Gavel className="h-4 w-4" />
                        Place Bid
                      </Button>
                    </form>
                  )}

                  {/* Bid Confirmation Modal */}
                  <AlertDialog open={bidConfirmOpen} onOpenChange={setBidConfirmOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm your bid</AlertDialogTitle>
                        <AlertDialogDescription>
                          You are about to place a bid of{" "}
                          <span className="font-semibold text-foreground">
                            {bidAmount ? formatZAR(parseFloat(bidAmount)) : "—"}
                          </span>{" "}
                          on <span className="font-semibold text-foreground">{listing.title}</span>.
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmBid}
                          loading={submitting}
                          loadingText="Placing bid..."
                          disabled={submitting}
                        >
                          Confirm Bid
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {!isAuction && !isOwner && listing.status === "active" && (
                    <>
                      {pendingCheckout && (
                        <Alert>
                          <AlertDescription className="space-y-2">
                            <p className="text-sm">
                              You already started a secure checkout for this listing. Resume where you left off — we'll reuse the same payment session so you aren't charged twice.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={resumePendingCheckout}
                              >
                                Resume checkout
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={discardPendingCheckout}
                                disabled={submitting}
                              >
                                Start over
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button
                        onClick={openBuyNowConfirmation}
                        disabled={submitting}
                        className="w-full"
                      >
                        {pendingCheckout ? "Resume Buy Now" : "Buy Now"}
                      </Button>

                      <AlertDialog
                        open={buyNowConfirmOpen}
                        onOpenChange={(open) => {
                          if (submitting) return;
                          setBuyNowConfirmOpen(open);
                          if (!open) setCheckoutError(null);
                        }}
                      >
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {pendingCheckout ? "Resume secure purchase" : "Confirm secure purchase"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              You are about to purchase{" "}
                              <span className="font-semibold text-foreground">{listing.title}</span> for{" "}
                              <span className="font-semibold text-foreground">
                                {formatZAR(listing.fixed_price || 0)}
                              </span>
                              . Payment is held in escrow and only released to the seller once you confirm delivery.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          {pendingCheckout && !checkoutError && (
                            <Alert>
                              <AlertDescription>
                                We'll reopen your existing checkout session instead of creating a new one, so you won't be charged twice.
                              </AlertDescription>
                            </Alert>
                          )}
                          {checkoutError && (
                            <Alert variant="destructive" role="alert" aria-live="assertive">
                              <AlertDescription>
                                {checkoutError} You can try again below.
                              </AlertDescription>
                            </Alert>
                          )}
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault();
                                handleBuyNow();
                              }}
                              loading={submitting}
                              loadingText="Preparing checkout..."
                              disabled={submitting}
                            >
                              {checkoutError
                                ? "Retry secure checkout"
                                : pendingCheckout
                                  ? "Reopen secure checkout"
                                  : "Continue to secure checkout"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
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
                              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleRemoveListing}
                                loading={submitting}
                                loadingText="Removing..."
                                disabled={submitting}
                              >
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

          <SimilarListings categoryId={listing.category_id} currentListingId={listing.id} currentTitle={listing.title} />
        </div>
      </main>
    </>
  );
}
