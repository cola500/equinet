---
title: "Retrospektiv: Sprint 59–62 — fyra features release-klara på en dag"
description: "Massrelease-dag: gruppbokningar, förfallen service, återkommande bokningar och kundinbjudningar går GA via 22 stories och 4 feature flag-borttagningar."
category: retrospective
status: active
last_updated: 2026-04-25
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - 5 Whys
  - Lärandeeffekt
---

# Retrospektiv: Sprint 59–62 — fyra features release-klara på en dag

**Datum:** 2026-04-25
**Scope:** Sprint 59 (gruppbokningar GA), Sprint 60 (förfallen service GA), Sprint 61 (återkommande bokningar GA), Sprint 62 (kundinbjudningar GA) — fyra parallella release-klar-sprintar körda sekventiellt under en arbetsdag.

---

## Resultat

- 22 stories done, 55 commits, 19 feature/fix-commits
- 4 feature flags borttagna: `group_bookings`, `due_for_service`, `recurring_bookings`, `customer_invite`
- Tester: 4375 (check:all 4/4 gröna, inga regressioner)
- 1 hotfix krävdes efter S62-2 (APP_URL missade domain-lagret)
- Inga TypeScript-fel
- Tid: ~1 arbetsdag

## Vad som byggdes

| Sprint | Lager | Filer/stories | Beskrivning |
|--------|-------|---------------|-------------|
| S59 | API, Domain, UI | GroupBooking-routes, rate limiter, $transaction | Döda requests filtreras, kopiera-kod-knapp, bokningsdetaljer inline, atomisk join + per-IP rate limit, feature flag borttagen |
| S60 | Domain, API, UI | DueForServiceService, provider-routes, IntervalSection | 44 tester, inline intervalredigering, >26-veckors-varning, native 200+[] vid flagga AV, feature flag borttagen |
| S61 | Domain, API, UI | BookingSeriesService ($transaction), /customer/booking-series/[id] | Atomisk create/cancel, startdatumsvalidering, kund-vy med cx-ux-review, email-bekräftelse, feature flag borttagen |
| S62 | UI, Domain, API | accept-invite/schema.ts, email-service.ts, AuthService.ts, GhostMergeService, CustomerActions | UI-lösenordsvalidering, APP_URL-byte, merge-dialog refresh, GhostMergeService-delegering, inbjudningshistorik, feature flag borttagen |
| Hotfix | Domain | AuthService.ts, RouteAnnouncementNotifier.ts, createPaymentService.ts | 5 kvarglömda NEXTAUTH_URL-instanser i domain-lagret — potentiellt kritisk Stripe callback-URL |

## Vad gick bra

### 1. Konsekvent release-klar-pipeline per feature
Varje sprint hade ett tydligt DoD: "ta bort feature flag". Det gav ett naturligt stopp-kriterium och tvingade fram verifiering att flaggan faktiskt var borta från `feature-flag-definitions.ts`, `playwright.config.ts` och admin-UI. Ingen feature lämnades halvöppen.

### 2. $transaction-mönstret applicerades korrekt på tre platser
S59-4 (atomisk join), S61-1 (atomisk serie-create) och S61-4 (atomisk serie-cancel) använde alla Prisma `$transaction` korrekt för att eliminera TOCTOU-race conditions. S59-4 fångade dessutom en riktig säkerhetsbugg — capacity check + insert körde som separata queries, vilket tillät dubbel-join vid cap.

### 3. cx-ux-reviewer tillfört verkligt värde på S61-3
Kund-vyn för seriebokningar fick flera konkreta UX-förbättringar från cx-ux-reviewer: häst + leverantör i header, baknavigering ovanför sidan, visuell dimning av historiska datum, redundant rad borttagen. Alla access­ibilitets-fixes (role=status, aria-labels, focus ring, 44px touch target) implementerades direkt.

