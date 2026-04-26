---
title: "Sprint 62: Kundinbjudningar release-klar"
description: "Täpper de fem luckor teateranalysen hittade. DoD: ta bort customer_invite feature flag."
category: sprint
status: planned
last_updated: 2026-04-25
tags: [sprint, customer-invite, ux, auth, tech-debt]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 62: Kundinbjudningar release-klar

## Sprint Overview

**Mål:** Täppa de fem luckor teateranalysen identifierade och släpp `customer_invite` utan feature flag.

**Källa:** Teateranalys 2026-04-25 — leverantör + kund i samspel med koden.

**Nuläge:** Inbjudnings- och merge-flödena fungerar tekniskt men har tre tydliga brister: UI-lösenordsvalidering saknar kravet på stora/små bokstäver, siffra och specialtecken (kunden kan skicka in ett svagt lösenord som UI godkänner men API avvisar); inbjudningslänkens bas-URL läses från `NEXTAUTH_URL` (kvarglömt från NextAuth-eran — kan ge felaktiga länkar i produktion); merge-dialogen stänger sig inte och refreshar inte kundlistan efter lyckad operation. Merge-routen duplicerar dessutom affärslogik som redan finns i `GhostMergeService`.

**DoD:** `customer_invite` feature flag borttagen. Funktionen alltid aktiv.

| Story | Gap | Effort |
|-------|-----|--------|
| S62-1 | GAP 2 — UI-lösenordsvalidering saknar regex-regler | 15 min |
| S62-2 | GAP 3 — `NEXTAUTH_URL` som bas-URL för inbjudningslänken | 15 min |
| S62-3 | GAP 4 — Merge-dialog refreshar inte kundlistan | 30 min |
| S62-4 | GAP 5 — Merge-route kringgår GhostMergeService | 60 min |
| S62-5 | GAP 1 — Ingen historik om skickade inbjudningar | 30 min |
| S62-6 | DoD — Ta bort customer_invite feature flag | 15 min |

---

## Stories

### S62-1: Synkronisera UI-lösenordsvalidering med API (GAP 2)

**Prioritet:** 1
**Effort:** 15 min
**Domän:** webb

**Problem:** `AcceptInvitePage` validerar bara `min(8)` + `max(72)`. API:et kräver dessutom stor bokstav, liten bokstav, siffra och specialtecken. Kunden kan fylla i `enkellösen8` — UI tillåter och skickar — API avvisar med 400 och `"Valideringsfel"` utan att ange vilken regel som bröts. Confusing error UX.

**Fix:** Lägg till samma `.regex()`-regler i UI-schemat som finns i API-schemat. Zod-valideringsfelet renderas inline i formuläret (react-hook-form sköter det) — kunden ser direkt vilken regel som saknas.

**Filer:**
- `src/app/(auth)/accept-invite/page.tsx` — uppdatera `acceptInviteSchema` med samma regex-regler som API

**Acceptanskriterier:**
- [ ] Lösenord utan stor bokstav ger inline-fel direkt i formuläret
- [ ] Lösenord utan specialtecken ger inline-fel direkt i formuläret
- [ ] Lösenord utan siffra ger inline-fel direkt i formuläret
- [ ] `SecurePass1!` accepteras av både UI och API
- [ ] Test: täcker de tre regex-fallen

---

### S62-2: Byt ut `NEXTAUTH_URL` mot `APP_URL` i email-service (GAP 3)

**Prioritet:** 2
**Effort:** 15 min
**Domän:** webb

**Problem:** `sendCustomerInviteNotification` (och `sendStableInviteNotification`) bygger inbjudningslänkens bas-URL från `process.env.NEXTAUTH_URL`. Variabeln härstammar från NextAuth-eran och är borttagen ur Vercel-dokumentationen — om den inte sätts i Vercel-miljön genereras länkarna med `http://localhost:3000`. Lokalt pekar `.env` på `192.168.1.37:3000` (iOS-dev-IP). Inbjudningslänkar till kunder i produktion riskerar att vara funktionslösa.

