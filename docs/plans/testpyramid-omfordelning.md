---
title: "Testpyramid-omfördelning: Discovery-plan"
description: "Klassning av alla 36 E2E-specs för omfördelning nedåt i testpyramiden"
category: plan
status: active
last_updated: 2026-04-19
reviewed_by: tech-architect (via tech lead) 2026-04-19
sections:
  - Sammanfattning
  - Klassningskriterier
  - Klassning per spec
  - Summary-tabell
  - Pilot-kandidater
  - Fas 3-batch
---

# Testpyramid-omfördelning: Discovery-plan

**Sprint:** S43  
**Story:** S43-0  
**Datum:** 2026-04-19

---

## Sammanfattning

Alla 36 E2E-specs är genomgångna och klassade. Resultatet:

| Kategori | Antal | Andel |
|----------|-------|-------|
| **STANNA** | 12 | 33% |
| **FLYTTA → integration** | 16 | 44% |
| **FLYTTA → component** | 5 | 14% |
| **TA BORT** | 3 | 8% |
| **Totalt** | **36** | 100% |

Förväntad vinst efter full omfördelning:
- E2E-svit: 36 specs → 12 specs (~67% reduktion)
- E2E-tid: ~15-20 min → ~3-5 min (uppskattning, beroende på vad som stannar)
- Ny integrationsnivå: +16 integration-testfiler, +5 component-testfiler
- Testkörningstid integration: ~5-10s extra total
- 0 skip-specs i smoke-tier (TA BORT + rening)

---

## Klassningskriterier

| Kategori | Kriterium |
|----------|-----------|
| **STANNA** | Genuin user journey över 2+ domäner (t.ex. provider gör X → kund ser Y), eller browser-specifikt beteende (offline PWA, Service Worker, visuell regression, kalendernavigation med datuminteraktion) |
| **FLYTTA → integration** | Testar API-logik, databas-interaktion, auth-guards, feature flag enforcement, CRUD-beteende som inte kräver browser-rendering |
| **FLYTTA → component** | UI-interaktion isolerad till en komponent/form (formulärvalidering, modal-rendering, edit/cancel-flöde) |
| **TA BORT** | Duplikat av unit/integration-täckning, fundamentalt bruten approach (Stripe E2E), majoritet test.skip(true), eller catch-all som överlappas av andra specs |

---

## Klassning per spec

### 1. accepting-new-customers.spec.ts
- **Rader:** 137 | **Tester:** ~14 | **Status:** Pass
- **Beskrivning:** Provider togglar "acceptingNewCustomers"-switch i sin profil. Kund ser amber-banner om leverantören inte tar nya kunder. Verifierar cross-view state: providerinställning → kundens upplevelse.
- **Förslag:** **STANNA**
- **Motivering:** Äkta cross-domain user journey (provider-inställning påverkar kund-vy). Kräver browser för att verifiera att banner visas/döljs baserat på inställning som ändrats av en annan inloggad roll.

---

### 2. admin.spec.ts
- **Rader:** 359 | **Tester:** ~46 | **Status:** Pass med mobile-skips
- **Beskrivning:** Admin CRUD: användarlista, leverantörlista, bokningslista, systeminställningar, feature flag-administrering. Tabellinteraktion med dropdown/dialog.
- **Förslag:** **FLYTTA → integration** ⚠️ SPLIT under batch-arbete
- **Motivering:** Dominant concern är API-beteende (list, ban/unban, view bookings). Mobile-skips beror på "Table layout not available on mobile" -- det är layout-problem, inte affärslogik. Admin CRUD kan testas direkt mot route-handlers utan browser.
- **SPLIT-notering (verifiera under S43-2):** Dropdown-tabell-navigation (ban/unban-dialog-interaktion) kan visa sig behöva STANNA som E2E eller bli component-test. Verifiera under batch-arbetet -- klassningen kan justeras per sub-test.
- **Till:** `src/app/api/admin/**/*.integration.test.ts` (API-CRUD) + potentiellt `src/components/admin/AdminTable.test.tsx` (dialog-interaktion)

---

### 3. announcements.spec.ts
- **Rader:** 456 | **Tester:** ~38 | **Status:** Kritiskt flaky/skipad
- **Beskrivning:** Rutt-annonseringsflöde (kund söker, väljer provider, ser annonser, bokar).
- **Förslag:** **TA BORT**
- **Motivering:** 8 av ~38 tester har `test.skip(true, ...)` -- varav 5 av dessa är "No announcements available" eller "No pending bookings to confirm". Resten av logiken täcks av `route-planning.spec.ts` (rutt-API), `route-announcement-notification.spec.ts` (notification-flödet), och `booking.spec.ts` (bokningsflödet). Ingen unik täckning kvar efter dessa migrerar.
- **Förutsättning:** Denna klassning förutsätter att `route-announcement-notification.spec.ts` förblir E2E (STANNA). Om den senare omklassas måste announcements-täckningen omvärderas -- det kan finnas scenario-täckning här som inte finns där.
- **Täcks redan av:** route-planning, route-announcement-notification, booking

