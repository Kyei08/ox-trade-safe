import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, CheckCircle2, XCircle, AlertCircle, FileText, History, GitCompare, Search, X } from "lucide-react";

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
  const [docVersions, setDocVersions] = useState<Record<string, Array<{ id: string; storage_path: string; version: number; created_at: string; url?: string; is_current: boolean }>>>({});
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [actionOpen, setActionOpen] = useState<"reject" | "more_info" | null>(null);
  const [notes, setNotes] = useState("");
  const [requestedDocs, setRequestedDocs] = useState("");
  const [acting, setActing] = useState(false);
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [compareLabel, setCompareLabel] = useState<string>("");
  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);

  // Search / filters
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"approved" | "rejected" | "requires_more_info" | null>(null);
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkDocs, setBulkDocs] = useState("");

  const openCompare = (key: string, label: string) => {
    const versions = docVersions[key] || [];
    if (versions.length < 1) return;
    setCompareKey(key);
    setCompareLabel(label);
    setCompareRight(versions[0]?.version ?? null); // newest
    setCompareLeft(versions[1]?.version ?? versions[0]?.version ?? null); // prior or same
  };

  const load = async () => {
    setLoading(true);
    const { data: verifications } = await supabase
      .from("seller_verifications")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });

    const userIds = (verifications || []).map((v) => v.user_id);
    let profilesMap: Record<string, { email: string | null; full_name: string | null; location: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, location")
        .in("id", userIds);
      profilesMap = Object.fromEntries((profiles || []).map((p) => [p.id, { email: p.email, full_name: p.full_name, location: p.location }]));
    }
    const merged = (verifications || []).map((v) => ({ ...v, profiles: profilesMap[v.user_id] || null }));
    setItems(merged);
    setSelectedIds([]);
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

    // Load all document versions and sign each one for inline viewing/comparison.
    const { data: versions } = await (supabase as any)
      .from("seller_verification_documents")
      .select("*")
      .eq("verification_id", item.id)
      .order("version", { ascending: false });
    const grouped: Record<string, any[]> = {};
    await Promise.all(
      (versions || []).map(async (v: any) => {
        const { data: signed } = await supabase.storage
          .from("seller-verification")
          .createSignedUrl(v.storage_path, 60 * 30);
        (grouped[v.field_key] ||= []).push({ ...v, url: signed?.signedUrl });
      })
    );
    setDocVersions(grouped);

    const { data: logs } = await (supabase as any)
      .from("seller_verification_audit_log")
      .select("*")
      .eq("verification_id", item.id)
      .order("created_at", { ascending: false });
    setAuditLog(logs || []);
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

      const applicantName = selected.seller_type === "business"
        ? selected.company_name
        : selected.full_name;

      if (status === "approved") {
        toast.success(
          `${applicantName || "Applicant"} has been approved as a seller`,
          {
            description: "They can now access the seller dashboard and list items for sale.",
            duration: 5000,
          }
        );
      } else {
        toast.success(`Marked as ${status.replace("_", " ")}`);
      }

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

  const bulkUpdate = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    setActing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("seller_verifications")
        .update({
          status: bulkAction,
          review_notes: bulkAction === "approved" ? (bulkNotes || null) : bulkNotes,
          requested_documents:
            bulkAction === "requires_more_info" && bulkDocs
              ? bulkDocs.split(",").map((s) => s.trim()).filter(Boolean)
              : null,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", selectedIds);
      if (error) throw error;
      toast.success(`${selectedIds.length} case${selectedIds.length === 1 ? "" : "s"} marked as ${bulkAction.replace(/_/g, " ")}`);
      setBulkAction(null);
      setBulkNotes("");
      setBulkDocs("");
      setSelectedIds([]);
      load();
    } catch (err: any) {
      toast.error(err.message || "Bulk update failed");
    } finally {
      setActing(false);
    }
  };

  const locationOf = (item: any) =>
    (item.seller_type === "business" ? item.business_address : item.physical_address) ||
    item.profiles?.location ||
    "";

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const loc = locationOf(i).trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.seller_type !== categoryFilter) return false;
      if (locationFilter !== "all" && locationOf(item).trim() !== locationFilter) return false;
      const created = new Date(item.created_at).getTime();
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
      if (q) {
        const haystack = [
          item.full_name,
          item.company_name,
          item.representative_name,
          item.profiles?.full_name,
          item.profiles?.email,
          locationOf(item),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, categoryFilter, locationFilter, dateFrom, dateTo]);

  const filtersActive =
    !!query || categoryFilter !== "all" || locationFilter !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setLocationFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((i) => selectedIds.includes(i.id));

  const toggleAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : filteredItems.map((i) => i.id));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const keys = selected
    ? (selected.seller_type === "business" ? DOC_KEYS_BUSINESS : DOC_KEYS_INDIVIDUAL)
    : [];

  return (
    <AdminLayout title="Seller Verification" description="Review and approve seller verification submissions (identity + business KYC)">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)} className="flex-1">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="pending_review">Pending</TabsTrigger>
            <TabsTrigger value="requires_more_info">More Info</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link to="/admin/kyc/legacy">
            <FileText className="w-4 h-4" />
            Legacy KYC archive
          </Link>
        </Button>
      </div>

      {/* Search & filters */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by seller name, company, representative, email or location..."
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="individual">Individual seller</SelectItem>
                  <SelectItem value="business">Registered business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Submitted from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Submitted to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {filteredItems.length} of {items.length} case{items.length === 1 ? "" : "s"}
            </p>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {!loading && filteredItems.length > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
            Select all shown
          </label>
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" disabled={selectedIds.length === 0 || acting} onClick={() => setBulkAction("approved")}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" disabled={selectedIds.length === 0 || acting} onClick={() => setBulkAction("rejected")}>
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="outline" disabled={selectedIds.length === 0 || acting} onClick={() => setBulkAction("requires_more_info")}>
              <AlertCircle className="w-4 h-4 mr-1" /> Request info
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {items.length === 0 ? "No submissions in this status." : "No cases match your search or filters."}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const name = item.seller_type === "business" ? item.company_name : item.full_name;
            const loc = locationOf(item);
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleOne(item.id)}
                    aria-label={`Select ${name || "case"}`}
                    className="mt-1 sm:mt-0"
                  />
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
                      {loc ? ` · ${loc}` : ""}
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

      {/* Bulk confirm dialog */}
      <Dialog open={!!bulkAction} onOpenChange={(o) => { if (!o) { setBulkAction(null); setBulkNotes(""); setBulkDocs(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "approved" ? "Approve" : bulkAction === "rejected" ? "Reject" : "Request more information for"}{" "}
              {selectedIds.length} case{selectedIds.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              This applies the same decision and notes to every selected applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Notes for applicants {bulkAction === "approved" ? "(optional)" : ""}</Label>
              <Textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Explain the decision or what's needed..."
              />
            </div>
            {bulkAction === "requires_more_info" && (
              <div>
                <Label>Requested documents (comma separated)</Label>
                <Input value={bulkDocs} onChange={(e) => setBulkDocs(e.target.value)} placeholder="Proof of residence, Selfie" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)} disabled={acting}>Cancel</Button>
            <Button
              onClick={bulkUpdate}
              loading={acting}
              disabled={bulkAction !== "approved" && !bulkNotes.trim()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setDocUrls({}); setAuditLog([]); setDocVersions({}); } }}>
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
                      const versions = docVersions[key] || [];
                      const olderVersions = versions.filter((v) => v.storage_path !== path);
                      return (
                        <div key={key} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <span className="text-sm font-medium">
                              {label}
                              {versions.length > 0 && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  v{versions[0]?.version ?? 1}
                                </Badge>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              {versions.length >= 2 && (
                                <button
                                  type="button"
                                  onClick={() => openCompare(key, label)}
                                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                                >
                                  <GitCompare className="w-3 h-3" /> Compare
                                </button>
                              )}
                              {url && (
                                <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                                  Open
                                </a>
                              )}
                            </div>
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

                          {olderVersions.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                {olderVersions.length} previous version{olderVersions.length === 1 ? "" : "s"}
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {olderVersions.map((v) => {
                                  const vIsPdf = v.storage_path.toLowerCase().endsWith(".pdf");
                                  return (
                                    <li key={v.id} className="border rounded p-2">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span>v{v.version} · {new Date(v.created_at).toLocaleString()}</span>
                                        {v.url && (
                                          <a href={v.url} target="_blank" rel="noreferrer" className="text-primary underline">
                                            Open
                                          </a>
                                        )}
                                      </div>
                                      {v.url && !vIsPdf && (
                                        <img src={v.url} alt={`${label} v${v.version}`} className="w-full h-24 object-cover rounded" />
                                      )}
                                      {vIsPdf && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <FileText className="w-3 h-3" /> PDF
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
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

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" /> Audit Log
                  </h3>
                  {auditLog.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No history yet.</p>
                  ) : (
                    <ol className="relative border-l pl-4 space-y-3">
                      {auditLog.map((entry) => (
                        <li key={entry.id} className="text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {entry.event_type.replace(/_/g, " ")}
                            </Badge>
                            {entry.status_from && entry.status_to && entry.status_from !== entry.status_to && (
                              <span className="text-xs text-muted-foreground">
                                {entry.status_from.replace(/_/g, " ")} → {entry.status_to.replace(/_/g, " ")}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                          </div>
                          {entry.review_notes && (
                            <p className="text-xs mt-1"><span className="text-muted-foreground">Notes: </span>{entry.review_notes}</p>
                          )}
                          {entry.requested_documents?.length > 0 && (
                            <p className="text-xs mt-1">
                              <span className="text-muted-foreground">Requested: </span>
                              {entry.requested_documents.join(", ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setActionOpen("more_info")} disabled={acting}>
                  <AlertCircle className="w-4 h-4 mr-1" /> Request More Info
                </Button>
                <Button variant="destructive" onClick={() => setActionOpen("reject")} disabled={acting}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => updateStatus("approved")} loading={acting}>
                  {!acting && <CheckCircle2 className="w-4 h-4 mr-1" />}
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
              loading={acting}
              disabled={!notes.trim()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side-by-side compare dialog */}
      <Dialog
        open={!!compareKey}
        onOpenChange={(o) => { if (!o) { setCompareKey(null); setCompareLeft(null); setCompareRight(null); } }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-4 h-4" /> Compare {compareLabel}
            </DialogTitle>
            <DialogDescription>
              Side-by-side view of document versions. Pick any two to compare.
            </DialogDescription>
          </DialogHeader>
          {compareKey && (() => {
            const versions = docVersions[compareKey] || [];
            const left = versions.find((v) => v.version === compareLeft);
            const right = versions.find((v) => v.version === compareRight);
            const renderPane = (v: typeof left, side: "left" | "right") => {
              if (!v) return <div className="text-sm text-muted-foreground">No version selected</div>;
              const isPdf = v.storage_path.toLowerCase().endsWith(".pdf");
              return (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      className="text-xs bg-background border rounded px-2 py-1"
                      value={v.version}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (side === "left") setCompareLeft(val);
                        else setCompareRight(val);
                      }}
                    >
                      {versions.map((opt) => (
                        <option key={opt.id} value={opt.version}>
                          v{opt.version} · {new Date(opt.created_at).toLocaleDateString()}
                          {opt.is_current ? " (current)" : ""}
                        </option>
                      ))}
                    </select>
                    {v.url && (
                      <a href={v.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Open full
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Uploaded {new Date(v.created_at).toLocaleString()}
                  </div>
                  {v.url ? (
                    isPdf ? (
                      <iframe src={v.url} title={`v${v.version}`} className="w-full h-[60vh] rounded border" />
                    ) : (
                      <img src={v.url} alt={`v${v.version}`} className="w-full max-h-[60vh] object-contain rounded border bg-muted" />
                    )
                  ) : (
                    <div className="text-xs text-muted-foreground">Preview unavailable</div>
                  )}
                </div>
              );
            };
            return (
              <div className="grid md:grid-cols-2 gap-3">
                {renderPane(left, "left")}
                {renderPane(right, "right")}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareKey(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSellers;
