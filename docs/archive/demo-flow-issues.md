---
title: Demo Flow Issues
description: Visuell genomgang av demo-flodet som leverantor -- identifierade problem och forslag
category: product-audit
status: active
last_updated: 2026-03-26
sections:
  - Step 1 Login
  - Step 2 Dashboard
  - Step 3 Customers
  - Step 4 Create Booking
  - Step 5 Complete Booking
  - Top 5 Problem
  - Snabba Fixes
---

# Demo Flow Issues

Visuell genomgang av leverantorsflode i lokal dev-miljo (2026-03-26).
Demo mode var INTE aktivt under testet -- detta visar saledes vad en demo-anvandare *med testdata* upplever.

---

## Step 1: Login

**Vad anvandaren ser:**
Rent inloggningsformular med "Logga in pa Equinet", email/losenord, gron knapp.

**Problem:**
1. **"Utvecklingsmiljo -- Lokal DB"-banner** syns langst upp i orange. Maste doljas i demo -- ser inte professionellt ut.
2. **"Glomt lösenord?" och "Registrera dig har"** -- irrelevant i demo. Anvandaren har fatt inloggningsuppgifter. Lankarna leder till sidor som inte ger varde i demo.
3. **Inget demo-välkommen** -- anvandaren vet inte vad de ska gora efter inloggning. En kort "Valkomsttext" eller guide-overlay saknas.
4. **Footer visar "Equinet v0.2.0"** -- versionnummer borde doljas i demo.

**Demo-bedömning:** OK men inte bra. Fungerar, men kanner sig som en dev-miljo, inte en produkt.

---

## Step 2: Dashboard

**Vad anvandaren ser:**
- "Välkommen tillbaka!" rubrik
- "Slutfor din profil"-banner (stor, tar mycket plats)
- "Kom igang"-checklista: "3 av 4 klara" med "Fyll i foretagsprofil" som ej klar
- Kort: Aktiva tjänster (13), Kommande bokningar (0), Nya förfrågningar (0), Recensioner (--)
- Snabbllankar: Se bokningar, Kalender, Kundregister, Logga arbete

**Problem:**
1. **"Slutfor din profil"-banner** -- stor och prominent. I en demo vill vi inte att anvandaren kanns som att nagonting ar halvfardigt. Ger ett ofardigt intryck.
2. **"Kom igang"-checklista** -- "Fyll i foretagsprofil" ar inte ifylld. Bor vara prepopulerad i demo, eller sa bor checklistan doljas i demo mode.
3. **"Aktiva tjänster: 13"** -- 11 av dessa ar "E2E Test Service". Siffran ar missvisande och gor att tjanstesidan ser absurd ut (se steg nedan).
4. **"Kommande bokningar: 0" och "Nya förfrågningar: 0"** -- Tomt. I en demo borde det finnas nagra exempelbokningar sa att dashboarden kanns levande.
5. **"Recensioner: --"** -- Dubbelstreck, ingen forklaring. Ser trasigt ut. Bor vara "0" eller doljas i demo.
6. **Snabblank "Logga arbete"** -- Gar till voice-log som ar feature-flag-gatad. Om flaggan ar av far anvandaren en konstig upplevelse. Bor doljas i demo.
7. **Notifikationsklocka visar "9+"** -- Vad ar 9+ notifikationer i ett demo-konto? Kan vara forvirrande.

**Demo-bedömning:** Daligt. Dashboarden ger intrycket av en ofullstandig produkt istallet for en fungerande plattform.

---

## Step 3: Customers

**Vad anvandaren ser:**
- "Kunder" rubrik med "Lagg till kund"-knapp
- Sokfalt och filter (Alla / Aktiva / Inaktiva)
- En kund: "Test Testsson, test@example.com, 1 bokning, Senast: 16 mars 2026"

**Problem:**
1. **"Test Testsson"** -- Uppenbart testdata. I en demo borde kunderna heta nagot realistiskt (t.ex. "Anna Johansson", "Erik Lindstrom").
2. **"test@example.com"** -- Testmail syns tydligt. Ser oprofessionellt ut.
3. **Bara EN kund** -- Kanns tomt. Demo borde ha 3-5 kunder med realistiska namn och historik.

**Demo-bedömning:** Mediokert. Fungerar men ger inget "wow" -- ser ut som en tom testmiljo.

---

## Step 4: Create Booking (via Kalender)

**Vad anvandaren ser:**
- Kalender med dagsvy, tillganglighetszon (gron, 09-17), now-line
- Tips-banner: "Tryck direkt i kalendern for att skapa en bokning" -- bra!
- "+ Bokning"-knapp oppnar dialog "Ny manuell bokning"
- Dialog: Tjänst-dropdown, datum, starttid, kund-sok, hast, anteckningar, aterkommande-toggle

**Problem:**
1. **Tjänst-dropdown -- STORSTA PROBLEMET:** Listan visar 11 st "E2E Test Service" med lite varierande priser (999kr/500kr). Alla heter exakt samma sak. Det ar OMOJLIGT for anvandaren att veta vilken som ar vilken. Sista tva alternativen ("Ridlektion", "Hovslagning Standard") ar de enda vetliga.
2. **"Gor detta aterkommande"-toggle** syns aven nar recurring bookings-flaggan ar av (i demo doljs den nar demo mode ar aktivt, men i vanligt lage syns den). Verifiera att den ar dold i demo.
3. **Hast-dropdown visar "E2E Blansen"** -- "E2E"-prefixet ar testdata som lacker igenom.
4. **Sluttid beraknas automatiskt** ("Sluttid: 10:45") -- Bra! En av fa saker som kanns polerad.