---

### 4. auth.spec.ts
- **Rader:** 166 | **Tester:** ~20 | **Status:** Pass
- **Beskrivning:** Registrering av kund/leverantör (navigerar till /check-email), login, logout, lösenordsvalidering (real-time UI-feedback), neutralt startläge för password-indikatorn.
- **Förslag:** **FLYTTA → component**
- **Motivering:** Login/logout + registrering är API-beteende (redirect-URL efter auth) som redan täcks av `src/app/api/auth/register/route.integration.test.ts`. Dominant concern i denna spec är real-time lösenordsvalidering (PasswordStrengthIndicator-komponenten) -- det är en component-test. Registration redirect-testet är enkelt nog att testa via integration (mock Supabase createUser, verifiera redirect).
- **Till:** `src/components/auth/PasswordStrengthIndicator.test.tsx` (lösenordsvalidering), befintlig `auth/register/route.integration.test.ts` (registration flow)

---

### 5. booking.spec.ts
- **Rader:** 432 | **Tester:** ~65 | **Status:** Pass med konditionella skips (data-dependent)
- **Beskrivning:** Kunds bokningsflöde: söka leverantörer, filtrera på ort, se profil, välj tidslucka, bekräfta bokning, se bokningslistan.
- **Förslag:** **STANNA**
- **Motivering:** Kärnan i produkten. Genuin user journey: discovery → selection → booking → confirmation. Sträcker sig över provider discovery, availability, och booking-domänen. Kräver browser för sökning + kalenderkomponent + navigation. Konditionella skips beror på seed-data, inte på att logiken är trasig.

---

### 6. business-insights.spec.ts
- **Rader:** 207 | **Tester:** ~15 | **Status:** Pass med ett skip (info-popovers selector)
- **Beskrivning:** Provider analytics-sida: KPI-kort (bokningar, intäkt, betyg), period-switcher (3/6/12 mån), chartavsnitt, info-popövers.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Dominant concern är att API:et returnerar korrekta KPI-värden för valt tidsintervall. Period-switching triggar nytt API-anrop -- det är API-beteende. Chartrenderingen är visuell och täcks bättre av visual-regression (om vi vill). Info-popöver-testet är redan skip:at med selectorproblem.
- **Till:** `src/app/api/provider/insights/route.integration.test.ts`

---

### 7. calendar.spec.ts
- **Rader:** 358 | **Tester:** ~30 | **Status:** Pass med mobile-skips (day view vs week view)
- **Beskrivning:** Provider-kalender: veckovy, navigering (föregående/nästa vecka), klicka på daghuvudrubrik, datumspecifik navigation.
- **Förslag:** **STANNA**
- **Motivering:** Kalenderinteraktion är browser-specifik. Veckovy, scrollning, och datumnavigering kräver rendering av en riktig kalenderkomponent med Playwright-interaktion. Mobile-skips är legitima (day view vs week view -- olika layout, rätt att testa separat).

---

### 8. customer-due-for-service.spec.ts
- **Rader:** 280 | **Tester:** ~28 | **Status:** Pass
- **Beskrivning:** Kundvy av hästar som är förfallna till service (baserat på rekommenderat serviceintervall).
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Testar att API returnerar korrekta hästar baserat på bokningshistorik + serviceintervall. Sidrendering (heading, cards) är enkel enough för integration-assertion (kontrollera response-data). Kund-interaktionen (boka ny tid) täcks av booking.spec.ts som stannar.
- **Till:** `src/app/api/customer/due-for-service/route.integration.test.ts`

---

### 9. customer-insights.spec.ts
- **Rader:** 120 | **Tester:** ~15 | **Status:** Pass
- **Beskrivning:** Kundinsikter: statistik om tjänsteleverantörer kunden anlitat, hästar, bokningshistorik.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Testar att API returnerar korrekta aggregerade värden. Inga komplexa browser-interaktioner. Data-display-sida.
- **Till:** `src/app/api/customer/insights/route.integration.test.ts`

---

### 10. customer-invite.spec.ts
- **Rader:** 98 | **Tester:** ~10 | **Status:** Pass
- **Beskrivning:** Leverantör bjuder in en ghost-kund (manuellt tillagd). Testar inbjudningslänk, token-validering, UI-bekräftelse.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Kärnan är att inbjudnings-API skapar korrekt inbjudan + HMAC-token. UI-flödet (klicka "Bjud in" → toast) är enkelt nog. Token-validering är tydligt integration-testbar.
- **Till:** `src/app/api/customer-invite/route.integration.test.ts`

