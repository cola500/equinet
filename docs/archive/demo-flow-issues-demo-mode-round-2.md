---
title: Demo Flow Issues -- Round 2 (Demo Mode + Demo Seed)
description: Visuell genomgang efter demo-seed med realistisk data och demo mode aktivt
category: product-audit
status: active
last_updated: 2026-03-26
sections:
  - Step 1 Login
  - Step 2 Dashboard
  - Step 3 Customers
  - Step 4 Calendar
  - Step 5 Services
  - Step 6 Bookings
  - What Improved Since Last Round
  - Top 5 Remaining Problems
  - Is It Demo Ready
  - 3 Final Fixes Before Demo
---

# Demo Flow Issues -- Round 2

Visuell genomgang med `NEXT_PUBLIC_DEMO_MODE=true` + demo-seed (2026-03-26).
Jamforelse mot Round 1 (demo mode utan seed) och Round 0 (varken demo mode eller seed).

---

## Step 1: Login

**Vad anvandaren ser:** Identiskt med tidigare -- oforandrat av demo mode eller seed.

**Kvarstaende:**
- "Utvecklingsmiljo -- Lokal DB" orange banner
- "Glomt lösenord?" och "Registrera dig har"
- "Equinet v0.2.0" i footer

**Bedömning:** Acceptabelt. Login ar bara en genomgang -- anvandaren spenderar 5 sekunder har.

---

## Step 2: Dashboard

**Vad anvandaren ser:**
- "Maria Lindgren" i ovre hogra hornet (istallet for "Leverantör Testsson")
- 5 rena nav-tabs: Översikt, Kalender, Bokningar, Mina tjänster, Kunder
- "Du har 1 ny förfrågan" -- gul banner med lank till bokningar
- Statskort: Aktiva tjänster (4), Kommande bokningar (3), Nya förfrågningar (1)
- Statistikgraf med data (bokningar per vecka, intakter per manad)
- Snabbllankar med badge "1" pa Se bokningar

**Forbattrat sedan Round 1:**
- "Slutfor din profil"-banner ar BORTA (profilen ar nu komplett nog)
- "Kom igang"-checklista ar BORTA (samma anledning)
- Stats visar riktiga siffror: 4 tjänster, 3 kommande, 1 förfrågan
- "Maria Lindgren" istallet for "Leverantör Testsson"
- Statistikgraferna visar faktisk data

**Kvarstaende:**
- Dev-banner syns
- "v0.2.0" i footer

**Bedömning:** MYCKET BRA. Dashboarden kanns nu som en levande verksamhet. Statistik, kommande bokningar, och en vaentande förfrågan ger helhetskansla.

---

## Step 3: Customers

**Vad anvandaren ser:**
- 5 kunder: Test Testsson, Anna Johansson, Johan Pettersson, Erik Svensson, Sofia Berg (saknas i screenshoten men finns)
- Svenska namn, realistiska emails (@demo.equinet.se)
- Haktaggar pa kunder med hästar ("1 hast")
- Bokningshistorik per kund

**Forbattrat sedan Round 1:**
- 4 nya realistiska kunder (Anna, Erik, Sofia, Johan)
- Haktaggar synliga
- Bokningshistorik (1-2 bokningar per kund)

**Kvarstaende:**
- **"Test Testsson" (test@example.com) syns fortfarande** -- den ursprungliga testanvandaren fran seed-test-users.ts. Kopplar till gamla bokningar.
- Dev-banner

**Bedömning:** Bra men "Test Testsson" forstror. Behover antingen doljas eller tas bort fran kundlistan.

---

## Step 4: Calendar

**Vad anvandaren ser:**
- Veckokalender med bokningsblock:
  - Mandag: "Hovslagning" 09:00-10:00 (truncerad text)
  - Fredag: "Hovslagning" 09:00-10:00
  - Torsdag: Manuell "Ridlektion" 10:00-10:45 (fran tidigare test)
- "1 bokning vantar" banner med expanderbar lista
- Tillganglighetszon gron 09-17 pa vardagar, "Stangt" pa helg

**Forbattrat sedan Round 1:**
- Kalendern ar INTE tom -- bokningar syns pa flera dagar
- "1 bokning vantar" ger tydlig action-signal
- Tillganglighetsschema fungerar

**Kvarstaende:**
- Den manuella ridlektionen fran forsta testet (utan demo mode) syns fortfarande -- blandad data
- Dev-banner

**Bedömning:** Bra. Kalendern kanns levande och visar hur produkten fungerar.

---

## Step 5: Services

**Vad anvandaren ser:**
- 4 aktiva tjänster: Halsokontroll (900 kr), Hovvard utan beslag (700 kr), Hovslagning (1200 kr), Ridlektion (500 kr)
- 1 inaktiv tjänst: "Hovslagning Standard" (800 kr) -- med "Inaktiv"-badge
- Varje kort visar pris, varaktighet, aterbesokintervall
- "Lagg till tjänst"-knapp

