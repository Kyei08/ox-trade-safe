# Listings Performance Benchmark

Automated latency benchmark for category + conditions filtering on the
`listings` query path. Use it to lock in current performance and detect
regressions after future changes (schema, indexes, query refactors).

## What it measures

Five real-world scenarios that mirror `src/pages/Listings.tsx`:

| Scenario | What it exercises |
|---|---|
| `baseline_active_listings` | Status + sort, no filters (control) |
| `category_only` | `status + category_id + order by created_at` index path |
| `conditions_only_single_option` | `listing_conditions(option_id, listing_id)` covering index + `IN` join |
| `category_plus_conditions` | Combined two-step query used by the UI |
| `cursor_page_2_by_created_at` | Keyset pagination (`OR` keyset predicate) |

Each scenario runs **2 warmup + 8 measured** iterations and reports
`min / p50 / mean / p95 / max`.

## Commands

```bash
# Run + save a fresh "latest.json" (and a timestamped history file)
bun run scripts/perf/listingsBench.ts

# Lock in the current numbers as the baseline
bun run scripts/perf/listingsBench.ts --baseline

# Run and diff against baseline.json (non-zero exit on regression)
bun run scripts/perf/listingsBench.ts --compare
```

Optional env var: `PERF_REGRESSION_PCT` (default `25`) — p95 percent
increase that counts as a regression in `--compare` mode.

## Output

Results land in `scripts/perf/results/`:

- `baseline.json` — the locked reference (commit this when intentional)
- `latest.json` — most recent run
- `run-<timestamp>.json` — full history (gitignore if noisy)

## Suggested workflow

1. Before a change you suspect might affect query latency, run
   `--baseline` to snapshot today's performance.
2. Make the change (new index, query rewrite, schema migration, …).
3. Run `--compare`. The script exits non-zero if any scenario's p95
   degrades by more than the threshold.

## Notes

- Uses the public anon key, so it measures what real users experience
  (network + PostgREST + RLS + Postgres), not just raw SQL.
- Numbers depend on network conditions — run baseline and compare from
  the same environment for fair diffs.
- Add new scenarios by appending to `buildScenarios()` in
  `listingsBench.ts`.