---

### 11. customer-profile.spec.ts
- **Rader:** 142 | **Tester:** ~12 | **Status:** Pass
- **Beskrivning:** Kundprofil-sida: read-mode display, redigera-knapp, stalladress-sektion, formulärfält, edit/save-flöde.
- **Förslag:** **FLYTTA → component**
- **Motivering:** Dominant concern är formulär-UI: read/edit toggle, vilka fält visas, labels och placeholders. Ingen cross-domain logik. API-save täcks av integration-testet för profile-route. Component-test kan verifiera form-rendering utan browser.
- **Till:** `src/app/(protected)/customer/profile/CustomerProfileForm.test.tsx`

---

### 12. customer-registry.spec.ts
- **Rader:** 129 | **Tester:** ~13 | **Status:** Pass
- **Beskrivning:** Leverantörs kundregister: lista kunder, sök på namn, expandera kundkort för detaljer/hästar.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Sökning och listning är API-beteende (server-side search). Expandering av kundkort är UI men handlar om API-data rendering. Integration-test kan verifiera att korrekt data returneras för sökterm.
- **Till:** `src/app/api/provider/customers/route.integration.test.ts`

---

### 13. customer-reviews.spec.ts
- **Rader:** 205 | **Tester:** ~21 | **Status:** Pass med konditionella skips
- **Beskrivning:** Kund skickar recension efter avslutad bokning. Stjärnbetyg + text. Leverantör ser betyget på sin dashboard.
- **Förslag:** **STANNA**
- **Motivering:** Äkta cross-domain user journey: kund submitar recension → leverantör ser betyg på dashboard. Kräver browser för stjärninteraktion (click → state change) + navigation mellan kund- och leverantörs-vy. ReviewService-logiken är redan testad i unit-tester.

---

### 14. due-for-service.spec.ts
- **Rader:** 115 | **Tester:** ~8 | **Status:** Pass
- **Beskrivning:** Leverantörssidan för besöksplanering: överförfallna hästar, sammanfattningskort, filter (Försenade/Alla).
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Testar att API returnerar hästar baserat på bokningshistorik + serviceintervall. Filter-logiken är server-side. Sida-rendering är enkel data-display.
- **Till:** `src/app/api/provider/due-for-service/route.integration.test.ts`

---

### 15. exploratory-baseline.spec.ts
- **Rader:** 302 | **Tester:** ~27 | **Status:** Pass med konditionella skips
- **Beskrivning:** Catch-all-spec för testfall som inte täcks av andra specs: dashboard stat-kort navigation, provider profil recurring bookings-inställningar, admin system-sida, smoke: alla nyckel-sidor laddar.
- **Förslag:** **TA BORT**
- **Motivering:** Explicit catch-all ("Covers test cases NOT already covered by existing specs"). När vi migrerar de andra specs-erna försvinner gap-motivationen. Dashboard stats täcks av provider.spec.ts, admin-sidan av admin.spec.ts, recurring bookings av recurring-bookings.spec.ts -- alla sådana som migreras till integration. Ingen unik browser-logik som inte täcks av specs som STANNAR.
- **Täcks redan av:** provider.spec.ts (dashboard), admin.spec.ts (admin), calendar.spec.ts (kalendersida smoke)

---

### 16. feature-flag-toggle.spec.ts
- **Rader:** 730 | **Tester:** ~94 | **Status:** Pass med mobile-skips + env-override-skips
- **Beskrivning:** Admin togglar feature flags via UI → verifierar nav-synlighet för provider/kund, API returnerar 404 när flagga är OFF. 730 rader, 94 tester -- störst spec i sviten.
- **Förslag:** **FLYTTA → integration** ⚠️ SPLIT krävs — inte ren 1-till-1
- **Motivering:** Dominant concern är att API-routes returnerar 404 när feature flag är OFF (API enforcement). Nav-synligheten är React-logik som kan testas med component-tester. De 10 miljö-override-skippade testerna (`test.skip(true, '...has env override')`) är permanent döda kod och tas bort.
- **SPLIT-notering (måste ske under S43-2+):** Spec-filen måste splitas i två delar före borttagning: (1) API enforcement-tester → integration, (2) nav-synlighet vid flag-toggle → `src/components/layout/ProviderNav.test.tsx` + `CustomerNav.test.tsx`. Permanent-skippade env-override-tester tas bort direkt. Kan inte göras som ren "ta bort E2E-spec" utan att skriva båda ersättarna först.
- **Till:** `src/app/api/**/*.integration.test.ts` (feature-flag-gating per route) + `src/components/layout/ProviderNav.test.tsx` (nav-synlighet)

