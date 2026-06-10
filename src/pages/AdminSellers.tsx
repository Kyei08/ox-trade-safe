import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, CheckCircle2, XCircle, AlertCircle, FileText, Loader2, History } from "lucide-react";

type Status = "pending_review" | "approved" | "rejected" | "requires_more_info";

const DOC_KEYS_INDIVIDUAL = [
  ["id_document_path", "SA ID"],
  ["selfie_path", "Selfie"],
  ["proof_of_residence_path", "Proof of Residence"],
] as const;

const DOC_KEYS_BUSINESS = [
  ["cipc_document_path", "CIPC Document"],
  ["representative_id_path", "Representative ID"],
  ["proof_of_business_address_path", "Proof of Business Address"],
  ["proof_of_business_banking_path", "Proof of Business Banking"],
] as const;

const statusColor: Record<Status, string> = {
  pending_review: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-700 border-red-500/30",
  requires_more_info: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

const AdminSellers = () => {
  const [tab, setTab] = useState<Status>("pending_review");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [actionOpen, setActionOpen] = useState<"reject" | "more_info" | null>(null);
  const [notes, setNotes] = useState("");
  const [requestedDocs, setRequestedDocs] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: verifications } = await supabase
      .from("seller_verifications")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });

    const userIds = (verifications || []).map((v) => v.user_id);
    let profilesMap: Record<string, { email: string | null; full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      profilesMap = Object.fromEntries((profiles || []).map((p) => [p.id, { email: p.email, full_name: p.full_name }]));
    }
    const merged = (verifications || []).map((v) => ({ ...v, profiles: profilesMap[v.user_id] || null }));
    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tab]);

  const openDetail = async (item: any) => {
    setSelected(item);
    const keys: ReadonlyArray<readonly [string, string]> =
      item.seller_type === "business" ? DOC_KEYS_BUSINESS : DOC_KEYS_INDIVIDUAL;
    const urls: Record<string, string> = {};
    await Promise.all(
      keys.map(async (entry) => {
        const key = entry[0];
        const path = item[key];
        if (path) {
          const { data } = await supabase.storage
            .from("seller-verification")
            .createSignedUrl(path, 60 * 30);
          if (data?.signedUrl) urls[key] = data.signedUrl;
        }
      })
    );
    setDocUrls(urls);
  };

  const updateStatus = async (status: Status, payload: { review_notes?: string | null; requested_documents?: string[] | null } = {}) => {
    if (!selected) return;
    setActing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("seller_verifications")
        .update({
          status,
          review_notes: payload.review_notes ?? null,
          requested_documents: payload.requested_documents ?? null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success(`Marked as ${status.replace("_", " ")}`);
      setSelected(null);
      setActionOpen(null);
      setNotes("");
      setRequestedDocs("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setActing(false);
    }
  };

  const keys = selected
    ? (selected.seller_type === "business" ? DOC_KEYS_BUSINESS : DOC_KEYS_INDIVIDUAL)
    : [];

  return (
    <AdminLayout title="Seller Verification" description="Review and approve seller verification submissions">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)} className="mb-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="pending_review">Pending</TabsTrigger>
          <TabsTrigger value="requires_more_info">More Info</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No submissions in this status.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const name = item.seller_type === "business" ? item.company_name : item.full_name;
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{name || "Unnamed"}</span>
                      <Badge variant="outline" className="capitalize">{item.seller_type}</Badge>
                      <Badge variant="outline" className={statusColor[item.status as Status]}>
                        {item.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.profiles?.email} · Submitted {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDetail(item)}>
                    <Eye className="w-4 h-4 mr-1" /> Review
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setDocUrls({}); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Seller Verification</DialogTitle>
                <DialogDescription>
                  Submitted {new Date(selected.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Applicant</h3>
                  <div className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Type: </span><span className="capitalize">{selected.seller_type}</span></div>
                    <div><span className="text-muted-foreground">Email: </span>{selected.profiles?.email}</div>
                    {selected.seller_type === "individual" ? (
                      <>
                        <div><span className="text-muted-foreground">Full name: </span>{selected.full_name}</div>
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Address: </span>{selected.physical_address}</div>
                        {selected.phone && <div><span className="text-muted-foreground">Phone: </span>{selected.phone}</div>}
                      </>
                    ) : (
                      <>
                        <div><span className="text-muted-foreground">Company: </span>{selected.company_name}</div>
                        <div><span className="text-muted-foreground">Reg #: </span>{selected.registration_number}</div>
                        {selected.vat_number && <div><span className="text-muted-foreground">VAT #: </span>{selected.vat_number}</div>}
                        <div><span className="text-muted-foreground">Representative: </span>{selected.representative_name}</div>
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Business address: </span>{selected.business_address}</div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Documents</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {keys.map(([key, label]) => {
                      const url = docUrls[key];
                      const path = selected[key];
                      const isPdf = path?.toLowerCase().endsWith(".pdf");
                      return (
                        <div key={key} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{label}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                                Open
                              </a>
                            )}
                          </div>
                          {url ? (
                            isPdf ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="w-4 h-4" /> PDF document
                              </div>
                            ) : (
                              <img src={url} alt={label} className="w-full h-40 object-cover rounded" />
                            )
                          ) : (
                            <div className="text-xs text-muted-foreground">Not provided</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selected.review_notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Previous notes: </span>{selected.review_notes}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setActionOpen("more_info")} disabled={acting}>
                  <AlertCircle className="w-4 h-4 mr-1" /> Request More Info
                </Button>
                <Button variant="destructive" onClick={() => setActionOpen("reject")} disabled={acting}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => updateStatus("approved")} disabled={acting}>
                  {acting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject / Request more info dialog */}
      <Dialog open={!!actionOpen} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionOpen === "reject" ? "Reject submission" : "Request more information"}
            </DialogTitle>
            <DialogDescription>
              The applicant will be notified and can update their submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Notes for applicant</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain the decision or what's needed..." />
            </div>
            {actionOpen === "more_info" && (
              <div>
                <Label>Requested documents (comma separated)</Label>
                <Input value={requestedDocs} onChange={(e) => setRequestedDocs(e.target.value)} placeholder="Proof of residence, Selfie" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={acting}>Cancel</Button>
            <Button
              onClick={() =>
                updateStatus(actionOpen === "reject" ? "rejected" : "requires_more_info", {
                  review_notes: notes || null,
                  requested_documents:
                    actionOpen === "more_info" && requestedDocs
                      ? requestedDocs.split(",").map((s) => s.trim()).filter(Boolean)
                      : null,
                })
              }
              disabled={acting || !notes.trim()}
            >
              {acting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSellers;
