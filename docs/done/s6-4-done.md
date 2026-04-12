---
title: "S6-4 Done -- RLS Spike"
description: "Avslutningsdokument for RLS research-spike"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S6-4 Done -- RLS Spike

## Acceptanskriterier

Fran sprint-dokumentet:

- [x] Fraga 1 besvarad: Kan vi använde RLS med Prisma direkt-anslutning? **Ja, via Client Extensions + set_config() i transaction. Men Prismas eget exempel varnar for produktion.**
- [x] Fraga 2 besvarad: Kraver det Supabase-klient? **Nej, men Supabase-klienten gor det enklare. Byte ar inte realistiskt (83+ filer).**
- [x] Fraga 3 besvarad: PoC pa en tabell? **Möjligt men kraver att ALLA 83+ access-punkter wrappas i RLS-aware extension.**
- [x] Fraga 4 besvarad: Prestanda-paverkan? **~2-5ms per query (extra transaction overhead). Forsumbart for Equinet.**
- [x] Fraga 5 besvarad: Serverless + PgBouncer? **Fungerar med transaction mode + set_config(..., TRUE). INTE statement mode.**
- [x] Dokument: `docs/research/rls-spike.md` med fynd, rekommendation, effort-uppskattning
- [x] Ingen koddandring i main (research-spike)

## Definition of Done

- [x] Leverans matchar sprint-dokumentets krav
- [x] Tidboxen halldes (1 session)
- [x] Rekommendation dokumenterad med motivering

## Avvikelser

Inga. Spiken levererade exakt det som sprintdokumentet bad om.

## Lardomar

1. **Prisma + RLS ar inte moget nog.** Officella exemplet varnar for produktion. Community-bibliotek har lag adoption. Avvakta tills Prisma har forstaklassig support.

2. **Single-tenant minskar RLS-vardet.** RLS ar mest vardefullt i multi-tenant-miljoer. Equinet ar single-tenant per deployment -- en leverantör per instans.

3. **Applikationslagrets skydd ar starkare an forvantat.** Analys av 83+ access-punkter visade att de flesta redan har ownership-checks. `findById()` utan filter ar enda identifierade risken, och den kan fixas med en enkel repository-andring.

4. **Konkret forbattring identifierad (Alt 3):** Byt `findById()` till `findByIdForProvider()`/`findByIdForCustomer()`. Liten insats, hogt varde. Kan bli en framtida story.