---

### 17. follow-provider.spec.ts
- **Rader:** 351 | **Tester:** ~47 | **Status:** Pass
- **Beskrivning:** Kund följer/avföljer leverantör med optimistisk UI-uppdatering. Följ-status persisterar vid navigering. Municipality-inställning i profil. Leverantör ser inte FollowButton.
- **Förslag:** **FLYTTA → integration** ⚠️ SPLIT krävs — inte ren 1-till-1
- **Motivering:** Kärnan är follow/unfollow API-beteende + persist i DB. Municipality-inställning är CRUD -- integration-testbar. Ingen cross-domain journey (bara kund-vy).
- **SPLIT-notering:** Optimistisk UI (knappstatus ändras direkt utan sidomladdning) är browser-specifikt beteende som inte kan replikeras med enbart route-handler-anrop. FollowButton-komponenten behöver en component-test för att täcka det optimistiska state-flödet (klick → pending state → success/error). Migreringen är: API-beteende → integration, optimistisk UI → `src/components/providers/FollowButton.test.tsx`.
- **Till:** `src/app/api/provider/follow/route.integration.test.ts` (API) + `src/components/providers/FollowButton.test.tsx` (optimistisk UI)

---

### 18. group-bookings.spec.ts
- **Rader:** 220 | **Tester:** ~12 | **Status:** Pass
- **Beskrivning:** Gruppbokning: kund skapar gruppbokning, ser tillgängliga grupptider, bekräftar.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Feature-flag-gatad (env override, alltid ON i E2E). Bara 12 tester. Kärnan är att API returnerar tillgängliga grupptider + skapar bokning. UI-flödet är relativt enkelt (en dialog, liknande vanlig bokning). Vanliga booking.spec.ts STANNAR och täcker bokningsflödets browser-specifika delar.
- **Till:** `src/app/api/group-bookings/route.integration.test.ts` (finns redan delvis!)

---

### 19. horses.spec.ts
- **Rader:** 172 | **Tester:** ~9 | **Status:** Pass
- **Beskrivning:** Kunds häst-CRUD: lägg till häst (formulär med namn/ras/färg/födelseår/kön), redigera, ta bort, lista.
- **Förslag:** **FLYTTA → component**
- **Motivering:** Rena formulärinteraktioner i en dialog. Ingen cross-domain logik. API-CRUD täcks av integration-test. HorseForm-komponenten kan testas med RTL (render, fill, submit, verify state).
- **Till:** `src/components/horses/HorseForm.test.tsx`

---

### 20. manual-booking.spec.ts
- **Rader:** 77 | **Tester:** ~8 | **Status:** Pass (mobile skip)
- **Beskrivning:** Leverantör skapar manuell bokning direkt från kalender-vyn (+ Bokning-knappen). Dialog med service-select, datum, tid, kund-välj.
- **Förslag:** **STANNA**
- **Motivering:** Kräver kalender-kontext + dialog-interaktion + service-dropdown + datumnavigering. Integrerat med kalender-renderingen på ett sätt som är svårt att mocka. Mobile-skip är legitim (dialog timing differs).

---

### 21. municipality-watch.spec.ts
- **Rader:** 199 | **Tester:** ~28 | **Status:** Pass
- **Beskrivning:** Kund lägger till/tar bort kommunbevakningar (combobox med kommuner + tjänstetyp). Räknare, persistence vid sidladdning.
- **Förslag:** **FLYTTA → component**
- **Motivering:** Dominant concern är combobox-interaktion + CRUD i kundprofil. API-beteende är enkelt (create/delete watch). Combobox-suggestions är client-side eller enkel API-query. Component-test kan verifiera dropdown-rendering + add/remove utan browser.
- **Till:** `src/components/municipality/MunicipalityWatchCard.test.tsx`

---

### 22. no-show.spec.ts
- **Rader:** 185 | **Tester:** ~21 | **Status:** Pass med mobile-skips
- **Beskrivning:** Leverantör markerar bokning som "ej infunnit". Badge visas i kundens bokningslista. Varningsbadge i kundregister. Desktop-only: no-show-knapp i kalender-dialog.
- **Förslag:** **STANNA**
- **Motivering:** Äkta cross-domain state: leverantör agerar (markerar no-show) → kund ser förändrat badge i sin bokningslista. Kräver browser för att navigera mellan roller och verifiera visuell state-förändring.

---

