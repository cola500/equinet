# RLS Spike: Prisma + set_config

Research spike for S10-1. Tests Row Level Security with Prisma against Supabase.

## Usage

```bash
# Requires .env.supabase with Supabase credentials
npx tsx scripts/rls-spike/test-rls.ts
```

The script automatically:
1. Creates `rls_test` schema in Supabase
2. Runs `prisma migrate deploy` against it
3. Seeds test data (2 providers, 6 bookings)
4. Enables RLS + FORCE + policy on Booking
5. Runs all 8 tests
6. Cleans up (drops `rls_test` schema)

## Tests

| # | Test | Verifies |
|---|------|----------|
| 1 | set_config i $transaction | Provider A sees only their bookings |
| 2 | Utan set_config | 0 rows returned (RLS blocks) |
| 3 | Via PgBouncer | set_config works through connection pooler |
| 4 | $queryRawUnsafe | RLS applies to raw SQL queries |
| 5 | Prestanda | Overhead of set_config per query |
| 6 | Session-lackage | set_config doesn't leak between transactions |
| 7 | Concurrent access | Parallel transactions don't cross-contaminate |
| 8 | Ingen-policy-fallback | Table with RLS but no policy = 0 rows |

## Results

After running, results are saved to `scripts/rls-spike/results.json`.
Final documentation goes to `docs/research/rls-prisma-spike.md`.
