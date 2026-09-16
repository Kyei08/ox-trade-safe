import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatZAR } from "@/lib/currency";
import { clearPendingCheckout } from "@/lib/pendingCheckout";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<{ amount: number; status: string; invoice_number: string | null } | null>(null);
  const listingId = searchParams.get("listing_id");
  const mPaymentId = searchParams.get("m_payment_id");

  useEffect(() => {
    if (!user || !mPaymentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    // PayFast confirms payment through a server notification, which can land a
    // few seconds after the buyer returns. Poll briefly until it arrives.
    const check = async () => {
      attempts += 1;
      const { data } = await supabase
        .from("orders")
        .select("amount, status, invoice_number")
        .eq("m_payment_id", mPaymentId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setOrder(data);
        if (data.status !== "pending") {
          clearPendingCheckout(listingId ?? undefined, user.id);
          setLoading(false);
          return;
        }
      }

      if (attempts >= 8) {
        setLoading(false);
        return;
      }
      setTimeout(check, 2000);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user, mPaymentId, listingId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Confirming your payment</h2>
          <p className="text-muted-foreground">Please wait while PayFast confirms your payment...</p>
        </Card>
      </div>
    );
  }

  const paid = order?.status && order.status !== "pending" && order.status !== "cancelled";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 max-w-md w-full text-center">
        {paid ? (
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        ) : (
          <Clock className="h-16 w-16 text-primary mx-auto mb-4" />
        )}
        <h1 className="text-3xl font-bold mb-2">
          {paid ? "Payment Successful!" : "Payment Pending"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {paid
            ? "Your payment has been confirmed. You can track your order from the dashboard."
            : "We haven't received confirmation from PayFast yet. If your payment went through, your order will update automatically within a few minutes."}
        </p>

        {order && (
          <p className="text-lg font-semibold mb-2">{formatZAR(order.amount)}</p>
        )}
        {order?.invoice_number && (
          <p className="text-sm text-muted-foreground mb-6">Invoice: {order.invoice_number}</p>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate("/dashboard")}>View My Purchases</Button>
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
