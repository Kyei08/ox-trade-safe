import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Flag, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Report {
  id: string;
  reporter_id: string;
  report_type: string;
  reported_listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  reviewed: { label: "Reviewed", variant: "outline", icon: Flag },
  resolved: { label: "Resolved", variant: "default", icon: CheckCircle },
  dismissed: { label: "Dismissed", variant: "destructive", icon: XCircle },
};

const AdminReports = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) checkAdminAndFetch();
  }, [user]);

  const checkAdminAndFetch = async () => {
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });

      if (!data) {
        toast.error("You don't have permission to access this page");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await fetchReports();
    } catch (error) {
      navigate("/dashboard");
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (reportId: string, newStatus: string) => {
    setUpdatingId(reportId);
    try {
      const { error } = await supabase
        .from("reports")
        .update({
          status: newStatus,
          admin_notes: adminNotes[reportId] || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;
      toast.success(`Report marked as ${newStatus}`);
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || "Failed to update report");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReports = filterStatus === "all"
    ? reports
    : reports.filter((r) => r.status === filterStatus);

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-24 pb-12">
          <div className="container px-4 max-w-4xl">
            <Skeleton className="h-12 w-64 mb-8" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </>
    );
  }

  if (!isAdmin) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Reports</h1>
              <p className="text-muted-foreground">
                {reports.filter((r) => r.status === "pending").length} pending reports
              </p>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredReports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Flag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No reports found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const config = statusConfig[report.status] || statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <Card key={report.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <Badge variant="outline">
                            {report.report_type === "listing" ? "Listing" : "User"}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(report.created_at), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Reason:</span>
                          <p className="font-medium capitalize">{report.reason.replace(/_/g, " ")}</p>
                        </div>
                        {report.reported_listing_id && (
                          <div>
                            <span className="text-muted-foreground">Listing:</span>
                            <Button
                              variant="link"
                              className="p-0 h-auto text-sm"
                              onClick={() => navigate(`/listings/${report.reported_listing_id}`)}
                            >
                              View Listing
                            </Button>
                          </div>
                        )}
                        {report.reported_user_id && (
                          <div>
                            <span className="text-muted-foreground">User:</span>
                            <Button
                              variant="link"
                              className="p-0 h-auto text-sm"
                              onClick={() => navigate(`/seller/${report.reported_user_id}`)}
                            >
                              View Profile
                            </Button>
                          </div>
                        )}
                      </div>

                      {report.description && (
                        <div>
                          <span className="text-sm text-muted-foreground">Details:</span>
                          <p className="text-sm mt-1">{report.description}</p>
                        </div>
                      )}

                      {report.status === "pending" && (
                        <div className="space-y-3 pt-2 border-t">
                          <Textarea
                            placeholder="Admin notes (optional)..."
                            value={adminNotes[report.id] || ""}
                            onChange={(e) =>
                              setAdminNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                            }
                            className="min-h-16"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateReport(report.id, "resolved")}
                              disabled={updatingId === report.id}
                            >
                              {updatingId === report.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Resolve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateReport(report.id, "reviewed")}
                              disabled={updatingId === report.id}
                            >
                              Mark Reviewed
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateReport(report.id, "dismissed")}
                              disabled={updatingId === report.id}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}

                      {report.admin_notes && report.status !== "pending" && (
                        <div className="pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Admin notes:</span>
                          <p className="text-sm mt-1">{report.admin_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default AdminReports;
