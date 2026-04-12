---
title: "Inventering: WebView-vyer att migrera till native SwiftUI"
description: "Komplett kartlaggning av ALLA WebView-skarmar i iOS-appen, inklusive feature-flaggade, med tier-baserad prioritering"
category: ios-strategy
status: draft
last_updated: 2026-03-14
sections:
  - Context
  - Komplett oversikt
  - Tier 1 Alltid synliga
  - Tier 2 Feature-flaggade
  - Tier 3 Avvakta
  - Prioritetsordning
  - Gemensamma monster
  - Nasta steg
tags: [ios, swiftui, native, webview, migration]
related:
  - docs/superpowers/specs/2026-03-12-ios-native-first-rebuild-design.md
  - docs/plans/native-ios-analysis.md
---

# Inventering: WebView -> Native SwiftUI

## Context

iOS-appen ar hybrid -- vissa skarmar ar native SwiftUI, andra laddar webbsidor i WKWebView. Native vyer ger battre UX (snabbare, offline-cache, haptics, native gestures). Vi har redan migrerat Kalender och Hjalp till native. Denna inventering kartlagger ALLA WebView-skarmar -- bade synliga och feature-flaggade -- och foreslar prioritetsordning.

---

## Komplett översikt: Alla skarmar

### Redan native (klart)

| Skarm | Typ |
|-------|-----|
| Login / Biometric | Native SwiftUI |
| Kalender (Tab 2) | Native SwiftUI |
| Hjalp (Mer -> Hjalp) | Native SwiftUI |
| Logga ut | Native SwiftUI |

### Alltid synliga WebView-skarmar (provider)

| Skarm | Webb-URL | Komplexitet |
|-------|----------|-------------|
| **Översikt / Dashboard (Tab 1)** | `/provider/dashboard` | Medel |
| **Bokningar (Tab 3)** | `/provider/bookings` | Hog |
| **Mina tjänster (Mer)** | `/provider/services` | Medel |
| **Kunder (Mer)** | `/provider/customers` | Hog |
| **Recensioner (Mer)** | `/provider/reviews` | Lag-Medel |
| **Min profil (Mer)** | `/provider/profile` | Hog |

### Feature-flaggade WebView-skarmar (provider) -- DOLDA I APPEN

| Skarm | Feature flag | Webb-URL | Default | Komplexitet |
|-------|-------------|----------|---------|-------------|
| **Rostloggning** | `voice_logging` | `/provider/voice-log` | ON | Medel-Hog |
| **Ruttplanering** | `route_planning` | `/provider/route-planning` | ON | Hog |
| **Rutt-annonser** | `route_announcements` | `/provider/announcements/*` | ON | Medel |
| **Besoksplanering** | `due_for_service` | `/provider/due-for-service` | ON | Medel |
| **Affarinsikter** | `business_insights` | `/provider/insights` | ON | Medel |
| **Gruppbokningar** | `group_bookings` | `/provider/group-bookings/*` | ON | Medel-Hog |
| **Aterk. bokningar** | `recurring_bookings` | (inbyggd i bokningsflode) | ON | Lag (inget eget UI) |
| **Prenumeration** | `provider_subscription` | (inline i profil) | OFF | Lag (Stripe redirect) |
| **Kundinbjudningar** | `customer_invite` | (API-only) | OFF | -- (inget UI) |

### Feature-flaggade WebView-skarmar (kund)

| Skarm | Feature flag | Webb-URL | Default | Komplexitet |
|-------|-------------|----------|---------|-------------|
| **Gruppbokningar** | `group_bookings` | `/customer/group-bookings/*` | ON | Medel-Hog |
| **Stallprofiler** | `stable_profiles` | `/stables/*`, `/stable/*` | OFF | Hog |
| **Sjalvombokning** | `self_reschedule` | (inline i bokningar) | ON | Lag |
| **Folj leverantör** | `follow_provider` | (inline) | ON | Lag |
| **Bevaka kommun** | `municipality_watch` | (inline) | ON | Lag |

