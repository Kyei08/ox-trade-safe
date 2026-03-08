import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Flag } from "lucide-react";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "counterfeit", label: "Counterfeit or stolen goods" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "other", label: "Other" },
];

interface ReportDialogProps {
  reportType: "listing" | "user";
  reportedListingId?: string;
  reportedUserId?: string;
  reportedName?: string;
  children?: React.ReactNode;
}

const ReportDialog = ({
  reportType,
  reportedListingId,
  reportedUserId,
  reportedName,
  children,
}: ReportDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to submit a report");
      navigate("/auth");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason for your report");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        report_type: reportType,
        reported_listing_id: reportType === "listing" ? reportedListingId : null,
        reported_user_id: reportedUserId || null,
        reason,
        description: description.trim() || null,
      });

      if (error) throw error;

      toast.success("Report submitted successfully. Our team will review it shortly.");
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        toast.error("You have already reported this.");
      } else {
        toast.error(error.message || "Failed to submit report");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Report {reportType === "listing" ? "Listing" : "User"}
          </DialogTitle>
          <DialogDescription>
            {reportedName
              ? `Report "${reportedName}" — our team will review this within 24 hours.`
              : `Tell us why you're reporting this ${reportType}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label>Reason *</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Additional details (optional)</Label>
            <Textarea
              id="report-description"
              placeholder="Provide any additional context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="mr-2 h-4 w-4" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
