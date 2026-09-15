import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  Clock,
  XCircle,
  AlertCircle,
  CheckCircle2,
  FileText,
  History,
} from "lucide-react";

type VerificationStatus =
  | "not_started"
  | "pending_review"
  | "approved"
  | "rejected"
  | "requires_more_info";

const INDIVIDUAL_DOCS = [
  ["id_document_path", "South African ID"],
  ["selfie_path", "Selfie Verification"],
  ["proof_of_residence_path", "Proof of Residence"],
] as const;

const BUSINESS_DOCS = [
  ["cipc_document_path", "CIPC Document"],
  ["representative_id_path", "Representative ID"],
  ["proof_of_business_address_path", "Proof of Business Address"],
  ["proof_of_business_banking_path", "Proof of Business Banking"],
] as const;

const statusMeta: Record<
  VerificationStatus,
  { label: string; icon: typeof Clock; className: string; description: string }
> = {
  not_started: {
    label: "Not started",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground border-border",
    description: "You haven't submitted your seller verification yet.",
  },
  pending_review: {
    label: "Pending review",
    icon: Clock,
    className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
    description: "Your documents are with our review team. We'll let you know as soon as it's done.",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    description: "You're a verified seller and can list items for sale.",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-500/10 text-red-700 border-red-500/30",
    description: "Your submission was not approved. Review the notes below and submit again.",
  },
  requires_more_info: {
    label: "More information needed",
    icon: AlertCircle,
    className: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    description: "We need a few more documents before we can finish your review.",
  },
};

interface Props {
  userId: string;
}

const SellerVerificationPanel = ({ userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [versionCounts, setVersionCounts] = useState<Record<string, number>>({});
  const [auditLog, setAuditLog] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      setRecord(data || null);

      if (data) {
        const fields = data.seller_type === "business" ? BUSINESS_DOCS : INDIVIDUAL_DOCS;
        const urls: Record<string, string> = {};
        await Promise.all(
          (fields as ReadonlyArray<readonly [string, string]>).map(async ([key]) => {
            const path = (data as any)[key];
            if (!path) return;
            const { data: signed } = await supabase.storage
              .from("seller-verification")
              .createSignedUrl(path, 60 * 10);
            if (signed?.signedUrl) urls[key] = signed.signedUrl;
          })
        );

        const { data: versions } = await (supabase as any)
          .from("seller_verification_documents")
          .select("field_key")
          .eq("verification_id", data.id);
        const counts: Record<string, number> = {};
        (versions || []).forEach((v: any) => {
          counts[v.field_key] = (counts[v.field_key] || 0) + 1;
        });

        const { data: logs } = await (supabase as any)
          .from("seller_verification_audit_log")
          .select("*")
          .eq("verification_id", data.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        setDocUrls(urls);
        setVersionCounts(counts);
        setAuditLog(logs || []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const status = (record?.status || "not_started") as VerificationStatus;
  const meta = statusMeta[status] || statusMeta.not_started;
  const StatusIcon = meta.icon;
  const docFields = record?.seller_type === "business" ? BUSINESS_DOCS : INDIVIDUAL_DOCS;
  const requested: string[] = Array.isArray(record?.requested_documents)
    ? record.requested_documents
    : [];

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Seller verification
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </div>
            <Badge variant="outline" className={`self-start ${meta.className}`}>
              <StatusIcon className="w-3.5 h-3.5 mr-1" />
              {meta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Account type</p>
              <p className="font-medium capitalize">
                {record?.seller_type === "business" ? "Registered business" : record?.seller_type || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Submitted</p>
              <p className="font-medium">
                {record?.created_at ? new Date(record.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Last update</p>
              <p className="font-medium">
                {record?.reviewed_at
                  ? new Date(record.reviewed_at).toLocaleDateString()
                  : record?.updated_at
                  ? new Date(record.updated_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          {status === "pending_review" && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Case in review</AlertTitle>
              <AlertDescription>
                Your case is in the review queue. You can still view the documents you sent below.
              </AlertDescription>
            </Alert>
          )}

          {(status === "rejected" || status === "requires_more_info") && (
            <Alert variant={status === "rejected" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {status === "rejected" ? "Action needed" : "We need more from you"}
              </AlertTitle>
              <AlertDescription className="space-y-1">
                {record?.review_notes && <p>{record.review_notes}</p>}
                {requested.length > 0 && (
                  <p>
                    <span className="font-medium">Requested: </span>
                    {requested.join(", ")}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant={status === "approved" ? "outline" : "default"} size="sm">
              <Link to="/seller-verification">
                {status === "not_started"
                  ? "Start verification"
                  : status === "approved"
                  ? "View verification"
                  : "Continue verification"}
              </Link>
            </Button>
            {status === "approved" && (
              <Button asChild size="sm">
                <Link to="/create-listing">Create a listing</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      {record && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> My documents
            </CardTitle>
            <CardDescription>Links stay active for a few minutes for your security.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {docFields.map(([key, label]) => {
                const path = (record as any)[key];
                const url = docUrls[key];
                const count = versionCounts[key] || (path ? 1 : 0);
                const isRequested = requested.some((r) =>
                  r.toLowerCase().includes(label.toLowerCase())
                );
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {path
                          ? `Uploaded${count > 1 ? ` · ${count} versions` : ""}`
                          : "Not uploaded yet"}
                        {isRequested ? " · re-upload requested" : ""}
                      </p>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline shrink-0"
                      >
                        View
                      </a>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Missing
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {auditLog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" /> Verification history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l pl-4 space-y-3">
              {auditLog.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">
                      {String(entry.event_type).replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.review_notes && (
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Notes: </span>
                      {entry.review_notes}
                    </p>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SellerVerificationPanel;