**Fix:**
1. Byt variabelnamnet till `APP_URL` i `email-service.ts` (alla tre ställen som läser bas-URL)
2. Verifiera att `APP_URL` finns i `.env.example`
3. Verifiera/lägg till `APP_URL` i Vercel-miljön (Johan gör detta manuellt)

**Filer:**
- `src/lib/email/email-service.ts` — ersätt `NEXTAUTH_URL` med `APP_URL`
- `.env.example` — lägg till `APP_URL=https://equinet.vercel.app`

**Acceptanskriterier:**
- [ ] Sökning på `NEXTAUTH_URL` i `src/lib/email/` ger noll träffar
- [ ] `APP_URL` används konsekvent i alla bas-URL-läsningar i email-service
- [ ] `.env.example` dokumenterar `APP_URL`
- [ ] Fallback är fortfarande `http://localhost:3000` vid lokal dev

---

### S62-3: Stäng merge-dialog och refresha kundlistan efter lyckad merge (GAP 4)

**Prioritet:** 3
**Effort:** 30 min
**Domän:** webb

**Problem:** `CustomerMergeDialog` visar success-text men dialogen stänger sig inte och kundlistan refreshar inte. Ghost-kunden sitter kvar i listan tills leverantören manuellt laddar om sidan — förvirrande eftersom man just sett "Kunden har slagits ihop".

**Fix:**
1. Lägg till `onSuccess` callback-prop i `CustomerMergeDialog`
2. Stäng dialogen automatiskt (med kort delay för success-text) efter lyckad merge
3. Anropa `onSuccess` från `CustomerCard` → `CustomerActions` → sidan refreshar via `router.refresh()` eller SWR-mutate

**Kontrollera:** Hur hämtar `customers/page.tsx` sin data — SWR-hook eller server-fetch? Välj rätt refresh-metod.

**Filer:**
- `src/components/provider/customers/CustomerMergeDialog.tsx` — lägg till `onSuccess` prop + auto-stäng
- `src/components/provider/customers/CustomerActions.tsx` — ta emot och vidarebefordra `onSuccess`
- `src/components/provider/customers/CustomerCard.tsx` — koppla `onSuccess` till data-refresh
- `src/app/provider/customers/page.tsx` — eventuell router.refresh/mutate

**Acceptanskriterier:**
- [ ] Merge-dialogen stänger sig automatiskt ~1.5s efter success-text visas
- [ ] Kundlistan uppdateras och ghost-kunden är borta utan manuell sidladdning
- [ ] Avbryt-knapp och `onOpenChange(false)` fungerar fortfarande korrekt
- [ ] Vid merge-fel stänger dialogen sig inte (felmeddelandet visas kvar)

---

### S62-4: Refaktorera merge-route att använda GhostMergeService (GAP 5)

**Prioritet:** 4
**Effort:** 60 min
**Domän:** webb

**Problem:** `POST /api/provider/customers/[customerId]/merge` duplicerar hela affärslogiken (IDOR-check, ghost-check, hitta real user, atomisk 11-stegs-transaktion) inline med Prisma — utan att använda `GhostMergeService` som redan finns och är testad. `GhostMergeService` används bara i register-flödet (implicit ghost merge vid registrering). Dubbel kod = risk att reglerna divergerar.

**Fix:** Refaktorera merge-routen att instansiera och anropa `GhostMergeService`. Merge-transaktionen (11 steg) är redan implementerad i repot (`PrismaAuthRepository.executeMergeTransaction` eller liknande) — verifiera att den täcker samma steg som routens inline-implementation.

**OBS:** Läs `GhostMergeService.ts` och `PrismaAuthRepository.ts` noggrant. Om `executeMergeTransaction` i repot täcker samma 11 steg som routens inline-transaction — bra, använd den. Om den saknar steg (t.ex. `ProviderCustomerNote`, `Follow`, `MunicipalityWatch`) — utöka repot och `GhostMergeService` innan du byter ut routen.

