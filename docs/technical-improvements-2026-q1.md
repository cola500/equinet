---
title: Technical Improvements -- Q1 2026
description: Sammanfattning av teknisk genomlysning och förbättringar genomförda under Q1 2026
category: retro
status: current
last_updated: 2026-03-28
sections:
  - Bakgrund
  - Vad vi gjorde
  - Resultat
  - Vad vi inte gjorde
  - Strategi framåt
  - Slutsats
---

# Technical Improvements -- Q1 2026

## Bakgrund

Under denna period genomfördes en riktad teknisk genomlysning av Equinet med fokus på arkitektur, kodkvalitet och förändringsbarhet.

Målet var att minska risk, förenkla utveckling och förbättra struktur -- utan att stoppa produktutvecklingen.

---

## Vad vi gjorde

### 1. Rollhantering (Auth)

Införde centrala rollhelpers (`requireProvider`, `requireCustomer`, `requireAuth`) och migrerade 80% av API-routes (47 st) från manuella strängjämförelser till typsäkra guards.

**Effekt:**
- Enklare att förstå accessregler -- en rad istället för 5-8
- Minskad risk för säkerhetsbuggar (konsekvent 401/403-beteende)
- Nya routes får korrekt auth automatiskt

### 2. API-wrapper (withApiHandler)

Införde en deklarativ wrapper som centraliserar auth, feature flags, rate limiting, JSON-parsing, Zod-validering och felhantering. Migrerade 18 routes.

**Effekt:**
- ~886 LOC boilerplate borttaget
- Mer konsekvent route-struktur
- Enklare att bygga nya endpoints -- config-objekt istället för copy-paste

### 3. BookingService-förbättringar

Extraherade gemensam valideringslogik till privata hjälpmetoder: `validateService`, `validateProvider`, `validateTimeSlot`.

**Effekt:**
- Minskad duplicering mellan create, manual och reschedule-flöden
- Nya bokningsregler behöver bara läggas till på ett ställe

### 4. PaymentService som source of truth

Flyttade betalningslogik från route-lagret till den befintliga (men oanvända) PaymentService. Routen minskade från 281 till 104 LOC.

**Effekt:**
- Tydligare ansvarsfördelning -- en source of truth för betalningsflödet
- Bättre testbarhet -- service-logik och HTTP-logik testas separat

### 5. Named Prisma selects

Extraherade 6 återkommande select-block i PrismaBookingRepository till namngivna konstanter. Minskade 20 inline-block till 6 delade definitioner.

**Effekt:**
- Minskad risk för drift mellan queries
- Nya fält behöver bara läggas till på ett ställe per variant

### 6. Testsäkring av specialroutes

Lade till tester för routes som medvetet inte refaktorerades: Fortnox OAuth, reschedule IDOR-skydd, route-orders dual-mode. Totalt +19 nya tester.

**Effekt:**
- Säkrare kodbas -- känsliga routes har nu explicit verifierat beteende
- Tryggare framtida refaktorering

### 7. Feature flag-genomgång

Inventerade alla 18 flaggor, kartlade användning (server, klient, navigation, E2E). Identifierade och fixade 2 saknade server-gates.

**Effekt:**
- Konsekvent flagg-beteende (defense in depth)
- Bättre kontroll över demo/features

---

## Resultat

| Mätpunkt | Värde |
|----------|-------|
| LOC boilerplate borttaget | ~1000 |
| Routes med centrala helpers | 47 |
| Routes med withApiHandler | 18 |
| Nya tester | +19 |
| Total testsvit | 3755 gröna |
| Regressioner | 0 |
| Commits | 9 |

---

## Vad vi INTE gjorde (medvetna beslut)

- Ingen stor omskrivning av BookingService
- Ingen wrapper v2 (params-stöd, custom rate-limit-key)
- Ingen refaktorering av komplexa specialroutes (route-orders, bookings/manual)
- Ingen ombyggnad av feature flag-systemet
- Ingen migrering av native routes eller admin routes
- Ingen receipt-extraktion eller email-template-modernisering

**Varför:** Den stora vinsten var redan tagen. Kvarvarande förbättringar har avtagande avkastning och görs bäst i samband med relevant produktarbete.

---

## Strategi framåt

### Använd nya mönster för:
- **Nya routes** -- `withApiHandler` med deklarativ config
- **Betalning** -- alltid via `PaymentService`
- **Bokningsvalidering** -- centralisera om duplicering uppstår
- **Routes du redan redigerar** -- byt till wrapper i samma commit

### Refaktorera INTE när:
- Koden redan fungerar och inte är en flaskhals
- Förändringen inte stödjer en pågående feature
- Testtäckningen är god och beteendet verifierat

### Ta nästa teknikspår när:
- En feature blir svår att bygga pga strukturella hinder
- Duplicering börjar öka igen i ett specifikt område
- Buggar börjar uppstå i samma del av kodbasen

---

## Slutsats

Kodbasen är nu i ett stabilt och förbättrat läge. De viktigaste strukturella riskerna är adresserade, testtäckningen är hög, och nya mönster är etablerade och dokumenterade.

Fokus framåt bör vara produktutveckling, demo och användarvärde. Teknikarbete görs selektivt när det ger tydlig effekt.
