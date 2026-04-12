---
title: "RLS & Supabase Learnings"
description: "Lärdomar från RLS-implementation och Supabase-klient-migrering"
category: rule
status: active
last_updated: 2026-04-12
tags: [rls, supabase, security]
paths:
  - "src/__tests__/rls/*"
  - "src/lib/supabase/*"
  - "supabase/*"
---

# RLS & Supabase Learnings

- **RLS-bevistest mot Supabase**: `src/__tests__/rls/rls-proof.integration.test.ts` (24 tester). Seed med service_role, query med signInWithPassword-klienter. `verifyJwtClaims()` guard i beforeAll mot falska gröna.
- **PostgREST select med relationer**: Forward: `Table!column(fields)`. Reverse: `Table(fields)` (auto-detect FK).
- **RLS-policies är OR -- explicit `.eq()` obligatoriskt**: Supabase-klient queries MÅSTE alltid ha `.eq("providerId", ...)`. Publik read-policy kombinerad med provider-specifik policy ger tillgång till ALLA rader.
- **`@updatedAt` har ingen DB-default**: Supabase-klient måste skicka `updatedAt` explicit vid INSERT/UPSERT. Gäller: User, Provider, Booking, Payment, Horse.
- **RLS ENABLE saknas != policies saknas**: Policies kan existera utan att RLS är aktiverat. Verifiera `pg_tables.rowsecurity = true`.
- **vi.mock Supabase-klient**: `vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))`. I test: `vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: vi.fn().mockReturnValue({ select: ... }) } as never)`.
