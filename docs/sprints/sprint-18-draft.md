---
title: "Sprint 18: iOS Native -- Sista WebView-offloads"
description: "Migrera gruppbokningar, hjälp, annonserings-CRUD och profilbild till native SwiftUI"
category: sprint
status: active
last_updated: 2026-04-09
tags: [sprint, ios, native, swiftui, webview-migration]
sections:
  - Sprint Overview
  - Auth-strategi
  - Stories
  - Exekveringsplan
  - Sprint Retro Template
---

# Sprint 18: iOS Native -- Sista WebView-offloads

**Status:** Aktiv
**Sprint Goal:** Eliminera de kvarvarande WebView-offloads i leverantörsflödet. Efter sprinten ska alla dagliga skärmar vara native SwiftUI.

---

## Sprint Overview

Inventering (session 2026-04-09) visar att 12 av 16 skärmar redan är native.
Kvar som WebView:

| Skärm | Komplexitet | Beslut |
|-------|-------------|--------|
| Gruppbokningar (lista + matchning) | Medel | **Native** (S18-1) |
| Hjälpcenter (artiklar) | Låg | **Native** (S18-2) |
| Annonsering CRUD (skapa + detalj) | Medel | **Native** (S18-3) |
| Profilbild-uppladdning | Låg-medel | **Native** (S18-4) |
| Tillgänglighetsschema | Hög | **WebView** (later) |
| Ruttplanering (karta + OSRM) | Mycket hög | **WebView** (later) |
| Voice logging (speech + AI) | Mycket hög | **WebView** (later) |
| Radera konto | Sällan använd | **WebView** (later) |

**Kvar som WebView efter sprinten:** Ruttplanering, voice logging, tillgänglighetsschema, radera konto -- alla antingen mycket komplexa eller sällan använda.

---

## Auth-strategi

Alla berörda webb-endpoints använder **session-auth** (Supabase cookies).
iOS-appen har **Bearer JWT** (MobileToken i Keychain).

**Approach per story:**

| Story | Nya endpoints? | Motivering |
|-------|---------------|------------|
| S18-1 Gruppbokningar | Ja, `/api/native/group-bookings` | Befintliga endpoints kräver session. Aggregerat API minskar roundtrips. |
| S18-2 Hjälp | Nej | Artiklarna är statisk data -- bäddas in i appen |
| S18-3 Annonsering | Delvis | Lista redan native. Skapa + detalj behöver native endpoints |
| S18-4 Profilbild | Ja, `/api/native/upload` | Upload-endpoint kräver session idag |

---

## Stories

### S18-1: Gruppbokningar native -- ios

**Prioritet:** Hög
**Typ:** iOS native-migrering
**Feature flag:** `group_bookings`
**Beskrivning:** Migrera gruppboknings-listan och matchnings-flödet till native SwiftUI.
Leverantören ser öppna gruppförfrågningar i sitt område, kan matcha och skapa bokningar.

**Webb-inventering:**

*Lista (`/provider/group-bookings`):*
- Geo-filtrering: adress-sök + "min position" + radius (25/50/100 km)
- Kort per förfrågan: serviceType, plats, datum, antal deltagare, status
- Tap -> detalj

*Detalj (`/provider/group-bookings/[id]`):*
- Förfrågningsinfo: serviceType, plats, datumintervall, specialinstruktioner
- Deltagarlista: namn, antal hästar, hästnamn, status
- Match-dialog: välj tjänst + datum + tid -> skapa N bokningar

**Uppgifter:**

1. **API** (`/api/native/group-bookings`):
   - GET `/api/native/group-bookings/available?lat=X&lng=Y&radius=Z` -- lista öppna förfrågningar med avstånd
   - GET `/api/native/group-bookings/[id]` -- detalj med deltagare
   - POST `/api/native/group-bookings/[id]/match` -- matcha (serviceId, bookingDate, startTime)
   - Auth: `authFromMobileToken()` (Bearer JWT)
   - Rate limiting, Zod-validering

2. **iOS modeller** (`GroupBookingModels.swift`):
   - `GroupBookingRequest`: id, serviceType, locationName, address, lat, lng, dateFrom, dateTo, maxParticipants, status, notes, participantCount, distance
   - `GroupBookingDetail`: allt ovan + participants[]
   - `GroupBookingParticipant`: id, numberOfHorses, horseName, notes, status, firstName
   - `GroupBookingMatchRequest`: serviceId, bookingDate, startTime

3. **iOS ViewModel** (`GroupBookingsViewModel.swift`):
   - Hämta lista med geo-filter (CoreLocation för "min position")
   - Hämta detalj
   - Matcha förfrågan (optimistisk UI)
   - Filter: radius-picker state
   - Geocoding via CLGeocoder (ersätter `/api/geocode`)