**Forbattrat sedan Round 1:**
- **DRAMATISK FORBATTRING** -- fran 13 "E2E Test Service" till 4 unika, realistiska tjänster
- Varierade priser och tider
- Aterbesokintervall pa hovtjanster (6 resp. 8 veckor)

**Kvarstaende:**
- **"Hovslagning Standard" (Inaktiv)** syns fortfarande -- deaktiverad istallet for borttagen pga kopplad bokningsdata. Forvirrande i demo.
- **Roda "Ta bort"-knappar** -- destruktiva knappar synliga i demo
- Dev-banner

**Bedömning:** Bra. Realistiska tjänster med rimliga priser. "Hovslagning Standard" sticker ut som konstig -- bor doljas i demo.

---

## Step 6: Bookings

**Vad anvandaren ser:**
- Tabs: Alla (8), Vantar (1), Bekraftade (2), Genomförda (3), Ej infunna (0), Avbokade (2)
- Mix av status -- levande kansla
- Bokningskort med fullstandig info: tjänst, kund, datum, tid, hast, pris

**Forbattrat sedan Round 1:**
- Blandade statusar (inte bara "completed")
- Realistiska kundnamn och tjänster
- Kundfodbackningsbubblor ("Vanligen lite kickig pa vanster bak")

**Kvarstaende:**
- **"DEMO-SEED" syns i anteckningar** pa 4 bokningar -- providerNotes-faltet anvands for taggning och renderas i UI. KRITISKT.
- **"Test Testsson" med test@example.com** -- gamla bokningar (Ridlektion, Hovslagning Standard) fran seed-test-users
- **"E2E Blansen"** -- gammal hastreferens pa Hovslagning Standard-bokningen
- **"Recensera kund"-knapp** pa genomförda bokningar -- om den klickas gar den till recensionssidan som ar sparrad i demo

**Bedömning:** Bra grund men "DEMO-SEED" i anteckningarna ar en demo-dodare. Maste fixas.

---

## What Improved Since Last Round

| Omrade | Round 1 (demo mode, ingen seed) | Round 2 (demo mode + seed) |
|--------|--------------------------------|---------------------------|
| Dashboard stats | 0/0/-- | 4/3/1 |
| Tjänster | 11x "E2E Test Service" | 4 realistiska |
| Kunder | 1x "Test Testsson" | 4 realistiska + 1 gammal |
| Kalender | Tom | 3+ bokningar synliga |
| Bokningar | 2 (bara gamla) | 8 i blandade statusar |
| Provider-namn | "Leverantör Testsson" | "Maria Lindgren" |
| Företag | "Test Stall AB" | "Lindgrens Hovslageri & Ridskola" |
| Profil-checklista | Visas (3/4 klara) | Borta (profil komplett nog) |

---

## Top 5 Remaining Problems

1. **"DEMO-SEED" syns i anteckningar** -- providerNotes-faltet renderas i bokningskorten. Taggningen lacker in i UI. Använd ett annat falt eller dolj providerNotes i demo mode.

2. **"Test Testsson" + test@example.com finns kvar** -- den ursprungliga testanvandaren ar kopplad till gamla bokningar (Hovslagning Standard, manuell Ridlektion). Syns i kundlistan och bokningskorten.

3. **"Utvecklingsmiljo -- Lokal DB" banner** -- orange banner pa VARJE sida. Inte paverkad av demo mode.

4. **"Hovslagning Standard" (Inaktiv)** -- syns pa tjanstesidan med "Inaktiv"-badge. Forvirrande -- varfor har leverantören en inaktiv tjänst?

5. **Roda "Ta bort"-knappar pa tjänster** -- destruktiva knappar i demo ar riskabla. Anvandaren kan av misstag radera demo-data.

---

## Is It Demo-Ready?

**Nastan.** Demot ar nu 80% bra:
- Dashboarden ar overklaglig -- levande stats, förfrågan, grafer
- Tjänster ar realistiska och varierade
- Kunder och hästar har trovardiga namn
- Kalender och bokningar visar en aktiv verksamhet
- Navigeringen ar ren (5 tabs)

**Men 3 saker forstorer fortfarande intrycket:**
1. "DEMO-SEED" i bokningskorten -- omedelbart synlig, ser trasigt ut
2. "Test Testsson" bland realistiska kunder -- bryter illusionen
3. Dev-bannern -- skriker "detta ar inte pa riktigt"

---

## 3 Final Fixes Before Demo

### 1. Fixa DEMO-SEED-taggning (5 min)
Flytta taggningen fran `providerNotes` (som renderas i UI) till ett falt som INTE visas, t.ex. en hardkodad `cancellationMessage`-prefix for cancelled bookings, eller bara kolla `customerId` + `@demo.equinet.se` for identifiering istallet.

### 2. Dolj "Test Testsson" i demo (10 min)
Antingen:
- Ta bort testanvandarens gamla bokningar i demo-seeden
- Eller filtrera bort kunder med `@example.com` i kundlistan nar demo mode ar aktivt

### 3. Dolj dev-banner i demo mode (2 min)
Villkorlig rendering pa DevBanner-komponenten: `if (isDemoMode()) return null`
