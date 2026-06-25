/**
 * Listings Performance Benchmark
 * --------------------------------
 * Measures query latency for category + conditions filtering against
 * the live Lovable Cloud backend (via the public anon key) and writes
 * results to scripts/perf/results/.
 *
 * Usage:
 *   bun run scripts/perf/listingsBench.ts            # run + save as latest
 *   bun run scripts/perf/listingsBench.ts --baseline # save as baseline.json
 *   bun run scripts/perf/listingsBench.ts --compare  # run + diff vs baseline
 *
 * CI tip: run with --compare and a threshold via PERF_REGRESSION_PCT
 * (default 25). Non-zero exit on regression.
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://wjdjoeljyyjibhuotftc.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZGpvZWxqeXlqaWJodW90ZnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTQwMTcsImV4cCI6MjA3NzE5MDAxN30.kGviSbJQqs3hksFuXkVjcxYt_RAcbtv3GQeqc-udri0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");
mkdirSync(RESULTS_DIR, { recursive: true });

const PAGE_SIZE = 24;
const WARMUP_RUNS = 2;
const MEASURED_RUNS = 8;
const REGRESSION_PCT = Number(process.env.PERF_REGRESSION_PCT ?? 25);

type Scenario = {
  name: string;
  run: () => Promise<{ rows: number }>;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; out: T }> {
  const t0 = performance.now();
  const out = await fn();
  return { ms: performance.now() - t0, out };
}

function pct(arr: number[], p: number) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function pickCategoryId(): Promise<string | null> {
  const { data } = await supabase.from("categories").select("id").limit(1);
  return data?.[0]?.id ?? null;
}

async function pickOptionIds(limit = 2): Promise<string[]> {
  const { data } = await supabase
    .from("category_condition_options")
    .select("id")
    .limit(limit);
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function buildScenarios(): Promise<Scenario[]> {
  const categoryId = await pickCategoryId();
  const optionIds = await pickOptionIds(2);

  return [
    {
      name: "baseline_active_listings",
      run: async () => {
        const { data, error } = await supabase
          .from("listings")
          .select("id, title, fixed_price, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw error;
        return { rows: data?.length ?? 0 };
      },
    },
    {
      name: "category_only",
      run: async () => {
        if (!categoryId) return { rows: 0 };
        const { data, error } = await supabase
          .from("listings")
          .select("id, title, fixed_price, created_at")
          .eq("status", "active")
          .eq("category_id", categoryId)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw error;
        return { rows: data?.length ?? 0 };
      },
    },
    {
      name: "conditions_only_single_option",
      run: async () => {
        if (optionIds.length === 0) return { rows: 0 };
        const { data, error } = await supabase
          .from("listing_conditions")
          .select("listing_id")
          .eq("option_id", optionIds[0])
          .limit(5000);
        if (error) throw error;
        const ids = Array.from(
          new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id))
        ).slice(0, 200);
        if (ids.length === 0) return { rows: 0 };
        const { data: listings, error: e2 } = await supabase
          .from("listings")
          .select("id, title, created_at")
          .eq("status", "active")
          .in("id", ids)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (e2) throw e2;
        return { rows: listings?.length ?? 0 };
      },
    },
    {
      name: "category_plus_conditions",
      run: async () => {
        if (!categoryId || optionIds.length === 0) return { rows: 0 };
        const { data, error } = await supabase
          .from("listing_conditions")
          .select("listing_id")
          .in("option_id", optionIds)
          .limit(5000);
        if (error) throw error;
        const ids = Array.from(
          new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id))
        ).slice(0, 200);
        if (ids.length === 0) return { rows: 0 };
        const { data: listings, error: e2 } = await supabase
          .from("listings")
          .select("id, title, created_at")
          .eq("status", "active")
          .eq("category_id", categoryId)
          .in("id", ids)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (e2) throw e2;
        return { rows: listings?.length ?? 0 };
      },
    },
    {
      name: "cursor_page_2_by_created_at",
      run: async () => {
        const { data: first, error } = await supabase
          .from("listings")
          .select("id, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw error;
        const cursor = first?.[first.length - 1];
        if (!cursor) return { rows: 0 };
        const { data, error: e2 } = await supabase
          .from("listings")
          .select("id, title, created_at")
          .eq("status", "active")
          .or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);
        if (e2) throw e2;
        return { rows: data?.length ?? 0 };
      },
    },
  ];
}

type ScenarioResult = {
  name: string;
  rows: number;
  runs: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
};

async function runScenario(s: Scenario): Promise<ScenarioResult> {
  for (let i = 0; i < WARMUP_RUNS; i++) await s.run();
  const samples: number[] = [];
  let rows = 0;
  for (let i = 0; i < MEASURED_RUNS; i++) {
    const { ms, out } = await timed(s.run);
    samples.push(ms);
    rows = out.rows;
  }
  return {
    name: s.name,
    rows,
    runs: MEASURED_RUNS,
    min: Math.min(...samples),
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    p50: pct(samples, 50),
    p95: pct(samples, 95),
    max: Math.max(...samples),
  };
}

function fmt(n: number) {
  return n.toFixed(1).padStart(7) + "ms";
}

function printTable(rows: ScenarioResult[]) {
  console.log(
    "\nScenario".padEnd(40) +
      "rows".padStart(6) +
      "min".padStart(10) +
      "p50".padStart(10) +
      "mean".padStart(10) +
      "p95".padStart(10) +
      "max".padStart(10)
  );
  console.log("-".repeat(96));
  for (const r of rows) {
    console.log(
      r.name.padEnd(40) +
        String(r.rows).padStart(6) +
        fmt(r.min).padStart(10) +
        fmt(r.p50).padStart(10) +
        fmt(r.mean).padStart(10) +
        fmt(r.p95).padStart(10) +
        fmt(r.max).padStart(10)
    );
  }
}

function diffTable(curr: ScenarioResult[], base: ScenarioResult[]) {
  console.log("\nDiff vs baseline (p95):");
  console.log("-".repeat(72));
  let regressed = 0;
  for (const c of curr) {
    const b = base.find((x) => x.name === c.name);
    if (!b) {
      console.log(`${c.name.padEnd(40)} NEW    p95=${fmt(c.p95)}`);
      continue;
    }
    const delta = c.p95 - b.p95;
    const deltaPct = (delta / b.p95) * 100;
    const marker =
      deltaPct > REGRESSION_PCT ? "❌ REGRESS" : deltaPct < -10 ? "✅ FASTER " : "≈ ok     ";
    if (deltaPct > REGRESSION_PCT) regressed++;
    console.log(
      `${c.name.padEnd(40)} ${marker}  base=${fmt(b.p95)}  now=${fmt(c.p95)}  Δ=${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`
    );
  }
  return regressed;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const isBaseline = args.has("--baseline");
  const isCompare = args.has("--compare");

  console.log(
    `▶ Listings perf bench — warmup=${WARMUP_RUNS} measured=${MEASURED_RUNS} pageSize=${PAGE_SIZE}`
  );

  const scenarios = await buildScenarios();
  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    process.stdout.write(`  • ${s.name} ... `);
    const r = await runScenario(s);
    results.push(r);
    console.log(`p95=${r.p95.toFixed(1)}ms (rows=${r.rows})`);
  }

  printTable(results);

  const payload = {
    timestamp: new Date().toISOString(),
    config: { warmup: WARMUP_RUNS, measured: MEASURED_RUNS, pageSize: PAGE_SIZE },
    results,
  };

  const baselinePath = join(RESULTS_DIR, "baseline.json");
  const latestPath = join(RESULTS_DIR, "latest.json");
  const historyPath = join(
    RESULTS_DIR,
    `run-${payload.timestamp.replace(/[:.]/g, "-")}.json`
  );

  writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  writeFileSync(historyPath, JSON.stringify(payload, null, 2));

  if (isBaseline) {
    writeFileSync(baselinePath, JSON.stringify(payload, null, 2));
    console.log(`\n💾 Saved baseline → ${baselinePath}`);
    return;
  }

  if (isCompare) {
    if (!existsSync(baselinePath)) {
      console.error(
        "\n⚠  No baseline.json found. Run once with --baseline first."
      );
      process.exit(2);
    }
    const base = JSON.parse(readFileSync(baselinePath, "utf-8"));
    const regressed = diffTable(results, base.results);
    if (regressed > 0) {
      console.error(
        `\n❌ ${regressed} scenario(s) regressed by more than ${REGRESSION_PCT}% on p95.`
      );
      process.exit(1);
    }
    console.log("\n✅ No regressions beyond threshold.");
  } else {
    console.log(`\n💾 Saved latest → ${latestPath}`);
    console.log("   Tip: add --baseline to lock current numbers, --compare to diff.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
