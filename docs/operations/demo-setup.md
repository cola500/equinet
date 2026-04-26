---
title: "Demo Setup — Erik Järnfot (leverantörsdemo)"
description: "Inloggning och instruktioner för att köra leverantörsdemon för Erik Järnfot"
category: operations
status: active
last_updated: 2026-04-25
sections:
  - Inloggning
  - Köra demon
  - Återställa data
  - Vad som ingår i demo-datan
  - Demo-flöde (manuell walkthrough)
  - Vad demo-läget gör
---

# Demo Setup — Erik Järnfot (leverantörsdemo)

Instruktioner för att sätta upp och köra leverantörsdemon som visar Equinet för en
potentiell pilot-leverantör.

## Inloggning

| Fält | Värde |
|------|-------|
| E-post | `erik.jarnfot@demo.equinet.se` |
| Lösenord | `DemoProvider123!` |
| Namn | Erik Järnfot |
| Företag | Järnfots Hovslageri |
| Ort | Örebro |

Logga in via `/login` eller `/provider/dashboard`.

## Köra demon

### Steg 1: Se till att lokal DB är igång

```bash
npm run db:up          # Starta Supabase lokalt
npm run env:status     # Verifiera att lokal DB är aktiv
```

### Steg 2: Kör seed-scriptet

```bash
npm run db:seed:demo-provider
```

Scriptet är **idempotent** — kör det hur många gånger som helst utan dubbletter.

### Steg 3: Starta dev-servern

```bash
npm run dev
```

Öppna `http://localhost:3000/login` och logga in med uppgifterna ovan.

### Steg 4 (valfritt): Aktivera demo-läge

`demo_mode`-flaggan fokuserar UI:t på kärnleverantörsvyerna och visar en snabb-inloggningsknapp.

```bash
# Sätt miljövariabel i .env.local
NEXT_PUBLIC_DEMO_MODE=true
```

Eller aktivera via adminpanelen: `/admin/system` → Feature Flags → `demo_mode`.

#### Vad demo-läget gör

| Beteende | Detalj |
|----------|--------|
| **Synliga paths** | `/provider/dashboard`, `/provider/calendar`, `/provider/bookings`, `/provider/customers`, `/provider/services`, `/provider/profile` |
| **Dolda paths** | Allt övrigt (ruttplanering, export, verifiering, debug, etc.) döljs från navigation |
| **DemoLoginButton** | Visas på `/login`-sidan — loggar in automatiskt som Erik Järnfot med ett klick |
| **Tjänster** | Alla tjänster visas (aktiva **och** inaktiva) — filtrera ALDRIG på `isActive` i demo-läge |
| **Header** | Visar "Demo"-badge och döljer inloggad-meny-poster utanför demo-scopet |

> **Gotcha:** Filtrera aldrig bort data (t.ex. inaktiva tjänster) baserat på `isDemoMode()`. Demo-läget ska visa ett realistiskt urval av data, inte ett reducerat. Hotfix `ac9a36bf` åtgärdade ett sådant filter i services-sidan.

## Återställa data

Om du vill börja om med fräsch demo-data:

```bash
npm run db:seed:demo-provider:reset
```

`--reset`-flaggan raderar alla kunder, hästar, bokningar, recensioner och anteckningar
skapade av demo-scriptet, och återskapar dem från grunden. **Leverantörskontot (Erik Järnfot)
och dennes tjänster berörs inte av reset.**

### Identifiera demo-data

Demo-data är märkt på följande sätt:

| Typ | Märkning |
|-----|----------|
| Kunder | E-post matchar `DEMO_CUSTOMER_EMAILS`-konstanten i seed-scriptet |
| Hästar | Kopplade till demo-kunder (via `ownerId`) |
| Bokningar | Kopplade till demo-kunder (via `customerId`) |
| Recensioner | Kopplade till demo-bokningar |
| Anteckningar | Skapade av demo-leverantören (`providerId` = Erik Järnfot) |

## Vad som ingår i demo-datan

### Leverantör

- **Järnfots Hovslageri** — Örebro, 50 km serviceradie
- Verifierad (`isVerified: true`)
- Tillgänglighet: Mån–Fre 07:00–16:00

### Tjänster (5 st)

| Tjänst | Pris | Tid | Interval |
|--------|------|-----|---------|
| Omskoning | 1 400 kr | 75 min | 8 veckor |
| Verkning (barfota) | 750 kr | 45 min | 6 veckor |
| Akutbesök | 2 500 kr | 60 min | — |
| Ungdomsverkning | 600 kr | 40 min | 6 veckor |
| Hovslagarbedömning | 800 kr | 30 min | — |

### Kunder (9 st) med hästar (14 st)

