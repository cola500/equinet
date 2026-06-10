---
title: "Customer Home Vision — 'Mina hästar' som hem"
description: "Vision-utforskning av hästägarens hemvy. Utgår från frågan: om Lisa loggar in en gång i veckan, vad vill hon se först? Inventerar befintliga data, rangordnar signaler och skissar tre alternativa hem (hästcentrerad / bokningscentrerad / blandad) med wireframes och för/nackdelar, plus en rekommendation. Read-only, ingen implementation."
category: idea
status: draft
last_updated: 2026-06-05
sections:
  - Executive summary
  - Frågan - vad vill Lisa se först
  - Vilka data finns redan
  - Vilka signaler är viktigast
  - Tre alternativa kund-hem
  - Rekommendation
  - Öppna frågor och nästa steg
tags:
  - ux
  - customer
  - hästägare
  - home
  - vision
related:
  - docs/ux/customer-demo-discovery-2026-06.md
  - docs/ux/equinet-full-app-picture-2026-06.md
---

# Customer Home Vision — "Mina hästar" som hem

> Vision, inte beslut. Vi utforskar hypotesen att hästägarens hem **inte** är "Hitta tjänster"
> eller "Mina bokningar" utan **"Mina hästar"** — innan vi bygger något.
>
> **Read-only. Ingen implementation, ingen kod.** FACT = verifierat i kod. INFERENCE = bedömning.
> Bygger på [customer-demo-discovery](./customer-demo-discovery-2026-06.md) och
> [full-app-picture](./equinet-full-app-picture-2026-06.md).

---

## Executive summary

- **Hypotesen håller (INFERENCE).** En hästägare som loggar in ~1 gång/vecka tänker inte i
  "bokningar" eller "sök" — hon tänker i **hästar**: *"Mår mina hästar bra, behöver något göras?"*
  Bokning och sök är **handlingar som följer av en hästs status**, inte hemmet i sig.
- **Datan finns redan (FACT).** Allt en hästcentrerad hemvy behöver är redan modellerat och delvis
  beräknat: hästar med bild/ras/ålder, **per-häst försenat-besök-status** (`useDueForService`),
  vårdhistorik (genomförda bokningar + noteringar), kommande bokningar och dela-länkar.
- **Den viktigaste signalen är "behöver något göras?"** — dvs **försenat besök** (röd, agera) och
  **nästa bokning** (grön, lugn). Detta finns redan beräknat per häst men visas idag bara som en liten
  badge i hästlistan.
- **Rekommendation:** en **häst-ledd hemvy (Alternativ C, häst-lett mixad)** — hästkorten är hemmet, med
  en smal "behöver din uppmärksamhet"-rad överst som lyfter försenade besök + nästa bokning så den mest
  akuta signalen aldrig begravs bakom flera hästar.
- Detta löser samtidigt det största kund-UX-gapet från discoveryn: **ingen kund-hemvy** (ägaren landar
  idag på publik sök).

---

## 1. Frågan — vad vill Lisa se först?

Lisa (2 hästar: Molly, Storm) loggar in en gång i veckan. Hennes första fråga är **inte** "var bokar jag?"
utan:

> **"Är allt under kontroll med mina hästar — och behöver jag göra något?"**

Hon vill, i prioritetsordning:
1. **Larm:** Är någon häst **försenad** för hovvård/besök? (→ agera: boka)
2. **Lugn:** När är **nästa besök** inbokat, och för vilken häst?
3. **Kontext:** Vad gjordes **senast**, och finns något **nytt** (anteckning) sen sist?

→ Det är en **per-häst statusöversikt**, inte en bokningslista och inte en sökruta. Det stärker hypotesen
att **"Mina hästar" är hemmet**.

---

## 2. Vilka data finns redan? (FACT)

