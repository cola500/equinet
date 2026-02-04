# Row Level Security (RLS) -- Findings & Implementation

## Background

Supabase automatically exposes all `public` tables via its PostgREST API. Without Row Level Security (RLS), anyone with the project's `anon` key can read and write all data directly, bypassing application-level authorization.

Our application uses Prisma with `service_role` credentials, which bypasses RLS entirely. This means RLS does not affect normal application behavior -- it only protects against direct PostgREST API access.

## Risk Assessment

**Risk level: Medium** (with mitigating factors)

### Mitigating Factors
- Prisma uses `service_role` which bypasses RLS -- app is unaffected
- Authorization is enforced in API routes (session + ownership checks)
- The `anon` key is not exposed in frontend code
- All data access goes through server-side API routes

### Why We Still Need RLS
- **Defense in depth**: If the `anon` key leaks, all data is exposed
- **Supabase best practice**: The platform is designed to work with RLS
- **Compliance**: Security audits expect database-level protections
- **Future-proofing**: If we ever use Supabase JS client from frontend

## Tables Covered (All 21)

| # | Table | Data Sensitivity | Notes |
|---|-------|-----------------|-------|
| 1 | User | **High** | Contains passwordHash, email, phone |
| 2 | Provider | Medium | Business info, location |
| 3 | Service | Low | Public service listings |
| 4 | Availability | Low | Weekly schedule |
| 5 | AvailabilityException | Low | Date-specific overrides |
| 6 | Booking | **High** | Customer-provider relationships, dates |
| 7 | Horse | Medium | Owner info, medical needs |
| 8 | HorsePassportToken | **High** | Authentication tokens |
| 9 | Upload | Medium | File paths, user associations |
| 10 | FortnoxConnection | **Critical** | Encrypted OAuth tokens |
| 11 | Payment | **High** | Financial data, invoice info |
| 12 | Notification | Medium | User messages, links |
| 13 | RouteOrder | Medium | Addresses, phone numbers |
| 14 | Route | Low | Route planning data |
| 15 | RouteStop | Medium | Addresses, coordinates |
| 16 | EmailVerificationToken | **High** | Authentication tokens |
| 17 | Review | Low | Public reviews |
| 18 | HorseNote | Medium | Veterinary/medical notes |
| 19 | ProviderVerification | Medium | Verification documents |
| 20 | GroupBookingRequest | Medium | Location, contact info |
| 21 | GroupBookingParticipant | Medium | User associations |

## Implementation

### Approach: Enable RLS with No Permissive Policies ("Deny All")

We enable RLS on every table without adding any permissive policies. This means:

- **PostgREST (anon/authenticated roles)**: All queries return empty results / are blocked
- **Prisma (service_role)**: Full access, completely unaffected
- **Supabase Dashboard**: Full access via the dashboard

This is the simplest and safest approach for our architecture where all data access goes through server-side Prisma.

### Migration

File: `prisma/migrations/20260204120000_enable_rls/migration.sql`

```sql
ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
-- Repeated for all 21 tables
```

### Rollback

If something goes wrong:
```sql
ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;
```

## Verification Checklist

- [ ] `npx prisma migrate status` shows the RLS migration
- [ ] Application works normally (all tests pass)
- [ ] Supabase Dashboard Linter shows no RLS warnings
- [ ] Direct PostgREST access returns empty/blocked:
  ```bash
  curl 'https://[PROJECT].supabase.co/rest/v1/User?select=email' \
    -H 'apikey: [ANON_KEY]' \
    -H 'Authorization: Bearer [ANON_KEY]'
  # Should return [] or error
  ```

## Future Considerations

If we later want to use the Supabase JS client from frontend (e.g., for real-time subscriptions), we'll need to add granular RLS policies per table. Example:

```sql
-- Users can read their own bookings
CREATE POLICY "Users read own bookings" ON "Booking"
  FOR SELECT USING (auth.uid()::text = "customerId");

-- Providers can manage their services
CREATE POLICY "Providers manage own services" ON "Service"
  FOR ALL USING ("providerId" IN (
    SELECT id FROM "Provider" WHERE "userId" = auth.uid()::text
  ));
```

This is not needed now since all access goes through Prisma.

## References

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Prisma + Supabase](https://supabase.com/docs/guides/integrations/prisma)
- Internal: `docs/archive/PLAN-RLS.md` (original analysis)