### Infrastruktur (inte skarmar)

| Feature | Flag | Notering |
|---------|------|----------|
| Offlinelage | `offline_mode` | SWR + ServiceWorker + IndexedDB |
| Push-notiser | `push_notifications` | APNs device token registration |

---

## Tier 1: Alltid synliga -- hogst prio

### 1. Översikt / Dashboard (Tab 1)

**Vad:** KPI-kort (vantande bokningar, dagens schema, nasta bokning), snabbatgarder, checklista for nya leverantorer.

**Varfor native:** Forsta skarmen -- snabb laddning kritiskt. KPI-data kan cachas offline. Pull-to-refresh.

**API:** Ny `/api/native/dashboard` (kombinera befintliga).
**Komplexitet:** Medel (~300 rader Swift). Read-only kort + navigering.

---

### 2. Bokningar (Tab 3)

**Vad:** Lista med statusfilter (Vantande/Bekraftade/Genomforda/Avbokade), sok, paginering. Tap -> detaljvy med statusknappar.

**Varfor native:** Nast mest anvanda. Tung interaktion. Offline-relevans.

**API:** Ny `/api/native/bookings` med paginering + filter. Statusandring via befintlig `/api/bookings/[id]`.
**Komplexitet:** Hog (~500+ rader). List + filter + mutation + detalj + offline.

---

### 3. Recensioner (Mer)

**Vad:** Omdomeslista med stjarnbetyg, kommentarer, svar. Genomsnittsbetyg.

**Varfor native:** Quick win -- enkel read-mostly vy, stort native-intryck.

**API:** Befintlig `/api/reviews` + eventuellt native-endpoint.
**Komplexitet:** Lag-Medel (~200 rader). Read-only + svarsformular.

---

### 4. Mina tjänster (Mer)

**Vad:** Tjanstelista med namn, pris, tidsatgang, aterbesoksintervall. Redigering inline.

**Varfor native:** Enkel CRUD, etablerar "native list + edit"-monster.

**API:** Befintlig `/api/services`, eventuellt `/api/native/services`.
**Komplexitet:** Medel (~250 rader). List + edit-sheet.

---

### 5. Kunder (Mer)

**Vad:** Kundregister med filter, sok, kunddetalj (hästar, anteckningar, bokningshistorik, insikter, inbjudan).

**Varfor native:** Offline-relevant -- kundinfo ute i falt. Manga sub-vyer.

**API:** Ny `/api/native/customers` + detalj.
**Komplexitet:** Hog (~600+ rader).

---

### 6. Min profil (Mer)

**Vad:** 3 flikar (Profil, Tillgänglighet, Bokningsinstallningar). Profilbild, adress, veckoschema, undantag.

**Varfor native:** Lagst ROI -- komplex + sallan använd efter setup.

**API:** Multipla nya endpoints.
**Komplexitet:** Mycket hog (~800+ rader).

---

## Tier 2: Feature-flaggade -- migreras nar/om de blir permanenta

### 7. Besoksplanering (due_for_service)

**Vad:** Hästar som behover aterbesok, sorterat pa urgency. Overdue + upcoming (2 veckor).

**Varfor native:** Offline-relevant for faltarbete. Relativt enkel listevy.

**Komplexitet:** Medel (~250 rader). Read-only lista med filter.

---

### 8. Affarinsikter (business_insights)

**Vad:** Analysdashboard: tjanstefordelning, tids-heatmap, kundretention, KPI:er.

**Varfor native:** Diagram/charts kraver iOS-native bibliotek (Swift Charts).

**Komplexitet:** Medel-Hog (~400 rader). Swift Charts + KPI-kort.

---

### 9. Rostloggning (voice_logging)

**Vad:** Tala/skriv vad du gjort, AI matchar till bokningar, extraherar arbete + observationer.

**Varfor native:** Redan native SpeechRecognizer! Naturlig kandidat.