### 23. offline-mutations.spec.ts
- **Rader:** 416 | **Tester:** ~22 | **Status:** Alla skip om OFFLINE_E2E saknas
- **Beskrivning:** Service Worker mutation queue: offline → kö mutation → optimistisk UI → reconnect → sync → verifiera serverstate. Kräver produktionsbuild med aktiv SW.
- **Förslag:** **STANNA**
- **Motivering:** Fundamentalt browser-specifikt (SW, context.setOffline(), IndexedDB). Kan inte replikeras utan browser. Kör i separat test-tier (npm run test:e2e:offline). Värdefullt att bevara -- offlinekvalitet kan inte testas på annat sätt.

---

### 24. offline-pwa.spec.ts
- **Rader:** 122 | **Tester:** ~20 | **Status:** Flesta skip om OFFLINE_E2E saknas
- **Beskrivning:** PWA manifest (URL, innehåll), offline-banner vid nätverksförlust, offline-sida (/~offline), Service Worker-baserade navigeringstester.
- **Förslag:** **STANNA**
- **Motivering:** SW- och offline-simulation är browser-specifikt. Manifest-testet (HTTP GET) KUNDE vara integration-test, men testet finns naturligt i offline-sviten. Offline-banner och offline-page kräver browser-rendering. Kör i separat offline-tier.

---

### 25. payment.spec.ts
- **Rader:** 337 | **Tester:** ~62 | **Status:** Kritiskt flaky -- heavy conditional skips
- **Beskrivning:** Stripe PaymentElement-flöde: kund betalar bekräftad bokning med Stripe-element.
- **Förslag:** **TA BORT**
- **Motivering:** Tre inbyggda test.skip(true) i beforeEach (test customer not found, no provider, no booking). Stripe rekommenderar att INTE E2E-testa PaymentElement (iframe-sandbox, card-element ej interagerbar). Gotcha i memory: "Stripe E2E -- mocka, inte riktig iframe". Payment-API-logiken (create payment intent, webhook dedup) täcks av `bookings/[id]/payment/route.integration.test.ts` + `webhooks/stripe/route.integration.test.ts` (finns redan).
- **Täcks redan av:** `src/app/api/bookings/[id]/payment/route.integration.test.ts`, `src/app/api/webhooks/stripe/route.integration.test.ts`

---

### 26. provider-notes.spec.ts
- **Rader:** 336 | **Tester:** ~31 | **Status:** Pass med mobile-skips (kalender-beroende)
- **Beskrivning:** Leverantörsanteckningar om kundbesök: skapa, redigera, ta bort. Visning i kalender-dialog (desktop) och i kundregister.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Kärnan är CRUD-API för anteckningar. Kalender-dialogintegration är browser-specifik men kalender-testerna STANNAR -- om anteckningar är kritiska i kalender-kontexten kan de läggas till calendar.spec.ts. Mobile-skips beror på "kalender-veckovy inte tillgänglig" -- inte på anteckningslogiken.
- **Till:** `src/app/api/provider/customers/[id]/notes/route.integration.test.ts`

---

### 27. provider-onboarding.spec.ts
- **Rader:** 189 | **Tester:** ~9 | **Status:** Pass
- **Beskrivning:** Nyregistrerad leverantörs onboarding-flöde: login → onboarding-checklist → fyll i profil → skapa tjänst → se checklistan uppdateras.
- **Förslag:** **STANNA**
- **Motivering:** Kritisk user journey för nytt kontos livscykel. Sträcker sig över auth, profil, service och onboarding-state. Skapar faktisk Supabase-user via Admin API -- kräver komplett stack. Endast 9 tester men hög affärsvikt.

---

### 28. provider-profile-edit.spec.ts
- **Rader:** 266 | **Tester:** ~30 | **Status:** Pass
- **Beskrivning:** Leverantörs profilredigering: personuppgifter, företagsinfo, cancel-flöde (återställer ursprungsvärden).
- **Förslag:** **FLYTTA → component**
- **Motivering:** Dominant concern är formulär-UI: edit/cancel-toggle, fältredigering, återställning vid cancel. Ingen cross-domain logik. API-save är enkel CRUD. Component-test kan verifiera form-state utan browser.
- **Till:** `src/components/provider/profile/ProviderProfileEditForm.test.tsx`

---

### 29. provider.spec.ts
- **Rader:** 321 | **Tester:** ~49 | **Status:** Pass med konditionella skips (no services/bookings)
- **Beskrivning:** Provider-dashboard: stat-kort, tjänstehantering (skapa, redigera, ta bort), bokning accept/reject, leverantörslista.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Tjänstehantering (CRUD) och bokningsaccept/-reject är API-beteende. Dashboard stat-kort är data-rendering. Konditionella skips ("No pending bookings") är data-dependent -- integration-tester med seeded data eliminerar detta problem.
- **Till:** `src/app/api/services/route.integration.test.ts`, `src/app/api/bookings/[id]/route.integration.test.ts` (utökas)

---

