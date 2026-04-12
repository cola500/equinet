---
title: Demo Go/No-Go
description: Slutgiltig visuell genomgang av demo-flodet -- beslut om demo-readiness
category: product-audit
status: active
last_updated: 2026-03-26
sections:
  - Step 1 Login
  - Step 2 Dashboard
  - Step 3 Customers
  - Step 4 Calendar
  - Step 5 Bookings
  - Step 6 Services
  - Verdict
---

# Demo Go/No-Go

Slutgiltig visuell genomgang med demo mode + demo-seed + alla fixar (2026-03-26).

---

## Step 1: Login

**Vad anvandaren ser:** Rent inloggningsformular. "Logga in pa Equinet", email, lösenord, gron knapp.

**Kansla: 4/5**

Dev-banner ar BORTA. Sidan kanns professionell. "Glomt lösenord?" och "Registrera dig har" syns men sticker inte ut -- anvandaren spenderar 5 sekunder har.

**Bryter illusionen?** Nej. Footer visar "v0.2.0" men ingen tittar dit.

---

## Step 2: Dashboard

**Vad anvandaren ser:**
- "Maria Lindgren" i ovre hogra hornet
- 5 rena nav-tabs (Översikt, Kalender, Bokningar, Mina tjänster, Kunder)
- "Du har 1 ny förfrågan" -- gul banner med lank
- Statskort: Aktiva tjänster (4), Kommande bokningar (3), Nya förfrågningar (1)
- "Visa statistik" expanderbar
- Snabbllankar med badge "1" pa Se bokningar

**Kansla: 5/5**

Ingen dev-banner. Ingen checklista. Ingen "Slutfor din profil". Bara levande data. Snabblankarna har badge som visar att det finns nagonting att gora. Statistiken visar att verksamheten har historik.

**Bryter illusionen?** Nej. Detta kanns som en riktig produkt.

---

## Step 3: Customers

**Vad anvandaren ser:**
- 3 kunder: Anna Johansson (1 bokning, 1 hast), Johan Pettersson (1 bokning), Erik Svensson (1 bokning, 1 hast)
- Svenska namn, `@demo.equinet.se`-emails
- Bokningshistorik och hasttaggar

**Kansla: 4/5**

Realistiska namn. Hasttaggen ("1 hast") ger en professionell touch. 3 kunder ar lagom for att visa funktionaliteten utan att kanna sig tomt.

**Bryter illusionen?** Email-domanen `demo.equinet.se` ar subtil och trovärdig -- ser ut som en riktig doman. Sofia Berg saknas (har bara avbokad bokning, visas inte i listan med aktiva) -- 3 kunder ar tillrackligt.

---

## Step 4: Calendar

**Vad anvandaren ser:**
- Veckokalender med bokningsblock pa mandag och fredag
- "1 bokning vantar" banner
- Tillganglighetszon gron 08-17 pa vardagar, "Stangt" pa helg
- "+ Bokning"-knapp

**Kansla: 4/5**

Kalendern kanns levande -- bokningar syns, vaentande förfrågan markeras tydligt. Helger ar markerade som stangda. Tips-bannern ("Tryck direkt i kalendern...") ar hjalpsam.

**Bryter illusionen?** Nej. Bokningsblocken har ratt tjanstenamn och tider.

---

## Step 5: Bookings

**Vad anvandaren ser:**
- Tabs: Alla (6), Vantar (1), Bekraftade (2), Genomförda (3), Ej infunna (0), Avbokade (1)
- Forsta bokningen: Ridlektion for Sofia Berg, "Vantar pa svar", Acceptera/Avboj-knappar
- Bekraftade: Hovvard utan beslag (Erik, Saga), Hovslagning (Anna, Storm)
- Genomförda: 3 st med realistiska detaljer
- Kundkommentarer: "Vanligen lite kickig pa vanster bak", "Forsta lektionen, nyborjare", "Haltar lite pa vanger fram"

**Kansla: 5/5**

**Basta sidan i demon.** Blandningen av statusar gor att det kanns som en riktig dag i verksamheten. Kundkommentarerna ger autenticitet. Hastnamnen (Storm, Saga, Bella, Prinsen) ar trovardiga. Acceptera/Avboj-knapparna visar tydligt vad man kan gora.

**Bryter illusionen?** Nej. Inga "DEMO-SEED", inga "Test Testsson", inga "example.com".

---

## Step 6: Services

**Vad anvandaren ser:**
- 4 tjänster i grid: Halsokontroll (900 kr, 30 min), Hovvard utan beslag (700 kr, 45 min), Hovslagning (1200 kr, 60 min), Ridlektion (500 kr, 45 min)
- Aterbesoksintervall pa hovtjanster (6/8 veckor)
- "Lagg till tjänst"-knapp

**Kansla: 4/5**

Realistiska tjänster med varierade priser. Aterbesoksintervallet visar en avancerad funktion utan att vara overvaldigande.

**Bryter illusionen?** Roda "Ta bort"-knappar ar framtradande men inte en deal-breaker -- leverantören forstår att de kan hantera sina tjanster.

---

## Testord-kontroll

| Sokt | Hittat? |
|------|---------|
| DEMO-SEED | NEJ -- borta fran alla bokningskort |
| Test Testsson | NEJ -- borta fran kundlista och bokningar |
| test@example.com | NEJ -- borta fran alla synliga sidor |
| E2E | NEJ -- inga E2E-tjänster eller hästar |
| example.com | NEJ -- alla emails ar @demo.equinet.se |
| Hovslagning Standard (Inaktiv) | NEJ -- filtreras bort i demo mode |
| Dev-banner | NEJ -- dold i demo mode |

---

## Verdict

### Ar detta demo-redo?

**JA.**

Demon ar redo att visas for en kund. Flodet fran inloggning till genomförd bokning kanns professionellt och trovardigt. Data ar realistisk, navigeringen ar ren, och inga testord eller dev-artefakter lacker igenom.

### De 3 sista forbattringarna som hade gjort demon annu battre (nice to have)

1. **Dolj "Glomt lösenord?" och "Registrera dig har" pa login-sidan i demo** -- smattpolar men gor login renare
2. **Dolj versionnummer "v0.2.0" i footer i demo** -- subtil men markbar for detaljfokuserade anvandare
3. **Dolj roda "Ta bort"-knappar pa tjanstekort i demo** -- minskar risken att demo-data forstors

### Vad ar det starkaste i demon just nu?

**Bokningssidan.** Blandningen av statusar (vantar, bekraftad, genomförd, avbokad), kundkommentarer ("Vanligen lite kickig pa vanster bak"), hastdetaljer (Storm, Saga, Bella), och Acceptera/Avboj-flodet ger en kansla av en levande verksamhet. Det ar har produktens varde blir tydligt.

### Vad ar det svagaste som fortfarande kanns?

**Kundlistan kanns tunn** -- 3 kunder ar tillrackligt for att visa funktionaliteten, men en kund med fler bokningar (3-4 st) hade gett mer djup vid demo. Aven avsaknaden av profilbilder pa kunder/leverantor gor att UI:t kanns lite opersonligt.
