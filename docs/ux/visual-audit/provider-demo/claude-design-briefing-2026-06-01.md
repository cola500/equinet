---
title: Claude Design Briefing — Provider Demo Visual Audit
description: Briefing och screenshot-paket för en visuell Claude Design-genomlysning av Equinets leverantörsdemo i staging. Innehåller kontext, audit-fynd, granskningsfrågor, önskad output, constraints och ett färdigt copy-paste-promptblock.
category: guide
status: draft
last_updated: 2026-06-01
sections:
  - Context
  - Audit context
  - Captured screenshots
  - Live staging findings
  - Visual review questions
  - Required output from Claude Design
  - Constraints
  - Copy-paste prompt for Claude Design
tags:
  - ux
  - demo
  - provider
  - visual-audit
  - claude-design
depends_on:
  - docs/ux/provider-demo-ux-audit-2026-05.md
related:
  - docs/operations/demo-setup.md
---

# Claude Design Briefing — Provider Demo Visual Audit

> Paket för en **visuell** UX-genomlysning av Equinets leverantörsdemo (staging).
> Read-only underlag — ingen implementation. Bygger på den IA-baserade
> [provider-demo-ux-audit-2026-05.md](../../provider-demo-ux-audit-2026-05.md).

---

## Context

- **Equinet** är en boknings- och samordningsplattform för hästtjänster.
- **Målgrupp:** hovslagare, veterinärer, hästterapeuter och andra hästnära
  tjänsteutövare — praktiska yrkesmänniskor som jobbar mobilt, ofta i stallmiljö.
- **Tonalitet:** praktisk, pålitlig, lugn. Inte "tech-startup-glättig".
- **Fokus för denna review:** leverantörsvyn (provider) i **staging-demon**, inloggad
  som demo-leverantören **Erik Järnfot** (Järnfots Hovslageri, Örebro).
- **Mål:** bedöma den *visuella* UX:en — layout, hierarki, densitet,
  navigationstydlighet, kognitiv belastning, trust, polish och demo-effektivitet —
  och rekommendera små slices, inte en omdesign.

---

## Audit context

Den föregående IA-auditen (kodbaserad) landade i fyra huvudfynd:

1. **Kalendern verkar vara den starkaste primära arbetsytan** — den är visuell,
   interaktiv och täcker funktionellt ~90 % av det Bokningar gör plus omboka,
   tillgänglighet och manuell bokning som bara finns där.
2. **Översikt, Bokningar och Kalender överlappar** — samma bokningsdata och samma
   två räknare (kommande bokningar, nya förfrågningar) visas på tre ställen. Risk:
   tittaren läser produkten som "komplex admin-app", inte "gör mitt jobb enklare".
3. **Demon visar för många primära flikar** — särskilt mobilt, där botten-tabbaren
   trängs med 7 flikar + "Mer".
4. **Vissa empty states riskerar att kännas tomma/trasiga** — främst Bokningar och
   Insikter, som saknar pedagogisk tomtlägestext.

Auditens rekommenderade riktning: **Kalender som primär yta**, **smal Översikt**,
**Bokningar tonas ner till sekundär lista**, **färre primära flikar**.

---

## Captured screenshots

Sökväg: `docs/ux/visual-audit/provider-demo/screenshots/`. Tagna live från
`https://equinet-staging.johanlindengard.com` 2026-06-01 (desktop 1440×900,
mobil 390×844).

| # | Fil | Skärm | Viewport |
|---|-----|-------|----------|
| 1 | `01-dashboard-desktop.png` | Översikt / Dashboard | Desktop (full sida) |
| 1 | `01-dashboard-mobile.png` | Översikt + botten-tabbar | Mobil |
| 2 | `02-calendar-desktop.png` | Kalender (veckovy) | Desktop (full sida) |
| 2 | `02-calendar-mobile.png` | Kalender | Mobil |
| 3 | `03-bookings-desktop.png` | Bokningar (lista) | Desktop (full sida) |
| 3 | `03-bookings-mobile.png` | Bokningar | Mobil |
| 4 | `04-customers-desktop.png` | Kunder | Desktop (full sida) |
| 5 | `05-services-desktop.png` | Mina tjänster | Desktop (full sida) |
| 6 | `06-insights-desktop.png` | Insikter | Desktop (full sida) |
| 7 | `07-messages-desktop.png` | Meddelanden | Desktop (full sida) |
| 8 | `08-nav-more-desktop.png` | "Mer"-meny öppen (desktop) | Desktop |
| 9 | `09-nav-more-mobile.png` | "Mer"-drawer (mobil) | Mobil |

