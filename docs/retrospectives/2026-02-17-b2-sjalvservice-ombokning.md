# Retrospektiv: B2 Självservice-ombokning

**Datum:** 2026-02-17
**Scope:** Komplett self-service reschedule-feature: schema, domain service, API, e-post, kund-UI, leverantörsinställningar

---

## Resultat

- 21 ändrade filer, 4 nya filer (+ 1 migration), 1 ny migration
- 41 nya tester (alla TDD, alla gröna)
- 1890 totala tester (inga regressioner, +41 från 1849)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~2 sessioner (33 + 34)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma`, migration `20260217100000` | 5 nya fält: Provider (rescheduleEnabled/windowHours/maxReschedules/requiresApproval), Booking (rescheduleCount) |
| Feature flags | `feature-flags.ts`, 3 testfiler | `self_reschedule` flagga (default true) |
| Repository | `IBookingRepository.ts`, `PrismaBookingRepository.ts`, `MockBookingRepository.ts`, `BookingMapper.ts` | `rescheduleWithOverlapCheck` med serializable transaction, alla select-block uppdaterade |
| Domain | `BookingService.ts`, `BookingService.test.ts` | `rescheduleBooking()` med 13 valideringssteg, 4 nya feltyper, 15 tester |
| API | `reschedule/route.ts`, `reschedule/route.test.ts` | PATCH med auth, feature flag, rate limit, Zod .strict(), 10 tester |
| E-post | `templates.ts`, `templates.test.ts`, `notifications.ts`, `index.ts` | `bookingRescheduleEmail()` + `sendBookingRescheduleNotification()` (kund + leverantör), 6 tester |
| Kund-UI | `customer/bookings/page.tsx`, `RescheduleDialog.tsx` | Omboka-knapp med villkor, ResponsiveDialog med datumväljare + tidsväljare |
| Leverantör-UI | `provider/profile/page.tsx`, `useProviderProfile.ts` | Ombokningsinställningar-card med 4 kontroller (switch, select, select, switch) |
| Provider API | `provider/profile/route.ts`, `route.test.ts` | 4 nya Zod-fält + uppdaterade select-block i GET/PUT, 3 tester |

## Vad gick bra

### 1. Fasuppdelningen mellan sessioner fungerade
Fas 1-3 (backend) byggdes i session 33, fas 4-8 (e-post + UI) i session 34. MEMORY.md gav tillräckligt kontext för att fortsätta utan friktionslöst. Inga glapp mellan sessionerna.

### 2. `/implement`-skill sparade tid i fas 4-8
Att skapa en plan och köra `/implement` istället för manuell fas-för-fas gav en rak pipeline: RED-GREEN per fas, typecheck mellan faser, automatisk slutverifiering. Totalt ~15 minuter för fas 4-8.

### 3. ResponsiveDialog-mönstret gav gratis mobil-stöd
Istället för att bygga separat mobil/desktop-dialog räckte det att använda befintliga `ResponsiveDialog`. All mobil-logik (Drawer vs Dialog) hanteras av den gemensamma komponenten.

### 4. Serializable transaction i repository
`rescheduleWithOverlapCheck` använder serializable isolering med overlap-exkludering av den egna bokningen. Förhindrar dubbelbokningar vid concurrent reschedule utan extra locking-kod.

## Vad kan förbättras

### 1. Reschedule API-routen triggar inte e-post
`sendBookingRescheduleNotification` finns men anropas inte från `PATCH /api/bookings/[id]/reschedule/route.ts`. Integration saknas -- e-posten måste anropas efter lyckad reschedule (som fire-and-forget, samma mönster som booking creation).

**Prioritet:** HÖG -- kunder och leverantörer får ingen notifikation om ombokning

### 2. Ingen tillgänglighetskontroll i RescheduleDialog
Kunden kan välja vilken dag/tid som helst i kalendern -- det finns ingen visualisering av leverantörens tillgängliga tider. BookingService validerar server-side, men användarupplevelsen är sämre än vid nybokning.

**Prioritet:** MEDEL -- server-validering fångar fel, men UX kan förbättras med availability-visning

### 3. Inget test för sendBookingRescheduleNotification
Notifikationsfunktionen saknar dedikerade unit-tester (till skillnad från templates som har 6). Mönstret i befintliga notifications.ts har inga tester alls, men nya funktioner bör ha det.

**Prioritet:** LÅG -- funktionen är enkel och följer befintligt mönster, men testtäckning bör läggas till

## Patterns att spara

### Reschedule med overlap-check
Serializable transaction som atomärt uppdaterar datum/tid, inkrementerar rescheduleCount, OCH verifierar överlapp -- exkluderar den egna bokningen från overlap-sökningen. Mönster att kopiera vid framtida move/swap-operationer.

### Inline settings med optimistisk UI
Provider-inställningar (rescheduleEnabled, windowHours, maxReschedules, requiresApproval) använder inline `onCheckedChange`/`onValueChange` som direkt anropar PUT-API:t och sedan kör `mutateProfile()`. Samma mönster som `acceptingNewCustomers` -- inget lokalt state att synka.

### Conditional settings UI
Ombokningsinställningar-kortet visar detalj-inställningar (fönster, max, godkännande) BARA om `rescheduleEnabled` är true. Reducerar visuellt brus och förenklar UX för leverantörer som inte vill erbjuda ombokning.

## 5 Whys (Root-Cause Analysis)

### Problem: E-postnotifikation integrerades inte i API-routen
1. Varför? Planen specificerade fas 4 (e-post) och fas 3 (API) som separata faser utan integrationssteg
2. Varför? Planen skrev fas 3 i session 33 och fas 4 i session 34 -- de var separata sessioner
3. Varför? Integration ansågs implicit -- "API anropar notification" -- men kodades aldrig explicit
4. Varför? Planen hade inget fas-steg för "koppla ihop API + notification"
5. Varför? Planmallen saknar "integrationschecklista" -- varje fas verifierar sig själv men inte kopplingar till andra faser

**Åtgärd:** Lägg till integrationssteg i planer som spänner över flera sessioner. Varje API-fas som producerar side-effects (e-post, notification) bör ha en explicit integrations-rad.
**Status:** Att göra

## Lärandeeffekt

**Nyckelinsikt:** Feature flags + inline provider-inställningar ger leverantörer full kontroll utan deploy. Men integrationen mellan lager (API -> notification) måste vara explicit i planen, inte implicit. "Bygg notifikation" != "Koppla notifikation till API."