**Demo-bedömning:** Dialogen ar bra strukturerad, men testdata forstror upplevelsen totalt.

---

## Step 5: Complete Booking

**Vad anvandaren ser efter klick pa bokningsblock:**
- Dialog med "Ridlektion", "Test Testsson"
- Status-badges: "Bekraftad", "Manuell bokning"
- Bokningsdetaljer: datum, tid, pris, hast
- Kundinformation: email, telefon (klickbar)
- "Dina anteckningar" med mikrofon-ikon (rostinmatning)
- Tre knappar: "Markera som genomförd" (gron), "Ej infunnit" (rod outline), "Avboka"

**Vad som hander:** Klick pa "Markera som genomförd" -> bokningen far en bock i kalendern, statusen andras.

**Problem:**
1. **Bokningen blir "Genomförd" men ingen bekraftelse-toast** -- Dialogen stangs bara. Anvandaren vet inte sakert att nagonting hande. (Not: toast KAN ha visats men forsvunnit snabbt.)
2. **"Recensera kund"-knapp** -- Dyker upp pa bokningssidan (ej i demo, men i vanlig vy). Ar det vettskt att visa detta for en demo-anvandare som precis skapat en bokning? Forvagar kanske.
3. **Bokningslistan visar aven aldra E2E-data** -- "Hovslagning Standard" fran 16 mars med "E2E Blansen" och "Kundkommentarer: Vanligen kom 10 minuter innan". Testdata som inte borde synas.

**Demo-bedömning:** Sjava flodet fungerar bra (skapa -> slutfor). Det kanner sig logiskt och snabbt. Men testdata forstror helhetsintrycket.

---

## Tjanstesidan (extra observation)

**Vad anvandaren ser:**
- 13 tjänster i ett grid
- 11 st heter "E2E Test Service" med "Test beskrivning", varierande priser (500/999 kr)
- 2 st ar realistiska: "Ridlektion" och "Hovslagning Standard"
- Varje kort har "Redigera" och en rod "Ta bort"-knapp

**Problem:**
1. **11 identiska "E2E Test Service"** -- Ser helt absurt ut. Ingen kan ta produkten pa allvar med detta.
2. **Roda "Ta bort"-knappar** -- Prominent och farlig i en demo. Anvandaren kanske klickar av nyfikenhet och raderar testdata.

**Demo-bedömning:** Katastrofalt. Denna sida FAR INTE visas i en demo utan att testdata rensas.

---

## Navigationsobservationer

- **"Recensioner"** syns i toppnavigering aven om demo mode dolt sidan. Nav-filtreringen for demo ar separat och använder `DEMO_ALLOWED_PATHS` + `demoTabs`.
- **"Mer"-meny** (ej testad i denna genomgang) -- bor verifieras att den filtrerar korrekt i demo mode.
- **"Rapportera fel"-FAB** (rod knapp nere till hoger) -- Bor doljas i demo. Kunden ska inte se bugg-rapporteringssystem.

---

## Top 5 Storsta Demo-Problem

1. **Testdata overallt** -- "E2E Test Service" x11, "Test Testsson", "test@example.com", "E2E Blansen". Forstror hela intrycket. En demo maste ha realistisk data.

2. **Dashboarden kanns tom och ofullstandig** -- "0 bokningar", "0 förfrågningar", "--" recensioner, ofullstandig profil-checklista. Ger intrycket att produkten inte ar fardig.

3. **"Utvecklingsmiljo"-banner** -- Orange banner langst upp pa VARJE sida. Sager rakt ut att detta ar en testmiljo.

4. **Tjanste-dropdown i bokningsdialogen** -- 11 identiska "E2E Test Service" gor det omojligt att valja ratt. Blockerar det viktigaste flodet i demon.

5. **Ingen onboarding eller guide** -- Anvandaren loggar in och landar pa en dashboard utan kontext. Ingen vet var man ska borja eller vad man ska gora forst.

---

## Snabba Fixes (fore demo)

### Kan fixas pa minuter

- [ ] **Dolj "Utvecklingsmiljo"-banner i demo mode** -- Villkorlig rendering baserat pa `isDemoMode()`
- [ ] **Dolj "Rapportera fel"-FAB i demo mode** -- Samma check
- [ ] **Dolj "Logga arbete"-snabblank i demo** -- Filtrera bort fran snabbllankar nar demo ar aktivt
- [ ] **Dolj onboarding-checklista i demo** -- `!demo &&` wrapper
- [ ] **Dolj "Slutfor din profil"-banner i demo** -- `!demo &&` wrapper
- [ ] **Dolj versionnummer i footer i demo** -- `!demo &&` pa `Equinet v0.2.0`

### Kraver lite mer arbete

- [ ] **Rensa E2E-testdata fran demo-databasen** -- Ta bort alla "E2E Test Service", skapa 3-4 realistiska tjänster (Ridlektion, Hovslagning, Tandvard, Massage)
- [ ] **Skapa realistisk demo-seed** -- 3-5 kunder med svenska namn, 5-10 bokningar (mix av kommande, genomförda, avbokade), 2-3 hästar med rimliga namn
- [ ] **Dolj "Glomt lösenord?" och "Registrera dig har" i demo** -- Onodiga lankar for en demo
- [ ] **Dolj eller nollstall notifikationsklockan** i demo -- "9+" notiser pa ett demo-konto ar forvirrande

### Kan vanta (nice to have)

- [ ] Demo-valkommen/guide overlay vid forsta inloggning
- [ ] Pre-populerad profil sa att profilkomplettering visar 100%
- [ ] "Recensioner: --" -> dolj kortet i demo eller visa "4.2" med exempeldata
