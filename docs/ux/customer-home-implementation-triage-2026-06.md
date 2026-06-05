---
title: "Customer Home — Implementation Triage (Alternativ C)"
description: "Read-only implementation-triage för en minimal hästledd kundhemvy (Alternativ C). Kartlägger återanvändbara hooks/API:er, rekommenderar route (/customer), analyserar redirect-konsekvenser, definierar MVP-innehåll, listar risker och föreslår en första, rollback-bar implementation-slice. Ingen kod."
category: idea
status: draft
last_updated: 2026-06-05
sections:
  - Sammanfattning
  - Återanvändbara hooks och API:er
  - Route för kundens hem
  - Redirect-konsekvens
  - MVP-innehåll
  - Risker
  - Första implementation-slice
tags:
  - ux
  - customer
  - home
  - triage
  - implementation
related:
  - docs/ux/customer-home-vision-2026-06.md
  - docs/ux/customer-demo-discovery-2026-06.md
---

# Customer Home — Implementation Triage (Alternativ C)

> Read-only triage. Beslut: **Alternativ C — hästledd blandad kundhemvy**
> ([vision](./customer-home-vision-2026-06.md)). Mål: förstå hur en **minimal** hemvy kan byggas på
> **befintlig data**. **Ingen kod, ingen commit/push.** Branch: `staging`.
> FACT = verifierat i kod. INFERENCE = bedömning/förslag.

---

## Sammanfattning

- **Allt MVP:t behöver finns redan** som hooks/API:er — ingen ny endpoint eller datamodell krävs.
- **Rekommenderad route: `/customer`** (ny `src/app/customer/page.tsx`). Den är **redan redirect-target**
  i `middleware-auth.ts` men saknar sida idag → **404** (latent bugg). Att lägga hemvyn där fixar samtidigt
  den danglande redirecten.
- **Redirect-ändringen är 1 rad** i `src/app/dashboard/page.tsx` (customer-grenen `/providers` → `/customer`),
  helst **bakom en feature flag** (`customer_home`) för instant rollback. Provider/admin opåverkade.
- **Minsta refaktor:** extrahera `DueStatusBadge` (idag lokal i `customer/horses/page.tsx`) till en delad
  komponent så hemmet och hästlistan delar den.
- **Största risk:** tom/ny kund (0 hästar/bokningar) — kräver bra onboarding-empty-state. Demo-läget
  påverkas inte (kund saknar demo-mode idag).

---

## 1. Återanvändbara hooks och API:er (FACT)

| Behov | Hook / API | Returnerar | Anmärkning |
|---|---|---|---|
| **Hästar** | `useHorses()` → SWR `/api/horses` | `HorseData[]` (+ `mutate`) | Bild, ras, födelseår m.m. |
| **Försenat/nästa-due per häst** | `useDueForService()` → SWR `/api/customer/due-for-service` | `{ items: DueForServiceResult[] }` med `horseId`, `status: "overdue"\|"upcoming"\|"ok"`, `daysUntilDue`, `dueDate` | **Kärnsignalen** — redan beräknad |
| **Bokningar (kommande/historik)** | SWR `/api/bookings` (Booking[]) | bokningar med `status`, `bookingDate`, häst, leverantör, tjänst | Används redan i `customer/bookings/page.tsx:40`; ingen dedikerad hook — antingen återanvänd `useSWR("/api/bookings")` eller extrahera `useCustomerBookings()` |
| **Vårdhistorik / anteckningar** | `/api/horses/[id]/timeline`, `/api/horses/[id]/notes` | per-häst | **Ej i MVP** — drill-down på hästprofilen (rang 3-4) |
| **Tom-/onboarding-nudge** | `CustomerOnboardingChecklist` (komponent finns) | — | Kan återanvändas för 0-data-läget |
| **Due-badge** | `DueStatusBadge` (lokal i `customer/horses/page.tsx`) | — | **Extrahera till delad komponent** för återanvändning |

**Slutsats:** hemmet är en **kompositionsvy** över 3 befintliga SWR-källor (hästar + due + bokningar). Inget nytt API.

---

## 2. Route för kundens hem