### 30. recurring-bookings.spec.ts
- **Rader:** 464 | **Tester:** ~53 | **Status:** Flaky -- konditionella skips + mobile-skips
- **Beskrivning:** Återkommande bokningsserie: skapa (desktop dialog), se serie, omboka enskild i serien, avboka serie.
- **Förslag:** **FLYTTA → integration** ⚠️ SPLIT-risk — verifiera under batch
- **Motivering:** BookingSeries-domänlogiken (skapa, omboka, avboka serie) är API-beteende. Integration-tester med explicit seed eliminerar de konditionella skip-problemen.
- **SPLIT-notering (verifiera under S43-2):** Desktop-boknings-dialogen (skapa återkommande bokning via kalender-dialog) är integrerad med kalender-vyn på samma sätt som manual-booking.spec.ts -- som klassas STANNA. Om dialog-interaktionen är tätt kopplad till kalender-renderingen kan den delen behöva STANNA som E2E. Verifiera under batch-arbetet. Ren API-logik (skapa/avboka/omboka BookingSeries) kan alltid till integration.
- **Till:** `src/app/api/booking-series/route.integration.test.ts` (API-logik; dialog-delen utreds under batch)

---

### 31. reschedule.spec.ts
- **Rader:** 331 | **Tester:** ~21 | **Status:** Pass med mobile-skip (kalender-dialog)
- **Beskrivning:** Leverantör föreslår ombokning (med kalenderinteraktion) → kund godkänner/avvisar förslaget → status uppdateras.
- **Förslag:** **STANNA**
- **Motivering:** Äkta cross-domain workflow: leverantör → kalenderinteraktion → skapar ombokningsförslag → kund tar beslut → båda parter ser uppdaterad status. Kräver browser för kalender-dialog + navigation mellan roller.

---

### 32. route-announcement-notification.spec.ts
- **Rader:** 379 | **Tester:** ~35 | **Status:** Pass
- **Beskrivning:** Kund följer leverantör → leverantör annonserar rutt → kund ser in-app-notifikation (generisk eller personaliserad med förfallen häst). Kräver FOLLOW_PROVIDER + DUE_FOR_SERVICE.
- **Förslag:** **STANNA**
- **Motivering:** Komplex cross-domain notifikationsflöde: follow-domänen + rutt-domänen + notifikations-domänen + due-for-service-domänen. Kräver verklig browser-navigation för att verifiera att notifikation dyker upp i UI. Svår att replikera med enbart API-anrop.

---

### 33. route-planning.spec.ts
- **Rader:** 235 | **Tester:** ~20 | **Status:** Flaky -- konditionella skips
- **Beskrivning:** Rutt-CRUD: skapa rutt, lägga till stopp, se ruttöversikt, markera stopp som slutförda.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Konditionella skips ("No route orders available", "No routes available") är data-dependent -- integration-tester med explicit seed löser detta. Rutt-CRUD är API-beteende. Inget cross-domain.
- **Till:** `src/app/api/routes/route.integration.test.ts`

---

### 34. security-headers.spec.ts
- **Rader:** 100 | **Tester:** ~10 | **Status:** Pass
- **Beskrivning:** HTTP response headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, XSS-Protection, Cross-Origin Policies.
- **Förslag:** **FLYTTA → integration** ⚠️ SPIKE krävs först
- **Motivering:** Logiken bör vara integration-testbar -- HTTP-headers kräver inte browser. Men Next.js security headers sätts i `next.config.ts` (headers-konfiguration), inte i en route-handler. Det är oklart om Vitest kan anropa Next.js-appen och få med dessa headers utan en test-server.
- **SPIKE (30 min, backlog):** Innan migration -- verifiera om supertest/testserver-mönster fungerar i Vitest-kontext. Om ja: FLYTTA → integration, ny fil `src/__tests__/security-headers.integration.test.ts`. Om nej: förblir E2E (STANNA) tills vi har Next.js test-server-setup. Spike ska inte blockera pilot eller Fas 3-batch.
- **Till (om spike lyckas):** `src/__tests__/security-headers.integration.test.ts`

---

### 35. unsubscribe.spec.ts
- **Rader:** 77 | **Tester:** ~10 | **Status:** Pass
- **Beskrivning:** Email-avprenumeration via HMAC-token: giltig länk → framgångssida, ogiltig token → felmeddelande, saknade parametrar → felmeddelande.
- **Förslag:** **FLYTTA → integration**
- **Motivering:** Testar `/api/email/unsubscribe`-endpoint som returnerar HTML-svar. Inget login. Ingen komplex UI-interaktion. Integration-test kan anropa route-handler direkt och assertera response-body (HTML-text). HMAC-token-generering kan återanvändas från `e2e/setup/e2e-utils.ts`.
- **Till:** `src/app/api/email/unsubscribe/route.integration.test.ts`

