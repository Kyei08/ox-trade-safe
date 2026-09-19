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

const AdminOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
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
  }, [orders, search, statusFilter]);

  const paidOrders = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const awaitingShipment = orders.filter((o) => o.status === "paid").length;
  const inTransit = orders.filter((o) => o.status === "shipped").length;
  const pendingPayment = orders.filter((o) => o.status === "pending").length;

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
            placeholder="Search buyer, seller, listing, invoice or tracking number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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
    </AdminLayout>
  );
};

export default AdminOrders;