---

## Live staging findings

> Observationer från live-genomgången. **Viktig kontext för bedömningen** så att
> "tomt" inte misstas för "dålig design".

### Datakontext — demon saknar KOMMANDE bokningar

- **Bokningar-sidan är full av bokningskort** (lång lista), men dessa ligger i
  **dåtid** (genomförda/avbokade).
- Därför visar **Dashboard "Kommande bokningar: 0"** och **"Nya förfrågningar: 0"**,
  och **Kalenderns aktuella vecka (1 juni) är helt tom**.
- Konsekvens: de två ytorna som auditen vill lyfta fram (Kalender + smal Översikt)
  ser just nu **tomma** ut, trots att produkten har data. **Demon behöver
  framtidsdaterade bokningar** för att Kalendern ska kunna bära demon.

### Navigationstillstånd på staging skiljer sig från koden

- **Demo-läget (`demo_mode`) är INTE aktivt** på staging-login — den fulla
  leverantörsnavigationen visas, inte de trimmade `demoTabs`.
- **Desktop primär nav (6 + Mer):** Översikt · Kalender · Bokningar · Meddelanden ·
  Mina tjänster · Kunder · **Mer**. "Mer" innehåller bara **Insikter · Hjälp ·
  Min profil** (avancerade funktioner är flaggade av på staging).
- **Mobil botten-tabbar (7 + Mer):** Översikt · Kalender · Bokningar · Kunder ·
  Meddelanden · Insikter · Tjänster · **Mer**. → **Inkonsekvens:** Insikter och
  Tjänster är primära mobilt men ligger i "Mer"/separat på desktop.

### Visuella förstaintryck (att bekräfta av Claude Design)

- **Dashboard:** korrekt och ren layout, men **nollställd** — tre stora "0"-kort och
  två platta nollgrafer dominerar. Känns mer som tom analytics än som "hem".
- **Kalender (veckovy):** "Vecka" är vald men vyn visar i praktiken **en enda
  dagkolumn** (mån 1 juni, 07:00–16:00) utan bokningar. Stark yta i teorin, men ser
  tom och nästan enkolumns-aktig ut i nuläget.
- **Bokningar:** tät men välstrukturerad kortlista — fungerar som översikt.
- **Mobil botten-tabbar:** **7 flikar + Mer** är hårt trängt; etiketterna
  (Bokningar/Kunder/Insikter/Tjänster) är mycket små och svårlästa. Tydligaste
  "developer-built"-signalen i demon.

---

## Visual review questions

Be Claude Design bedöma, med screenshots framför sig:

1. **Vilken sida känns mest som en naturlig startpunkt** för en leverantör — Översikt
   eller Kalender?
2. **Känns Kalendern visuellt stark nog att vara primary workspace?** (Bedöm
   layoutpotentialen — anta att den fylls med kommande bokningar, inte dagens tomma
   vecka.)
3. **Känns Översikt redundant eller värdeskapande?** Vad är dess unika visuella värde
   när räknarna också finns i Kalender/Bokningar?
4. **Känns Bokningar som en primär flik eller en sekundär lista?**
5. **Är navigationen visuellt för tung** — särskilt mobil botten-tabbar med 7 + Mer?
6. **Vad skapar mest kognitiv belastning** över skärmarna?
7. **Vad känns mest "developer-built"** (rått, oputsat) snarare än produktmoget?
8. **Vad bör förenklas först** inför demon — störst effekt, minst arbete?

---

## Required output from Claude Design

Be Claude Design leverera:

1. **Screen-by-screen visual observations** (en kort bedömning per skärm: layout,
   hierarki, densitet, polish).
2. **Top 5 visual UX risks** (rangordnade).
3. **Recommended navigation simplification** (konkret — vilka flikar primära, vilka
   till "Mer", desktop vs mobil).
