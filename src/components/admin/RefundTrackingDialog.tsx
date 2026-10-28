import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquareText } from "lucide-react";
import BuyerUpdateDraftDialog from "./BuyerUpdateDraftDialog";

export type RefundStatus = "not_started" | "in_progress" | "refunded" | "resolved_other";

export const REFUND_LABELS: Record<RefundStatus, string> = {
  not_started: "Refund not started",
  in_progress: "Refund in progress",
  refunded: "Refunded",
  resolved_other: "Resolved another way",
};

export interface RefundOrder {
  id: string;
  amount: number;
  invoice_number: string | null;
  review_reason?: string | null;
  refund_status?: RefundStatus | null;
  refund_reference?: string | null;
  refund_notes?: string | null;
  refund_updated_at?: string | null;
  listing?: { title: string } | null;
  buyer?: { full_name: string | null; email: string } | null;
}

interface Props {
  order: RefundOrder | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function RefundTrackingDialog({ order, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<RefundStatus>("not_started");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  useEffect(() => {
    if (!order) return;
    setStatus(order.refund_status ?? "not_started");
    setReference(order.refund_reference ?? "");
    setNotes(order.refund_notes ?? "");
  }, [order]);

  const closed = status === "refunded" || status === "resolved_other";
  const needsReference = status === "refunded" && !reference.trim();

  const save = async () => {
    if (!order) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        refund_status: status,
        refund_reference: reference.trim() || null,
        refund_notes: notes.trim() || null,
        needs_admin_review: !closed,
        ...(status === "refunded" ? { status: "refunded" as const } : {}),
      } as never)
      .eq("id", order.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save refund", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: closed ? "Case closed" : "Refund updated" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund tracking</DialogTitle>
          <DialogDescription>
            {order?.listing?.title ?? "Order"} · {order?.invoice_number ?? order?.id.slice(0, 8)} · R
            {Number(order?.amount ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </DialogDescription>
        </DialogHeader>
        {order?.review_reason && (
          <p className="text-sm text-destructive">{order.review_reason}</p>
        )}
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="refund-status">Refund status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RefundStatus)}>
              <SelectTrigger id="refund-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REFUND_LABELS) as RefundStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{REFUND_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-ref">Refund reference</Label>
            <Input
              id="refund-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PayFast refund ID or bank reference"
              maxLength={120}
            />
            {needsReference && (
              <p className="text-xs text-destructive">Add the refund reference before marking it refunded.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-notes">Resolution notes</Label>
            <Textarea
              id="refund-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was done and what the buyer was told"
              rows={4}
              maxLength={2000}
            />
          </div>
          {order?.refund_updated_at && (
            <p className="text-xs text-muted-foreground">
              Last updated {new Date(order.refund_updated_at).toLocaleString("en-ZA")}
            </p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setDraftOpen(true)} disabled={!order}>
            <MessageSquareText className="h-4 w-4 mr-2" />
            Draft buyer update
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={saving || needsReference}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {order && (
        <BuyerUpdateDraftDialog
          open={draftOpen}
          onOpenChange={setDraftOpen}
          order={order}
          refundStatus={status}
          refundReference={reference}
          refundNotes={notes}
        />
      )}
    </Dialog>
  );
}
