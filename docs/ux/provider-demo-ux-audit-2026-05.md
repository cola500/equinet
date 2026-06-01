---
title: Provider Demo UX Audit
description: Read-only UX- och demo-audit av leverantörsvyn i Equinet inför Claude Design-review. Kartlägger navigation, funktionell överlappning och demo-tydlighet, samt föreslår keep/simplify/move/remove och första UX-slices.
category: guide
status: draft
last_updated: 2026-06-01
sections:
  - Executive summary
  - Metod och avgränsning
  - Current provider navigation map
  - Page-by-page observations
  - Overlap matrix
  - Keep / Simplify / Move / Remove
  - Open questions for Johan
  - Recommended first UX slices
tags:
  - ux
  - demo
  - provider
  - navigation
  - information-architecture
related:
  - docs/operations/demo-setup.md
---

# Provider Demo UX Audit (leverantörsvy)

> Underlag för Claude Design-review. Syftet är att identifiera vad som bör
> **förenklas, tas bort, slås ihop eller flyttas** i demo-upplevelsen för
> leverantörsvyn — inte att lösa något direkt. Read-only.

---

## Executive summary

Leverantörsvyn är funktionellt rik och välstrukturerad, men **för bred för en demo**.
En ny tittare möts av tre nästan överlappande "bokningsytor" (Översikt, Bokningar,
Kalender) innan hen ens hunnit förstå vad produkten gör. Demo-läget finns redan och
trimmar bort de mest avancerade sidorna — men det trimmar **inte** bort den interna
redundansen mellan de tre kärnytorna, och det visar fortfarande **7 primära flikar**,
vilket är tungt för en mobil bottom-tab-rad.

Tre huvudobservationer:

1. **Överlappning Översikt ↔ Bokningar ↔ Kalender är reell.** Kalendern täcker
   funktionellt ~90 % av det Bokningar gör (acceptera, avboka, markera genomförd,
   notering, recension — samma API-anrop) och ~40–50 % av Översikt. Hypotesen att
   Översikt och Bokningar kan tonas ner stämmer i sak — med en viktig nyans (se nedan).

2. **Bokningar och Kalender har olika UX-styrkor, inte olika funktioner.** Kalendern är
   *visuell planering*; Bokningar är *snabb listfiltrering*. De gör samma sak men för
   olika mentala lägen. Att radera den ena utan att flytta dess styrka till den andra
   skapar friktion.

3. **Demo-läget är på rätt väg men inte färdigtrimmat.** `demoTabs` visar fortfarande
   7 flikar. Ett demo-flöde mår bättre av 3–4 tydliga ytor + "Mer".

**Viktigaste demo-risken:** En demo-tittare förstår inte *värdet* snabbare av att se
fler ytor — hen blir förvirrad av att samma bokningar dyker upp på tre ställen och
drar slutsatsen "det här är en komplex admin-app", inte "det här gör mitt jobb enklare".

