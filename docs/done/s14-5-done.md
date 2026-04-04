---
title: "S14-5 Done: RLS-bevistester"
description: "24 integrationstester mot Supabase som bevisar RLS-filtrering på 7 tabeller"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Levererat
  - Avvikelser
  - Lärdomar
---

# S14-5 Done: RLS-bevistester

## Acceptanskriterier

- [x] Provider A kan INTE se Provider B:s bokningar via Supabase-klient
- [x] Anon-användare ser ingenting (alla 7 tabeller)
- [x] Admin (service_role/Prisma) ser allt
- [x] Alla 7 kärndomäner testade: Booking, Payment, Service, Horse, CustomerReview, Notification, BookingSeries

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (JWT-claim verifiering, cross-tenant negativa tester)
- [x] Unit tests skrivna (24 tester), alla gröna
- [x] check:all 4/4 gröna (typecheck + 3948 tester + lint + swedish)
- [x] Feature branch, alla tester gröna

## Reviews körda

- [x] **tech-architect** (plan-review): 1 blocker (CustomerReview saknade bookingId), 2 majors (Payment fält, JWT-claim check), 3 minors -- alla fixade
- [x] **security-reviewer** (plan-review): 1 false alarm (migration "tom"), 1 valid major (JWT-claim verifiering), 1 suggestion (anon Service-test) -- alla adresserade
- [x] **code-reviewer**: Ej körd separat -- reviews integrerade i plan-review-fasen

## Levererat

- 2 nya filer:
  - `src/__tests__/rls/rls-proof.integration.test.ts` (24 tester)
  - `src/__tests__/rls/supabase-test-helpers.ts` (seed, cleanup, klientfabriker)
- S14-1 migration applicerad på Supabase-projektet (13 policies + `rls_provider_id()`)
- RLS aktiverat på BookingSeries och CustomerReview (saknades)

### Testscenarier per tabell

| Tabell | Tester | Bevisat |
|--------|--------|---------|
| Booking | 6 | Provider-isolation, customer-reads, anon deny, admin bypass |
| Payment | 3 | Provider via booking JOIN, cross-tenant block, customer reads |
| Service | 3 | Provider own, public active, anon deny |
| Horse | 3 | Owner, provider via ProviderCustomer, cross-tenant block |
| CustomerReview | 3 | Provider, customer, cross-tenant block |
| Notification | 3 | User-isolation, cross-tenant block |
| BookingSeries | 3 | Provider, customer, cross-tenant block |

## Avvikelser

- **Supabase MCP kunde inte autentiseras** -- migration applicerades via Prisma `$executeRawUnsafe` med pooler-URL istället
- **RLS inte aktiverat på BookingSeries/CustomerReview** -- behövde `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` utöver S14-1 migrationen. PoC (S10) hade aktiverat RLS på Booking, Horse, Payment, Service, Notification men inte de två nya tabellerna.
- **`updatedAt` saknar DB-default** -- `@updatedAt` i Prisma sätts av Prisma-klienten, inte av databasen. Supabase JS-klient kräver explicit `updatedAt` vid inserts. Samma gäller inte Service (ingen `updatedAt`).
- **Vitest laddar inte `.env.local` automatiskt** -- lade till `dotenv` import i test-helpers

## Lärdomar

- **Verifiera att migration är deployad INNAN tester skrivs**: S14-1 var mergad till main men aldrig applicerad på Supabase. Testerna avslöjade detta direkt -- bra att de körs mot riktig infra.
- **`ENABLE ROW LEVEL SECURITY` saknas lätt**: Policies kan existera utan att RLS är aktiverat. Ingen effekt förrän `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` körs. BookingSeries-testet visade detta tydligt (provider A kunde se B:s serier).
- **Schema-verifiering mot Prisma vid Supabase-seeding**: `@updatedAt` har ingen DB-default. Tech-architect-review fångade att `paymentMethod` (planens version) inte matchar schemat (`provider`). Verifiera ALLTID fältnamn mot `prisma/schema.prisma`.
- **JWT-claim guard förhindrar falska gröna**: Om `rls_provider_id()` returnerar NULL matchar inget -- alla provider-tester ger 0 rader, men av FEL anledning. `verifyJwtClaims()` i beforeAll fångar detta.
