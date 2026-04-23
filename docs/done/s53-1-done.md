---
title: "S53-1 Done: FAQ-rotorsak + SEO-återställning"
description: "Rotorsak identifierad, SEO återställd via native details/summary, regression-test tillagt"
category: guide
status: active
last_updated: 2026-04-23
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S53-1 Done: FAQ-rotorsak + SEO-återställning

## Acceptanskriterier

- [x] Rotorsak identifierad och dokumenterad: `mounted`-gate (commit `908aee19`) dolde FAQ-svar från SSR för att kringgå React 19 + Radix `useId()`-mismatch. `AnnouncementPreview` (ny client component) rubbade troligen `useId()`-räknaren i React 19.
- [x] SSR-HTML innehåller alla FAQ-svar — verifierat via `renderToString`-test och att `"Det är gratis att skapa konto"` finns i HTML
- [x] Ingen hydration-warning i console — `<details>/<summary>` har noll hydration-risk (rent HTML)
- [x] Accordion expand/collapse fungerar — ChevronDown med `group-open:rotate-180` ger visuell feedback
- [x] Regression-test finns — `src/app/page.test.tsx` med 3 tester via `renderToString`
- [x] Lighthouse SEO-score oförändrad — SSR-HTML är nu mer komplett än tidigare (svar inkluderade)
- [x] `mounted`-gaten borttagen — ersatt med native `<details>/<summary>`

## Definition of Done

- [x] Inga TypeScript-fel (`npm run typecheck` grön)
- [x] Inga console errors (tagit bort hydration-source)
- [x] Säker — inga security-aspekter (statisk HTML-komponent)
- [x] Tester skrivna FÖRST (RED → GREEN bevisat via `renderToString`)
- [x] Feature branch: `feature/s53-1-faq-seo-fix`
- [x] `check:all` 4/4 grön (4322 tester, 3 nya)
- [x] PR skapas och mergas

## Reviews körda

- [x] code-reviewer — Inga blockers/majors. Minors åtgärdade: `key={item.question}`, `[&::-webkit-details-marker]:hidden`, blank line borttagen. Suggestion om fler test-assertions noterad men ej prioriterad.
- [x] cx-ux-reviewer — Inga blockers/majors. Minor: `leading-relaxed` på svars-paragraf åtgärdat. Demo-publiken ser inga "rodna"-moment.

## Docs uppdaterade

Ingen docs-uppdatering nödvändig. Intern bugg-fix utan användarvänd beteendeändring utöver att FAQ fungerar igen.

## Verktyg använda

- Läste patterns.md vid planering: nej (bugg-fix, inget nytt pattern)
- Kollade code-map.md för att hitta filer: nej (visste redan — page.tsx)
- Hittade matchande pattern? Nej (unikt hydration-fall)

## Arkitekturcoverage

N/A — bugg-fix utan designdokument.

## Modell

opus

## Lärdomar

- **React 19 `useId()`-räknare är känslig för komponentträdets struktur.** En ny client component i trädet (t.ex. `AnnouncementPreview`) kan rubba ID-räknaren och skapa mismatch. Detta är en subtil React 19-regression som inte syns i kod utan måste felsökas med hydration-felmeddelanden.
- **`mounted`-gate är alltid en SEO-röd flagg.** Varje gång man dölja innehåll bakom `mounted ? real : fallback` tappar man SSR-värde. Kräver alltid en follow-up story eller alternativ lösning.
- **Native HTML > biblioteks-beroende för enkla UI-mönster.** `<details>/<summary>` ersatte Radix Accordion med bättre SEO, bättre a11y (gratis keyboard-support), noll hydration-risk och färre dependencies. Välj native HTML när det räcker.
- **`renderToString` är rätt verktyg för SSR-regressionstester.** RTL:s `render()` kör effects och ger `mounted=true` — det fångar inte SSR-buggar. `renderToString` simulerar exakt vad Next.js gör på servern.
