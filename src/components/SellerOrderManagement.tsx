import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Package, Truck, CheckCircle, ClipboardList } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface SellerOrder {
  id: string;
  listing_id: string;
  amount: number;
  status: string;
  tracking_number: string | null;
  shipping_address: string | null;
  delivery_option: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  listings: {
    id: string;
    title: string;
    images: string[] | null;
  };
  buyer_profile: {
    full_name: string | null;
  } | null;
}

interface Props {
  orders: SellerOrder[];
  onOrderUpdated: () => void;
}

const statusFlow = ["paid", "shipped", "delivered"] as const;

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "secondary", icon: <ClipboardList className="w-4 h-4" />, label: "Pending" },
  paid: { color: "default", icon: <CheckCircle className="w-4 h-4" />, label: "Paid" },
  shipped: { color: "default", icon: <Truck className="w-4 h-4" />, label: "Shipped" },
  delivered: { color: "default", icon: <Package className="w-4 h-4" />, label: "Delivered" },
  cancelled: { color: "destructive", icon: <ClipboardList className="w-4 h-4" />, label: "Cancelled" },
  refunded: { color: "secondary", icon: <ClipboardList className="w-4 h-4" />, label: "Refunded" },
};

const SellerOrderManagement = ({ orders, onOrderUpdated }: Props) => {
  const [editingOrder, setEditingOrder] = useState<SellerOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const openEdit = (order: SellerOrder) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setTrackingNumber(order.tracking_number || "");
    setNotes(order.notes || "");
  };

  const handleUpdate = async () => {
    if (!editingOrder) return;
    setUpdating(true);
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
        tracking_number: trackingNumber || null,
        notes: notes || null,
      };

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", editingOrder.id);

      if (error) throw error;
      toast.success("Order updated successfully");
      setEditingOrder(null);
      onOrderUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No orders to manage yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map((order) => {
          const config = statusConfig[order.status] || statusConfig.pending;
          return (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {order.listings?.images?.[0] ? (
                    <img
                      src={order.listings.images[0]}
                      alt={order.listings.title}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg truncate">{order.listings?.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Buyer: {order.buyer_profile?.full_name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={config.color as any} className="flex items-center gap-1 shrink-0">
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-lg font-bold text-primary">{formatZAR(order.amount)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.delivery_option && (
                          <Badge variant="outline">{order.delivery_option}</Badge>
                        )}
                        {order.tracking_number && (
                          <span className="text-xs text-muted-foreground">
                            Tracking: {order.tracking_number}
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(order)}>
                          Manage Order
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Order</DialogTitle>
            <DialogDescription>
              Update order status, tracking number, and notes for "{editingOrder?.listings?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Order Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tracking Number</label>
              <Input
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea
                placeholder="Add notes about this order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)} disabled={updating}>Cancel</Button>
            <Button onClick={handleUpdate} loading={updating} loadingText="Updating..." disabled={updating}>
              Update Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SellerOrderManagement;