**Rekommenderad första slice:** Gör **Kalendern till primär arbetsyta** och **slå ihop
Översikt till en smal start-/sammanfattningsvy** medan Bokningar tonas ner till en
sekundär lista under "Mer". Detaljer i [Recommended first UX slices](#recommended-first-ux-slices).

---

## Metod och avgränsning

- **Grund:** Kodanalys av navigation och sidor (Next.js App Router, `src/app/provider/*`
  och `src/components/layout/*`). Detta är source of truth för informationsarkitektur.
- **Read-only:** Inga kodändringar, inga commits, ingen deploy. Branch: `staging`.
- **Inte gjort:** Jag har inte klickat igenom den live-renderade staging-miljön med
  demo-användaren (Erik). Observationer om *innehåll och flöden* är härledda ur koden;
  observationer om *upplevd känsla* (visuell densitet, scroll-längd, laddningstider) bör
  bekräftas live av Claude Design.
- **Perspektiv:** Produktägare + UX-designer. Fokus på demo-tydlighet, navigation och
  informationsarkitektur — inte kodkvalitet.

---

## Current provider navigation map

### Demo-läge (det som faktiskt visas i demon)

Demo-läget aktiveras via `NEXT_PUBLIC_DEMO_MODE=true` eller feature-flaggan `demo_mode`
(`src/lib/demo-mode.ts`). Då byts den fulla navigationen mot en kortare lista.

**Primära flikar i demo (`demoTabs`, 7 st):**

```
Översikt · Kalender · Bokningar · Kunder · Meddelanden · Insikter · Tjänster
```

**Tillåtna sidor i demo (`DEMO_ALLOWED_PATHS`, 9 st):**

```
dashboard · calendar · bookings · customers · services · insights · messages · profile · help
```

> Notera diskrepansen: `demoTabs` listar 7 flikar men `DEMO_ALLOWED_PATHS` tillåter 9
> sidor. Profil och Hjälp är åtkomliga men ligger utanför primärraden (i "Mer"/header).
> Allt annat (rutter, ruttplanering, rutt-annonser, gruppbokningar, voice-log,
> verifiering, export, integrationer, debug) är dolt i demo. Det är bra — men de 7
> primära flikarna är fortfarande många för en demo, särskilt på mobilens BottomTabBar
> som normalt visar 4 + "Mer".

### Full leverantörsnavigation (icke-demo, för referens)

**Primär (alltid synlig):** Översikt · Kalender · Bokningar · Meddelanden *(+ desktop:
Mina tjänster · Kunder · Recensioner)*

**"Mer"-meny, grupperad:**

- **Dagligt arbete:** Logga arbete `voice_logging` · Mina tjänster · Kunder
- **Planering:** Ruttplanering `route_planning` · Rutt-annonser `route_announcements` ·
  Besöksplanering · Gruppbokningar
- **Mitt företag:** Insikter `business_insights` · Recensioner · Hjälp `help_center` ·
  Min profil

**Dolda (endast direktlänk, ej i nav):** Rutter (arkiv) · Verifiering · Export ·
Integrationer · Debug · Häst-tidslinje.

```
Leverantörsnav
├─ Översikt        /provider/dashboard   [offline-safe]   ← startsida
├─ Kalender        /provider/calendar    [offline-safe]
├─ Bokningar       /provider/bookings    [offline-safe, badge: pending]
├─ Meddelanden     /provider/messages    [flag: messaging, badge: unread]
└─ Mer
   ├─ Dagligt arbete:  Logga arbete · Tjänster · Kunder
   ├─ Planering:       Ruttplanering · Rutt-annonser · Besöksplanering · Gruppbokningar
   └─ Mitt företag:    Insikter · Recensioner · Hjälp · Min profil
```

Källa: `src/components/layout/ProviderNav.tsx`, `src/components/layout/BottomTabBar.tsx`,
`src/lib/demo-mode.ts`.

---

## Page-by-page observations

Demo-relevans-skala: ⭐⭐⭐ kärnvärde (visar vad produkten gör) · ⭐⭐ stödjande ·
⭐ admin/konfig · ❌ ej för demo.

### Kärnytor (i demo)

| Sida | Route | Demo | Observation |
|------|-------|------|-------------|
| **Översikt** | `/dashboard` | ⭐⭐ | Startsida. Onboarding-checklist, priority action-kort, 4 stat-kort (tjänster, kommande, nya förfrågningar, recensioner), kollapsbara grafer (bokningar/vecka, intäkt/månad), aktiva rutter, snabblänkar. **Demo-risk:** mycket av detta blir tomt eller trivialt med lite demodata; statistik-graferna är dess enda *unika* värde och de kräver historik för att imponera. Onboarding + rutter döljs/tunnas i demo → kvar blir en sida som mest dubblerar räknare. |
| **Kalender** | `/calendar` | ⭐⭐⭐ | Dag/3-dagar/vecka/månad, bokningsblock med färgkodning, pending-banner med snabbåtgärder, klick → BookingDetailDialog (full statushantering + reschedule + notering + recension), redigera öppettider, undantag/stängt-dagar, skapa manuell bokning. **Den klart starkaste demo-ytan** — visuell, interaktiv, "så här ser min vecka ut". |
| **Bokningar** | `/bookings` | ⭐⭐⭐ | 6 statusflikar (Alla/Väntar/Bekräftade/Genomförda/Ej infunna/Avbokade) med räknare, bokningskort med kund/häst/pris/kvitto, alla statusåtgärder. **Funktionellt ~90 % överlapp med Kalendern** men bättre för "visa allt snabbt, filtrera". Svag empty state ("Inga bokningar"). |
| **Kunder** | `/customers` | ⭐⭐ | Kundlista, hästar, kundanteckningar. Bra empty state med både auto- och manuell väg. Visar återkommande-kund-värdet. |
| **Tjänster** | `/services` | ⭐⭐⭐ | Skapa/hantera tjänster (hovslagning, massage…). **Bäst i klassen empty state** med konkreta exempel + CTA. Grundförutsättning för hela produkten — utan tjänster kan ingen boka. |
| **Insikter** | `/insights` | ⭐⭐ | Affärsstatistik (intäkt, bokningar, retention). Värdefull men kräver data för att inte kännas tom; ingen tydlig empty state. |
| **Meddelanden** | `/messages` | ⭐⭐ | Kund↔leverantör-konversationer. Neutral empty state. Bra för att visa tvåvägs-kommunikation om demodata finns. |
| **Min profil** | `/profile` | ⭐⭐ | Personlig + företagsprofil, tillgänglighet, inställningar, feature-flaggade sektioner. I "Mer". |
| **Hjälp** | `/help` | ⭐ | Hjälpcenter/FAQ. I "Mer". Stöd, inte värde-demo. |

### Avancerade/dolda i demo (för referens)

| Sida | Route | Demo | Observation |
|------|-------|------|-------------|
| Recensioner | `/reviews` | ⭐⭐ | Social proof. Döljs i demo (redirect → profil). Kunde vara ⭐⭐⭐ med bra demodata. |
| Besöksplanering | `/due-for-service` | ⭐⭐ | Smarta påminnelser. Bra pedagogisk empty state. Dold i demo. |
| Ruttplanering | `/route-planning` | ⭐ | Kräver flera bokningar + geo-förståelse. Rätt att dölja. |
| Rutt-annonser | `/announcements` | ⭐ | Avancerad opt-in. Bästa empty state i appen (säljer värdet). Rätt att dölja i demo. |
| Gruppbokningar | `/group-bookings` | ⭐ | Stallgemenskaper. Terminologiglapp ("grupprequests" internt vs "gruppbokningar" i UI). Rätt att dölja. |
| Logga arbete (voice) | `/voice-log` | ⭐ | Nischat röst→AI-flöde. Rätt att dölja. |
| Rutter (arkiv) | `/routes` | ⭐ | Historik. Svag empty state. Admin-brus i demo. |
| Verifiering | `/verification` | ⭐ | ID-setup. Admin-brus. |
| Export | `/export` | ⭐ | GDPR-export. Admin-brus. |
| Integrationer | `/settings/integrations` | ⭐ | Fortnox m.m. Admin-brus. |
| Debug | `/debug` | ❌ | Dev-verktyg. Aldrig i demo. |

### Empty states (viktigt för demo med tunn data)

- **Starka (kontext + CTA + värde):** Tjänster, Rutt-annonser, Besöksplanering, Gruppbokningar.
- **Svaga (för minimala):** Bokningar ("Inga bokningar"), Rutter ("Du har inga rutter än").
- **Neutrala:** Meddelanden, Insikter (ingen explicit empty state — riskerar att se "trasig" ut tom).

### Terminologi

- Navigeringslabels är konsekvent svenska och generiska nog för hovslagare/veterinär/terapeut
  ("Tjänster", "Kunder", "Häst" fungerar för alla).
- **Glapp att städa:** "grupprequests" (internt) vs "gruppbokningar" (UI); "återbesöksintervall"
  vs "revisitintervall" vs "intervall" — välj en. (Lågt prioriterat för demo eftersom dessa
  sidor döljs, men relevant om de visas.)

---

## Overlap matrix

Vad finns var bland de tre kärnytorna (rad = funktion/data):

| Funktion / Data | Översikt | Bokningar | Kalender |
|---|:---:|:---:|:---:|
| Visa alla bokningar | – | ✔ | ✔ (visuellt) |
| Filtrera på status | – | ✔ | ✔ (färg) |
| Se bokningsdetaljer | – | ✔ | ✔ (dialog) |
| Acceptera pending | ✔ (via nav) | ✔ | ✔ (banner/dialog) |
| Avvisa / avboka | ✔ (via nav) | ✔ | ✔ |
| Markera genomförd / ej infunnit | – | ✔ | ✔ |
| Lägg till notering | – | ✔ | ✔ (samma komponent) |
| Se/ge recension | – | ✔ | ✔ |
| Omboka | – | – | ✔ |
| Hantera tillgänglighet/undantag | – | – | ✔ |
| Skapa manuell bokning | – | – | ✔ |
| Statistik / grafer | ✔ | – | – |
| Aktiva rutter | ✔ | – | – |
| Priority action / nästa steg | ✔ | – | – |
| Onboarding-progress | ✔ | – | – |
| Räknare: nya förfrågningar | ✔ | ✔ | ✔ |
| Räknare: kommande bokningar | ✔ | – | ✔ |

**Tolkning:**

- **Kalendern är supersettet för bokningshantering.** Allt Bokningar kan göra kan Kalendern
  göra (samma API-anrop) — plus omboka, tillgänglighet och manuell bokning som *bara* finns
  i Kalendern.
- **Bokningars enda unika UX-värde är listan + snabbfiltret**, inte funktionen.
- **Översikts enda unika värde är statistik, rutter, onboarding och priority action** — varav
  flera är svaga eller tomma i demo.
- **Tre ytor visar samma två räknare** (nya förfrågningar, kommande bokningar) → tydligaste
  signalen på redundans för en ny tittare.

---

## Keep / Simplify / Move / Remove

> Rekommendationer för **demo-upplevelsen**. Inget föreslås raderas ur produkten i stort —
> detta gäller vad demon ska *visa* och hur navigationen ska *kännas*.

### KEEP (oförändrat, bär demon)

- **Kalender** — primär arbetsyta, starkaste värde-demo.
- **Tjänster** — grundförutsättning + bäst empty state.
- **Kunder** — visar återkommande-kund-värdet.

### SIMPLIFY (behåll men trimma)

- **Översikt** → smal "start/sammanfattning": behåll priority action + 2–3 nyckeltal, lyft
  fram statistik (dess unika värde) och länka tydligt vidare till Kalender. Ta bort dubbletter
  av räknare som redan syns i Kalender/Bokningar.
- **Bokningar** → behåll som *lista/filter-vy* men positionera den som komplement till
  Kalendern, inte som likvärdig primär flik. Förbättra empty state.
- **Insikter** → ge en tydlig empty/"såhär blir det med data"-vy så den inte ser trasig ut tom.

### MOVE (flytta från primär till "Mer" i demo)

- **Bokningar** → från primär flik till "Mer" (eller sekundär), när Kalendern är primär yta.
- **Insikter, Meddelanden, Recensioner** → sekundärt i demo om målet är 3–4 primära flikar.
- **Profil/Hjälp** → redan i "Mer"; behåll.

### REMOVE (från demon — redan mestadels gjort)

- Rutter (arkiv), Verifiering, Export, Integrationer, Debug, Voice-log, Ruttplanering,
  Rutt-annonser, Gruppbokningar — **döljs redan korrekt i demo.** Ingen åtgärd, men bekräfta
  att inga djuplänkar i demodata leder in i dem.

---

## Open questions for Johan

1. **Demo-mål:** Är demon till för att *sälja in* (wow-faktor, värde på 2 min) eller för att
   *visa bredd* (allt produkten kan)? Svaret avgör om vi ska ner till 3–4 flikar eller behålla 7.
2. **Primär yta:** Är du bekväm med att göra **Kalendern** till leverantörens startyta i demo,
   istället för Översikt? (Det är den enskilt största IA-ändringen.)
3. **Bokningar:** Får Bokningar tonas ner till "Mer"/sekundär i demo, eller ser du den som en
   måste-ha primär flik?
4. **Översikt:** Vill du behålla Översikt som "hem" för nya/inaktiva leverantörer även i demo,
   eller är en sammanslagning till Kalender + smal toppsammanfattning OK?
5. **Demodata-mognad:** Hur mycket historik har Erik i demon? Statistik/Insikter/Recensioner
   står och faller med data — ska vi prioritera demodata-kvalitet före IA-trimning?
6. **Mobil vs desktop:** Är demon primärt mobil (BottomTabBar, 4+Mer) eller desktop (7 flikar
   ryms)? Trimningsbehovet är mycket större på mobil.

---

## Recommended first UX slices

Små, oberoende slices i värdeordning. Varje levererar demo-värde fristående.

**Slice 1 (MVP) — Kalender som primär arbetsyta + smal Översikt.**
Sätt Kalendern först i demo-navigationen (startyta), och banta Översikt till en
sammanfattningsremsa (priority action + statistik + "öppna kalendern"). Mål: en ny tittare
landar direkt i "så här ser min vecka ut" istället för en räknar-vägg. *Störst värdeandel,
adresserar huvudrisken.*

**Slice 2 — Tona ner Bokningar till sekundär lista.**
Flytta Bokningar från primär flik till "Mer" (behåll full funktion). Kalendern blir
hanteringsytan; Bokningar blir "visa allt/filtrera". Minskar trippel-redundansen till
en tydlig primär + en sekundär. *Beroende: gör efter Slice 1 så Kalendern bär lasten.*

**Slice 3 — Trimma demo-navigationen till 3–4 primära flikar.**
Reducera `demoTabs` från 7 till t.ex. Kalender · Tjänster · Kunder (+ "Mer" för resten).
Färre val = snabbare förståelse. *Kräver beslut på Open question 1 + 6.*

**Slice 4 — Empty states för demo-trygghet.**
Ge Bokningar, Insikter och Rutter (om synliga) kontextuella empty states i nivå med Tjänster
("X dyker upp här när …"). Skyddar demon mot att se tom/trasig ut vid tunn data.

**Slice 5 — Terminologi-städ.**
Ena "gruppbokningar" och "återbesöksintervall". Lågt brådskande för demo (sidorna döljs) men
billig kvalitetshöjning om de exponeras.

---

> **Nästa steg:** Claude Design tar detta underlag, bekräftar de upplevelse-baserade
> observationerna live i staging-demon, och prioriterar slices mot demo-målet (Open question 1).