4. **Recommended first 3 UX slices** (små, oberoende, i värdeordning).
5. **Quick wins vs larger redesign ideas** (separera billigt-och-snabbt från
   större omtag).
6. **Explicita svar på tre beslutsfrågor:**
   - **A) Should Calendar become the provider demo start page?**
   - **B) Should Bookings move to "More"?**
   - **C) Should Overview be simplified?**

---

## Constraints

- **Prefer small slices** — inga stora omskrivningar.
- **No full redesign** — arbeta inom befintlig struktur och komponentbibliotek
  (shadcn/ui, Tailwind, grön primärfärg `green-600`).
- **Preserve Equinet brand** — lugn, grön, praktisk; behåll logotyp och färgspråk.
- **Optimize for demo clarity** — målet är att en ny tittare förstår värdet snabbt.
- **Mobile matters** — leverantörer jobbar mobilt; botten-tabbaren är kritisk.
- **Horse-professional tone** — practical, trustworthy, calm. Inte lekfull/glättig.

---

## Copy-paste prompt for Claude Design

> Klistra in texten nedan i Claude Design tillsammans med de 13 screenshotsen från
> `docs/ux/visual-audit/provider-demo/screenshots/`.

```
You are a senior product designer reviewing the provider-facing demo of Equinet,
a booking and coordination platform for equine service professionals (farriers,
equine vets, equine therapists). The audience is practical, mobile-first
tradespeople who work in stable environments. Brand tone: practical, trustworthy,
calm — not playful or flashy. Primary brand color is green.

I'm attaching screenshots of the provider demo in our staging environment, logged
in as our demo provider "Erik Järnfot" (a farrier). Desktop is 1440×900, mobile is
390×844. The UI language is Swedish.

Screens included:
1. Översikt / Dashboard (desktop + mobile)
2. Kalender / Calendar — week view (desktop + mobile)
3. Bokningar / Bookings — list (desktop + mobile)
4. Kunder / Customers (desktop)
5. Mina tjänster / Services (desktop)
6. Insikter / Insights (desktop)
7. Meddelanden / Messages (desktop)
8. "Mer" / More menu open (desktop)
9. "Mer" / More drawer (mobile)

IMPORTANT DATA CONTEXT — do not mistake "empty" for "bad design":
The staging demo currently has NO upcoming bookings (the seeded bookings are all in
the past). So the Dashboard shows "0 upcoming / 0 new requests" with flat zero
charts, and the Calendar's current week renders empty. The Bookings list, by
contrast, is full (historical bookings). Assess the LAYOUT and STRUCTURE assuming
these surfaces would be populated with realistic upcoming bookings in a real demo.

NAVIGATION CONTEXT:
- Desktop primary nav: Översikt · Kalender · Bokningar · Meddelanden · Mina tjänster
  · Kunder · More (More contains Insikter · Hjälp · Min profil).
- Mobile bottom tab bar: 7 tabs + More (Översikt · Kalender · Bokningar · Kunder ·
  Meddelanden · Insikter · Tjänster · More) — note the desktop/mobile inconsistency.

Our prior information-architecture audit hypothesizes:
- Calendar is the strongest primary workspace.
- Översikt, Bokningar and Calendar overlap heavily (same bookings, same counters in
  three places).
- The demo shows too many primary tabs, especially on mobile.
- Some empty states (Bookings, Insights) risk looking broken/empty.

Please evaluate the VISUAL UX across these dimensions: layout, hierarchy, density,
navigation clarity, cognitive load, trust, polish, and demo-effectiveness.

Deliver:
1. Screen-by-screen visual observations (layout, hierarchy, density, polish).
2. Top 5 visual UX risks, ranked.
3. Recommended navigation simplification (which tabs primary vs in "More";
   desktop vs mobile).
4. Recommended first 3 UX slices — small, independent, ordered by value.
5. Quick wins vs larger redesign ideas.
6. Explicit answers to:
   A) Should Calendar become the provider demo start page?
   B) Should Bookings move to "More"?
   C) Should Overview be simplified?

Constraints: prefer small slices, no full redesign, preserve the Equinet brand
(green, calm, practical), optimize for demo clarity, mobile matters, keep a
horse-professional tone (practical, trustworthy, calm).
```