| Alternativ | För | Emot | Bedömning |
|---|---|---|---|
| **`/customer` (ny `src/app/customer/page.tsx`)** | Redan redirect-target i `middleware-auth` (rad 80, 85) → **fixar dangling 404**; kanonisk kund-rot; kort | Ny fil | **REKOMMENDERAS** |
| `/customer/dashboard` (ny) | Speglar provider | `/customer` (bare) **förblir 404**; speglar inte kundens språk ("dashboard") | Näst bäst |
| Förstärk `/customer/horses` | Minst nytt; hästkort finns redan | Blandar "hantera hästar" med "hem"; `/customer` förblir 404; svår att hålla isär | Avråds som hem |

> **FACT:** det finns **ingen** `src/app/customer/page.tsx` och ingen `customer/layout.tsx` idag — sidor wrappar
> sig själva i `CustomerLayout`. `middleware-auth.ts` skickar providers till `/customer` (rad 80) och listar
> `/customer` som customer-only (rad 85), men eftersom sidan saknas blir det **404**. En hemvy på `/customer`
> löser detta.

**Nav:** "Mina hästar" (`/customer/horses`) behålls som full hantera-vy. Om en egen "Hem"-flik i `CustomerNav`
behövs är ett **separat beslut** (MVP når hemmet via login-landning + Header "Översikt").

---

## 3. Redirect-konsekvens

**Idag (FACT, `src/app/dashboard/page.tsx`):**
```
session.userType === "provider" → /provider/dashboard (eller /provider/calendar i demo)
annars (customer)               → /providers   ← landar på PUBLIK sök
```

**Förslag:** customer-grenen `/providers` → **`/customer`**, helst flagg-gated:
```
customer → flags.customer_home ? "/customer" : "/providers"
```

| Yta | Påverkas? | Hur |
|---|---|---|
| `/dashboard` funnel | **Ja** (1 rad) | customer → `/customer` (flagg-gated) |
| `login/page.tsx` | Nej | Skickar redan icke-demo till `/dashboard` → följer funneln automatiskt |
| `middleware-auth.ts` | Nej (positiv bieffekt) | Provider→`/customer`-redirecten resolvar nu till hemmet istf. 404; `/customer` är customer-gated |
| Header "Översikt" (kund) | Nej | Pekar på `/dashboard` → `/customer` |
| **Provider / admin** | **Nej** | Egna grenar orörda |

**Test att uppdatera:** ingen `/dashboard`-test finns idag (FACT), men **grep brett** efter test som hävdar
`customer → /providers` innan ändring.

---

## 4. MVP-innehåll (Alternativ C) → datakälla

| Block | Innehåll | Datakälla | Tom-läge |
|---|---|---|---|
| **Behöver uppmärksamhet** (smal rad överst) | Försenade hästar (röd) + "Boka"-CTA; topp 2-3, "+N till" | `useDueForService()` items `status==="overdue"` (+ `"upcoming"` amber) | Dölj raden om inga overdue/upcoming |
| **Nästa bokning** | "Molly · Omskoning · 9 juni · Erik J." | `/api/bookings` — tidigaste `bookingDate > now` & status confirmed/pending | "Ingen kommande bokning — boka nästa besök" |
| **Mina hästar** | Kompakt hästgrid: bild, namn, `DueStatusBadge`, "Visa häst" | `useHorses()` + `DueStatusBadge` (delad) | Se onboarding nedan |
| **CTA: Hitta hjälp** | Knapp → `/providers` | statisk | alltid |
| **CTA: Lägg till häst** | Visas när **0 hästar** | → `AddEditHorseDialog` / `/customer/horses` | **onboarding-empty:** rubrik + "Lägg till häst" + "Hitta tjänster" (ev. `CustomerOnboardingChecklist`) |

INFERENCE: hemmet ska besvara "är något rött? när är nästa?" på <2 sek; allt-grönt → lugnt läge (bara
"Nästa: …" + hästgrid).

---

## 5. Risker

| Risk | Detalj | Mitigering |
|---|---|---|
| **Loading states** | 3 SWR-källor (hästar/due/bokningar) → layout-shift | En `CustomerHomeSkeleton` tills alla tre resolvat; eller progressiv med reserverad höjd |
| **Tom data** | Ny kund: 0 hästar och/eller 0 bokningar | Dedikerat onboarding-empty (Lägg till häst + Hitta tjänster); "Nästa bokning"-tomtext |
| **Många hästar** | Översikt + akut signal kan drunkna | Attention-raden cappar (topp 2-3 + "+N till"); hästgrid scrollar; sortera overdue först |
| **Mobil layout** | 390px | Attention-rad full bredd; hästgrid 1-2 kol (`useIsMobile`/grid-cols); återanvänd befintliga responsiva mönster |
| **Demo vs riktig kund** | Kund saknar demo-mode idag (CustomerNav släcks i demo) | Hemmet är **full-läge**; demo opåverkat. När kund-demo byggs (discovery Slice 1) blir hemmet demo-landningen |
| **Dangling `/customer`** | Provider-redirect → 404 idag | Att skapa sidan **fixar** detta (positivt) |
| **Due-data tom/fel** | Hästar utan intervall → inga due-items | Behandla som "ok"; visa bara hästkort utan badge |

