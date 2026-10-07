---
title: "UX-förbättringar -- Backlog"
description: "UX-backlog fran branschjamforelse med Booksy, Acuity och Calendly"
category: idea
tags: [ux, backlog, booking, recurring, waitlist, calendar-sync]
status: active
last_updated: 2026-10-01
sections:
  - Implementerat
  - B-kategori -- Medelstor insats
  - C-kategori -- Större insats
  - Prioriteringsförslag
  - "Design-debt: Leverantörskalendern (Impeccable-kritik 2026-09-29)"
---

# UX-förbättringar -- Backlog

> Idéer från UX-analys 2026-02-17, jämförelse mot branschledande bokningsappar (Booksy, Acuity, Calendly).
> A-kategori implementerades i session 30. B- och C-kategori sparas här för framtida implementation.

---

## Implementerat

| # | Feature | Status |
|---|---------|--------|
| A1 | Dashboard-trendgrafer (bokningar/vecka + intäkter/månad) | Klart |
| A2 | Kund-onboarding-checklista (4 steg) | Klart |
| A3 | Delad EmptyState-komponent (4 vyer) | Klart |
| A4 | Förbättrade Quick Actions + klickbara KPI-kort | Klart |
| B1 | Bokningspåminnelser 24h (e-post + in-app, opt-out) | Klart |
| B3 | Affärsinsikter (tjänsteanalys, tidsanalys, kundretention, KPIs) | Klart |
| B4 | No-show-spårning (status, UI, kundregister, insikter) | Klart |
| B2 | Självservice-ombokning (feature flag `self_reschedule`) | Klart |
| C1 | Återkommande bokningar (BookingSeriesService, feature flag `recurring_bookings`) | Klart |

---

## B-kategori -- Medelstor insats

### ~~B1: Bokningspåminnelser~~ (Implementerad 2026-02-17)

Implementerad i session 30. E-postpåminnelser 24h före bokning med checklista, in-app-notifikation, unsubscribe via HMAC-token, opt-out via profil. Cron kör 06:00 UTC dagligen.

---

### ~~B2: Självservice-ombokning~~ (Implementerad 2026-02-18)

Implementerad med feature flag `self_reschedule`. Inkluderar:
- API route `/api/bookings/[id]/reschedule` med ägarskapskontroll
- Konfigurerbar deadline per leverantör (minsta antal timmar innan)
- Max antal ombokningar per bokning
- Kund-UI för att välja ny tid från tillgängliga tider
- Bokningshistorik-spårning (reschedule count)

---

### ~~B3: Affärsinsikter (utökade)~~ (Implementerad 2026-02-17)

Implementerad i session 32. Ny sida `/provider/insights` med:
- KPI-kort (avbokningsgrad, no-show-grad, snittbokningsvärde, unika kunder, manuella bokningar)
- Populäraste tjänster (horisontell BarChart med intäkt per tjänst)
- Tidsanalys (heatmap: dag x timme)
- Kundretention (LineChart: nya vs återkommande kunder per månad)
- Period-selector (3/6/12 månader)
- Feature flag: `business_insights`

---

### ~~B4: No-show-spårning~~ (Implementerad 2026-02-17)

Implementerad i session 31. 27 filer, 1815 tester. Inkluderar:
- `no_show`-status i state machine (confirmed -> no_show, terminal)
- "Ej infunnit"-knapp i bokningslista + kalendervy
- Orange badge per kund i kundregistret (varning vid 2+)
- No-show-data i AI-kundinsikter
- Rate limiting tillagd i bookings/[id] (pre-existing fix)

---

## C-kategori -- Större insats

### ~~C1: Återkommande bokningar~~ (Implementerad 2026-02-17, session 38)

Implementerad i session 38 (mergad commit 3df242c). Feature flag `recurring_bookings`. Inkluderar:
- `BookingSeries`-modell med intervall (veckor/månader) och antal tillfällen
- `BookingSeriesService` för skapande och hantering av serier
- 3 API routes (skapa serie, lista serier, hantera enskilda tillfällen)
- Provider settings för att aktivera/konfigurera återkommande bokningar
- Kund- och leverantörs-UI
- Retro: `docs/retrospectives/2026-02-17-c1-aterkommande-bokningar.md`

---

### C2: Väntlista

**Problem:** När alla tider är bokade har kunden inget sätt att visa intresse. Leverantören missar potentiella bokningar.

**Lösning:**
- "Ställ dig i kö"-knapp på fullbokade tider
- Automatisk notifiering när en tid blir ledig
- Leverantören ser väntlistans storlek per tidsslot

**Insats:** Stor -- ny datamodell (WaitlistEntry), event-driven notifiering vid avbokning, race condition-hantering.

---

### C3: Kalendersynk

**Problem:** Leverantörer och kunder har sina bokningar på ett ställe (Equinet) men resten av sitt schema i Google Calendar/Outlook.

**Lösning:**
- Export: iCal-feed (URL som kan prenumereras på)
- Import: Läs leverantörens externa kalender och blockera tider automatiskt (tvåvägssynk)

**Insats:** Stor -- iCal-generering (enklare), OAuth + API-integration för tvåvägssynk (komplex).

**Rekommendation:** Börja med envägs iCal-export (1-2 dagars arbete). Tvåvägssynk i senare fas.

---

## Prioriteringsförslag

```
Klart:       B2 (ombokning), C1 (återkommande bokningar)
Nästa:       C3 (iCal-export) -- snabb win, 1-2 dagars arbete
Framtida:    C2 (väntlista) -- större projekt, event-driven arkitektur
```

---

## Design-debt: Leverantörskalendern (Impeccable-kritik 2026-09-29)

> **Detta är en analys/backlog, INTE beslutade designändringar.** En `/impeccable critique`-genomlysning av leverantörskalendern (`src/app/provider/calendar/page.tsx` + `WeekCalendar`/`MonthCalendar`/`BookingDetailDialog`/`ProviderRescheduleDialog`) kördes 2026-09-29, efter att `v0.3.0` redan var släppt i produktion. Fullständig rapport: [`.impeccable/critique/2026-09-29T15-15-16Z__src-app-provider-calendar-page-tsx.md`](../../.impeccable/critique/2026-09-29T15-15-16Z__src-app-provider-calendar-page-tsx.md) (Design Health Score 23/40, "Acceptabel"). Beslut: låt en användare prova `v0.3.0` i befintligt skick först och väg samman denna analys med faktisk feedback innan något av punkterna nedan prioriteras in i en sprint.

| # | Fynd | Användarpåverkan | Yta/komponent | Prioritet | Föreslagen verifiering | Status |
|---|------|-------------------|----------------|-----------|--------------------------|--------|
| D1 | Klicka-för-att-boka i veckovyn saknar tangentbordsstöd (`role`/`tabIndex`/`onKeyDown`) -- `MonthCalendar` har mönstret korrekt, `WeekCalendar` saknar det helt | Tangentbordsanvändare kan inte skapa en bokning alls i standardvyn (vecka är default på desktop) -- fullständig uppgiftsblockering, inte bara friktion | `src/components/calendar/WeekCalendar.tsx` (dagkolumnens klick-handler) | P0 | Tangentbordsnavigering (Tab + Enter/Space) genom veckovyn i en E2E- eller manuell test; jämför med `MonthCalendar`s redan fungerande mönster | Åtgärdad 2026-10-01 (PR #529) |
| D2 | Flera interaktiva element understiger produktens egna 44px-touch-target-golv (`BookingBlock` 28px, vyväxlingsknappar 32px, färgkod-toggle utan padding) | Svårare att träffa rätt tappmål på mobil, där leverantören ofta använder appen enhandsfattat mellan uppdrag | `src/components/calendar/BookingBlock.tsx`, `src/components/calendar/CalendarHeader.tsx`, `src/app/provider/calendar/page.tsx` (färgkod-knapp) | P1 | Mät faktisk renderad höjd/bredd på berörda element i Chrome DevTools vid 390px bredd; jämför mot det dokumenterade 44px-golvet i `DESIGN.md` | Åtgärdad 2026-10-01 (PR #530) |
| D3 | Bokningsstatus (väntande/bekräftad/avbokad/genomförd) renderas med tre oberoende, inbördes avvikande färgimplementationer inom samma feature (`BookingBlock`, `BookingDetailDialog`, `MonthCalendar`), som inte matchar sidans egen färgkod-legend | Legenden lär ut fel färgkod för minst en av vyerna -- användaren kan inte lita på att en given färg betyder samma sak överallt i kalendern | `src/components/calendar/BookingBlock.tsx`, `src/components/calendar/BookingDetailDialog.tsx`, `src/components/calendar/MonthCalendar.tsx`, `src/app/provider/calendar/page.tsx` (`LEGEND_ITEMS`) | P1 | Visuell sida-vid-sida-jämförelse av samma bokningsstatus i alla tre vyer + legenden; se även den redan dokumenterade "Duplicated Status Rule" i `DESIGN.md` | Åtgärdad 2026-10-01 för kalendern och 5 bokningsytor via delad `booking-status`-modul (refactor T3) |
| D4 | Månadsvyn kommunicerar bokningsstatus enbart via färg på mobil -- tjänstenamnet döljs (`hidden md:inline`), ingen statusikon | Användare som inte kan skilja på liknande färger (eller inte har lärt sig legenden) får ingen alternativ signal för att avgöra bokningsstatus på mobil | `src/components/calendar/MonthCalendar.tsx` | P2 | Manuell granskning vid 390px bredd; kontrollera mot WCAG "använd inte enbart färg för att förmedla information" | Åtgärdad 2026-10-01: månadsvyns chips är knappar med statusikon (samma ikoner som `BookingBlock`) och `aria-label` med tid, tjänst och status; verifierat på 360/375/390/412 px utan textspill |
| D5 | De två handkodade popup-vyerna (`slotPopup`, `dayPopup`) saknar `role="dialog"`, fokushantering och Escape-stängning, till skillnad från de Radix-baserade dialogerna på samma sida | Skärmläsaranvändare får ingen signal om att en popup öppnats; tangentbordsanvändare kan inte stänga den med Escape som de kan med alla andra dialoger på sidan | `src/components/calendar/WeekCalendar.tsx`, `src/components/calendar/MonthCalendar.tsx` | P2 | Manuell VoiceOver/tangentbordsgenomgång; jämför beteende mot `BookingDetailDialog`/`ProviderRescheduleDialog` | Åtgärdad 2026-10-01 (PR #533 + denna PR): båda popuparna är `role="dialog"` med namn, flyttar fokus vid tangentbordsöppning, stänger med Escape och återställer fokus. Ingen fokusfälla (popuparna är icke-modala med avsikt); Tab lämnar dem utan att stänga |
| D6 | Veckovyns dagkolumn är `role="button"` och innehåller fokuserbara bokningsblock (nästlade interaktiva element). Mönstret speglar `MonthCalendar`, men ARIA behandlar barnen till en knapp som presentationella | Skärmläsare kan utelämna bokningarna i kolumnen -- bör verifieras innan det räknas som problem | `src/components/calendar/WeekCalendar.tsx` (dagkolumnen, ~rad 344) | P2 | **Skärmläsartest (VoiceOver + tangentbord)** av veckovyn. Om bokningarna inte annonseras: byt till ett syskon-overlay (`<button>` bakom `BookingBlock`) i stället för `role="button"` på kolumnen. Gäller även `MonthCalendar` | Ej reproducerad i Chromium (2026-10-01): Chromiums tillgänglighetsträd (CDP `Accessibility.getFullAXTree`) listar bokningsblocken i veckovyn som `button`, `ignored=false`, trots nästlingen. Veckovyn orörd. VoiceOver/Safari ej testat. I månadsvyn är problemet undanröjt (datumknapp bredvid chipsen, inga nästlade element). Kvar: testa veckovyn i VoiceOver |
| D6b | Månadsvyns bokningschips var `div onClick` utan `role`/`tabIndex`: 0 av 8 fokuserbara och osynliga som åtgärdbara för skärmläsare. Det gick inte att öppna en bokning från månadsvyn med tangentbord | Tangentbordsanvändare och skärmläsare kunde inte öppna bokningar i månadsvyn (samma klass av fel som D1) | `src/components/calendar/MonthCalendar.tsx` | P1 | Verifierat i Chromium (tabIndex, tillgänglighetsträd) före och efter | Åtgärdad 2026-10-01: chips är `button`, cellen är inte längre `role=button` utan har en riktig datumknapp |
| D7 | Bokningsstatus har en kvarvarande etikettkälla utanför `components/booking/booking-status.ts`: `formatBookingStatus` i `src/lib/utils/booking.ts` ger "Väntande" (modulen säger "Väntar på svar"); funktionen anropas idag bara av sin egen test, alltså sannolikt död kod. Adminfiltrets `SelectItem` och `admin/page.tsx` använder också "Väntande" | Samma status har två benämningar i appen (badge: "Väntar på svar", filter/statistik: "Väntande") | `src/lib/utils/booking.ts` (+ `booking.test.ts` som låser texten), `src/app/admin/bookings/page.tsx`, `src/app/admin/page.tsx` | P2 | Besluta enhetlig benämning (UX-beslut, inte teknik); ta bort `formatBookingStatus` om den bekräftas oanvänd. Statusar i andra domäner (gruppbokning, rutt-annonser, buggrapporter, verifiering, mutationskö) har egna kopior och är ett separat spår | Åtgärdad 2026-10-01: `formatBookingStatus` (oanvänd, bara dess egen test) borttagen. Beslut: adminfilter/statistik behåller samlingsformerna ("Väntande", "Bekräftade", "Genomförda"); badgen säger "Väntar på svar". Statusar i andra domäner är fortsatt ett separat spår |
| D8 | `dayPopup` i månadsvyn hamnade delvis utanför skärmen för första/sista kolumnen: tangentbordsöppnad popup i måndagskolumnen på desktop (vänsterkant −67 px, regression från #537 som centrerade på datumknappen i stället för cellen) och mus/tryck i ytterkolumnerna på mobil (äldre: `clientX − gridRect.left` med `-translate-x-1/2` och `w-48`) | Knapparna i popupen kunde bli oåtkomliga eller klippta vid skärmkanten, särskilt på 360–412 px | `src/components/calendar/MonthCalendar.tsx` (`clampPopupLeft`) | P1 | Uppmätt på preview-deploymenten (87354fd2) före och lokalt efter, 1280/412/390/360 px, tangentbord och mus | Åtgärdad 2026-10-07: popupens centrum begränsas till gridets bredd; alla 20 uppmätta positioner inom skärmen, mittkolumnen oförändrad |

**Ej med i tabellen men noterat i rapporten** (mindre observationer, se fullständig rapport): terminologimismatch i avvisnings-dialogen ("Avboka bokning?" vid "Avvisa"), saknad laddningsindikator på statusknappar i `BookingDetailDialog`, triplicerad `getStatusStyles`/`getStatusLabel`-logik, samt en flytande röstlogg-FAB som i en skärmdump observerades överlappa en tidslucka i kalendergridet på mobil (bör verifieras separat, inte bekräftat som ett faktiskt klickproblem).

---

*Skapad: 2026-02-17, uppdaterad: 2026-10-07 (D1-D5 åtgärdade, D6 ej reproducerad i Chromium, D6b tillagd och åtgärdad, D7 åtgärdad, D8 popup vid skärmkant tillagd och åtgärdad)*