---

### 36. visual-regression.spec.ts
- **Rader:** 125 | **Tester:** ~22 | **Status:** Pass
- **Beskrivning:** Screenshot-baserad visuell regression: landing page, login, provider-dashboard, provider-bokningar, customer-sidor. Playwright `toHaveScreenshot()`.
- **Förslag:** **STANNA**
- **Motivering:** Per definition browser-specifikt. Visuell regression kräver faktiska skärmdumpar med browser-rendering. Kan inte replikeras med integration- eller unit-tester.

---

## Summary-tabell

| Spec | Rader | Tester | Status | Kategori |
|------|-------|--------|--------|----------|
| accepting-new-customers | 137 | ~14 | Pass | **STANNA** |
| admin | 359 | ~46 | Pass/mobile-skip | **FLYTTA → integration** |
| announcements | 456 | ~38 | Kritisk skip (8) | **TA BORT** |
| auth | 166 | ~20 | Pass | **FLYTTA → component** |
| booking | 432 | ~65 | Pass/data-skip | **STANNA** |
| business-insights | 207 | ~15 | Pass | **FLYTTA → integration** |
| calendar | 358 | ~30 | Pass/mobile-skip | **STANNA** |
| customer-due-for-service | 280 | ~28 | Pass | **FLYTTA → integration** |
| customer-insights | 120 | ~15 | Pass | **FLYTTA → integration** |
| customer-invite | 98 | ~10 | Pass | **FLYTTA → integration** |
| customer-profile | 142 | ~12 | Pass | **FLYTTA → component** |
| customer-registry | 129 | ~13 | Pass | **FLYTTA → integration** |
| customer-reviews | 205 | ~21 | Pass/data-skip | **STANNA** |
| due-for-service | 115 | ~8 | Pass | **FLYTTA → integration** |
| exploratory-baseline | 302 | ~27 | Pass/skip | **TA BORT** |
| feature-flag-toggle | 730 | ~94 | Pass/mobile+env-skip | **FLYTTA → integration** |
| follow-provider | 351 | ~47 | Pass | **FLYTTA → integration** |
| group-bookings | 220 | ~12 | Pass | **FLYTTA → integration** |
| horses | 172 | ~9 | Pass | **FLYTTA → component** |
| manual-booking | 77 | ~8 | Pass/mobile-skip | **STANNA** |
| municipality-watch | 199 | ~28 | Pass | **FLYTTA → component** |
| no-show | 185 | ~21 | Pass/mobile-skip | **STANNA** |
| offline-mutations | 416 | ~22 | Alla skip utan OFFLINE_E2E | **STANNA** |
| offline-pwa | 122 | ~20 | Flesta skip utan OFFLINE_E2E | **STANNA** |
| payment | 337 | ~62 | Kritisk skip (3 i beforeEach) | **TA BORT** |
| provider-notes | 336 | ~31 | Pass/mobile-skip | **FLYTTA → integration** |
| provider-onboarding | 189 | ~9 | Pass | **STANNA** |
| provider-profile-edit | 266 | ~30 | Pass | **FLYTTA → component** |
| provider | 321 | ~49 | Pass/data-skip | **FLYTTA → integration** |
| recurring-bookings | 464 | ~53 | Flaky/mobile+data-skip | **FLYTTA → integration** |
| reschedule | 331 | ~21 | Pass/mobile-skip | **STANNA** |
| route-announcement-notification | 379 | ~35 | Pass | **STANNA** |
| route-planning | 235 | ~20 | Flaky/data-skip | **FLYTTA → integration** |
| security-headers | 100 | ~10 | Pass | **FLYTTA → integration** |
| unsubscribe | 77 | ~10 | Pass | **FLYTTA → integration** |
| visual-regression | 125 | ~22 | Pass | **STANNA** |

### Totaler per kategori

| Kategori | Antal | Specs |
|----------|-------|-------|
| **STANNA** | **12** | accepting-new-customers, booking, calendar, customer-reviews, manual-booking, no-show, offline-mutations, offline-pwa, provider-onboarding, reschedule, route-announcement-notification, visual-regression |
| **FLYTTA → integration** | **16** | admin, business-insights, customer-due-for-service, customer-insights, customer-invite, customer-registry, due-for-service, feature-flag-toggle, follow-provider, group-bookings, provider-notes, provider, recurring-bookings, route-planning, security-headers, unsubscribe |
| **FLYTTA → component** | **5** | auth, customer-profile, horses, municipality-watch, provider-profile-edit |
| **TA BORT** | **3** | announcements, exploratory-baseline, payment |
| **Totalt** | **36** | |

---

## Pilot-kandidater (S43-1)