| Data | Källa | Status | Användbart för hem |
|---|---|---|---|
| **Hästar** (namn, ras, födelseår, färg, kön, bild, specialbehov) | `Horse` (`prisma/schema.prisma`) | Finns | Hästkort med bild + identitet |
| **Försenat besök / nästa-due per häst** | `useDueForService()` + `/api/customer/due-for-service` → `DueForServiceResult[]` (`status: "overdue"`, `daysUntilDue`, `horseId`) | **Finns + beräknat** | Den viktigaste signalen — visas idag bara som `DueStatusBadge` i hästlistan |
| **Kommande bokningar** | `/api/bookings` (status, `bookingDate`, häst, leverantör, tjänst) | Finns | "Nästa besök: Molly – Omskoning om 3 dagar" |
| **Vårdhistorik** (genomförda bokningar + noteringar, per häst) | `/api/horses/[id]/timeline` (merge) | Finns | "Senaste behandling" + tidslinje |
| **Anteckningar** (kategori + tidsstämpel) | `HorseNote` via `/api/horses/[id]/notes` | Finns | "Ny anteckning sedan sist"-signal |
| **Intervall / besöksschema** | `HorseServiceInterval` / `CustomerHorseServiceInterval` (`Besöksschema`-fliken) | Finns | Underlag för due-beräkningen |
| **Dela med veterinär** | `HorseProfileToken` (30-dgr) → `/profile/[token]` | Finns | "Dela hästprofil"-åtgärd per häst |

**Slutsats:** ingen ny datamodell behövs för en hästcentrerad hemvy — allt finns. Det som saknas är en
**vy som samlar signalerna per häst** (idag är de utspridda: badge i listan, historik på detaljsidan,
bokningar på en annan sida).

---

## 3. Vilka signaler är viktigast?

Rangordnat för en lågfrekvent (1/vecka) ägare:

| Rang | Signal | Varför | Visuell vikt |
|---|---|---|---|
| **1** | **Försenat besök** (overdue) | Kräver handling nu; ägarens ansvar | Röd, högst upp, "Boka"-CTA |
| **2** | **Nästa bokning** (kommande) | Lugn — "det är taget om hand" | Grön/neutral, datum + häst |
| **3** | **Senaste behandling** | Kontext — vad gjordes sist | Sekundär text per häst |
| **4** | **Ny anteckning sedan sist** | Lågfrekvent men relevant | Liten markör/prick |

