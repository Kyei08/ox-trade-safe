import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

type ItnEvent = {
  id: string;
  received_at: string;
  m_payment_id: string | null;
  pf_payment_id: string | null;
  payment_status: string | null;
  amount_gross: number | null;
  raw_body: string;
  result: "processed" | "ignored" | "failed";
  failure_reason: string | null;
  http_status: number | null;
  retry_count: number;
  last_retry_at: string | null;
};

const RESULT_VARIANT: Record<ItnEvent["result"], "default" | "secondary" | "destructive"> = {
  processed: "default",
  ignored: "secondary",
  failed: "destructive",
};

// Hide the signature when showing payload fields.
const payloadFields = (raw: string) => [...new URLSearchParams(raw).entries()].filter(([k]) => k !== "signature");

export default function AdminItnLog() {
  const { toast } = useToast();
  const [events, setEvents] = useState<ItnEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("payfast_itn_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(500);
    if (error) setLoadError(error.message);
    setEvents((data as ItnEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const retry = async (ev: ItnEvent) => {
    setRetrying(ev.id);
    const { data, error } = await supabase.functions.invoke("retry-payfast-itn", { body: { eventId: ev.id } });
    setRetrying(null);
    if (error || data?.error) {
      toast({ title: "Retry failed", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({
      title: data.result === "failed" ? "Still failing" : "Notification reprocessed",
      description: data.reason ?? "Order updated successfully.",
      variant: data.result === "failed" ? "destructive" : "default",
    });
    load();
  };

  const counts = useMemo(
    () => ({
      total: events.length,
      processed: events.filter((e) => e.result === "processed").length,
      ignored: events.filter((e) => e.result === "ignored").length,
      failed: events.filter((e) => e.result === "failed").length,
    }),
    [events]
  );

  const shown = events.filter((e) => {
    if (filter !== "all" && e.result !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [e.m_payment_id, e.pf_payment_id, e.failure_reason, e.payment_status].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">PayFast callback log</h1>
            <p className="text-sm text-muted-foreground">Every payment notification from PayFast, what happened, and why any failed.</p>
          </div>
          <Button variant="outline" onClick={load} loading={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ["all", "All events", counts.total],
            ["processed", "Processed", counts.processed],
            ["ignored", "No change", counts.ignored],
            ["failed", "Failed", counts.failed],
          ] as const).map(([key, label, n]) => (
            <Card key={key} className={`cursor-pointer ${filter === key ? "ring-2 ring-primary" : ""}`} onClick={() => setFilter(key)}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${key === "failed" && n > 0 ? "text-destructive" : ""}`}>{n}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <CardTitle className="text-base">Notifications ({shown.length})</CardTitle>
            <div className="flex gap-2 w-full md:w-auto">
              <Input placeholder="Search reference or reason…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:w-64" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="ignored">No change</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadError && <p className="text-sm text-destructive">Couldn't load the log: {loadError}</p>}
            {!loading && !loadError && shown.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No notifications match.</p>
            )}
            {shown.map((ev) => (
              <div key={ev.id} className="border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Badge variant={RESULT_VARIANT[ev.result]}>{ev.result === "ignored" ? "no change" : ev.result}</Badge>
                    <span className="text-sm font-medium">{ev.payment_status ?? "—"}</span>
                    <span className="text-sm">{ev.amount_gross != null ? `R${Number(ev.amount_gross).toFixed(2)}` : ""}</span>
                    <span className="text-xs text-muted-foreground truncate">{ev.m_payment_id ?? "no reference"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(ev.received_at).toLocaleString("en-ZA")}</span>
                    {ev.result === "failed" && (
                      <Button size="sm" onClick={() => retry(ev)} loading={retrying === ev.id} disabled={!!retrying}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Retry
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === ev.id ? null : ev.id)} aria-label="Toggle details">
                      {expanded === ev.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {ev.failure_reason && (
                  <p className={`text-sm mt-2 ${ev.result === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{ev.failure_reason}</p>
                )}
                {ev.retry_count > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Retried {ev.retry_count}× · last {ev.last_retry_at ? new Date(ev.last_retry_at).toLocaleString("en-ZA") : ""}
                  </p>
                )}
                {expanded === ev.id && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs bg-muted rounded p-3">
                    <div><span className="text-muted-foreground">HTTP response:</span> {ev.http_status ?? "—"}</div>
                    <div><span className="text-muted-foreground">PayFast ID:</span> {ev.pf_payment_id ?? "—"}</div>
                    {payloadFields(ev.raw_body).map(([k, v]) => (
                      <div key={k} className="break-all"><span className="text-muted-foreground">{k}:</span> {v}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