2 specs som representerar de två primära FLYTTA-kategorierna. security-headers utgick som pilot (se spike-notering under spec 34 -- Next.js headers sätts i next.config.ts, inte route-handler, oklart om Vitest kan anropa dem utan test-server).

### Pilot 1 (FLYTTA → integration): unsubscribe.spec.ts

**Motivering:**
- Liten (77 rader, 10 tester)
- Väldefinierad API-endpoint (`/api/email/unsubscribe`)
- HMAC-token-logik exporterad från `e2e/setup/e2e-utils.ts` -- kan importeras direkt i Vitest
- Testar HTML-response (inte JSON) -- visar att integration-tester kan assertera text/html-responses
- Enkel seed: bara `prisma.user.findUnique`
- Förväntad tidsvinst: ~30s E2E → <200ms integration

**Ny testfil:** `src/app/api/email/unsubscribe/route.integration.test.ts`

---

### Pilot 2 (FLYTTA → component): horses.spec.ts

**Pre-pilot verifiering (INNAN implementation):** Kontrollera att projektet har etablerat component-test-mönster med form-rendering + mock av services/Prisma. Sök i `src/**/*.test.tsx` efter existerande form-component-tester. Dokumentera fyndet i pilot-rapporten (S43-1):
- Om mönster finns: använd det direkt
- Om inget mönster finns: budgetera setup-kostnad i S43-1 (RTL-konfiguration, mock-strategi)

**Motivering:**
- Liten (172 rader, 9 tester)
- Form-CRUD i en dialog -- väldefinierad komponent
- Representerar FLYTTA → component-kategorin (5 specs totalt)
- HorseForm är självständig komponent utan external routing

**Ny testfil:** `src/components/horses/HorseForm.test.tsx`

---

## Fas 3-batch (S43-2)

Förutsatt **go** från pilot-rapporten. Första batch: 4-5 specs inom temat "data-display och CRUD-API".

**Tematisk samling: Data-display och CRUD-API (exkl. security-headers som kräver spike)**

| Spec | Kategori | Ny testfil | Rader | Motivering |
|------|----------|-----------|-------|------------|
| unsubscribe | Integration | `src/app/api/email/unsubscribe/route.integration.test.ts` | 77 | Piloten -- inkl i batch (alt. skip om pilot är batch) |
| due-for-service | Integration | `src/app/api/provider/due-for-service/route.integration.test.ts` | 115 | Liten, väldefinierad overdue-logik |
| customer-due-for-service | Integration | `src/app/api/customer/due-for-service/route.integration.test.ts` | 280 | Samma domän, kundvy -- naturlig pair |
| customer-insights | Integration | `src/app/api/customer/insights/route.integration.test.ts` | 120 | Liten, data-aggregering |
| customer-registry | Integration | `src/app/api/provider/customers/route.integration.test.ts` | 129 | Enkel list + search API |

**Total batch-storlek:** 5 specs, ~721 rader E2E → bort. Förväntad vinst: 5 × ~30s = ~2.5 min snabbare E2E.

**Skäl till denna batch:**
1. Alla fem är "data-display" specs -- hämtar data och visar den. Samma mönster.
2. Inga cross-domain beroenden.
3. Alla kan seedas med befintliga seed-helpers.
4. Inga mobile-skips att hantera.
5. Befintliga integration-tester finns för liknande routes (bookings, reviews) -- mönstret är bevisat.

---

## Kända risker inför S43-1 och S43-2

1. **security-headers → spike (inte pilot):** Next.js security headers sätts i `next.config.ts`, inte route-handler. Oklart om Vitest kan nå dessa headers utan en Next.js test-server (supertest/msw). Hanteras som separat 30-min spike i backlog, blockerar inte pilot eller Fas 3-batch.

2. **Unsubscribe HMAC-import:** `generateUnsubscribeTokenForTest` från `e2e/setup/e2e-utils.ts` -- kontrollera att den kan importeras i Vitest-kontext utan E2E-dependencies (Playwright-imports kan finnas transitivt).

3. **Horse component-test-mönster:** Kontrollera om projektet har etablerat component-test-mönster med form-rendering + mock av services. Om saknas: budgetera RTL-setup-tid i S43-1 (se pre-pilot-verifiering i Pilot 2).

4. **due-for-service tidsberäkning:** Intervall-logiken (90 dagar > 8 veckors intervall = förfallen) måste seedas med exakt timing -- integration-test-seed kan kontrollera detta bättre än E2E med verklig nuläges-timestamp.

5. **SPLIT-specs kräver mer tid per spec:** admin, feature-flag-toggle, follow-provider och recurring-bookings kräver att två ersättarfiler skrivs (integration + component) innan E2E-spec kan tas bort. Planera ~1.5x tid jämfört med ren migration.
