---
title: "S30-5 Plan: Hjalpartiklar till markdown"
description: "Migrera 2441 rader TS-artiklar till markdown-filer med en loader"
category: plan
status: wip
last_updated: 2026-04-17
sections:
  - Approach
  - Filer
  - Risker
---

# S30-5: Hjalpartiklar till markdown

## Approach

1. Skriv konverteringsskript som laser TS-arrays och genererar markdown-filer
2. Skapa `src/lib/help/articles/provider/<slug>.md`, `customer/<slug>.md`, `admin/<slug>.md`
3. Skriv `src/lib/help/loader.ts` som laser markdown och returnerar HelpArticle[]
4. Uppdatera `index.ts` att anvanda loadern istallet for att importera TS-arrays
5. Ta bort `articles.provider.ts`, `articles.customer.ts`, `articles.admin.ts`
6. Uppdatera tester

Markdown-format per fil:
- YAML frontmatter: slug, title, role, section, keywords, summary
- Body: markdown som mappas till HelpContent[] (## = heading, 1. = steps, - = bullets, > Tips: = tip)

Ingen ny dependency -- enkel YAML/markdown-parser i loadern.

## Filer

- **Nya:** 51 markdown-filer, `src/lib/help/loader.ts`, `scripts/convert-help-articles.ts`
- **Andras:** `src/lib/help/index.ts`, `src/lib/help/index.test.ts`
- **Tas bort:** `articles.provider.ts`, `articles.customer.ts`, `articles.admin.ts`

## Risker

- Markdown-parsern maste vara robust nog for att aterka HelpContent-strukturen korrekt
- Server-only: fs.readFileSync fungerar i Next.js server men inte i klient
- iOS native help anvander samma API -- verifiera att det fortfarande fungerar
