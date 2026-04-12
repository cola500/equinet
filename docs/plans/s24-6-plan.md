---
title: "Plan S24-6: Hjälpartiklar till markdown"
description: "Flytta articles.provider.ts + articles.customer.ts till markdown-filer"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Problemanalys
  - Lösningsarkitektur
  - Filer
  - Markdownformat
---

# Plan S24-6: Hjälpartiklar till markdown

## Problemanalys

`articles.provider.ts` (1335 rader) och `articles.customer.ts` (788 rader) är
TypeScript-filer med hårdkodad hjälpinnehåll. Problem:

1. `HelpCenter.tsx` är `"use client"` och anropar `getAllArticles(role)` direkt
2. Om loader använder `fs.readFileSync` fungerar det inte i klientbundlet
3. Lösning: refaktorera HelpCenter till props-driven + konvertera hjälpsidor till
   server components

## Lösningsarkitektur

```
loader.ts (server-only, fs.readFileSync)
  ↓ läser 44 .md filer
index.ts (server-only, re-exporterar loader + search)
  ↓ anropas av server components
search.ts (client-safe, ren array-filtrering)
  ↓ importeras av HelpCenter.tsx

HelpCenter.tsx (client) -- tar initialArticles: HelpArticle[] + sections: string[]
  ↓ search är lokal array-filtrering (inget I/O)

help/page.tsx (server) -- kallar getAllArticles + getArticleSections, ger props
help/[slug]/page.tsx (server) -- kallar getArticle, passerar artikel som prop
```

## Filer

### Nya filer
- `src/lib/help/loader.ts` -- markdown-parser (fs.readFileSync)
- `src/lib/help/search.ts` -- client-safe array-filter
- `src/lib/help/articles/provider/*.md` -- 28 artiklar
- `src/lib/help/articles/customer/*.md` -- 16 artiklar

### Ändrade filer
- `src/lib/help/index.ts` -- importera från loader
- `src/components/help/HelpCenter.tsx` -- acceptera props
- `src/app/provider/help/page.tsx` -- server component
- `src/app/customer/help/page.tsx` -- server component
- `src/app/admin/help/page.tsx` -- server component (om den använder articles)
- `src/app/provider/help/[slug]/page.tsx` -- server component
- `src/app/customer/help/[slug]/page.tsx` -- server component
- `src/app/admin/help/[slug]/page.tsx` -- server component

### Raderade filer
- `src/lib/help/articles.provider.ts`
- `src/lib/help/articles.customer.ts`

## Markdownformat

```markdown
---
slug: komma-igang
title: Komma igång som leverantör
role: provider
section: Kom igång
keywords:
  - komma igång
  - starta
summary: En rads sammanfattning.
---

Paragraftext här.

1. Steg ett
2. Steg två

---

Nästa block.

### Rubrik i blocket

- Punkt ett
- Punkt två

> Tips visas i amber-ruta.
```

### Parserregler per block (separerade med `\n---\n`)
- `### text` → heading
- `> text` → tip
- `1. `, `2. ` etc → steps
- `- text` → bullets
- Övriga rader → paragraphs

## Risker

- 44 markdown-filer att skapa -- risk för stavfel. Mitigation: testerna validerar att alla slugs är unika och att content.length > 0 per artikel.
- Sidor som konverteras till server components -- risk att klientlogik bryts. Mitigation: search-funktionalitet bibehålls som lokal array-filtrering i HelpCenter.
