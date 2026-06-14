import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, Clock, XCircle, AlertCircle, User, Building2, FileText, History, RefreshCw, ShieldCheck } from "lucide-react";

type SellerType = "individual" | "business";
type VerificationStatus =
  | "not_started"
  | "pending_review"
  | "approved"
  | "rejected"
  | "requires_more_info";

const INDIVIDUAL_DOC_FIELDS = [
  { key: "id_document_path", label: "South African ID", description: "Clear photo or scan of your SA ID document" },
  { key: "selfie_path", label: "Selfie Verification", description: "A selfie holding your ID next to your face" },
  { key: "proof_of_residence_path", label: "Proof of Residence", description: "Utility bill / bank statement (less than 3 months old)" },
] as const;

const BUSINESS_DOC_FIELDS = [
  { key: "cipc_document_path", label: "CIPC Document", description: "Company registration document from CIPC" },
  { key: "representative_id_path", label: "Representative ID", description: "SA ID of the authorised representative" },
  { key: "proof_of_business_address_path", label: "Proof of Business Address", description: "Lease, utility bill, or municipal letter" },
  { key: "proof_of_business_banking_path", label: "Proof of Business Banking", description: "Recent business bank statement or letter from the bank" },
] as const;

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

const statusMeta: Record<VerificationStatus, { label: string; icon: typeof Clock; color: string }> = {
  not_started: { label: "Not Started", icon: AlertCircle, color: "text-muted-foreground" },
  pending_review: { label: "Pending Review", icon: Clock, color: "text-yellow-600" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-600" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600" },
  requires_more_info: { label: "More Information Required", icon: AlertCircle, color: "text-orange-600" },
};

