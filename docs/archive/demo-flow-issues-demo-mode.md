---
title: Demo Flow Issues -- Demo Mode Active
description: Visuell genomgang av demo-flodet med NEXT_PUBLIC_DEMO_MODE=true aktivt
category: product-audit
status: active
last_updated: 2026-03-26
sections:
  - Step 1 Login
  - Step 2 Dashboard
  - Step 3 Customers
  - Step 4 Calendar and Create Booking
  - Step 5 Services
  - Step 6 Profile and Settings
  - Step 7 Blocked Pages
  - What Demo Mode Improved
  - Top 5 Problems in Demo Mode
  - What Still Blocks a Good Demo
---

# Demo Flow Issues -- Demo Mode Active

Visuell genomgang av leverantorsflode med `NEXT_PUBLIC_DEMO_MODE=true` (2026-03-26).
Jamforelse mot tidigare rapport utan demo mode.

---

## Step 1: Login

**Vad anvandaren ser:** Identiskt med vanligt lage.

**Kvarstaende problem:**
- "Utvecklingsmiljo -- Lokal DB" orange banner syns
- "Glomt losenord?" och "Registrera dig har" syns
- "Equinet v0.2.0" i footer
- Ingen demo-valkomstext eller guide

**Forbattrat av demo mode:** Ingenting. Login-sidan har ingen demo-check.

**Bedomning:** Oforandrat. Login behover egna demo-anpassningar.

---

## Step 2: Dashboard

**Vad anvandaren ser:**
- Navigering: Oversikt, Kalender, Bokningar, Mina tjanster, Kunder (5 tabs)
- "Valkommen tillbaka!"
- "Slutfor din profil"-banner
- "Kom igang"-checklista (3 av 4 klara)
- Stats: Aktiva tjanster (13), Kommande bokningar (0), Nya forfragningar (0)
- Snabbllankar: Se bokningar, Kalender, Kundregister (3 st)

**Forbattrat av demo mode:**
- Notifikationsklocka (9+) ar BORTA -- bra, forvirrande i demo
- "Recensioner"-lank i navigeringen ar BORTA -- bra, inte relevant i demo
- "Mer"-dropdown ar BORTA -- bra, renare navigering
- "Logga arbete"-snabblank ar BORTA -- bra, kravde feature flag
- Recensioner-statskort ar BORTA -- bra, visade "--"
- Layout andrad fran 4 stats-kort till 3 -- renare

**Kvarstaende problem:**
1. **"Utvecklingsmiljo -- Lokal DB"-banner** -- syns fortfarande
2. **"Slutfor din profil"-banner** -- tar stor plats, ger ofardigt intryck
3. **"Kom igang"-checklista** -- "Fyll i foretagsprofil" ej klar. Ser halvfardigt ut
4. **"Aktiva tjanster: 13"** -- 11 ar "E2E Test Service"
5. **"Kommande bokningar: 0"** -- tomt, ger intrycket av en tom produkt

**Bedomning:** Battre an utan demo mode. Navigeringen ar renare. Men dashboarden kanns fortfarande tom och ofullstandig.

---

## Step 3: Customers

**Vad anvandaren ser:** Identiskt med vanligt lage.

**Kvarstaende problem:**
- "Test Testsson" med "test@example.com" -- uppenbar testdata
- Bara 1 kund -- kanns tomt
- Dev-banner syns

**Forbattrat av demo mode:** Renare navigering (5 tabs istallet for 6+).

**Bedomning:** Data-problemet ar oppaverkat av demo mode. Behover realistisk seed.

---

## Step 4: Calendar and Create Booking

**Vad anvandaren ser:** Kalender med dagsvy, tom. "+ Bokning"-knapp.
Bokningsdialogen visar samma tjanste-dropdown som vanligt.

**Kvarstaende problem:**
1. **11 "E2E Test Service"** i tjanste-dropdown -- identiskt med vanligt lage
2. **"Gor detta aterkommande"-toggle** -- VERIFIERAD BORTA i demo mode (bekraftad fran kodgenomgang)
3. **"E2E Blansen"** i hast-dropdown -- testdata lacker igenom

**Forbattrat av demo mode:**
- "Gor detta aterkommande"-toggle ar dold (verified i koden, `recurringBookingsEnabled` ar false i demo)

**Bedomning:** Aterkommande-toggle ar battre, men tjanstedatan forstror fortfarande upplevelsen.

---

## Step 5: Services

**Vad anvandaren ser:** 13 tjanster i grid -- 11 st "E2E Test Service", 2 realistiska.

**Kvarstaende problem:**
- **IDENTISKT med vanligt lage** -- demo mode andrar ingenting pa tjanstesidan
- 11 "E2E Test Service" med roda "Ta bort"-knappar
- Ser absurt ut i en demo

**Forbattrat av demo mode:** Ingenting.

**Bedomning:** Katastrofalt. Storsta enskilda demo-blockeraren.

---

## Step 6: Profile and Settings