---

## 6. Första implementation-slice

**Scope:** minimal hemvy på `/customer` + flagg-gated redirect. Inget nav-bygge, ingen ny endpoint.

### Filer
| Åtgärd | Fil | Not |
|---|---|---|
| **NY** | `src/app/customer/page.tsx` | `"use client"`, `CustomerLayout`, komponerar `useHorses` + `useDueForService` + `useSWR("/api/bookings")` |
| **NY (liten)** | `src/components/customer/DueStatusBadge.tsx` | Extraherad från `customer/horses/page.tsx` (delad) |
| **ÄNDRA** | `src/app/customer/horses/page.tsx` | Importera delad `DueStatusBadge` istf. lokal |
| **ÄNDRA** | `src/app/dashboard/page.tsx` | customer-gren → `/customer` (flagg-gated `customer_home`) |
| **(ev.) NY** | `src/lib/feature-flag-definitions.ts` | Lägg `customer_home` (default off → on vid rollout) |
| **(ev.) NY** | `src/components/customer/CustomerHomeSkeleton.tsx` | Loading |

> Hemvyn kan börja som **en fil** (inline-block) och extraheras till delkomponenter vid 3+ återanvändning
> eller >300 rader (per refaktor-policy).

### Teststrategi
- **Komponenttester** för hemmet (mocka `useHorses`/`useDueForService`/SWR):
  - overdue-häst → attention-rad + "Boka"-CTA
  - kommande bokning → "Nästa bokning"-block
  - hästgrid renderar med `DueStatusBadge`
  - **0 hästar** → onboarding-empty (Lägg till häst + Hitta tjänster)
  - loading → skeleton
- **Redirect-test:** `/dashboard` customer + flag on → `/customer`; flag off → `/providers` (befintligt beteende).
- **Ingen ny API** → ingen ny integration/BDD-loop (återanvänder redan testade endpoints).
- `npm run check:all` grön.

### Visual verification
- Playwright/Mobile MCP (staging-like / lokal demo), **Lisa** (seedad, inloggningsbar — kräver discovery
  Slice 1 för demo, annars lokal kund): login → landar `/customer` → attention (Molly overdue) + nästa
  bokning + hästkort; **desktop + mobil (iPhone 17 Pro)**; + tom-läge för en fräsch kund.

### Rollback
- **Instant:** `customer_home`-flaggan av → funneln går tillbaka till `/providers`; nya `/customer`-sidan blir
  oreferens­erad (men ofarlig, och fixar fortfarande dangling-redirecten).
- **Kod:** ändringen är additiv (1 ny sida + 1 flagg-gated rad + 1 badge-extraktion) → ren `git revert`.

---

## Öppna beslut innan slice startar
1. **Flagga:** bygga `customer_home` feature flag (rekommenderas för säker rollout/rollback)?
2. **Nav:** lägga en "Hem"-flik i `CustomerNav`, eller räcker login-landning + Header "Översikt" för MVP?
3. **`upcoming` i attention-raden:** ta med amber "om X dagar" eller bara röd overdue i v1?
4. **Onboarding-empty:** återanvänd `CustomerOnboardingChecklist` eller en enklare egen empty?
5. **Demo-koppling:** vänta med visual verification tills kund-demo (discovery Slice 1) finns, eller verifiera
   mot lokal riktig kund nu?

> Källor: `src/hooks/useDueForService.ts`, `src/hooks/useHorses.ts`, `src/app/customer/bookings/page.tsx`,
> `src/app/dashboard/page.tsx`, `src/lib/middleware-auth.ts`, `src/domain/due-for-service/DueForServiceCalculator.ts`,
> [customer-home-vision](./customer-home-vision-2026-06.md), [customer-demo-discovery](./customer-demo-discovery-2026-06.md).
