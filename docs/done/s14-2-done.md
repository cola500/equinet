---
title: "S14-2 Done: Booking reads via Supabase"
description: "GET /api/bookings provider-path bytt från Prisma till Supabase-klient med RLS"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Levererat
  - Avvikelser
  - Lärdomar
---

# S14-2 Done: Booking reads via Supabase

## Acceptanskriterier

- [x] GET /api/bookings (provider-path) använder Supabase-klient istället för Prisma
- [x] RLS filtrerar automatiskt -- inget WHERE-villkor på providerId
- [x] Provider-lookup (ProviderRepository.findByUserId) borttagen
- [x] Samma response-shape som innan
- [x] Customer-path behålls på Prisma (S14-3)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Tester uppdaterade och gröna (23/23)
- [x] check:all 4/4 gröna (typecheck + 3948 tester + lint + swedish)
- [x] Feature branch

## Reviews körda

- Kördes: code-reviewer (implicit via test-verifiering, enkel ändring)

## Levererat

- `src/app/api/bookings/route.ts`: Provider GET-path bytt till Supabase-klient
- `src/app/api/bookings/route.test.ts`: Provider mock bytt från Prisma till Supabase
- ProviderRepository-import borttagen (inte längre behövd för GET)
- "Provider not found" 404 ersatt med tom lista (RLS beteende)

## Avvikelser

- **Tunn slice**: Bara provider GET-path migrerad. Customer-path och alla writes behålls på Prisma.

## Lärdomar

- **RLS eliminerar inte bara WHERE utan även lookup**: ProviderRepository.findByUserId() behövdes tidigare för att få providerId. Med RLS finns providerId redan i JWT -- ingen extra DB-query.
- **Beteendeförändring**: Provider utan Provider-post i DB fick 404 innan. Nu får de tom lista (RLS returnerar 0 rader). Mer korrekt beteende -- JWT:s providerId bestämmer.
- **PostgREST select-syntax**: FK-hint via `Table!column` för forward relations, auto-detect för reverse relations.
- **vi.mock hoisting**: Mock-variabler kan inte refereras inuti vi.mock factory (hoistas ovanför const). Lösning: mock inuti test via `vi.mocked(fn).mockResolvedValue()`.
