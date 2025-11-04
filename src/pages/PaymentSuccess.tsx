import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get("session_id");
  const listingId = searchParams.get("listing_id");

  useEffect(() => {
    // Simulate verification delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

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
          Your payment has been processed successfully. You will receive a confirmation email shortly.
        </p>
        
        {sessionId && (
          <p className="text-sm text-muted-foreground mb-6">
            Transaction ID: {sessionId.substring(0, 20)}...
          </p>
        )}

        <div className="flex flex-col gap-3">
          {listingId && (
            <Button onClick={() => navigate(`/listings/${listingId}`)}>
              View Listing
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/listings")}>
            Browse More Listings
          </Button>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