| Kund | Ort | Hästar |
|------|-----|--------|
| Lisa Andersson | Örebro | Molly (Welsh ponny), Storm (Sv. varmblod) |
| Anders Bergman | Västerås | Dante (Hanoveraner) |
| Karin Lindqvist | Arboga | Bella (Gotlandsruss), Silver (Islandshäst) |
| Peter Svensson | Kumla | Midnight (Araber) |
| Emma Eriksson | Örebro | Samba (Lusitano), Luna (Fjordhäst) |
| Stefan Olsson | Kungsör | Flash (Friesian) |
| Maria Holm | Örebro | Prince (Oldenburger), Nova (Islandshäst) |
| Johan Nilsson | Hallsberg | Tornado (Trakehner) |
| Sara Magnusson | Örebro | Stella (Shetlandsponny), Blixten (Nordsvensk kallblod) |

### Bokningar (20+ st)

- **5 bekräftade, kommande** (2–10 dagar framåt)
- **2 väntande** (4–8 dagar framåt)
- **8 genomförda** (4–70 dagar bakåt) + **2 serie-bokningar** (8 och 16 veckor bakåt)
- **2 avbokade**
- **1 manuell bokning** (skapad av leverantören, 14 dagar framåt)

### Återkommande bokning (1 serie)

- **Omskoning Molly** (Lisa Andersson) — 8-veckorsintervall, 6 tillfällen totalt, 3 skapade
- Visar serie-badge på bokningsdetalj och kalender
- Den kommande bekräftade bokningen är länkad till serien

### Konversation (1 st)

- **Anders Bergman / Dante** — 3 meddelanden, sista från kunden (oläst)
- Perfekt för att visa Smart Reply-chips: Erik kan svara med ett chip "Jag är på väg!" eller "Jag är framme nu!"
- Eriks telefonnummer (`070-234 56 78`) är setat — `{telefon}`-variabeln löses korrekt

### Recensioner (7 st)

Betyg 3–5 stjärnor. Kopplade till genomförda bokningar.

### Anteckningar

- 4 leverantörsanteckningar om kunder (journalanteckningar)
- 3 interna notes på enskilda bokningar

## Demo-flöde (manuell walkthrough)

Rekommenderad ordning för att visa plattformen för en pilot-leverantör:

1. **Dashboard** (`/provider/dashboard`) — översikt bokningar, kunder, aktuella händelser
2. **Kalender** (`/provider/calendar`) — veckovy, klicka på Lisa Andersson/Molly-bokningen
3. **Bokningsdetalj** — serie-badge ("Del av återkommande serie"), kundinfo, tidslinje
4. **Bokningslista** (`/provider/bookings`) — filtrera per status, se historik
5. **Kundlista** (`/provider/customers`) — klicka på Anders Bergman
6. **Kunddetalj Anders Bergman** — öppna Meddelanden-fliken på bokningen, visa Smart Reply-chips
   - Klicka på "Jag är framme nu!" — textrutan fylls i automatiskt
   - Visa att `{datum}`, `{tid}`, `{telefon}` löses automatiskt i mallarna
7. **Kunddetalj Lisa Andersson** — visa hästar, anteckningar, "Bjud in kund"-knappen
8. **Affärsinsikter** (`/provider/insights`) — grafer för bokningar, intäkter, populäraste tjänster
9. **Tjänster** (`/provider/services`) — visa, redigera en tjänst med rekommenderat intervall
10. **Profil** (`/provider/profile`) — visa leverantörsprofil, inställningar, recurring bookings-toggle

### Bra demo-poänger att lyfta

- **Smart Replies**: Svara kunder med ett klick — mallar som "Jag är på väg!" fylls in automatiskt med datum, tid och telefon
- **Återkommande bokningar**: Seriebaserade bokningar med automatisk schemaläggning (8-veckorsintervall)
- **Affärsinsikter**: Grafer för intäkter, populäraste tjänster och kundtillväxt
- **Kundinbjudningar**: Bjud in kunder via e-post direkt från kundkortet
- **Kategori-ikoner på landningssidan**: Sökfilter för hovslagare/veterinär/tränare med ikoner
- **Due-for-service**: Kunder vars hästar är försenade med hovvård visas på dashboard
- **Manuell bokning**: Leverantören kan lägga in bokningar för kunder
- **Kundanteckningar**: Privata journalanteckningar per kund — aldrig synliga för kunden
- **Recensioner**: Kundernas omdömen samlade under profilen

## Relaterade filer

- Seed-script: `scripts/seed-demo-provider.ts`
- Demo-mode logic: `src/lib/demo-mode.ts`
- Tillåtna demo-paths: `src/lib/demo-mode.ts → DEMO_ALLOWED_PATHS`