4. **iOS vyer**:
   - `NativeGroupBookingsView.swift` -- lista med sökning + radius-filter
   - Detalj i navigationDestination -- info + deltagare + match-knapp
   - Match-sheet: välj tjänst (Picker), datum (DatePicker), tid (DatePicker) -> bekräfta

5. **Koppling i NativeMoreView**: Byt WebView-fallback till native vy

**Acceptanskriterier:**
- [ ] Lista visar öppna förfrågningar med avstånd från leverantörens position
- [ ] Geo-filtrering fungerar (adress-sök eller CoreLocation)
- [ ] Detalj visar deltagare med hästar och status
- [ ] Match-dialog: välj tjänst + datum + tid, skapar bokningar
- [ ] Feature flag-gate på både API och UI
- [ ] Offline: visa cachad lista, blockera match vid offline
- [ ] Tester: ViewModel + API routes

**Effort:** 1.5-2 dagar

---

### S18-2: Hjälpcenter native -- ios

**Prioritet:** Medel
**Typ:** iOS native-migrering
**Feature flag:** `help_center`
**Beskrivning:** Bädda in hjälpartiklar i appen som native SwiftUI-vyer.
Artiklarna är statisk data (ingen API) -- perfekt för native.

**Webb-inventering:**

- Sök-fält med debounce (söker i titel, sammanfattning, nyckelord, innehåll)
- Accordion-sektioner grupperade per `section`
- Artikelvy: titel, sektion-badge, innehållsblock (paragrafer, steg-listor, punkt-listor)

**Uppgifter:**

1. **Artikeldata i Swift** (`HelpArticles.swift`):
   - Porta artiklar från `src/lib/help/articles.provider.ts` till Swift structs
   - Struct: `HelpArticle` (slug, title, section, summary, keywords, content)
   - Content som enum: `.paragraphs([String])`, `.steps([String])`, `.bullets([String])`
   - Statisk array -- ingen API behövs

2. **iOS ViewModel** (`HelpViewModel.swift`):
   - Sök-funktion (filtrerar på title, summary, keywords, content)
   - Gruppering per sektion

3. **iOS vyer**:
   - `NativeHelpView.swift` -- sökfält + sektioner med DisclosureGroup
   - Artikelvy i navigationDestination -- renderar innehållsblock

4. **Koppling i NativeMoreView**: Lägg till native vy för `/provider/help`

**Acceptanskriterier:**
- [ ] Alla provider-artiklar visas grupperade per sektion
- [ ] Sök filtrerar i realtid
- [ ] Artikelvy renderar paragrafer, steg-listor och punkt-listor
- [ ] Feature flag-gate
- [ ] Fungerar offline (all data lokal)
- [ ] Tester: HelpViewModel (sök, filtrering)

**Effort:** 0.5 dag

---

### S18-3: Annonsering CRUD native -- ios

**Prioritet:** Hög
**Typ:** iOS native-migrering
**Feature flag:** `route_announcements`
**Beskrivning:** Komplettera annonserings-flödet med native skapa-formulär och detaljvy.
Listan är redan native (NativeAnnouncementsView). Kvar: skapa annons + visa detalj med bokningar.

**Webb-inventering:**

*Skapa (`/provider/announcements/new`):*
- Multi-select: tjänster (checkboxes)
- Dropdown: kommun (MunicipalitySelect)
- Datumintervall: dateFrom + dateTo
- Textarea: specialinstruktioner (valfri)

*Detalj (`/provider/announcements/[id]`):*
- Annonsinfo: tjänst, datum, kommun, status, instruktioner
- Bokningssammanfattning: totalt, pending, confirmed
- Per bokning: kund, häst, tid, status + bekräfta/avboka-knappar

**Uppgifter:**

1. **API** (utöka befintliga native endpoints):
   - POST `/api/native/announcements` -- skapa annons (serviceIds, dateFrom, dateTo, municipality, specialInstructions)
   - GET `/api/native/announcements/[id]` -- detalj med bokningar
   - PATCH `/api/native/announcements/[id]/bookings/[bookingId]` -- uppdatera bokningsstatus
   - Auth: `authFromMobileToken()`

2. **iOS modeller** (utöka `AnnouncementModels.swift`):
   - `AnnouncementDetail`: allt från lista + bokningar[], specialInstructions
   - `AnnouncementBooking`: id, bookingDate, startTime, endTime, status, customerName, serviceName, horseName
   - `CreateAnnouncementRequest`: serviceIds, dateFrom, dateTo, municipality, specialInstructions

3. **iOS ViewModel** (utöka `AnnouncementsViewModel.swift`):
   - `createAnnouncement()` -- POST med formulärdata
   - `loadDetail(id)` -- GET detalj
   - `updateBookingStatus(announcementId, bookingId, status)` -- PATCH

4. **iOS vyer**:
   - `AnnouncementFormSheet.swift` -- formulär som .sheet (multi-select tjänster, kommun-picker, datumintervall, instruktioner)
   - `AnnouncementDetailView.swift` -- annonsinfo + bokningslista med bekräfta/avboka
   - Uppdatera `NativeAnnouncementsView` -- ersätt `onNavigateToWebPath` med native navigation