### 4. GhostMergeService-refaktoreringen (S62-4) rensar teknikskuld
Merge-routen hade duplicerat affärslogik direkt i route-handleren istf att delegera till `GhostMergeService`. S62-4 extraherade logiken till service-lagret — routes ska bara orkestreras, inte implementera affärslogik.

## Vad kan förbättras

### 1. APP_URL-rename missade 5 instanser i domain-lagret
S62-2 bytte `NEXTAUTH_URL` mot `APP_URL` i `email-service.ts` men missade `AuthService.ts` (lösenordsåterställnings-URL), `createPaymentService.ts` + `createPaymentWebhookService.ts` (Stripe callback-URL) och `RouteAnnouncementNotifier.ts` (2 push-URL). Stripe callback-URL var potentiellt kritisk — om den skickats med fel bas-URL hade Stripe-webhooks failat i produktion.

**Prioritet:** HÖG — miljövariabel-renames kräver global grep, inte fil-för-fil-fix.

### 2. TOCTOU i S59 borde ha hittats vid initial implementation
Race condition i join-flödet (capacity check + insert utan transaktion) var en klassisk TOCTOU. Den borde ha fångats i security-reviewer eller vid initial implementation av gruppbokningar. Nu fixades den i S59-4 som en del av "release-klar"-storyn.

**Prioritet:** MEDEL — security-reviewer-prompten bör explicit be om TOCTOU-granskning vid alla multi-step skrivoperationer.

## Patterns att spara

### Miljövariabel-rename: global grep FÖRST
Vid rename av en miljövariabel: kör `grep -r OLD_VAR_NAME src/ --include="*.ts"` som explicit första steg i PR-implementationen, inte som efterkontroll. Lista alla träffar i PR-beskrivningen. En missad instans kan vara en kritisk runtime-bugg (Stripe-callbacks, auth-redirect).

### Release-klar-sprint som feature-avslutningsritual
Mönstret "en hel sprint dedikerad till att ta en feature från flagga-på till GA" fungerar. Det samlar alla kvarvarande buggar, UX-issues och edge cases på ett ställe istf att spridas över flera sprintar. DoD (ta bort feature flaggan) ger ett tydligt avslutningskriterium.

### $transaction för alla multi-step skrivoperationer
Regel: om en operation läser och sedan skriver baserat på läsresultatet (check → insert, count → create), ska det ligga i en `$transaction`. Undantag kräver explicit motivering. Gäller speciellt: kapacitetsgränser, serien/gruppen-ägande, betalningsstatus-uppdateringar.

## 5 Whys

### Problem: Hotfix krävdes för APP_URL efter S62-2 — 5 kvarglömda instanser i domain-lagret

1. **Varför?** S62-2:s scope definierades som "byt ut NEXTAUTH_URL i email-service.ts" — för smalt.
2. **Varför?** Ingen sökte igenom hela kodbasen efter alla occurrences av `NEXTAUTH_URL` innan implementationen.
3. **Varför?** Miljövariabel-renames behandlas som "lägg till en rad i en fil" snarare än "sök + ersätt i hela repot".
4. **Varför?** Det finns inget CI-steg eller pre-commit-check som varnar för förekomsten av specifika föråldrade variabelnamn.
5. **Varför?** Kodbasen har ingen policy för "deprecated env var"-detektering — renames sker manuellt utan verktyg.

**Åtgärd:** Lägg till `grep -r OLD_VAR src/` som explicit steg i storyn vid miljövariabel-renames. Dokumentera i gotchas.md: "Vid miljövariabel-rename: grep ALLTID hela src/ innan PR skapas."
**Status:** Dokumenterad nedan (gotchas.md).

## Lärandeeffekt

**Nyckelinsikt:** Miljövariabel-renames är smygande globala operationer. En ändring i en fil räcker inte — sök alltid i hela kodbasen. En missad instans i betalningsflödet hade kunnat blockera Stripe-webhooks i produktion.
