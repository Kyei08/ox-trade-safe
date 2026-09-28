import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Scale,
  RefreshCw,
  SearchX,
  Search,
  ExternalLink,
  Sparkles,
  Stethoscope,
  ListOrdered,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ResolutionMessageDialog from "@/components/admin/ResolutionMessageDialog";
import { DiscrepancyDiagnosisDialog } from "@/components/admin/DiscrepancyDiagnosisDialog";
import {
  DiscrepancyTriageDialog,
  type TriageCaseInput,
} from "@/components/admin/DiscrepancyTriageDialog";

interface PayfastTx {
  id: string;
  m_payment_id: string | null;
  pf_payment_id: string | null;
  payment_status: string;
  amount_gross: number;
  received_at: string;
}

interface ReconOrder {
  id: string;
  listing_id: string;
  amount: number;
  status: string;
  payment_provider: string;
  payfast_payment_id: string | null;
  m_payment_id: string | null;
  invoice_number: string | null;
  created_at: string;
  listing: { title: string } | null;
  buyer: { full_name: string | null; email: string } | null;
}

type IssueKind = "missing" | "duplicate" | "mismatch" | "stale" | "unmatched";

interface IssueRow {
  kind: IssueKind;
  order?: ReconOrder;
  tx?: PayfastTx;
  detail: string;
}

const ISSUE_LABELS: Record<IssueKind, string> = {
  missing: "Missing confirmation",
  duplicate: "Duplicate payment",
  mismatch: "Amount mismatch",
  stale: "Payment confirmed, order not updated",
  unmatched: "Unknown transaction",
};

const ISSUE_VARIANTS: Record<IssueKind, "destructive" | "outline" | "secondary" | "default"> = {
  missing: "destructive",
  duplicate: "destructive",
  mismatch: "destructive",
  stale: "outline",
  unmatched: "secondary",
};

