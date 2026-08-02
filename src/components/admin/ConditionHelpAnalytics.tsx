import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, HelpCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getStoredEvents,
  clearStoredEvents,
  type AnalyticsEvent,
} from "@/lib/analytics";

interface Row {
  key: string;
  optionId: string;
  optionName: string;
  variant: string;
  inExperiment: boolean;
  opens: number;
  totalReadMs: number;
  proceeded: number;
  sessions: number;
}

function fmtMs(ms: number) {
  if (!ms) return "—";
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** Summarizes condition help engagement (opens, read time, proceed rate) per option and A/B variant. */
export default function ConditionHelpAnalytics() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const refresh = () => setEvents(getStoredEvents());

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row & { sessionIds: Set<string> }>();
    const get = (e: AnalyticsEvent) => {
      const id = String(e.properties.option_id ?? "unknown");
      const variant = String(e.properties.variant ?? "A");
      const key = `${id}::${variant}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          optionId: id,
          optionName: String(e.properties.option_name ?? id),
          variant,
          inExperiment: !!e.properties.in_experiment,
          opens: 0,
          totalReadMs: 0,
          proceeded: 0,
          sessions: 0,
          sessionIds: new Set<string>(),
        };
        map.set(key, row);
      }
      if (e.properties.option_name) row.optionName = String(e.properties.option_name);
      if (e.properties.in_experiment) row.inExperiment = true;
      const sid = e.properties.help_session_id;
      if (sid) row.sessionIds.add(String(sid));
      return row;
    };

    events.forEach((e) => {
      if (e.event === "condition_help_opened") get(e).opens += 1;
      else if (e.event === "condition_help_closed")
        get(e).totalReadMs += Number(e.properties.read_ms ?? 0);
      else if (e.event === "condition_help_proceeded") get(e).proceeded += 1;
    });

    return Array.from(map.values())
      .map(({ sessionIds, ...r }) => ({ ...r, sessions: sessionIds.size }))
      .sort((a, b) =>
        a.optionName === b.optionName
          ? a.variant.localeCompare(b.variant)
          : b.opens - a.opens
      );
  }, [events]);


  const totals = rows.reduce(
    (acc, r) => ({
      opens: acc.opens + r.opens,
      read: acc.read + r.totalReadMs,
      proceeded: acc.proceeded + r.proceeded,
    }),
    { opens: 0, read: 0, proceeded: 0 }
  );

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> Condition Help Analytics
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totals.opens} help open{totals.opens === 1 ? "" : "s"} ·{" "}
            {fmtMs(totals.read)} total read time ·{" "}
            {totals.opens > 0
              ? Math.round((totals.proceeded / totals.opens) * 100)
              : 0}
            % proceeded
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearStoredEvents();
              refresh();
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No condition help interactions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Avg read</TableHead>
                  <TableHead className="text-right">Total read</TableHead>
                  <TableHead className="text-right">Proceeded</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const rate = r.opens > 0 ? r.proceeded / r.opens : 0;
                  const rival = rows.find(
                    (o) => o.optionId === r.optionId && o.variant !== r.variant
                  );
                  const rivalRate = rival && rival.opens > 0 ? rival.proceeded / rival.opens : -1;
                  const leading = !!rival && r.opens > 0 && rate > rivalRate;
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.optionName}</TableCell>
                      <TableCell>
                        {r.inExperiment || rival ? (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted">
                            {r.variant}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.opens}</TableCell>
                      <TableCell className="text-right">
                        {fmtMs(r.opens ? r.totalReadMs / r.opens : 0)}
                      </TableCell>
                      <TableCell className="text-right">{fmtMs(r.totalReadMs)}</TableCell>
                      <TableCell className="text-right">{r.proceeded}</TableCell>
                      <TableCell
                        className={`text-right ${leading ? "font-semibold text-primary" : ""}`}
                      >
                        {r.opens > 0 ? `${Math.round(rate * 100)}%` : "—"}
                        {leading ? " ★" : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
