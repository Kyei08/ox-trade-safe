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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDiscrepancy: string;
  details: Record<string, unknown>;
}

const ResolutionMessageDialog = ({ open, onOpenChange, defaultDiscrepancy, details }: Props) => {
  const { toast } = useToast();
  const [discrepancy, setDiscrepancy] = useState(defaultDiscrepancy);
  const [recipient, setRecipient] = useState<"buyer" | "seller">("buyer");
  const [tone, setTone] = useState("professional and reassuring");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDiscrepancy(defaultDiscrepancy);
      setMessage("");
      setError(null);
      setNotes("");
    }
  }, [open, defaultDiscrepancy]);

  const draft = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("draft-resolution-message", {
      body: { discrepancy, details, recipient, tone, notes },
    });
    setLoading(false);
    if (fnError || data?.error) {
      let msg = data?.error as string | undefined;
      if (!msg && fnError && "context" in fnError) {
        try {
          msg = (await (fnError as { context: Response }).context.json())?.error;
        } catch { /* ignore */ }
      }
      setError(msg ?? fnError?.message ?? "Could not draft a message");
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
          <DialogTitle>Draft resolution message</DialogTitle>
          <DialogDescription>
            AI writes a clear message about this PayFast discrepancy. Review and edit before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Send to</Label>
              <Select value={recipient} onValueChange={(v) => setRecipient(v as "buyer" | "seller")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                </SelectContent>
              </Select>
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
            <Label htmlFor="discrepancy">Discrepancy</Label>
            <Textarea id="discrepancy" rows={3} value={discrepancy} onChange={(e) => setDiscrepancy(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Resolution to communicate (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="e.g. Refund of R150 issued, expect it in 3–5 business days"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Transaction details sent to the AI</summary>
            <pre className="mt-2 whitespace-pre-wrap bg-muted p-2 rounded">{JSON.stringify(details, null, 2)}</pre>
          </details>

          <Button onClick={draft} loading={loading} disabled={!discrepancy.trim() || loading} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {message ? "Redraft message" : "Draft message"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {message && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="draft">AI draft — review before sending</Label>
                <Button variant="ghost" size="sm" onClick={copy}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <Textarea id="draft" rows={12} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResolutionMessageDialog;
