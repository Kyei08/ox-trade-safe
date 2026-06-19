import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  getStoredEvents,
  clearStoredEvents,
  type AnalyticsEvent,
} from "@/lib/analytics";

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  "ending-soon": "Ending Soon",
  "price-low": "Price ↑",
  "price-high": "Price ↓",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
];

const AdminSortAnalytics = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  const refresh = () => setEvents(getStoredEvents());

  useEffect(() => {
    refresh();
  }, []);

  const sortEvents = useMemo(
    () => events.filter((e) => e.event === "listings_sort_changed"),
    [events]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    sortEvents.forEach((e) => {
      const key = String(e.properties.sort_by ?? "unknown");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([sort_by, count]) => ({
        sort_by,
        label: SORT_LABELS[sort_by] ?? sort_by,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [sortEvents]);

  const trend = useMemo(() => {
    // Group by day for last 14 days
    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const keys = Array.from(
      new Set(sortEvents.map((e) => String(e.properties.sort_by ?? "unknown")))
    );
    return days.map((day) => {
      const row: Record<string, string | number> = { day: day.slice(5) };
      keys.forEach((k) => (row[k] = 0));
      sortEvents.forEach((e) => {
        if (e.timestamp.slice(0, 10) === day) {
          const k = String(e.properties.sort_by ?? "unknown");
          row[k] = ((row[k] as number) ?? 0) + 1;
        }
      });
      return row;
    });
  }, [sortEvents]);

  const trendKeys = useMemo(
    () =>
      Array.from(
        new Set(sortEvents.map((e) => String(e.properties.sort_by ?? "unknown")))
      ),
    [sortEvents]
  );

  const chartConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    trendKeys.forEach((k, i) => {
      cfg[k] = { label: SORT_LABELS[k] ?? k, color: COLORS[i % COLORS.length] };
    });
    if (!cfg.count) {
      cfg.count = { label: "Selections", color: COLORS[0] };
    }
    return cfg;
  }, [trendKeys]);

  const total = sortEvents.length;

  return (
    <AdminLayout
      title="Sort Analytics"
      description="Track which sorting options users select on the listings page."
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm text-muted-foreground">
          {total} sort selection{total === 1 ? "" : "s"} recorded
          (local-only data).
        </p>
        <div className="flex gap-2">
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {counts.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-10 text-center text-muted-foreground">
              No sort events yet. Try changing sort options on the Listings page.
            </CardContent>
          </Card>
        )}
        {counts.map((c) => (
          <Card key={c.sort_by}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.count}</div>
              <div className="text-xs text-muted-foreground">
                {total > 0 ? Math.round((c.count / total) * 100) : 0}% of total
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {counts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Selections by sort option</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={counts}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill={COLORS[0]} radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trend (last 14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <LineChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {trendKeys.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminSortAnalytics;
