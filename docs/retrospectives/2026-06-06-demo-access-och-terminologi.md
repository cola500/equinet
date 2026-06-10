---
title: "Retrospektiv: Demo-access och hovslagar-terminologi"
description: Retro över en dags demo-polish på staging — login-routing, kundnav i demo, demo-ingångar på login + landning, samt realistisk hovslagar-terminologi i seeden. Täcker både process och utveckling.
category: retro
status: active
last_updated: 2026-06-06
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra (utveckling)
  - Vad gick bra (process)
  - Vad kan förbättras
  - Patterns att spara
  - 5 Whys
  - Lärandeeffekt
tags:
  - retrospective
  - demo
  - staging
  - process
---

# Retrospektiv: Demo-access och hovslagar-terminologi

**Datum:** 2026-06-06
**Scope:** En dags demo-polish mot staging i fem slices: (1) login-redirect via `/dashboard`, (2) kundnavigation synlig i demoläge, (3) demo-ingångar på login-sidan, (4) demo-ingångar på landningssidan, (5) realistisk hovslagar-terminologi i demo-seeden. Plus opt-in inloggningsbar demokund (mergad tidigt).

---

## Resultat

- 14 ändrade/nya filer, ~719 insertions / ~110 deletions (netto mot #354-baslinjen)
- 5 PR:er (#355–#359), alla mot `staging`, alla mergade med grön CI
- ~+8 nya tester (4569 → 4577 totalt), inga regressioner
- Typecheck = 0 errors genom hela dagen
- 0 nya migrationer (ren seed-/UI-/copy-förbättring)
- Allt live-verifierat på staging-demo (desktop + mobil)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Auth/routing | `src/app/(auth)/login/page.tsx` | Login routar via `/dashboard` istället för hårdkodad provider-redirect i demoläge |
| Layout | `src/components/layout/Header.tsx` | `CustomerNav` renderas nu även i demoläge (`!demo`-gaten borttagen) |
| Landing/UI | `src/app/page.tsx`, `src/components/landing/DemoLoginButton.tsx`, `demo-personas.ts` | "Utforska appen"-sektion + två demo-knappar; centraliserade demo-personer |
| Login/UI | `src/app/(auth)/login/page.tsx` | Två demo-knappar (hästägare/leverantör) i demoläge |
| Seed | `scripts/seed-demo-provider.ts` | 7 realistiska hovslagar-tjänster, ommappade bokningar/recensioner/serie/konversation, hovslagarnära fritext, `resetDemoData()` rensar nu tjänster |
| Tester | `*.test.tsx`, `demo-personas.test.ts` | TDD för varje slice (RED→GREEN) |
| Docs | `docs/demo/demo-terminology-review-2026-06.md` | Read-only-analys → implementationsstatus |

## Vad gick bra (utveckling)

### 1. Rotorsaks-fix istället för symptom
Login-buggen ("fastnar efter inloggning") löstes inte med en specialcase för Lisa, utan genom att ta bort duplicerad routing-logik och låta `/dashboard` (som redan routar per `userType`) göra jobbet. Minus kod, inte plus.

### 2. Centralisering tog bort duplicering
När demo-knapparna skulle finnas på två ytor (login + landning) extraherades `DEMO_PERSONAS` till en delad modul — credentials på ett enda ställe. "Ingen credential-duplicering"-kravet blev en städning, inte en börda.

### 3. Reset-risken hittades i analysen, inte i produktion
Read-only-granskningen av seeden flaggade att `resetDemoData()` inte rensade tjänster → namnbyten hade lämnat föräldralösa tjänster på staging. Åtgärdat i samma slice. Verifierat live: exakt 7 tjänster, inga gamla.

### 4. TDD fångade beteendet
Varje slice skrev test först (login-redirect, CustomerNav-i-demo, demo-personas, DemoLoginButton-props). RED bekräftades innan GREEN.

## Vad gick bra (process)

### 1. Read-only-analys före ändring
Två slices (CustomerNav-audit, terminologi-review) började med ren analys + dokument + minsta-slice-förslag innan en rad kod skrevs. Det gjorde att reset-risken och rotorsaken var kända innan implementation.

### 2. Tydliga stopp-gates styrda av Johan
"Stoppa innan merge", "stoppa innan commit/push", "stoppa efter analys" — varje slice hade en explicit gate. Det höll kontrollen hos product owner och gav naturliga granskningspunkter.

### 3. 5 Whys på den ursprungliga buggen
Login-buggen kördes genom 5 Whys → grundorsaken (demo-antaganden från när demon var leverantörsbara) avslöjades, vilket direkt förklarade nästa bugg (CustomerNav-gaten). En analys, två fix.

## Vad kan förbättras

### 1. Staging-verifiering kan inte ske före merge
Återkommande friktion: staging bygger bara `staging`-branchen, så varje slice krävde merge → vänta på deploy → verifiera. Visuell pre-merge-verifiering gjordes lokalt med demo-server (`NEXT_PUBLIC_DEMO_MODE=true` på `:3100`), men det var manuellt och uppstod på nytt varje slice.

**Prioritet:** MEDEL — överväg en dokumenterad "lokal demo-verifierings"-rutin (egen port + demo-env + lokal seed) som standard pre-merge-steg, så det inte återuppfinns varje gång.

### 2. Bakgrunds-pollning av deploy gick sönder två gånger
zsh read-only-variabeln `status` och en grep-pattern som inte matchade gav tomma/felande pollningar. Kostade omkörningar.

**Prioritet:** LÅG — trivialt, men ett litet återanvändbart "vänta-på-vercel-deploy"-skript skulle eliminera felet.

### 3. Interaktiv seed kräver manuell handoff
Staging-seeden kan inte köras av agenten (interaktiv `DATABASE_URL`-prompt). Korrekt ur säkerhetssynpunkt, men bröt det annars autonoma flödet — Johan fick köra ett kommando mitt i.

**Prioritet:** LÅG — detta är medvetet (secret stannar hos Johan). Dokumentera bara handoff-punkten tydligt i demo-runbooken.

## Patterns att spara

### Routa via /dashboard, hårdkoda aldrig roll-redirect
Efter inloggning: `router.push("/dashboard")` och låt `/dashboard` (server) redirecta per `userType`. Duplicera aldrig roll-routing i login/knappar — det var exakt det som orsakade login-buggen.

### Demo-personer i en delad modul
`src/components/landing/demo-personas.ts` är enda källan för demo-credentials. Komponenter tar props med defaults därifrån. Återanvänds av login + landning utan duplicering.

### Lokal demo-verifiering pre-merge
`NEXT_PUBLIC_DEMO_MODE=true PORT=3100 npx next dev` mot lokal Supabase (som har demo-seed) → Playwright-verifiera demoläge utan att störa `:3000`. Enda sättet att se demo-UX före merge till staging.

### resetDemoData() måste städa tjänster
Vid byte av seedade tjänstenamn: rensa providerns `Service`-rader i reset (efter bokningar + serier), annars blir gamla namn föräldralösa på staging. Implicit M2M (RouteOrder) rensas av Prisma automatiskt.

## 5 Whys

### Problem: Kund fastnar i väntläge efter inloggning (demo)
1. Varför? Lisa (kund) landade på `/provider/calendar` med tom vy.
2. Varför? Leverantörs-API:erna gav 403 — hon är kund.
3. Varför var hon på leverantörssidan? Login hårdkodade `/provider/calendar` för alla i demoläge.
4. Varför hårdkodat? Demo-redirecten antog att bara leverantörer loggar in i demo.
5. Varför det antagandet? Demoläget byggdes när det bara fanns en leverantörspersona; den inloggningsbara kunden (Lisa) lades till senare och bröt antagandet.

**Åtgärd:** Ta bort den hårdkodade redirecten och låt `/dashboard` routa per roll. Samma rotorsak fanns i `Header.tsx` (`!demo`-gate på `CustomerNav`) — fixad i nästa slice. Systemlärdom: *alla* demo-mode-villkor som antar en enda persona måste granskas när en ny persona introduceras.
**Status:** Implementerad (PR #356 + #357)

### Problem: Risk för föräldralösa tjänster vid terminologi-byte
1. Varför? `resetDemoData()` rensade inte `Service`.
2. Varför inte? Reset skrevs för att rensa kund-relaterad data (bokningar, hästar, kunder), inte providerns egna tjänster.
3. Varför spelar det roll nu? Vi byter *namn* på tjänster — gamla namn skulle ligga kvar bredvid nya.
4. Varför märks det inte i kod? Seeden gör `findFirst by name` → nytt namn = ny rad, ingen koll på gamla.
5. Varför fångades det ändå? Read-only-analysen av seeden gick igenom reset-flödet innan implementation.
**Åtgärd:** Lägg till `service.deleteMany({ providerId })` sist i reset. Verifierat live.
**Status:** Implementerad (PR #359)

## Lärandeeffekt

**Nyckelinsikt:** När en produkt får en ny persona (här: inloggningsbar demokund) måste *alla* villkor som tidigare antog en enda persona granskas — login-routing, nav-rendering, seed-data. Två av dagens buggar hade samma rotorsak. Process-mässigt var read-only-analys före kod och Johans explicita stopp-gates det som höll kvaliteten uppe; den största kvarvarande friktionen är att demo-UX bara kan verifieras på staging efter merge (eller lokalt med demo-server).
