import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Stethoscope, AlertTriangle } from "lucide-react";

interface DiscrepancyDiagnosisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled discrepancy summary (e.g. the reconciliation issue description). */
  defaultDiscrepancy?: string;
  /** Pre-filled transaction details (order refs, amounts, PayFast ids). */
  defaultDetails?: string;
}

export function DiscrepancyDiagnosisDialog({
  open,
  onOpenChange,
  defaultDiscrepancy = "",
  defaultDetails = "",
}: DiscrepancyDiagnosisDialogProps) {
  const [discrepancy, setDiscrepancy] = useState(defaultDiscrepancy);
  const [details, setDetails] = useState(defaultDetails);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const diagnose = async () => {
    if (!discrepancy.trim()) {
      setError("Describe the discrepancy first.");
      return;
    }
    setLoading(true);
    setError("");
    setAnalysis("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "diagnose-payment-discrepancy",
        { body: { discrepancy: discrepancy.trim(), details: details.trim() } },
      );
      if (fnError) throw new Error(fnError.message || "Diagnosis failed");
      if (data?.error) throw new Error(data.error);
      setAnalysis(data?.analysis ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Diagnose payment discrepancy
          </DialogTitle>
          <DialogDescription>
            AI identifies the likely cause, the supporting evidence, and whether to
            refund, retry, or investigate. Review before acting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discrepancy">Discrepancy</Label>
            <Textarea
              id="discrepancy"
              value={discrepancy}
              onChange={(e) => setDiscrepancy(e.target.value)}
              placeholder="e.g. Order OX-20260927-1234 shows paid but the buyer says they were charged twice…"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">Related transaction details (optional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="PayFast payment ids, amounts, dates, order status, ITN history…"
              rows={4}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Diagnosis failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={diagnose} disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Diagnosing…" : "Run diagnosis"}
          </Button>

          {analysis && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI diagnosis — review before acting
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {analysis}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
