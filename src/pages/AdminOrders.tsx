import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Package,
  Search,
  RefreshCw,
  Banknote,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";

interface AdminOrder {
  id: string;
  listing_id: string;
  amount: number;
  status: OrderStatus;
  tracking_number: string | null;
  invoice_number: string | null;
  payment_provider: string;
  payfast_payment_id: string | null;
  m_payment_id: string | null;
  created_at: string;
  updated_at: string;
  listing: { title: string } | null;
  buyer: { full_name: string | null; email: string } | null;
  seller: { full_name: string | null; email: string } | null;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  paid: "default",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

const STATUS_OPTIONS: OrderStatus[] = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"];

/** Payment status derived from the order status (PayFast confirms payment before fulfilment). */
const PAYMENT_STATUS_MAP: Record<OrderStatus, "pending" | "paid" | "refunded" | "cancelled"> = {
  pending: "pending",
  paid: "paid",
  shipped: "paid",
  delivered: "paid",
  cancelled: "cancelled",
  refunded: "refunded",
};

/** Fulfilment status derived from the order status. */
const FULFILLMENT_MAP: Record<OrderStatus, "awaiting" | "shipped" | "delivered" | "none"> = {
  pending: "none",
  paid: "awaiting",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "none",
  refunded: "none",
};

const AdminOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>("all");
  const [trackingFilter, setTrackingFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>("paid");
  const [editTracking, setEditTracking] = useState("");
  const [saving, setSaving] = useState(false);
  const [riskOrder, setRiskOrder] = useState<AdminOrder | null>(null);
  const [riskIssue, setRiskIssue] = useState("");
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskResult, setRiskResult] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        `id, listing_id, buyer_id, seller_id, amount, status, tracking_number, invoice_number, payment_provider, payfast_payment_id, m_payment_id, created_at, updated_at,
         listing:listings(title)`
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Could not load orders", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as (Omit<AdminOrder, "buyer" | "seller"> & {
      buyer_id: string;
      seller_id: string;
    })[];

    const userIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    setOrders(
      rows.map(({ buyer_id, seller_id, ...rest }) => ({
        ...rest,
        buyer: profileMap.get(buyer_id) ?? null,
        seller: profileMap.get(seller_id) ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const buyerQ = buyerFilter.trim().toLowerCase();
    const sellerQ = sellerFilter.trim().toLowerCase();
    const trackQ = trackingFilter.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return orders.filter((o) => {
      if (paymentFilter !== "all" && PAYMENT_STATUS_MAP[o.status] !== paymentFilter) return false;
      if (fulfillmentFilter !== "all" && FULFILLMENT_MAP[o.status] !== fulfillmentFilter) return false;
      if (from && new Date(o.created_at) < from) return false;
      if (to && new Date(o.created_at) > to) return false;
      if (trackQ && !o.tracking_number?.toLowerCase().includes(trackQ)) return false;
      if (
        buyerQ &&
        !(
          o.buyer?.full_name?.toLowerCase().includes(buyerQ) ||
          o.buyer?.email.toLowerCase().includes(buyerQ)
        )
      )
        return false;
      if (
        sellerQ &&
        !(
          o.seller?.full_name?.toLowerCase().includes(sellerQ) ||
          o.seller?.email.toLowerCase().includes(sellerQ)
        )
      )
        return false;
      if (!q) return true;
      return (
        o.listing?.title?.toLowerCase().includes(q) ||
        o.buyer?.full_name?.toLowerCase().includes(q) ||
        o.buyer?.email.toLowerCase().includes(q) ||
        o.seller?.full_name?.toLowerCase().includes(q) ||
        o.seller?.email.toLowerCase().includes(q) ||
        o.invoice_number?.toLowerCase().includes(q) ||
        o.tracking_number?.toLowerCase().includes(q) ||
        o.m_payment_id?.toLowerCase().includes(q) ||
        o.payfast_payment_id?.toLowerCase().includes(q)
      );
    });
  }, [
    orders,
    search,
    buyerFilter,
    sellerFilter,
    paymentFilter,
    fulfillmentFilter,
    trackingFilter,
    dateFrom,
    dateTo,
  ]);

  const hasActiveFilters =
    buyerFilter.trim() !== "" ||
    sellerFilter.trim() !== "" ||
    paymentFilter !== "all" ||
    fulfillmentFilter !== "all" ||
    trackingFilter.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setBuyerFilter("");
    setSellerFilter("");
    setPaymentFilter("all");
    setFulfillmentFilter("all");
    setTrackingFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const paidOrders = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const awaitingShipment = orders.filter((o) => o.status === "paid").length;
  const inTransit = orders.filter((o) => o.status === "shipped").length;
  const pendingPayment = orders.filter((o) => o.status === "pending").length;

  const openRisk = (order: AdminOrder) => {
    setRiskOrder(order);
    setRiskIssue("");
    setRiskResult(null);
    setRiskError(null);
  };

  const runRiskAnalysis = async () => {
    if (!riskOrder || !riskIssue.trim()) return;
    setRiskLoading(true);
    setRiskError(null);
    setRiskResult(null);

    const { data, error } = await supabase.functions.invoke("analyze-payment-risk", {
      body: {
        issue: riskIssue.trim(),
        order: {
          invoice_number: riskOrder.invoice_number,
          amount_zar: Number(riskOrder.amount),
          status: riskOrder.status,
          payment_provider: riskOrder.payment_provider,
          payfast_payment_id: riskOrder.payfast_payment_id,
          m_payment_id: riskOrder.m_payment_id,
          tracking_number: riskOrder.tracking_number,
          created_at: riskOrder.created_at,
          updated_at: riskOrder.updated_at,
          listing_title: riskOrder.listing?.title ?? null,
          buyer: riskOrder.buyer?.full_name || riskOrder.buyer?.email || null,
          seller: riskOrder.seller?.full_name || riskOrder.seller?.email || null,
        },
      },
    });

    setRiskLoading(false);

    if (error) {
      setRiskError(
        (error as { message?: string }).message ||
          "The analysis could not be completed. Please try again."
      );
      return;
    }
    if (data?.error) {
      setRiskError(data.error as string);
      return;
    }
    setRiskResult((data?.analysis as string) ?? null);
  };

  const openEdit = (order: AdminOrder) => {
    setEditing(order);
    setEditStatus(order.status);
    setEditTracking(order.tracking_number ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: editStatus,
        tracking_number: editTracking.trim() || null,
      })
      .eq("id", editing.id);
    setSaving(false);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Order updated" });
    setEditing(null);
    load();
  };

  return (
    <AdminLayout
      title="Orders & Payments"
      description="Track every payment, fulfilment status, and tracking number across the marketplace."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue (paid)</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R{totalRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{paidOrders.length} completed payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Awaiting shipment</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{awaitingShipment}</p>
            <p className="text-xs text-muted-foreground">Paid, not yet shipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inTransit}</p>
            <p className="text-xs text-muted-foreground">Shipped orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending payment</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingPayment}</p>
            <p className="text-xs text-muted-foreground">Checkout started, not confirmed</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search invoice, PayFast reference, listing title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Advanced filters
            </p>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1.5" />
                Clear filters
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">No filters applied</span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="filter-buyer">Buyer</Label>
              <Input
                id="filter-buyer"
                placeholder="Name or email"
                value={buyerFilter}
                onChange={(e) => setBuyerFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-seller">Seller</Label>
              <Input
                id="filter-seller"
                placeholder="Name or email"
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-tracking">Tracking number</Label>
              <Input
                id="filter-tracking"
                placeholder="e.g. TCG123456789ZA"
                value={trackingFilter}
                onChange={(e) => setTrackingFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment status</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="pending">Pending payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fulfilment status</Label>
              <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All fulfilment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fulfilment</SelectItem>
                  <SelectItem value="awaiting">Awaiting shipment</SelectItem>
                  <SelectItem value="shipped">In transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-from">From date</Label>
              <Input
                id="filter-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-to">To date</Label>
              <Input
                id="filter-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mb-3">
        Showing {filtered.length} of {orders.length} orders
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading orders…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No orders found</p>
            <p className="text-sm text-muted-foreground">Try a different search or filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card key={order.id}>
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/listing/${order.listing_id}`}
                        className="font-medium hover:underline truncate"
                      >
                        {order.listing?.title ?? "Listing removed"}
                      </Link>
                      <Badge variant={STATUS_VARIANTS[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {order.payment_provider}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      Buyer: {order.buyer?.full_name || order.buyer?.email || "—"} · Seller:{" "}
                      {order.seller?.full_name || order.seller?.email || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.invoice_number ?? order.id.slice(0, 8)} ·{" "}
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      {order.payfast_payment_id && ` · PayFast #${order.payfast_payment_id}`}
                      {order.tracking_number && ` · Tracking: ${order.tracking_number}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-lg font-bold">
                      R{Number(order.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => openEdit(order)}>
                      Update
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => openRisk(order)}>
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Analyse risk
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/listing/${order.listing_id}`} aria-label="View listing">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update order</DialogTitle>
            <DialogDescription>
              {editing?.listing?.title ?? "Order"} ·{" "}
              {editing?.invoice_number ?? editing?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="order-status">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as OrderStatus)}>
                <SelectTrigger id="order-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking-number">Tracking number</Label>
              <Input
                id="tracking-number"
                placeholder="e.g. TCG123456789ZA"
                value={editTracking}
                onChange={(e) => setEditTracking(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!riskOrder} onOpenChange={(open) => !open && setRiskOrder(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Payment risk analysis
            </DialogTitle>
            <DialogDescription>
              {riskOrder?.listing?.title ?? "Order"} ·{" "}
              {riskOrder?.invoice_number ?? riskOrder?.id.slice(0, 8)} · R
              {Number(riskOrder?.amount ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="risk-issue">Describe the payment issue</Label>
              <Textarea
                id="risk-issue"
                rows={4}
                placeholder="e.g. Buyer says the card was charged twice, but PayFast only shows one payment and the order is still pending."
                value={riskIssue}
                onChange={(e) => setRiskIssue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The order details above are sent along with your description.
              </p>
            </div>

            {riskError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {riskError}
              </div>
            )}

            {riskResult && (
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI assessment — review before acting
                </p>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{riskResult}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskOrder(null)} disabled={riskLoading}>
              Close
            </Button>
            <Button onClick={runRiskAnalysis} disabled={riskLoading || !riskIssue.trim()}>
              {riskLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analysing…
                </>
              ) : riskResult ? (
                "Re-run analysis"
              ) : (
                "Analyse risk"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminOrders;