const SellerVerification = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [docVersions, setDocVersions] = useState<Record<string, Array<{ id: string; storage_path: string; version: number; created_at: string; is_current: boolean; url?: string }>>>({});
  const [step, setStep] = useState(1);

  // Form state
  const [sellerType, setSellerType] = useState<SellerType>("individual");
  const [form, setForm] = useState({
    full_name: "",
    physical_address: "",
    phone: "",
    company_name: "",
    registration_number: "",
    vat_number: "",
    representative_name: "",
    business_address: "",
  });
  const [docs, setDocs] = useState<Record<string, string | undefined>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExisting(data);
        setSellerType(data.seller_type as SellerType);
        setForm({
          full_name: data.full_name ?? "",
          physical_address: data.physical_address ?? "",
          phone: data.phone ?? "",
          company_name: data.company_name ?? "",
          registration_number: data.registration_number ?? "",
          vat_number: data.vat_number ?? "",
          representative_name: data.representative_name ?? "",
          business_address: data.business_address ?? "",
        });
        const docFields = data.seller_type === "business" ? BUSINESS_DOC_FIELDS : INDIVIDUAL_DOC_FIELDS;
        const initialDocs: Record<string, string | undefined> = {};
        docFields.forEach((f) => (initialDocs[f.key] = (data as any)[f.key] ?? undefined));
        // Clear paths for documents the admin explicitly requested again, so the seller must re-upload.
        if (data.status === "requires_more_info" && Array.isArray(data.requested_documents)) {
          docFields.forEach((f) => {
            const requested = data.requested_documents.some((r: string) =>
              r.toLowerCase().includes(f.label.toLowerCase()) || r.toLowerCase().includes(f.key.toLowerCase())
            );
            if (requested) initialDocs[f.key] = undefined;
          });
        }
        setDocs(initialDocs);
        // Jump straight to documents step when resubmitting
        if (data.status === "requires_more_info" || data.status === "rejected") {
          setStep(3);
        }
      }
      // Count prior submissions from the audit log to show attempt number.
      const { count } = await (supabase as any)
        .from("seller_verification_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("event_type", ["submitted", "resubmitted"]);
      setSubmissionCount(count || 0);

      // Full audit log for the seller's own submission history view.
      if (data?.id) {
        const { data: logs } = await (supabase as any)
          .from("seller_verification_audit_log")
          .select("*")
          .eq("verification_id", data.id)
          .order("created_at", { ascending: false });
        setAuditLog(logs || []);

        const { data: versions } = await (supabase as any)
          .from("seller_verification_documents")
          .select("*")
          .eq("verification_id", data.id)
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
      }
      setLoading(false);
    })();
  }, [user]);

  const docFields = useMemo(
    () => (sellerType === "business" ? BUSINESS_DOC_FIELDS : INDIVIDUAL_DOC_FIELDS),
    [sellerType]
  );

  const isEditable = !existing || existing.status === "requires_more_info" || existing.status === "rejected";

  const uploadDoc = async (key: string, file: File) => {
    if (!user) return;
    if (file.size > MAX_SIZE) return toast.error("File must be 5MB or smaller");
    if (!ALLOWED_TYPES.includes(file.type)) return toast.error("Only JPG, PNG or PDF allowed");

    setUploadingKey(key);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${user.id}/${key}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("seller-verification")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setDocs((prev) => ({ ...prev, [key]: path }));

      // Record a new version row (older versions remain accessible to admins).
      if (existing?.id) {
        const { data: prev } = await (supabase as any)
          .from("seller_verification_documents")
          .select("version")
          .eq("verification_id", existing.id)
          .eq("field_key", key)
          .order("version", { ascending: false })
          .limit(1);
        const nextVersion = (prev?.[0]?.version ?? 0) + 1;

        await (supabase as any)
          .from("seller_verification_documents")
          .update({ is_current: false })
          .eq("verification_id", existing.id)
          .eq("field_key", key);

        await (supabase as any).from("seller_verification_documents").insert({
          verification_id: existing.id,
          user_id: user.id,
          field_key: key,
          storage_path: path,
          file_size: file.size,
          content_type: file.type,
          version: nextVersion,
          is_current: true,
        });
      }

      toast.success(`${key.replace(/_/g, " ")} uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const validateStep = () => {
    if (step === 2) {
      if (sellerType === "individual") {
        if (!form.full_name.trim()) return "Full name is required";
        if (!form.physical_address.trim()) return "Physical address is required";
      } else {
        if (!form.company_name.trim()) return "Company name is required";
        if (!form.registration_number.trim()) return "Registration number is required";
        if (!form.representative_name.trim()) return "Representative name is required";
        if (!form.business_address.trim()) return "Business address is required";
      }
    }
    if (step === 3) {
      for (const f of docFields) {
        if (!docs[f.key]) return `Please upload ${f.label}`;
      }
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) return toast.error(err);
    setStep((s) => Math.min(s + 1, 4));
  };

  const submit = async () => {
    if (!user) return;
    const err = validateStep();
    if (err) return toast.error(err);
    const isResubmission = !!existing && (existing.status === "requires_more_info" || existing.status === "rejected");
    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        seller_type: sellerType,
        full_name: sellerType === "individual" ? form.full_name : null,
        physical_address: sellerType === "individual" ? form.physical_address : null,
        phone: form.phone || null,
        company_name: sellerType === "business" ? form.company_name : null,
        registration_number: sellerType === "business" ? form.registration_number : null,
        vat_number: sellerType === "business" ? form.vat_number || null : null,
        representative_name: sellerType === "business" ? form.representative_name : null,
        business_address: sellerType === "business" ? form.business_address : null,
        ...docs,
        status: "pending_review" as const,
        review_notes: null,
        requested_documents: null,
      };

      const { error } = await supabase
        .from("seller_verifications")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      toast.success(isResubmission ? "Resubmitted for review" : "Verification submitted for review");
      const { data } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setExisting(data);

      // Seed version rows for docs uploaded before the verification row existed.
      if (data?.id) {
        const { data: existingDocs } = await (supabase as any)
          .from("seller_verification_documents")
          .select("storage_path")
          .eq("verification_id", data.id);
        const known = new Set((existingDocs || []).map((d: any) => d.storage_path));
        const toInsert = Object.entries(docs)
          .filter(([, path]) => path && !known.has(path))
          .map(([key, path]) => ({
            verification_id: data.id,
            user_id: user.id,
            field_key: key,
            storage_path: path as string,
            version: 1,
            is_current: true,
          }));
        if (toInsert.length > 0) {
          await (supabase as any).from("seller_verification_documents").insert(toInsert);
        }
      }

      setSubmissionCount((c) => c + 1);
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-24 pb-12">
          <div className="container px-4 max-w-3xl flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </main>
      </>
    );
  }

  // Status screen for non-editable states
  if (existing && !isEditable) {
    const meta = statusMeta[existing.status as VerificationStatus];
    const Icon = meta.icon;
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-24 pb-12">
          <div className="container px-4 max-w-3xl space-y-6">
            <h1 className="text-3xl font-bold">Seller Verification</h1>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className={`w-6 h-6 ${meta.color}`} />
                  <CardTitle>{meta.label}</CardTitle>
                </div>
                <CardDescription>
                  {existing.status === "pending_review"
                    ? "Your verification is being reviewed. We'll notify you when it's complete."
                    : "Your seller account is verified. You can now create listings."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account type</span>
                  <Badge variant="secondary" className="capitalize">{existing.seller_type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{new Date(existing.created_at).toLocaleDateString()}</span>
                </div>
                {existing.reviewed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reviewed</span>
                    <span>{new Date(existing.reviewed_at).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            {existing.status === "approved" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => navigate("/create-listing")}>Create a listing</Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>Go to seller dashboard</Button>
              </div>
            )}
            <SubmissionHistory auditLog={auditLog} docVersions={docVersions} docFields={existing.seller_type === "business" ? BUSINESS_DOC_FIELDS : INDIVIDUAL_DOC_FIELDS} />
          </div>
        </main>
      </>
    );
  }

  const progress = (step / 4) * 100;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container px-4 max-w-3xl space-y-6">
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <h1 className="text-3xl font-bold">Seller Verification</h1>
              {submissionCount > 0 && (
                <Badge variant="outline">Attempt #{submissionCount + (existing?.status === "requires_more_info" || existing?.status === "rejected" ? 1 : 0)}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Verify your account to start listing items. Step {step} of 4.
            </p>
          </div>

          {existing?.status === "requires_more_info" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>More information requested</AlertTitle>
              <AlertDescription>
                {existing.review_notes || "Please update the requested information and resubmit."}
                {existing.requested_documents?.length > 0 && (
                  <div className="mt-2 text-sm">
                    Requested documents: {existing.requested_documents.join(", ")}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {existing?.status === "rejected" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Previous submission rejected</AlertTitle>
              <AlertDescription>{existing.review_notes || "Please review and resubmit."}</AlertDescription>
            </Alert>
          )}

          <SubmissionHistory auditLog={auditLog} docVersions={docVersions} docFields={docFields} />

          <Progress value={progress} />

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Choose your account type</CardTitle>
                <CardDescription>This determines which documents we'll need.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={sellerType} onValueChange={(v) => setSellerType(v as SellerType)} className="grid gap-3">
                  <Label className="flex items-start gap-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary">
                    <RadioGroupItem value="individual" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <User className="w-4 h-4" /> Individual Seller
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Sell personal items as a private individual.</p>
                    </div>
                  </Label>
                  <Label className="flex items-start gap-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary">
                    <RadioGroupItem value="business" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="w-4 h-4" /> Registered Business
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Sell as a CIPC-registered South African company.</p>
                    </div>
                  </Label>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Your details</CardTitle>
                <CardDescription>
                  {sellerType === "individual" ? "Personal information" : "Business information"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sellerType === "individual" ? (
                  <>
                    <div>
                      <Label>Full Name *</Label>
                      <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Physical Address *</Label>
                      <Textarea value={form.physical_address} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone (optional)</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="082 123 4567" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Company Name *</Label>
                      <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Registration Number *</Label>
                        <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
                      </div>
                      <div>
                        <Label>VAT Number (optional)</Label>
                        <Input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Representative Name *</Label>
                      <Input value={form.representative_name} onChange={(e) => setForm({ ...form, representative_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Business Address *</Label>
                      <Textarea value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone (optional)</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Upload documents</CardTitle>
                <CardDescription>JPG, PNG or PDF, up to 5MB each.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(existing?.status === "requires_more_info" || existing?.status === "rejected") && existing?.review_notes && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Admin notes</AlertTitle>
                    <AlertDescription>{existing.review_notes}</AlertDescription>
                  </Alert>
                )}
                {docFields.map((f) => {
                  const requestedAgain =
                    existing?.status === "requires_more_info" &&
                    Array.isArray(existing?.requested_documents) &&
                    existing.requested_documents.some((r: string) =>
                      r.toLowerCase().includes(f.label.toLowerCase()) || r.toLowerCase().includes(f.key.toLowerCase())
                    );
                  return (
                  <div key={f.key} className={`border rounded-lg p-4 ${requestedAgain ? "border-orange-500/50 bg-orange-500/5" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4" /> {f.label}
                          {requestedAgain && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 border border-orange-500/30">
                              Requested again
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{f.description}</p>
                        {docs[f.key] && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Uploaded
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          id={`file-${f.key}`}
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadDoc(f.key, file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingKey === f.key}
                          onClick={() => document.getElementById(`file-${f.key}`)?.click()}
                        >
                          {uploadingKey === f.key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          {docs[f.key] ? "Replace" : "Upload"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );})}
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
                <CardDescription>Please confirm the details below before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account type</span>
                  <span className="capitalize font-medium">{sellerType}</span>
                </div>
                {sellerType === "individual" ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Full name</span><span>{form.full_name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Address</span><span className="text-right">{form.physical_address}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span>{form.company_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Reg #</span><span>{form.registration_number}</span></div>
                    {form.vat_number && <div className="flex justify-between"><span className="text-muted-foreground">VAT #</span><span>{form.vat_number}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Representative</span><span>{form.representative_name}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Business address</span><span className="text-right">{form.business_address}</span></div>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Documents:</span>
                  <ul className="mt-1 space-y-1">
                    {docFields.map((f) => (
                      <li key={f.key} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={next}>Continue</Button>
            ) : (
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {existing && (existing.status === "requires_more_info" || existing.status === "rejected") ? "Resubmit for Review" : "Submit for Review"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

type DocField = { key: string; label: string; description: string };

const SubmissionHistory = ({
  auditLog,
  docVersions,
  docFields,
}: {
  auditLog: any[];
  docVersions: Record<string, Array<{ id: string; storage_path: string; version: number; created_at: string; is_current: boolean; url?: string }>>;
  docFields: ReadonlyArray<DocField>;
}) => {
  const hasVersions = Object.values(docVersions).some((v) => v && v.length > 0);
  if (auditLog.length === 0 && !hasVersions) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-4 h-4" /> Submission History
        </CardTitle>
        <CardDescription>Every submission, review decision, and document version you've uploaded.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasVersions && (
          <div>
            <h4 className="text-sm font-medium mb-2">Document versions</h4>
            <div className="space-y-3">
              {docFields.map((f) => {
                const versions = docVersions[f.key] || [];
                if (versions.length === 0) return null;
                return (
                  <div key={f.key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{f.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {versions.length} version{versions.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <ul className="space-y-1 text-xs">
                      {versions.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            v{v.version}
                            {v.is_current && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">current</Badge>
                            )}
                            <span className="text-muted-foreground">
                              {new Date(v.created_at).toLocaleString()}
                            </span>
                          </span>
                          {v.url && (
                            <a href={v.url} target="_blank" rel="noreferrer" className="text-primary underline">
                              View
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {auditLog.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Activity timeline</h4>
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
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Notes: </span>{entry.review_notes}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerVerification;
