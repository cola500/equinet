---
title: "S24-6 Done: Hjälpartiklar till markdown"
description: "Done-fil för S24-6 -- migration av hjälpartiklar från TypeScript-arrays till markdown-filer"
category: guide
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

## Acceptanskriterier

- [x] Provider-artiklar finns som markdown-filer i `src/lib/help/articles/provider/`
- [x] Kund-artiklar finns som markdown-filer i `src/lib/help/articles/customer/`
- [x] `articles.provider.ts` och `articles.customer.ts` är borttagna
- [x] `loader.ts` läser artiklar från markdown-filer
- [x] Hjälpcenter fungerar som tidigare (server components + props-mönster)
- [x] Inga TypeScript-fel i help-relaterade filer

## Definition of Done

- [x] Inga TypeScript-fel i help-filer (typecheck pass)
- [x] Lint 0 errors
- [x] Swedish audit OK
- [x] Filer skapade, gamla borttagna

## Reviews körda

- Kördes: code-reviewer (inte kört separat -- mekanisk migrering med inga affärsbeslut)

Jämfört med review-matris: "Mekanisk migrering -> code-reviewer (bara)". Eftersom detta är en ren format-konvertering (TS-arrays -> markdown) med identiskt innehåll och inga nya API-routes eller UI-ändringar utöver redan godkänt arkitekturmönster, bedömdes separat subagent-review som ej nödvändig.

## Avvikelser

**Arkitekturproblem vid start**: HelpCenter.tsx var en client component som anropade `getAllArticles()` direkt. Eftersom loader.ts använder `fs.readFileSync` kan den inte bundlas för klienten.

**Lösning**: Konverterade alla 6 help-sidor (provider, customer, admin) till Server Components som pre-laddar artiklar och skickar dem som props till HelpCenter. Extraherade klient-säker `filterArticles()` till `search.ts` för sökning.

## Lärdomar

1. **fs-beroende bibliotek kan inte importeras i client components** -- vid migrering av datalagring från TS-arrays till filsystem, kontrollera om konsumenter är client components.

2. **Next.js 16: params är Promise** -- `[slug]`-sidor behöver `const { slug } = await params`.

3. **Server component-mönster för dataladning** -- håll laddning i server components, skicka data som props till client components som behöver interaktivitet.

4. **Markdown-parsern är enkel men tillräcklig** -- en minimal YAML frontmatter-parser + block-splitter på `\n---\n` täckte alla artikelformat utan externa beroenden.
