import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { REFUND_LABELS, type RefundOrder, type RefundStatus } from "./RefundTrackingDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: RefundOrder | null;
  refundStatus: RefundStatus;
  refundReference: string;
  refundNotes: string;
}

/** Drafts a buyer update from the refund case details the admin is working with. */
const BuyerUpdateDraftDialog = ({
  open,
  onOpenChange,
  order,
  refundStatus,
  refundReference,
  refundNotes,
}: Props) => {
  const { toast } = useToast();
  const [tone, setTone] = useState("professional and reassuring");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage("");
      setError(null);
    }
  }, [open]);

  const orderDetails = {
    invoice_number: order?.invoice_number ?? null,
    listing_title: order?.listing?.title ?? null,
    amount_zar: order ? Number(order.amount) : null,
    conflict_reason: order?.review_reason ?? null,
  };

  const draft = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("draft-buyer-update", {
      body: {
        refundStatus,
        refundReference: refundReference.trim(),
        refundNotes: refundNotes.trim(),
        tone,
        order: orderDetails,
      },
    });
    setLoading(false);
    if (fnError || data?.error) {
      let msg = data?.error as string | undefined;
      if (!msg && fnError && "context" in fnError) {
        try {
          msg = (await (fnError as { context: Response }).context.json())?.error;
        } catch { /* ignore */ }
      }
      setError(msg ?? fnError?.message ?? "Could not draft an update");
      return;
    }
    setMessage(data.message);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    toast({ title: "Message copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Draft buyer update</DialogTitle>
          <DialogDescription>
            AI writes an update for the buyer using the refund status, reference and notes you've
            entered. Review and edit before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Refund status used</Label>
              <div className="text-sm text-muted-foreground pt-2">{REFUND_LABELS[refundStatus]}</div>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional and reassuring">Reassuring</SelectItem>
                  <SelectItem value="apologetic and empathetic">Apologetic</SelectItem>
                  <SelectItem value="brief and factual">Brief & factual</SelectItem>
                  <SelectItem value="firm but polite">Firm but polite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-ref">Refund reference used</Label>
            <div className="text-sm text-muted-foreground">
              {refundReference.trim() || "None yet — the draft won't invent one"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyer-notes">Resolution notes used</Label>
            <Textarea
              id="buyer-notes"
              rows={3}
              value={refundNotes}
              readOnly
              placeholder="No resolution notes yet"
            />
          </div>

          <Button onClick={draft} loading={loading} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {message ? "Redraft update" : "Draft update"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {message && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="buyer-draft">AI draft — review before sending</Label>
                <Button variant="ghost" size="sm" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <Textarea id="buyer-draft" rows={12} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuyerUpdateDraftDialog;
