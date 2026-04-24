---
title: "Sprint 56: Sökning och transparens"
description: "Fyra gap-fixar från teater-analysen: kategori-filter, tjänstetyp-filter, transparent pending-status och review-uppmaning."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, search, ux, customer]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 56: Sökning och transparens

## Sprint Overview

**Mål:** Fixa fyra konkreta GAP identifierade i teater-genomgången "Johan bokar sin hovslagare".

**Källa:** `/Users/johanlindengard/Downloads/teater gapanalys.odt`

| Story | Gap | Effort |
|-------|-----|--------|
| S56-1 | GAP 1 — Kategori-ikoner på landningssidan filtrerar inte | 1-2h |
| S56-2 | GAP 2 — Ingen tjänstetyp-filter på /providers | 3-4h |
| S56-3 | GAP 6 — Pending-tillstånd ogenomskinligt | 1-2h |
| S56-4 | GAP 8 — Ingen review-uppmaning efter slutförd bokning | 2-3h |

**Inte i sprint:** GAP 3 (besöksområde geografiskt), GAP 4 (pre-booking messaging = Messaging Slice 5, backlog), GAP 5 (ruttplanering för kund = komplex), GAP 7 (läskvitton = backlog SUGGESTION-2), GAP 9 (leverantörs-notis vid recension = trivial, gör om tid finns).

---

## Stories

### S56-1: Kategori-ikoner på landningssidan navigerar till filtrerad sökning

**Prioritet:** 1
**Effort:** 1-2h
**Domän:** webb

**Problem:** De tre runda ikonerna (Veterinär, Hovslagare, Tränare) under sökrutan på landningssidan har ingen onClick. De ser klickbara ut men är enbart dekorativa. Kognitiv missanpassning mellan visuell affordance och beteende.

**Fix:** Wrap ikonerna i `Link` till `/providers?search=<kategori>`.

**Filer:**
- `src/app/page.tsx` — hitta kategori-ikonerna, lägg till navigering

**Implementation:**
Ikoner finns troligen som en lista med label + icon. Varje ikon ska länka till `/providers?search=Hovslagare` (etc). Använd befintligt `search`-param som redan stöds av `/providers`-sidan. Lägg till `cursor-pointer` och hover-state om det saknas.

**Acceptanskriterier:**
- [ ] Klick på "Hovslagare"-ikonen navigerar till `/providers?search=hovslagare` (eller liknande term som matchar tjänstetypen)
- [ ] Klick på "Veterinär" och "Tränare" gör detsamma
- [ ] Ikonerna har tydlig klickbar visuell stil (cursor, hover)

---

### S56-2: Tjänstetyp-filter på /providers-sidan

**Prioritet:** 2
**Effort:** 3-4h
**Domän:** webb

**Problem:** Sökning på `/providers` matchare på fritextfält (företagsnamn + beskrivning). Leverantörer som råkar nämna en tjänst i sin beskrivning dyker upp som falska positiva. Det finns ingen filtermöjlighet för "visa bara hovslagare" utan att förlita sig på fritext.

**Fix:** Lägg till ett tjänstetyp-dropdown/chipfiler ovanför sökresultaten. Filtrera på leverantörens faktiska tjänster (Service-tabellen i DB).

**Filer:**
- `src/app/api/providers/route.ts` — lägg till `serviceType`-queryparam som filtrerar på `Provider.services.name ILIKE %serviceType%`
- `src/app/providers/page.tsx` — lägg till filterchip/dropdown med vanliga kategorier
- `src/app/providers/ProviderFiltersDrawer.tsx` — lägg till i avancerade filter

**Implementation:**
1. API: `serviceType`-param → `where: { services: { some: { name: { contains: serviceType, mode: 'insensitive' } } } }`
2. UI: En rad med klickbara chips: "Alla", "Hovslagare", "Veterinär", "Hästterapeut", "Tränare". Aktiv chip markeras. Klick sätter `serviceType`-param i URL.
3. Kategorierna är hårdkodade i UI (inte från DB) — det räcker för MVP.

**Acceptanskriterier:**
- [ ] Filterchips visas ovanför sökresultaten
- [ ] Klick på "Hovslagare" visar bara leverantörer med en tjänst som matchar "hovslagare"
- [ ] Aktiv kategori är visuellt markerad
- [ ] "Alla" återställer filtret
- [ ] Kombineras med textfri sökning (båda filter aktiva samtidigt)
- [ ] Integrationstest för `?serviceType=hovslagare`-queryparam

---

### S56-3: Transparent pending-status på kundsidan

**Prioritet:** 3
**Effort:** 1-2h
**Domän:** webb

**Problem:** När en kund skapar en bokning visas "Väntar på bekräftelse" utan mer info. Kunden vet inte om leverantören fått notisen, om den lästs, eller vad som förväntas hända härnäst. "Pending-limbo."

**Fix:** Förbättra pending-state UX på kundvyn — utan schema-ändringar.

**Filer:**
- `src/app/customer/bookings/` — hitta bokningskort/-detalj, förbättra pending-state

**Implementation:**
Lägg till under "Väntar på bekräftelse"-badgen:
- Tidsangivelse: "Skapad för 2 timmar sedan"
- Förväntning: "Leverantören bekräftar vanligtvis inom ett dygn. Du får en notis när bokningen bekräftas."
- Länk till meddelanden (om bokning har chattmöjlighet): "Skicka ett meddelande till leverantören →"

**Acceptanskriterier:**
- [ ] Pending-bokningar visar tid sedan skapande
- [ ] Pending-bokningar visar förväntad svarstid som informativ text
- [ ] Om messaging är aktivt: länk till meddelandetråden visas
- [ ] Confirmed/cancelled-bokningar är opåverkade

---

### S56-4: Review-uppmaning efter slutförd bokning

**Prioritet:** 4
**Effort:** 2-3h
**Domän:** webb

**Problem:** "Skriv recension"-knappen sitter tyst i bokningskortet. Kunder som inte återkommer till appen glömmer att betygsätta. Leverantörernas rating växer långsammare än den skulle.

**Fix:** Visa en framträdande review-uppmaning i kundvyn för nyligen slutförda bokningar utan recension. Trigger: push-notis när bokning blir "completed".

**Filer:**
- `src/app/customer/bookings/page.tsx` (eller komponent) — lägg till "review-nudge"-banner/callout
- `src/app/api/bookings/[id]/route.ts` eller statusuppdateringsrouten — skicka push-notis till kund när status → "completed"

**Implementation:**
**Del 1 — In-app nudge (kunder som är i appen):**
Visa en callout-komponent högst upp på `/customer/bookings` om det finns bokningar som:
- status = "completed"
- reviewAvailable = true (eller: ingen Review-rad med booking.id)
- completed < 7 dagar sedan

Text: "Hoppas det gick bra med [tjänstnamn] hos [leverantör]! En recension hjälper andra kunder och leverantören."
Knapp: "Skriv recension" → öppnar ReviewDialog.

**Del 2 — Push-notis (kunder utanför appen):**
I statusuppdaterings-flödet (när leverantören markerar bokning som completed): skicka push till kunden:
"[Leverantörsnamn] markerade din bokning som slutförd. Hoppas det gick bra! Skriv gärna en recension."

Använd befintligt notis-system (Notification-modellen + push-infrastruktur).

**Acceptanskriterier:**
- [ ] Callout visas för completed-bokningar utan recension (senaste 7 dagar)
- [ ] Callout döljs när recension är skriven
- [ ] Push-notis skickas till kund när bokning markeras completed (om kunden har push-prenumeration)
- [ ] Ingen callout för redan recenserade bokningar