**Komplexitet:** Medel-Hog (~350 rader). Har SpeechRecognizer, behover AI-matchning + confirm-UI.

---

### 10. Rutt-annonser (route_announcements)

**Vad:** Publicera planerade rutter, kunder bokar langs vagen. Statustracking.

**Varfor native:** List + detalj, medelkomplext.

**Komplexitet:** Medel (~300 rader). CRUD + statushantering.

---

### 11. Ruttplanering (route_planning)

**Vad:** Valj ordrar, optimera rutt (Modal API + OSRM), interaktiv karta.

**Varfor native:** MapKit-integration ger battre kartupplevelse an webbkarta.

**Komplexitet:** Hog (~500 rader). MapKit + rutt-API + drag-reorder.

---

### 12. Gruppbokningar (group_bookings)

**Vad:** Hantera gruppbokningsforfragan, se deltagare, matcha leverantor.

**Varfor native:** Moderatkomplext list + detalj-monster.

**Komplexitet:** Medel-Hog (~350 rader). List + detalj + participant UI.

---

## Tier 3: Avvakta

| Skarm | Anledning att avvakta |
|-------|-----------------------|
| **Stallprofiler** | OFF, ny feature under utveckling, ej lanserad |
| **Prenumeration** | OFF, Stripe-redirect -- minimal UI-yta |
| **Kundinbjudningar** | API-only, inget dedikerat UI |
| **Kundappen (hela)** | Helt webbaserad, annan malgrupp |

---

## Prioritetsordning

| Prio | Skarm | Tier | Motivering |
|------|-------|------|-----------|
| 1 | **Översikt / Dashboard** | 1 | Forsta skarmen, snabb laddning, medel komplexitet |
| 2 | **Bokningar (lista)** | 1 | Nast mest använde, offline, hog men hanterbar |
| 3 | **Recensioner** | 1 | Quick win, enkel vy, stort native-intryck |
| 4 | **Mina tjänster** | 1 | Enkel CRUD, etablerar list+edit-monster |
| 5 | **Besoksplanering** | 2 | Offline-relevant, enkel lista, bra for falt |
| 6 | **Affarinsikter** | 2 | Swift Charts, native diagram > webbdiagram |
| 7 | **Rostloggning** | 2 | SpeechRecognizer redan native -- naturlig utvidgning |
| 8 | **Kunder** | 1 | Komplex men viktig for faltarbete |
| 9 | **Rutt-annonser** | 2 | Medel, CRUD + status |
| 10 | **Ruttplanering** | 2 | MapKit-fordel, men hog komplexitet |
| 11 | **Gruppbokningar** | 2 | Moderatkomplext, avvakta tills feature mognar |
| 12 | **Min profil** | 1 | Lagst ROI -- komplex + sallan använd |
| -- | Tier 3 | 3 | Avvakta |

**Alternativ ordning (quick wins forst):** Recensioner -> Mina tjänster -> Dashboard -> Bokningar -> Besoksplanering -> Kunder -> Profil

---

## Gemensamma monster (etablerade)

Ateranvand fran kalender/hjalp-migreringarna:

- **API:** `authFromMobileToken` + rate limiting (se `/api/native/calendar`, `/api/native/help`)
- **APIClient:** `authenticatedRequest<T>(path:responseType:)` i `APIClient.swift`
- **Cache:** UserDefaults med TTL (HelpCacheManager) eller SharedDataManager (widget-data)
- **UI:** NavigationStack, `.searchable()`, `.task {}`, error/loading states
- **Offline:** NetworkMonitor + cachad data + felvy
- **Feature flags:** Kontrollera `isFeatureEnabled()` i native API-endpoints for Tier 2-vyer

---

## Nasta steg

1. Diskutera prioritetsordning -- sarskilt Tier 1 vs Tier 2 interleaving
2. Valj forsta kandidat och skapa implementeringsplan
3. Varje migration foljer: API -> Modeller -> SwiftUI-vy -> Integration -> Cache -> Test
