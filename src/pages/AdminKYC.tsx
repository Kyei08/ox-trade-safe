import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface KYCSubmission {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  additional_info: string | null;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminKYC() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .single();

      if (data) {
        setIsAdmin(true);
        fetchSubmissions();
      } else {
        navigate("/");
      }
    } catch (error) {
      navigate("/");
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profile data separately for each submission
      const submissionsWithProfiles = await Promise.all(
        (data || []).map(async (submission) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", submission.user_id)
            .single();

          return {
            ...submission,
            profiles: profile || { full_name: "Unknown", email: "Unknown" },
          };
        })
      );

      setSubmissions(submissionsWithProfiles);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string, userId: string) => {
    setProcessing(true);
    try {
      // Update submission status
      const { error: updateError } = await supabase
        .from("kyc_submissions")
        .update({
          status: "approved",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (updateError) throw updateError;

      // Update profile KYC status
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          kyc_status: "verified",
          kyc_verified_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "KYC Approved",
        description: "User verification has been approved.",
      });

      fetchSubmissions();
      setReviewDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (submissionId: string, userId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Update submission status
      const { error: updateError } = await supabase
        .from("kyc_submissions")
        .update({
          status: "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", submissionId);

      if (updateError) throw updateError;

      // Update profile KYC status
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          kyc_status: "rejected",
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "KYC Rejected",
        description: "User verification has been rejected.",
      });

      fetchSubmissions();
      setReviewDialogOpen(false);
      setRejectionReason("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (submission: KYCSubmission) => {
    setSelectedSubmission(submission);
    setReviewDialogOpen(true);
    setRejectionReason("");
  };

  const renderSubmissionCard = (submission: KYCSubmission) => (
    <Card key={submission.id}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{submission.profiles.full_name}</CardTitle>
            <CardDescription>{submission.profiles.email}</CardDescription>
          </div>
          <Badge variant={
            submission.status === "approved" ? "default" :
            submission.status === "rejected" ? "destructive" :
            "secondary"
          }>
            {submission.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p><strong>Document Type:</strong> {submission.document_type}</p>
        <p><strong>Submitted:</strong> {new Date(submission.created_at).toLocaleDateString()}</p>
        {submission.additional_info && (
          <p><strong>Additional Info:</strong> {submission.additional_info}</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReviewDialog(submission)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Review
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(submission.document_url, "_blank")}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Document
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading || loading || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const approvedSubmissions = submissions.filter(s => s.status === "approved");
  const rejectedSubmissions = submissions.filter(s => s.status === "rejected");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">KYC Review Panel</h1>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pending ({pendingSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedSubmissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending submissions</p>
          ) : (
            pendingSubmissions.map(renderSubmissionCard)
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No approved submissions</p>
          ) : (
            approvedSubmissions.map(renderSubmissionCard)
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No rejected submissions</p>
          ) : (
            rejectedSubmissions.map(renderSubmissionCard)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review KYC Submission</DialogTitle>
            <DialogDescription>
              Review the submission and approve or reject it.
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              <div>
                <p><strong>User:</strong> {selectedSubmission.profiles.full_name}</p>
                <p><strong>Email:</strong> {selectedSubmission.profiles.email}</p>
                <p><strong>Document Type:</strong> {selectedSubmission.document_type}</p>
                <p><strong>Submitted:</strong> {new Date(selectedSubmission.created_at).toLocaleDateString()}</p>
              </div>

              {selectedSubmission.additional_info && (
                <div>
                  <Label>Additional Information</Label>
                  <p className="text-sm text-muted-foreground">{selectedSubmission.additional_info}</p>
                </div>
              )}

              {selectedSubmission.status === "pending" && (
                <div>
                  <Label htmlFor="rejectionReason">Rejection Reason (if rejecting)</Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a reason if rejecting..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedSubmission?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedSubmission.id, selectedSubmission.user_id)}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(selectedSubmission.id, selectedSubmission.user_id)}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