5. **Kommun-data**: Porta kommunlistan till Swift (statisk array eller hämta från API)

**Acceptanskriterier:**
- [ ] Skapa annons: välj tjänster + kommun + datum -> publicera
- [ ] Detaljvy: visa annonsinfo + bokningar med status
- [ ] Bekräfta/avboka bokningar direkt i detaljvyn
- [ ] Feature flag-gate
- [ ] Optimistisk UI vid statusändring
- [ ] Tester: ViewModel (skapa, detalj, statusändring)

**Effort:** 1-1.5 dagar

---

### S18-4: Profilbild native -- ios

**Prioritet:** Medel
**Typ:** iOS native-migrering
**Beskrivning:** Byt ut WebView-offload för profilbildsuppladdning mot native PhotosPicker.
Ger snabbare, snyggare upplevelse med native bildväljare och komprimering.

**Webb-inventering:**

- Drag-and-drop / filväljare
- Klientsidekomprimering (max 1MB, 1200px)
- POST FormData till `/api/upload` (bucket: "avatars", entityId: providerId)
- Uppdaterar Provider.profileImageUrl

**Uppgifter:**

1. **API** (`/api/native/upload`):
   - POST multipart upload med Bearer auth
   - Samma logik som `/api/upload` men med `authFromMobileToken()`
   - Returnerar URL

2. **iOS implementation** (i `NativeProfileView.swift`):
   - `PhotosPicker` (SwiftUI, iOS 16+) för bildval
   - Komprimering: `UIImage` -> JPEG-data (maxSize 1MB, compressionQuality stegvis)
   - Upload via `APIClient.uploadImage(data:)` -- multipart/form-data
   - Uppdatera profilbild i ViewModel efter lyckad upload
   - Progress-indikator under upload

3. **APIClient-utökning**:
   - `uploadProfileImage(imageData: Data) async throws -> String` (returnerar URL)
   - Multipart form-data encoding

**Acceptanskriterier:**
- [ ] Tap på profilbild öppnar PhotosPicker
- [ ] Vald bild komprimeras och laddas upp
- [ ] Profilbild uppdateras i UI efter upload
- [ ] Felhantering: för stor fil, nätverksfel, serverfel
- [ ] Tester: ViewModel (upload-flow mock)

**Effort:** 0.5 dag

---

### S18-5: Tillgänglighetsschema-polish (bonus) -- ios

**Prioritet:** Låg
**Typ:** iOS UX-förbättring
**Beskrivning:** Om tid finns -- bygg native vy för tillgänglighetsschemat
(`/provider/profile?tab=availability`). Idag offloadas till WebView.
Komplex men viktig för dagligt bruk.

**Uppskattning:** 1.5-2 dagar. Markerad som bonus -- tas bara om S18-1-4 går snabbt.

---

## Exekveringsplan

```
Fas 1 (grund):        S18-2 Hjälpcenter (0.5 dag, ingen API, snabb start)
                         |
Fas 2 (parallellt):   S18-4 Profilbild (0.5 dag) + S18-3 Annonsering CRUD (1-1.5 dag)
                         |                              |
Fas 3:                S18-1 Gruppbokningar (1.5-2 dag, störst scope)
                         |
Fas 4 (bonus):        S18-5 Tillgänglighetsschema (om tid finns)
                         |
Sprint-avslut:        iOS-testsvit + visuell verifiering + docs + retro
```

**Motivering:**
- S18-2 (Hjälp) först -- ingen API, bygger förtroende, snabb leverans
- S18-4 (Profilbild) och S18-3 (Annonsering) parallelliserbara (olika filer)
- S18-1 (Gruppbokningar) sist -- störst scope, drar nytta av mönster etablerade i S18-3

**Total effort:** ~3.5-4.5 dagar (exkl. bonus)

---

## Gemensamma mönster (alla stories)

**Native Screen Pattern** (CLAUDE.md):
0. Feature Inventory (OBLIGATORISKT) -- redan gjord ovan
1. Aggregerat API med Bearer auth
2. Codable structs + unknown-fallback
3. SharedDataManager-cache (5min TTL)
4. @State-baserad vy med callbacks
5. Tab-nav via callback, icke-tab via pendingMorePath
6. Cache-clear i AuthManager.logout()
7. Widget membershipExceptions om SharedDataManager refererar

**Auth:** Alla nya endpoints använder `authFromMobileToken()` (Bearer JWT).
**Tester:** ViewModel-tester (XCTest) + API route-tester (Vitest BDD dual-loop).
**Visuell verifiering:** mobile-mcp screenshots efter varje story.

---

## Sprint Retro Template

### Levererat

### WebView-status efter sprinten

### Vad gick bra?

### Vad kunde förbättras?

### Lärdomar för framtida native-migrering