**Designprincip (INFERENCE):** hemmet ska svara på **rang 1-2 på under 2 sekunder** ("är något rött? när
är nästa?"), och låta rang 3-4 vara drill-down. En ägare med "allt grönt" ska känna lugn direkt; en med
en försenad häst ska se det överst med en tydlig nästa-åtgärd.

---

## 4. Tre alternativa kund-hem

> Wireframes är mobil-först (~390px), eftersom demon främst visas på mobil.

### Alternativ A — Hästcentrerad

```
┌─────────────────────────────┐
│ Hej Lisa 👋                  │
│                             │
│ ┌─────────────────────────┐ │
│ │ [foto] Molly            │ │
│ │  Welsh ponny · 8 år     │ │
│ │  🔴 Försenad 5 dgr      │ │
│ │  Senast: Omskoning 2 apr│ │
│ │  [ Boka ]  [ Visa häst ]│ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ [foto] Storm            │ │
│ │  Sv. varmblod · 12 år   │ │
│ │  🟢 Nästa: 9 juni       │ │
│ │  Senast: Verkning 1 maj │ │
│ │  [ Boka ]  [ Visa häst ]│ │
│ └─────────────────────────┘ │
│ + Lägg till häst            │
└─────────────────────────────┘
```
**Styrkor:** matchar ägarens mentala modell rakt av; varje häst bär sin status + nästa åtgärd; skalar
naturligt (1-N hästar); återanvänder `DueStatusBadge` + timeline-data.
**Svagheter:** "nästa bokning" och "försenat" begravs om man har många hästar (måste skanna alla kort);
ingen enskild "vad är mest akut totalt sett"-vy; en ägare med 0 hästar får tom vy (behöver bra empty state
+ "hitta tjänster").

### Alternativ B — Bokningscentrerad

```
┌─────────────────────────────┐
│ Mina bokningar              │
│ ┌─────────────────────────┐ │
│ │ NÄSTA BESÖK             │ │
│ │ Molly · Omskoning       │ │
│ │ 9 juni 08:00 · Erik J.  │ │
│ │ [ Visa ]  [ Omboka ]    │ │
│ └─────────────────────────┘ │
│ Kommande (2) ▾              │
│ Tidigare ▾                  │
│ [ + Boka ny tjänst ]        │
└─────────────────────────────┘
```
**Styrkor:** nästa bokning omedelbart; nära dagens `/customer/bookings`; minst att bygga.
**Svagheter:** **fel mentala modell** för en 1/vecka-ägare (hon tänker häst, inte bokning); försenade
hästar (= ingen bokning än!) syns inte alls — den viktigaste signalen saknas; "tomt" om inga bokningar.

### Alternativ C — Blandad (häst-ledd)

```
┌─────────────────────────────┐
│ Hej Lisa 👋                  │
│ ┌─────────────────────────┐ │
│ │ ⚠ Behöver din uppmärksam-│ │  ← smal status-rad (rang 1-2)
│ │   het                   │ │
│ │ 🔴 Molly försenad 5 dgr │ │
│ │    [ Boka omskoning ]   │ │
│ │ 🟢 Nästa: Storm 9 juni  │ │
│ └─────────────────────────┘ │
│ MINA HÄSTAR                 │
│ ┌─────────┐ ┌─────────┐     │
│ │[foto]   │ │[foto]   │     │  ← hästkort (rang 3-4 drill-down)
│ │Molly 🔴 │ │Storm 🟢 │     │
│ └─────────┘ └─────────┘     │
│ + Lägg till häst            │
│ [ Hitta tjänster ]          │
└─────────────────────────────┘
```
**Styrkor:** mest akuta signalen (försenat + nästa) **överst** oavsett antal hästar, men hemmet är
fortfarande **häst-lett**; "allt grönt" → status-raden visar bara "Nästa: …" = lugn; ger plats för både
larm och översikt; naturlig väg till boka/hitta.
**Svagheter:** två zoner (rad + kort) = något mer att designa/bygga; risk för dubblering om status-raden
och korten visar samma sak (måste hållas komplementära); kräver en liten ny komponent (status-raden).

---

## 5. Rekommendation

**Favorit: Alternativ C (häst-ledd blandad).**

Motivering:
- Behåller hypotesens kärna — **hemmet är hästarna** (mot ägarens mentala modell), men löser Alternativ A:s
  enda verkliga svaghet: att den **viktigaste signalen (försenat / nästa)** kan begravas. Status-raden
  lyfter rang 1-2 till topp; hästkorten bär rang 3-4.
- Använder **bara befintlig data** (`useDueForService`, bokningar, timeline) — ingen ny modell, mest
  återanvändning + en liten status-rads-komponent.
- Ger demon ett starkt **"lugn i magen"-första intryck** och en tydlig väg till boka/hitta — fixar
  discoveryns största gap (ingen kund-hemvy, ägaren landar på publik sök).

**Fallback:** Om vi vill bygga ännu mindre först → **Alternativ A** (ren hästcentrerad) är en helt giltig
v1; status-raden (C) kan läggas till som inkrement när "många hästar"-skannings­problemet faktiskt
uppstår. **Alternativ B avråds** som hem — fel mentala modell och döljer försenade hästar.

---

## 6. Öppna frågor och nästa steg

**Produktbeslut (innan bygge):**
1. **Är "Mina hästar" hemmet?** Bekräfta riktningen (C eller A) innan en slice formaliseras.
2. **Exponeras "försenat besök" för kunden i hemmet/demon?** Datan finns; idag bara en liten badge.
   Det är den starkaste demo-poängen ("vi säger till i tid").
3. **Tom-läge:** ägare med 0 hästar — hemmet ska då nudga "Lägg till häst" + "Hitta tjänster" (onboarding).
4. **Relation till nav:** blir "Mina hästar"/"Hem" samma sak? (Idag är `/customer/horses` en flik; hemmet
   kan bli den, eller en ny `/customer` som speglar den.)
5. **"Senaste behandling" + "ny anteckning":** ta med i v1 eller spara till polish?

**Nästa steg (när riktning bekräftad):**
- Kör Seven Dimensions-refinement på epiken "kund-hem (Mina hästar)"
  ([story-refinement.md](../../.claude/rules/story-refinement.md)).
- Koppla till [customer-demo-discovery](./customer-demo-discovery-2026-06.md) **Slice 2 (customer start
  page)** — denna vision konkretiserar vad den slicen ska innehålla.
- Ingen kod förrän riktningen är beslutad.

> Källor: `prisma/schema.prisma` (Horse), `src/hooks/useDueForService.ts`,
> `src/app/api/customer/due-for-service/route.ts`, `/api/horses/[id]/timeline` + `/notes`,
> [full-app-picture §5.3, §6.2](./equinet-full-app-picture-2026-06.md),
> [customer-demo-discovery](./customer-demo-discovery-2026-06.md).