**Vad anvandaren ser:**

### Profil-tab:
- Profilbild (tom upload-ikon)
- Personlig information: "Leverantor Testsson", provider@example.com
- Foretagsinformation: "Test Stall AB", Stockholm
- "Profil 60% komplett" med progress bar

### Installningar-tab:
- BARA "Bokningsinstellningar" med "Ta emot nya kunder"-toggle

### Tillganglighet-tab:
- Normal tillganglighetsschema

**Forbattrat av demo mode:**
- **Verifiering-kort: BORTA** -- bra
- **Exportera data-kort: BORTA** -- bra
- **Subscription-kort: BORTA** -- bra
- **Ombokningsinstellningar: BORTA** -- bra
- **Aterkommande bokningar: BORTA** -- bra
- **Radera konto: BORTA** -- bra, farlig knapp

**Kvarstaende problem:**
1. **"Leverantor Testsson"** -- testnamn
2. **"provider@example.com"** -- test-email
3. **"Test Stall AB"** -- testnamn pa foretag
4. **"Profil 60% komplett"** -- ser ofardigt ut i demo
5. **Dev-banner** -- syns fortfarande

**Bedomning:** Installningar ar MYCKET battre. Bara "Ta emot nya kunder" kvar -- rent och enkelt. Profildatan ar dock testdata.

---

## Step 7: Blocked Pages (URL-redirect test)

Testat att navigera direkt till sparrade sidor via URL:

| Sida | Resultat | Redirect till |
|------|----------|---------------|
| `/provider/reviews` | Blank sida -> redirect | `/provider/profile` |
| `/provider/verification` | (ej testat, bekraftad i kod) | `/provider/profile` |
| `/provider/export` | (ej testat, bekraftad i kod) | `/provider/profile` |
| `/provider/settings/integrations` | (ej testat, bekraftad i kod) | `/provider/profile` |
| `/provider/routes` | (ej testat, bekraftad i kod) | `/provider/profile` |
| `/provider/debug` | (ej testat, bekraftad i kod) | `/provider/profile` |

**Observation:** Redirecten fungerar men det finns en kort tom rendering (vit sida) innan redirect sker. Inte kritiskt men markbart.

---

## What Demo Mode Actually Improved

### Navigering
- 5 rena tabs: Oversikt, Kalender, Bokningar, Mina tjanster, Kunder
- "Recensioner" borta
- "Mer"-dropdown borta
- Notifikationsklocka borta

### Dashboard
- Recensioner-kort borta
- "Logga arbete"-snabblank borta
- 3 stats-kort istallet for 4

### Profile/Settings
- 6 sektioner borttagna (verifiering, export, subscription, ombokning, aterkommande, radera konto)
- Installningar-tabben ar minimal och ren

### Bokningsdialog
- "Gor detta aterkommande"-toggle borta

### URL-sparrar
- 6 sidor redirectar till /provider/profile

---

## Top 5 Problems in Demo Mode

1. **Testdata overallt** -- 11x "E2E Test Service", "Test Testsson", "provider@example.com", "Test Stall AB", "E2E Blansen". Demo mode doljer UI-element men andrar INTE data. Detta ar det storsta problemet.

2. **"Utvecklingsmiljo"-banner pa varje sida** -- Orange banner langst upp sager att detta ar en dev-miljo. Demo mode paverkar den inte alls.

3. **Dashboard kanns tom** -- 0 kommande bokningar, 0 forfragningar, ofullstandig profil-checklista. Aven med renare navigering kanns det som en tom produkt.

4. **Profil ser ofullstandig ut** -- "60% komplett", "Ej angiven" pa adress/postnummer/serviceomrade, tom profilbild. Ger intrycket att produkten ar halvfardig.

5. **Ingen onboarding/guide** -- Anvandaren loggar in utan kontext. Vet inte var man borjar eller vad poangen ar.

---

## What Still Blocks a Good Demo

### Blockerare (maste fixas)
- [ ] **Rensa E2E-testdata** -- Skapa en demo-seed med realistiska tjanster, kunder, bokningar
- [ ] **Dolj dev-banner i demo** -- `isDemoMode()` check i DevBanner-komponenten
- [ ] **Dolj onboarding-checklista i demo** -- `!demo &&` wrapper pa dashboarden
- [ ] **Dolj "Slutfor din profil"-banner i demo** -- `!demo &&` wrapper

### Bor fixas (starkt rekommenderat)
- [ ] **Pre-populera profil** -- Fullt namn, foretagsinfo, profilbild, 100% komplett
- [ ] **Dolj login-lankarna** i demo -- "Glomt losenord?" och "Registrera dig har"
- [ ] **Dolj versionnummer** i footer i demo
- [ ] **Skapa demo-bokningar** -- 3-5 kommande, 5-10 genomforda, realistisk historik

### Nice to have
- [ ] Demo-valkommen med kort guide
- [ ] Pre-laddade notifikationer
- [ ] Profilbild pa demo-kontot
