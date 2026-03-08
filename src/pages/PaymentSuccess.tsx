import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatZAR } from "@/lib/currency";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderCreated, setOrderCreated] = useState(false);
  const sessionId = searchParams.get("session_id");
  const listingId = searchParams.get("listing_id");

  useEffect(() => {
    const createOrder = async () => {
      if (!user || !listingId || orderCreated) {
        setLoading(false);
        return;
      }

      try {
        // Fetch listing to get price and seller
        const { data: listing } = await supabase
          .from("listings")
          .select("seller_id, fixed_price, current_bid, listing_type")
          .eq("id", listingId)
          .single();

        if (listing) {
          const amount = listing.listing_type === "fixed_price"
            ? listing.fixed_price
            : listing.current_bid;

          // Check if order already exists for this session
          const { data: existingOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();

          if (!existingOrder && amount) {
            await supabase.from("orders").insert({
              listing_id: listingId,
              buyer_id: user.id,
              seller_id: listing.seller_id,
              amount,
              status: "paid" as const,
              stripe_session_id: sessionId,
            });

            // Mark listing as sold
            await supabase
              .from("listings")
              .update({ status: "sold" as const })
              .eq("id", listingId);
          }

          setOrderCreated(true);
        }
      } catch (error) {
        console.error("Error creating order:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(createOrder, 1000);
    return () => clearTimeout(timer);
  }, [user, listingId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-muted-foreground mb-6">
          Your payment has been processed successfully. You can track your order from the dashboard.
        </p>
        
        {sessionId && (
          <p className="text-sm text-muted-foreground mb-6">
            Transaction ID: {sessionId.substring(0, 20)}...
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate("/dashboard")}>
            View My Purchases
          </Button>
          {listingId && (
            <Button variant="outline" onClick={() => navigate(`/listings/${listingId}`)}>
              View Listing
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/listings")}>
            Browse More Listings
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
