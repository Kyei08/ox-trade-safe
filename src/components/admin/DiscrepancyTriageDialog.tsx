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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ListOrdered, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface TriageCaseInput {
  ref: string;
  issueType: string;
  discrepancy: string;
  details?: string;
}

interface DiscrepancyTriageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cases: TriageCaseInput[];
}

export function DiscrepancyTriageDialog({
  open,
  onOpenChange,
  cases,
}: DiscrepancyTriageDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const runTriage = async () => {
    if (cases.length === 0) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "triage-payment-discrepancies",
        { body: { cases } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (err) {
      toast({
        title: "Triage failed",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setAnalysis(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Triage unresolved discrepancies
          </DialogTitle>
          <DialogDescription>
            The AI ranks all {cases.length} unresolved case
            {cases.length === 1 ? "" : "s"} by urgency and tells you which
            evidence to review first for each.
          </DialogDescription>
        </DialogHeader>

        {!analysis && (
          <Button onClick={runTriage} disabled={loading || cases.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ranking cases…
              </>
            ) : (
              "Rank by urgency"
            )}
          </Button>
        )}

        {analysis && (
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                AI triage — review before acting. Rankings are advisory and
                based only on the details shown on this page.
              </AlertDescription>
            </Alert>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">
              {analysis}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={runTriage}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Re-running…
                  </>
                ) : (
                  "Re-run triage"
                )}
              </Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
