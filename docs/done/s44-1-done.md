---
title: "S44-1 Done: Batch 2 — 4 specs till integration"
description: "Migrerade customer-invite, group-bookings, provider-notes, route-planning till integration-tester. E2E: 25 → 21 specs."
category: guide
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Täckning
  - Avvikelser
  - Lärdomar
---

# S44-1 Done: Batch 2 — 4 specs till integration

## Acceptanskriterier

- [x] `e2e/customer-invite.spec.ts` (98r) raderad — 7 integration-tester i `route.integration.test.ts`
- [x] `e2e/group-bookings.spec.ts` (220r) raderad — 4 integration-tester tillagda i befintlig fil (för `/available`)
- [x] `e2e/provider-notes.spec.ts` (336r) raderad — 11 integration-tester i ny fil
- [x] `e2e/route-planning.spec.ts` (235r) raderad — 12 integration-tester i ny fil
- [x] `e2e/security-headers.spec.ts` stannar (SPIKE-beslut — next.config.ts headers tillgängliga ej via NextRequest)
- [x] E2E-antal: 25 → 21 specs (4 raderade)
- [x] Integration-tester: 4268 gröna (var 4239 i S44-0 output)
- [x] `check:all` 4/4 gröna

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker (inga nya routes — enbart tester)
- [x] Tester skrivna med BDD dual-loop (integration-tester driver beteendet)
- [x] Feature branch, `check:all` grön, klar för merge via PR

## Reviews körda

- [x] code-reviewer — findings: 2 Major, 4 Minor, 2 Suggestions
  - **Major 1 fixad:** notes-POST saknade whitespace-only-test → lade till
  - **Major 2 fixad:** DELETE IDOR-test kastar nu med P2025-kommentar
  - **Minor 3 fixad:** PATCH saknade 403-test för providerId-missmatch → lade till
  - **Minor 4 fixad:** `any` → `unknown` i $transaction-mock-typ
  - **Minor 5 fixad:** invite updateMany assertion utökad med `data: { usedAt: expect.any(Date) }`
  - **Minor 6:** group-bookings /available mockformat bekräftat korrekt (class mock-mönstret säkerställer att riktig service körs)
  - Suggestions (ej åtgärdade): `as never` i feature-flag-mock, rate-limit-test i notes — acceptabla minor-gaps

## Docs uppdaterade

Ingen docs-uppdatering (intern testmigrering — ingen användarvänd ändring).

## Verktyg använda

- Läste patterns.md vid planering: ja
- Kollade code-map.md för att hitta filer: ja
- Hittade matchande pattern: "BDD dual-loop integration-test" (customer-invite som mall)

## Täckning

| Spec | Tester | Täckta scenarios |
|------|--------|-----------------|
| customer-invite | 7 | 401, 404 flag, 404 IDOR, 409 active account, 400 sentinel email, 200 token + email |
| group-bookings /available | 4 | 200, 401, 403 customer, 404 flag |
| provider-notes GET | 3 | 401, 403 no relation, 200 list |
| provider-notes POST | 6 | 401, 403, 400 empty, 400 whitespace, 400 too long, 201 created |
| provider-notes DELETE | 3 | 401, 404 P2025 IDOR, 204 success |
| route-planning POST | 5 | 401, 404 flag, 400 empty orders, 400 no name, 201 happy path |
| route-planning GET | 3 | 401, 404 flag, 200 list |
| route-planning PATCH | 5 | 401, 404 not found, 403 IDOR, 200 in_progress, 200 completed+route |

## Coverage-gaps (acceptabla)

- UI-flöden (knapptext, mobil-skip, inline-redigering) — E2E-nivå, ej relevant för integration
- security-headers.spec.ts kvarstår som E2E (next.config.ts headers injiceras av Next.js-server, ej NextRequest)

## Avvikelser

security-headers.spec.ts klassades om från FLYTTA till STANNA (SPIKE-resultat i plan). E2E-mål ändrades från 26→22 till 25→21 (security-headers räknades med i ursprunglig uppskattning).

## Lärdomar

- `vi.hoisted()` måste innehålla ALLA mock-objekt som `vi.mock()` factory refererar — inte bara enkla funktioner. `mockPrisma` med `$transaction`-mock måste vara i hoisted-blocket.
- `$transaction`-mock: `vi.fn().mockImplementation(async (callback) => callback(mockTx))` — enkelt mönster som låter route-logiken köra utan att Prisma-DB berörs.
- Komplexa routes med `$transaction` (route-planning) kan integration-testas effektivt utan att testa varje transaktionsteg — fokus på input/output-beteende.