const zar = (n: number) => `R${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;

const ISSUE_ORDER: IssueKind[] = ["missing", "duplicate", "mismatch", "stale", "unmatched"];

const AdminReconciliation = () => {
  const [orders, setOrders] = useState<ReconOrder[]>([]);
  const [transactions, setTransactions] = useState<PayfastTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [draftIssue, setDraftIssue] = useState<IssueRow | null>(null);
  const [diagnoseIssue, setDiagnoseIssue] = useState<IssueRow | null>(null);
  const [triageOpen, setTriageOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    // Types for the ledger table regenerate after its migration applies; cast until then.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = supabase as any;
    const [ordersRes, txRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          `id, listing_id, amount, status, payment_provider, payfast_payment_id, m_payment_id, invoice_number, created_at,
           listing:listings(title)`
        )
        .order("created_at", { ascending: false }),
      db
        .from("payfast_transactions")
        .select("id, m_payment_id, pf_payment_id, payment_status, amount_gross, received_at")
        .order("received_at", { ascending: false }),
    ]);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (ordersRes.error || txRes.error) {
      setLoadError(ordersRes.error?.message ?? txRes.error?.message ?? "Could not load data");
      setLoading(false);
      return;
    }

    const rows = (ordersRes.data ?? []) as unknown as (Omit<ReconOrder, "buyer"> & {
      buyer_id: string;
    })[];
    const userIds = [...new Set(rows.map((r) => r.buyer_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    setOrders(
      rows.map(({ buyer_id, ...rest }) => ({ ...rest, buyer: profileMap.get(buyer_id) ?? null }))
    );
    setTransactions((txRes.data ?? []) as PayfastTx[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { issues, reconciled } = useMemo(() => {
    const txByRef = new Map<string, PayfastTx[]>();
    for (const t of transactions) {
      if (!t.m_payment_id) continue;
      const arr = txByRef.get(t.m_payment_id) ?? [];
      arr.push(t);
      txByRef.set(t.m_payment_id, arr);
    }
    const orderRefs = new Set(
      orders.map((o) => o.m_payment_id).filter((v): v is string => !!v)
    );

    const found: IssueRow[] = [];
    let ok = 0;
    const paidStates = ["paid", "shipped", "delivered"];

    for (const o of orders) {
      if (o.payment_provider !== "payfast" || !o.m_payment_id) continue;
      const txs = txByRef.get(o.m_payment_id) ?? [];
      const complete = txs.filter((t) => t.payment_status === "COMPLETE");

      if (complete.length > 1) {
        found.push({
          kind: "duplicate",
          order: o,
          detail: `${complete.length} successful PayFast transactions for this order.`,
        });
      }

      const amountBad = complete.find(
        (t) => Math.abs(Number(o.amount) - Number(t.amount_gross)) > 0.01
      );
      if (amountBad) {
        found.push({
          kind: "mismatch",
          order: o,
          tx: amountBad,
          detail: `Order total ${zar(Number(o.amount))} but PayFast confirmed ${zar(
            Number(amountBad.amount_gross)
          )}.`,
        });
      }

      if (paidStates.includes(o.status) && complete.length === 0) {
        found.push({
          kind: "missing",
          order: o,
          detail: "Order is marked paid, but PayFast never confirmed this payment.",
        });
      } else if (o.status === "pending" && complete.length > 0) {
        found.push({
          kind: "stale",
          order: o,
          detail: "PayFast confirmed the payment, but the order is still pending.",
        });
      }

      if (paidStates.includes(o.status) && complete.length === 1 && !amountBad) ok++;
    }

    for (const t of transactions) {
      if (
        t.payment_status === "COMPLETE" &&
        t.m_payment_id &&
        !orderRefs.has(t.m_payment_id)
      ) {
        found.push({
          kind: "unmatched",
          tx: t,
          detail: "A successful PayFast payment with no matching order on the marketplace.",
        });
      }
    }

    found.sort(
      (a, b) => ISSUE_ORDER.indexOf(a.kind) - ISSUE_ORDER.indexOf(b.kind)
    );
    return { issues: found, reconciled: ok };
  }, [orders, transactions]);

  const counts = useMemo(() => {
    const c: Record<IssueKind, number> = {
      missing: 0,
      duplicate: 0,
      mismatch: 0,
      stale: 0,
      unmatched: 0,
    };
    for (const i of issues) c[i.kind] += 1;
    return c;
  }, [issues]);

  const visibleIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        i.order?.invoice_number?.toLowerCase().includes(q) ||
        i.order?.m_payment_id?.toLowerCase().includes(q) ||
        i.order?.payfast_payment_id?.toLowerCase().includes(q) ||
        i.tx?.m_payment_id?.toLowerCase().includes(q) ||
        i.tx?.pf_payment_id?.toLowerCase().includes(q) ||
        i.order?.listing?.title?.toLowerCase().includes(q) ||
        i.order?.buyer?.full_name?.toLowerCase().includes(q) ||
        i.order?.buyer?.email.toLowerCase().includes(q)
      );
    });
  }, [issues, search, kindFilter]);

  const triageCases: TriageCaseInput[] = useMemo(
    () =>
      issues.map((issue, idx) => ({
        ref:
          issue.order?.invoice_number ??
          issue.order?.m_payment_id?.slice(0, 8) ??
          issue.tx?.pf_payment_id ??
          issue.tx?.m_payment_id ??
          `case-${idx + 1}`,
        issueType: ISSUE_LABELS[issue.kind],
        discrepancy: issue.detail,
        details: JSON.stringify({
          order: issue.order
            ? {
                listing: issue.order.listing?.title,
                amount_zar: issue.order.amount,
                status: issue.order.status,
                buyer: issue.order.buyer?.full_name || issue.order.buyer?.email,
                payment_reference: issue.order.m_payment_id,
                payfast_payment_id: issue.order.payfast_payment_id,
                created_at: issue.order.created_at,
              }
            : null,
          payfast_transaction: issue.tx
            ? {
                payment_reference: issue.tx.m_payment_id,
                payfast_payment_id: issue.tx.pf_payment_id,
                status: issue.tx.payment_status,
                amount_gross_zar: issue.tx.amount_gross,
                received_at: issue.tx.received_at,
              }
            : null,
        }),
      })),
    [issues]
  );

  const summaryCards: { key: string; label: string; value: number; icon: typeof Scale; tone: string }[] = [
    { key: "all", label: "Reconciled payments", value: reconciled, icon: CheckCircle2, tone: "text-green-600" },
    { key: "missing", label: "Missing confirmation", value: counts.missing, icon: AlertTriangle, tone: "text-destructive" },
    { key: "duplicate", label: "Duplicate payments", value: counts.duplicate, icon: Copy, tone: "text-destructive" },
    { key: "mismatch", label: "Amount mismatches", value: counts.mismatch, icon: Scale, tone: "text-destructive" },
    { key: "stale", label: "Order not updated", value: counts.stale, icon: RefreshCw, tone: "text-amber-600" },
    { key: "unmatched", label: "Unknown transactions", value: counts.unmatched, icon: SearchX, tone: "text-amber-600" },
  ];

  return (
    <AdminLayout
      title="Payment Reconciliation"
      description="Compare PayFast confirmations against paid orders and flag missing, duplicated, or mismatched payments."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground">
          {issues.length === 0
            ? "All PayFast payments reconcile with orders."
            : `${issues.length} issue${issues.length === 1 ? "" : "s"} found across ${orders.length} orders.`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTriageOpen(true)}
            disabled={loading || issues.length === 0}
          >
            <ListOrdered className="h-4 w-4 mr-2" />
            Triage by urgency
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Re-run reconciliation
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        {summaryCards.map(({ key, label, value, icon: Icon, tone }) => (
          <Card
            key={key}
            className={kindFilter !== "all" || key === "all" ? "" : "opacity-60"}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${tone}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
              {key !== "all" && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground mt-1"
                  onClick={() => setKindFilter(kindFilter === key ? "all" : key)}
                >
                  {kindFilter === key ? "Showing these — clear" : "Show only these"}
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search invoice, payment reference, listing, or buyer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Reconciling payments…
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive text-sm">{loadError}</CardContent>
        </Card>
      ) : visibleIssues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-3" />
            <p className="font-medium">Everything reconciles</p>
            <p className="text-sm text-muted-foreground">
              No missing, duplicated, or mismatched payments found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleIssues.map((issue, idx) => {
            const label = ISSUE_LABELS[issue.kind];
            const title =
              issue.order?.listing?.title ??
              issue.tx?.pf_payment_id ??
              "PayFast transaction";
            return (
              <Card key={`${issue.kind}-${issue.order?.id ?? issue.tx?.id ?? idx}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ISSUE_VARIANTS[issue.kind]}>{label}</Badge>
                        {issue.order ? (
                          <Link
                            to={`/listing/${issue.order.listing_id}`}
                            className="font-medium hover:underline truncate"
                          >
                            {title}
                          </Link>
                        ) : (
                          <span className="font-medium truncate">{title}</span>
                        )}
                        {issue.order?.status && (
                          <Badge variant="outline" className="uppercase text-[10px]">
                            order: {issue.order.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1">{issue.detail}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {issue.order
                          ? `${issue.order.invoice_number ?? issue.order.m_payment_id?.slice(0, 8) ?? ""} · ${
                              issue.order.buyer?.full_name || issue.order.buyer?.email || "—"
                            } · ${formatDistanceToNow(new Date(issue.order.created_at), { addSuffix: true })}`
                          : `${issue.tx?.m_payment_id ?? "no reference"} · ${formatDistanceToNow(
                              new Date(issue.tx?.received_at ?? new Date()),
                              { addSuffix: true }
                            )}`}
                        {issue.tx?.pf_payment_id && ` · PayFast #${issue.tx.pf_payment_id}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-lg font-bold">
                        {zar(Number(issue.order?.amount ?? issue.tx?.amount_gross ?? 0))}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setDiagnoseIssue(issue)}>
                        <Stethoscope className="h-4 w-4 mr-1" /> Diagnose
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDraftIssue(issue)}>
                        <Sparkles className="h-4 w-4 mr-1" /> Draft message
                      </Button>
                      {issue.order && (
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to={`/listing/${issue.order.listing_id}`}
                            aria-label="View listing"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <DiscrepancyDiagnosisDialog
        open={!!diagnoseIssue}
        onOpenChange={(o) => !o && setDiagnoseIssue(null)}
        defaultDiscrepancy={
          diagnoseIssue ? `${ISSUE_LABELS[diagnoseIssue.kind]}: ${diagnoseIssue.detail}` : ""
        }
        defaultDetails={
          diagnoseIssue
            ? JSON.stringify(
                {
                  order: diagnoseIssue.order
                    ? {
                        invoice_number: diagnoseIssue.order.invoice_number,
                        listing: diagnoseIssue.order.listing?.title,
                        amount_zar: diagnoseIssue.order.amount,
                        status: diagnoseIssue.order.status,
                        payment_reference: diagnoseIssue.order.m_payment_id,
                        payfast_payment_id: diagnoseIssue.order.payfast_payment_id,
                        created_at: diagnoseIssue.order.created_at,
                      }
                    : null,
                  payfast_transaction: diagnoseIssue.tx
                    ? {
                        payment_reference: diagnoseIssue.tx.m_payment_id,
                        payfast_payment_id: diagnoseIssue.tx.pf_payment_id,
                        status: diagnoseIssue.tx.payment_status,
                        amount_gross_zar: diagnoseIssue.tx.amount_gross,
                        received_at: diagnoseIssue.tx.received_at,
                      }
                    : null,
                },
                null,
                2
              )
            : ""
        }
      />
      <DiscrepancyTriageDialog
        open={triageOpen}
        onOpenChange={setTriageOpen}
        cases={triageCases}
      />
      <ResolutionMessageDialog
        open={!!draftIssue}
        onOpenChange={(o) => !o && setDraftIssue(null)}
        defaultDiscrepancy={draftIssue ? `${ISSUE_LABELS[draftIssue.kind]}: ${draftIssue.detail}` : ""}
        details={
          draftIssue
            ? {
                order: draftIssue.order
                  ? {
                      invoice_number: draftIssue.order.invoice_number,
                      listing: draftIssue.order.listing?.title,
                      amount_zar: draftIssue.order.amount,
                      status: draftIssue.order.status,
                      payment_reference: draftIssue.order.m_payment_id,
                      payfast_payment_id: draftIssue.order.payfast_payment_id,
                      created_at: draftIssue.order.created_at,
                    }
                  : null,
                payfast_transaction: draftIssue.tx
                  ? {
                      payment_reference: draftIssue.tx.m_payment_id,
                      payfast_payment_id: draftIssue.tx.pf_payment_id,
                      status: draftIssue.tx.payment_status,
                      amount_gross_zar: draftIssue.tx.amount_gross,
                      received_at: draftIssue.tx.received_at,
                    }
                  : null,
              }
            : {}
        }
      />
    </AdminLayout>
  );
};

export default AdminReconciliation;
