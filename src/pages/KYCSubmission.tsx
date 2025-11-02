import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle, XCircle, Clock } from "lucide-react";

export default function KYCSubmission() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [lastSubmission, setLastSubmission] = useState<any>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchKYCStatus();
    }
  }, [user]);

  const fetchKYCStatus = async () => {
    try {
      // Get profile KYC status
      const { data: profile } = await supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", user?.id)
        .single();

      setKycStatus(profile?.kyc_status || "pending");

      // Get last submission
      const { data: submissions } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (submissions && submissions.length > 0) {
        setLastSubmission(submissions[0]);
      }
    } catch (error) {
      console.error("Error fetching KYC status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5242880) {
        toast({
          title: "File too large",
          description: "File size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !documentType) {
      toast({
        title: "Missing Information",
        description: "Please select a file and document type",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create FormData for the secure edge function
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      if (additionalInfo) {
        formData.append('additionalInfo', additionalInfo);
      }

      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call the secure upload edge function
      const { data, error } = await supabase.functions.invoke('upload-kyc-document', {
        body: formData,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');

      toast({
        title: "KYC Submitted",
        description: "Your KYC documents have been submitted for review.",
      });

      // Reset form
      setFile(null);
      setDocumentType("");
      setAdditionalInfo("");
      fetchKYCStatus();
    } catch (error: any) {
      console.error('KYC upload error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || 'Failed to upload document',
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (kycStatus) {
      case "verified":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusText = () => {
    switch (kycStatus) {
      case "verified":
        return "Your KYC verification has been approved!";
      case "rejected":
        return "Your KYC submission was rejected. Please review and resubmit.";
      default:
        return "Your KYC is pending review.";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">KYC Verification</h1>

      <Alert className="mb-6">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <AlertDescription>{getStatusText()}</AlertDescription>
        </div>
      </Alert>

      {lastSubmission && lastSubmission.status === "rejected" && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            <strong>Rejection Reason:</strong> {lastSubmission.rejection_reason}
          </AlertDescription>
        </Alert>
      )}

      {kycStatus !== "verified" && (
        <Card>
          <CardHeader>
            <CardTitle>Submit KYC Documents</CardTitle>
            <CardDescription>
              Please upload a valid government-issued ID and provide any additional information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="documentType">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="national_id">National ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file">Upload Document (Max 5MB)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  required
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
                <Textarea
                  id="additionalInfo"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Any additional information you'd like to provide..."
                  rows={4}
                />
              </div>

              <Button type="submit" disabled={submitting || !file || !documentType} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit KYC
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {lastSubmission && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Submission History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Document Type:</strong> {lastSubmission.document_type}</p>
              <p><strong>Status:</strong> {lastSubmission.status}</p>
              <p><strong>Submitted:</strong> {new Date(lastSubmission.created_at).toLocaleDateString()}</p>
              {lastSubmission.reviewed_at && (
                <p><strong>Reviewed:</strong> {new Date(lastSubmission.reviewed_at).toLocaleDateString()}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
