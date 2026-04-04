---
title: "S14-1 Done: RLS READ-policies på kärndomäner"
description: "13 SELECT-policies på 7 tabeller via Prisma-migration"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# S14-1 Done: RLS READ-policies på kärndomäner

## Acceptanskriterier

- [x] SELECT-policies skapade på alla kärndomäners tabeller
- [x] Provider ser bara sin egen data (via providerId i JWT)
- [x] Kund ser bara sin egen data (via auth.uid())
- [x] Anon ser ingenting (deny-all, inga policies för anon)
- [x] service_role (Prisma) kringgår RLS (ingen FORCE ROW LEVEL SECURITY)
- [x] Hjälpfunktion rls_provider_id() för DRY
- [x] Befintlig PoC-policy uppdaterad för konsistens

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (Zod-validering N/A, RLS policies korrekt strukturerade)
- [x] Unit tests skrivna FÖRST (17 tester), alla gröna
- [x] check:all 4/4 gröna (typecheck + 3924 tester + lint + swedish)
- [x] Feature branch, alla tester gröna

## Reviews körda

- [x] **tech-architect** (plan-review): 3 åtgärder -- alla implementerade (ALTER befintlig policy, BookingSeries tillagd, Horse-synlighet dokumenterad)
- [x] **security-reviewer** (plan-review): 3 påstådda blockers -- alla utvärderade som false alarms (SECURITY DEFINER antas felaktigt, MobileToken deny-all redan aktivt, Horse-policy korrekt). 1 giltig major (BookingSeries saknas) -- implementerad.
- [x] **code-reviewer** (kod-review): 0 blockers, 0 majors, 2 minor, 2 suggestions. Verdict: ready to merge.

## Levererat

- 1 Prisma-migration: `20260404120000_rls_read_policies`
- 13 SELECT-policies på 7 tabeller (Booking, Payment, Service, Horse, CustomerReview, Notification, BookingSeries)
- 1 hjälpfunktion: `rls_provider_id()`
- 17 tester

## Avvikelser

- **Testfil placering**: `prisma/migrations/__tests__/` istället för `src/__tests__/rls/` -- bättre co-location med migrationer. Code-reviewer godkände.
- **Faktisk RLS-filtrering testas i S14-5**, inte här. Testerna verifierar migrationens innehåll.

## Lärdomar

- **Security-reviewer kan ha felaktiga antaganden**: Reviewern antog SECURITY DEFINER trots att planen inte specificerade det, och påstod att Payment har `customerId` direkt (falskt). Viktigt att kritiskt granska security-findings mot faktiskt schema.
- **BookingSeries missades i första planutkastet**: Trots att den är listad som kärndomän i CLAUDE.md. Subagent-review fångade detta -- bekräftar att self-review-steget har värde.
- **`auth.uid()::text` cast**: Supabase `auth.uid()` returnerar uuid, Prisma lagrar som text. Casten är nödvändig för jämförelse.
