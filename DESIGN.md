---
name: Equinet
description: Bokningsplattform för hästtjänster -- kopplar hästägare med hovslagare, veterinärer och hästterapeuter
colors:
  deep-pine: "oklch(0.42 0.09 160)"
  deep-pine-foreground: "oklch(0.985 0 0)"
  warm-ochre: "oklch(0.65 0.12 70)"
  warm-ochre-foreground: "oklch(0.25 0.05 70)"
  neutral-bg: "oklch(0.98 0.005 80)"
  neutral-fg: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0.005 80)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.92 0.01 75)"
  destructive: "oklch(0.577 0.245 27.325)"
  status-pending: "#fef9c3"
  status-pending-foreground: "#854d0e"
  status-confirmed: "#dcfce7"
  status-confirmed-foreground: "#166534"
  status-cancelled: "#fee2e2"
  status-cancelled-foreground: "#991b1b"
  status-completed: "#dbeafe"
  status-completed-foreground: "#1e40af"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(1.875rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.deep-pine-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-pill:
    backgroundColor: "{colors.status-pending}"
    textColor: "{colors.status-pending-foreground}"
    rounded: "4px"
    padding: "4px 8px"
---

# Design System: Equinet

## Overview

**Creative North Star: "The Trusted Stable Hand"**

Equinet ska kännas pålitlig, varm och utan krusiduller -- som en erfaren stalldräng som får saker gjorda utan dramatik. Systemet balanserar två register: en lugn, funktionell "Operate"-ton i kalender, bokningar och kundregister (där hovslagaren och hästägaren faktiskt jobbar), och en varmare, mer övertygande "Persuade"-ton på landningssidan (där skeptiska SMS-bokare ska övertygas att byta system).

Det är inte ett lantligt pastisch-tema -- inga träpaneler, ingen kursiv skript-font, inga hästskor som dekorativa ikoner överallt. Istället: en varm, nästan-vit bakgrund, en dov djupgrön primärfärg och en elegant seriff-rubrik som ger auktoritet utan att kännas som ett uppstartsföretag. Ytorna är flata i vila; skugga används sparsamt, bara för att signalera "detta ligger ovanpå" (card, dialog, dropdown) -- aldrig som dekoration.

**Key Characteristics:**
- Varm, nästan-vit bakgrund (aldrig kall grå) mot en dov skogsgrön primärfärg
- Elegant seriff-rubriker (DM Serif Display) mot ren sans-serif brödtext (Inter)
- Subtila skuggor, tydliga gränser -- flat-by-default, skugga signalerar lager, inte dekoration
- Mjukt avrundade hörn (8-14px) på kort och knappar; den generella `<Badge>`-komponenten är pill-formad, men de faktiska bokningsstatus-märkena är det inte (4px, se Colors/Components)
- 44px touch-targets som obligatorisk golv på mobil för alla interaktiva element

## Colors

Varm, jordnära palett byggd runt en djup skogsgrön primärfärg och en varm ockra-accent -- inga kalla, kliniska SaaS-blåtoner.

### Primary
- **Deep Pine** (`oklch(0.42 0.09 160)`): huvudaktionsfärg -- primärknappar, aktiva navigationselement, fokusringar. Dov och auktoritativ, inte skrikig.

### Secondary
- **Warm Ochre** (`oklch(0.65 0.12 70)`): sekundär accent för varma, humana touchpoints -- t.ex. varningsbanners, uppmärksamhetselement som inte är fel/destruktiva.

### Neutral
- **Warm Paper** (`oklch(0.98 0.005 80)`): sidbakgrund -- varm nästan-vit, aldrig kliniskt grå.
- **Card White** (`oklch(1 0 0)`): kortytor, ligger ovanpå sidbakgrunden.
- **Ink** (`oklch(0.145 0 0)`): primär text.
- **Quiet Gray** (`oklch(0.556 0 0)`): sekundär/muted text (metadata, tidsstämplar, hjälptext).
- **Hairline Border** (`oklch(0.92 0.01 75)`): gränser, dividers, input-kanter -- alltid subtil, aldrig hård svart.

### Status-färger (domänspecifikt, bokningsstatus) -- observerad verklighet, inte en ren tokenkälla

Två separata, oförenade system existerar samtidigt i koden:

1. **Det faktiskt använda mönstret** (29 filer, bl.a. `BookingCard.tsx`, `BookingDetailDialog.tsx`, hela admin- och provider-ytan): hårdkodade Tailwind-pastellpar, `text-xs px-2 py-1 rounded` (4px, INTE pill):
   - **Pending** (`bg-yellow-100 text-yellow-800`): "Väntar på svar".
   - **Confirmed** (`bg-green-100 text-green-800`): "Bekräftad".
   - **Cancelled** (`bg-red-100 text-red-800`): "Avbokad".
   - **Completed** (`bg-blue-100 text-blue-800`, eller `bg-emerald-100 text-emerald-800` för "Betald" i `BookingDetailDialog`): "Genomförd".
   - **No-show** (`bg-orange-100 text-orange-800`): "Ej infunnit".
   - **In route** (`bg-purple-100 text-purple-800`): "Inplanerad i rutt".
2. **En parallell, oanvänd tokenuppsättning** i `globals.css` (`--status-confirmed`, `--status-pending`, `--status-cancelled`, `--status-completed`, alla i OKLCH): definierade men refererade av NOLL komponenter i `src/`. Teknisk skuld -- inte source of truth, trots att de ser ut som det.

### Named Rules
**The Duplicated Status Rule (observerad avvikelse, inte ett förebildligt mönster).** Statuslogiken (färg + svensk etikett) är kopierad, inte delad, över minst 29 filer -- och en mer genomtänkt OKLCH-tokenuppsättning finns definierad men aldrig kopplad in. Replikera INTE detta mönster i ny kod; om en ny statusindikator behövs, fråga om konsolidering till en delad komponent/token-källa hör till uppgiften innan du kopierar `styles`-objektet en 30:e gång.

## Typography

**Display/Headline/Title Font:** DM Serif Display (weight 400 i typsnittsfilen, men alltid renderad `font-bold` i bruk -- se observation nedan)
**Body/Label Font:** Inter

**Character:** En elegant, auktoritativ seriff för rubriker mot en ren, arbetsam sans-serif för allt operativt innehåll -- paret ger systemet värme och tillit utan att offra läsbarhet i täta gränssnitt som kalender och kundlistor.

### Hierarchy
- **Display** (bold, `clamp(1.875rem, 5vw, 3.75rem)` / text-3xl→text-6xl, line-height 1.1): sidans H1, bara på landningssidan/hero-ytor.
- **Headline** (bold, `clamp(1.5rem, 3vw, 1.875rem)` / text-2xl→text-3xl, line-height 1.2): sektionsrubriker (H2).
- **Title** (bold, 18px / text-lg, line-height 1.3): kortrubriker, t.ex. "🐴 Hästägare"-panelrubriker.
- **Body** (regular, 16px / text-base, line-height 1.5): brödtext, formulärfält, listor.
- **Label** (medium, 14px / text-sm, line-height 1.4): knapptext, metadata, badge-text.

### Named Rules
**The Serif-Is-Sparse Rule.** DM Serif Display används ENDAST för rubriker (h1-h3-nivå och korttitlar) -- aldrig för brödtext, knappar eller formulärfält. Serif signalerar struktur, inte volym.

**Observation (inte en regel, en avvikelse värd att känna till):** typsnittsfilen `DM_Serif_Display` laddas med `weight: "400"`, men varje observerad användning i koden lägger till Tailwind-klassen `font-bold` ovanpå. Eftersom DM Serif Display bara finns i vikt 400 renderar webbläsaren en syntetisk fetstil. Fungerar visuellt idag men är tekniskt en mismatch -- värt att åtgärda om en riktig bold-variant behövs.

## Layout

Standard Tailwind-container/responsive breakpoints (`sm`/`md`/`lg`/`xl` defaults), ingen anpassad grid-skala observerad. Mobil-först genomgående: touch-target-golv (44px) appliceras via `min-h-[44px] sm:min-h-0`-mönstret på interaktiva element och tas bort på `sm`-brytpunkten och uppåt där mus/pekare inte kräver samma yta. Knappar och formulär staplas vertikalt på mobil (`flex-col gap-2 sm:flex-row`) och går till rad/grid på desktop.

## Elevation & Depth

**Öppen fråga, inte en fastslagen princip.** Koden idag är nästan helt flat: `shadow-xs` på outline-knappar och inputs, `shadow-sm` på kort -- inga dramatiska lyft, inga djupa skuggor någonstans. Detta är det observerade nuläget, dokumenterat ärligt, men INTE låst som en bindande regel för framtiden -- systemet kan medvetet röra sig mot mer djup senare.

### Shadow Vocabulary (observerat)
- **xs** (`shadow-xs`, Tailwind default ≈ `0 1px 2px rgba(0,0,0,0.05)`): outline-knappar, inputs -- markerar "detta är interaktivt och har en kant".
- **sm** (`shadow-sm`, Tailwind default ≈ `0 1px 3px rgba(0,0,0,0.1)`): kort -- markerar "detta ligger på ytan, separat från bakgrunden".

## Shapes

Mjukt avrundad genomgående, ingen skarp/rak kant någonstans i det observerade gränssnittet.

- **sm** (6px): små element, `size="sm"`-knappar.
- **md** (8px): standardknappar, inputs, selects.
- **lg** (10px): bas-radien (`--radius`).
- **xl** (14px): kort, större containers.
- **full** (pill): den generella `<Badge>`-komponenten. Bokningsstatus-märken använder INTE denna -- de är 4px (`rounded`), se Colors/Components.

## Components

Sturdy and unfussy -- solida, pålitliga ytor utan dekorativ flärd. Komponenterna kommer från shadcn/ui, tunt anpassade med projektets OKLCH-tokens.

### Buttons
- **Shape:** `rounded-md` (8px).
- **Primary:** Deep Pine bakgrund, vit text (`bg-primary text-primary-foreground`), `hover:bg-primary/90`.
- **Outline:** transparent bakgrund, `shadow-xs`, kant i `border-input`, `hover:bg-accent`.
- **Ghost/Secondary/Link/Destructive:** samma struktur, olika bakgrund/textfärg-par via samma `cva`-variant-system.
- **Touch target:** default och `lg`-storlekar har `min-h-[44px] sm:min-h-0` inbyggt. `size="sm"`-knappar har INTE detta automatiskt -- måste läggas till manuellt när en liten knapp ändå är det primära tappbara målet på mobil.

### Badges

Två skilda komponenter, inte en:
- **`<Badge>` (shadcn-komponenten, `src/components/ui/badge.tsx`):** `rounded-full` (pill), `px-2.5 py-0.5`, `text-xs font-semibold`. Variant → färg: default (primary/Deep Pine), secondary, destructive, outline. Används för generella etiketter, inte bokningsstatus.
- **Statusmärken (bokningsstatus, egen ad-hoc-implementation per fil):** `<span>` med `text-xs px-2 py-1 rounded` (4px hörn, INTE pill) och det hårdkodade färgparet från "Status-färger" ovan. Bygger INTE på `<Badge>`-komponenten alls -- separat, duplicerad kod per fil. Se "The Duplicated Status Rule".

### Cards / Containers
- **Corner Style:** `rounded-xl` (14px).
- **Background:** Card White mot Warm Paper-sidbakgrund -- alltid en subtil ljushetsskillnad, aldrig identisk med bakgrunden.
- **Shadow Strategy:** `shadow-sm`, se Elevation.
- **Border:** tunn `border` i Hairline Border-tonen.
- **Internal Padding:** `py-6` (24px vertikalt), `px-6` i header/content-underkomponenter.

### Inputs / Fields
- **Style:** `rounded-md`, `border-input`, `shadow-xs`, transparent bakgrund.
- **Focus:** `focus-visible:border-ring` + 3px ring i `ring-ring/50`.
- **Error:** `aria-invalid:border-destructive` + destructive-ring.
- **Touch target:** `min-h-[44px] sm:min-h-0`, samma mönster som knappar.

### Navigation
Mobil-först växling mellan `MobileDrawer`/`ResponsiveDialog` och desktop-varianter styrd av `useIsMobile()` -- ingen egen nav-specifik styling utöver komponentbiblioteket; ärver färg/typografi-tokens rakt av.

## Do's and Don'ts

### Do:
- **Do** använda semantiska tokens (`bg-primary`, `text-foreground`, `border-input`) -- aldrig råa Tailwind-gråtoner eller hex-värden direkt i komponenter.
- **Do** hålla skuggor subtila och funktionella (xs/sm) -- skugga kommunicerar lagerordning, inte dekoration.
- **Do** applicera 44px touch-target-golvet på ALLA interaktiva element på mobil, inklusive `size="sm"`-knappar där de är primära tappmål.
- **Do** reservera DM Serif Display för rubriker (h1-h3/korttitlar) -- aldrig för brödtext eller UI-kontroller.

### Don't:
- **Don't** hårdkoda Tailwind-gråtoner (`text-gray-900`, `text-gray-600`) i nya komponenter -- observerat i `src/app/page.tsx` som en avvikelse från tokensystemet, inte ett mönster att upprepa.
- **Don't** introducera dramatiska skuggor, lyft-på-hover-effekter eller glasmorphism -- bryter mot den flata, lugna grundkänslan.
- **Don't** använda status-färgerna (confirmed/pending/cancelled/completed) för något annat än faktisk bokningsstatus -- de är en domänspecifik vokabulär, inte ett allmänt färgschema.
- **Don't** kopiera `getStatusBadge`/`styles`-objektet till fil nummer 30 -- konsolidera till en delad komponent om uppgiften tillåter det, annars flagga det som observerad skuld snarare än att tyst upprepa mönstret.
- **Don't** lägga till lantlig pastisch-dekoration (träpanel-texturer, kursiv skript-font, hästskor som ikonspam) -- North Star är "pålitlig stalldräng", inte "lantlig souvenirbutik".