**Filer:**
- `src/app/api/provider/customers/[customerId]/merge/route.ts` — använd `GhostMergeService` istället för inline Prisma
- `src/infrastructure/persistence/auth/PrismaAuthRepository.ts` — utöka `executeMergeTransaction` om steg saknas
- `src/domain/auth/GhostMergeService.ts` — inga ändringar förväntas (logiken är rätt)

**Acceptanskriterier:**
- [ ] Merge-routen innehåller ingen inline Prisma-logik (bara validering + service-anrop)
- [ ] `GhostMergeService.merge()` anropas i routen
- [ ] Alla 11 merge-steg täcks av `executeMergeTransaction` i repot
- [ ] Befintliga tester i `GhostMergeService.test.ts` är gröna
- [ ] `npm run check:all` grön

---

### S62-5: Visa senast skickad inbjudan på kundkortet (GAP 1)

**Prioritet:** 5
**Effort:** 30 min
**Domän:** webb

**Problem:** `inviteStatus === "sent"` är session-local state. Vid nästa sidladdning visas alltid "Skicka inbjudan" — leverantören vet inte om de bjöd in kunden förra veckan och när länken går ut. De kan råka skicka duplicerade inbjudningar ovetandes (servern hanterar detta korrekt, men UX:en är förvirrande).

**Fix:** Hämta senast skapade `CustomerInviteToken` (om `usedAt: null` och inte utgången) för kunden och visa det i kundkortet: t.ex. "Inbjudan skickad [datum], giltig till [datum]". Knappen bör kvarstå (leverantören kan skicka om) men texten ger tydlig historik.

**Kontrollera:** Lägg till ett fält i `GET /api/provider/customers` (eller det specifika kundkortet) som returnerar `lastInviteSentAt` och `lastInviteExpiresAt` — bara för manuellt tillagda kunder med aktiv token.

**Filer:**
- `src/app/api/provider/customers/route.ts` (eller kunddetaljrouten) — inkludera senast aktiv invite-token
- `src/components/provider/customers/CustomerActions.tsx` — visa "Inbjudan skickad [datum]" om aktiv token finns

**Acceptanskriterier:**
- [ ] Kundkortet visar "Inbjudan skickad [datum], giltig till [datum]" om en aktiv token finns
- [ ] Ingen text visas om ingen aktiv token finns
- [ ] Knappen "Skicka inbjudan" finns kvar (kan skicka om)
- [ ] Text visas korrekt vid sidladdning (inte bara session-state)

---

### S62-6: Ta bort customer_invite feature flag (DoD)

**Prioritet:** 6
**Effort:** 15 min
**Domän:** webb

**Fix:** Ta bort `customer_invite`-flaggan från alla platser:
- `src/lib/feature-flag-definitions.ts`
- `src/app/api/auth/accept-invite/route.ts`
- `src/app/api/provider/customers/[customerId]/invite/route.ts`
- `src/app/api/provider/customers/[customerId]/merge/route.ts`
- `src/components/provider/customers/CustomerActions.tsx` — ta bort `flags.customer_invite`-villkoren, visa knappar alltid (för manuellt tillagda kunder)

**Acceptanskriterier:**
- [ ] Sökning på `customer_invite` ger noll träffar i `src/`
- [ ] "Skicka inbjudan" och "Slå ihop"-knapparna visas utan feature flag-toggle
- [ ] `npm run check:all` grön

---

## Förväntat resultat

| Vad | Före | Efter |
|-----|------|-------|
| Svagt lösenord i UI | UI godkänner, API avvisar med kryptiskt fel | UI avvisar direkt med tydlig regelförklaring |
| Inbjudningslänk i produktion | Riskerar `localhost:3000` om NEXTAUTH_URL saknas | `APP_URL` satt korrekt, länkarna fungerar |
| Kundlistan efter merge | Ghost sitter kvar tills manuell sidladdning | Listan refreshas, ghost försvinner |
| Merge-routens arkitektur | Inline Prisma, duplicerar GhostMergeService | GhostMergeService används, en källa för logiken |
| Historik om skickade inbjudningar | Ingen indikation | "Inbjudan skickad [datum]" visas på kundkortet |
| Feature flag | På | Borttagen |
