import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Clock, ShieldCheck, Truck, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import LogisticsHeader from "../components/LogisticsHeader";
import LogisticsBottomNav from "../components/LogisticsBottomNav";

type Status = "loading" | "no_auth" | "not_started" | "pending" | "rejected" | "more_info" | "approved";

const BecomeCourier = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [sellerType, setSellerType] = useState<string | null>(null);
  const [isCourier, setIsCourier] = useState(false);
  const [available, setAvailable] = useState(false);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState<string | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) {
      setStatus("no_auth");
      return;
    }
    const [{ data: ver }, { data: roles }, { data: prof }] = await Promise.all([
      supabase.from("seller_verifications").select("status, seller_type").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("courier_available, courier_available_updated_at").eq("id", user.id).maybeSingle(),
    ]);
    setIsCourier(!!roles?.some((r) => r.role === "courier"));
    setAvailable(!!prof?.courier_available);
    setAvailabilityUpdatedAt(prof?.courier_available_updated_at ?? null);
    if (!ver) return setStatus("not_started");
    setSellerType(ver.seller_type);
    switch (ver.status) {
      case "approved":
        return setStatus("approved");
      case "rejected":
        return setStatus("rejected");
      case "requires_more_info":
        return setStatus("more_info");
      default:
        return setStatus("pending");
    }
  };

  useEffect(() => {
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const activateCourier = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "courier" as const });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not activate courier role");
      return;
    }
    toast.success("You're now a verified OX Logistics courier!");
    setIsCourier(true);
  };

  const deactivateCourier = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .eq("role", "courier" as const);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIsCourier(false);
    setAvailable(false);
    toast.success("Courier role removed");
  };

  const toggleAvailability = async (next: boolean) => {
    if (!user) return;
    setTogglingAvailability(true);
    const prev = available;
    setAvailable(next);
    const { data, error } = await supabase
      .from("profiles")
      .update({ courier_available: next })
      .eq("id", user.id)
      .select("courier_available_updated_at")
      .maybeSingle();
    setTogglingAvailability(false);
    if (error) {
      setAvailable(prev);
      toast.error(error.message || "Could not update availability");
      return;
    }
    setAvailabilityUpdatedAt(data?.courier_available_updated_at ?? new Date().toISOString());
    toast.success(next ? "You're online — accepting deliveries" : "You're offline");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <LogisticsHeader location="Sandton" />
      <main className="container max-w-2xl px-3 sm:px-4 py-5 sm:py-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold">Become an OX Courier</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Earn by delivering goods across South Africa. We reuse your existing OX verification — no extra paperwork.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shared Verification</CardTitle>
            <CardDescription>
              One KYC across OX Marketplace, Logistics & future Services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-1">Individual</p>
              <ul className="text-muted-foreground list-disc ml-5 space-y-0.5">
                <li>South African ID</li>
                <li>Phone & Email</li>
                <li>Proof of Residence</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Business</p>
              <ul className="text-muted-foreground list-disc ml-5 space-y-0.5">
                <li>CIPC Registration</li>
                <li>Business Address & Contact</li>
                <li>Representative ID</li>
                <li>Proof of Business Banking</li>
                <li>VAT Number (optional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {status === "loading" && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {status === "no_auth" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              Sign in to apply as a courier.
              <Button onClick={() => navigate("/auth")} className="w-fit">Sign in</Button>
            </AlertDescription>
          </Alert>
        )}

        {status === "not_started" && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Complete verification first</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              Submit your KYC once and use it for Marketplace and Logistics.
              <Button asChild className="w-fit">
                <Link to="/seller-verification">Start verification</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {status === "pending" && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Verification in review</AlertTitle>
            <AlertDescription>
              Your {sellerType ?? ""} verification is being reviewed. You'll be able to activate the courier role once approved.
            </AlertDescription>
          </Alert>
        )}

        {status === "more_info" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>More information requested</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              The review team needs more info on your verification.
              <Button asChild variant="outline" className="w-fit">
                <Link to="/seller-verification">Update verification</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {status === "rejected" && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Verification rejected</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              Please review the notes and resubmit.
              <Button asChild variant="outline" className="w-fit">
                <Link to="/seller-verification">Resubmit verification</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {status === "approved" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                You're verified
                {isCourier && (
                  <Badge className="ml-2 bg-accent/15 text-accent border-accent/30" variant="outline">
                    Courier Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Your shared OX verification ({sellerType}) is approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCourier ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          available ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                        }`}
                        aria-hidden
                      />
                      <div>
                        <Label htmlFor="courier-available" className="text-sm font-semibold cursor-pointer">
                          {available ? "Available for deliveries" : "Offline"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {available
                            ? "You'll appear in nearby courier searches."
                            : "Turn on to start receiving requests."}
                          {availabilityUpdatedAt && (
                            <> · Updated {new Date(availabilityUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="courier-available"
                      checked={available}
                      onCheckedChange={toggleAvailability}
                      disabled={togglingAvailability}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button asChild>
                      <Link to="/logistics/orders">View delivery requests</Link>
                    </Button>
                    <Button variant="outline" onClick={deactivateCourier} disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Pause courier role
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={activateCourier} disabled={submitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Activate courier role
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <LogisticsBottomNav />
    </div>
  );
};

export default BecomeCourier;
