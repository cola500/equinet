---
title: "API Types Pattern"
description: "Beslut: lättviktigt mönster för delade API request/response-typer mellan API, frontend och iOS — DEFERRED. Nuvarande manuell sync funkar; etablera mönster när verklig smärtpunkt syns."
category: architecture
status: draft
last_updated: 2026-05-06
tags: [architecture, api, typescript, types, frontend, ios]
related:
  - ddd-light-pattern.md
  - domain-boundaries-discovery.md
sections:
  - Beslut
  - Nuvarande approach
  - Triggers för att aktivera
  - Möjliga vägar (jämförelse)
  - Bedömt minsta värde när vi väl gör det
---

# API Types Pattern — DEFERRED

> **Beslut 2026-05-06:** Inte aktivera ett formellt typdelnings-mönster nu. Se "Triggers för att aktivera" nedan.

---

## Beslut

**Inte etablera formellt mönster för delade API-typer just nu.** Nuvarande manuella sync mellan API-routes, frontend-komponenter och iOS-Swift-modeller fungerar tillräckligt. Bygg detta dokument vidare när vi faktiskt ser smärtpunkter som motiverar abstraktionen.

**Argument:**
- Tre konsumenter (Next.js Server Components, klient-komponenter, iOS) har idag egna typdefinitioner. Det är dubbeljobb men inte mätbart problem.
- Typdrift mellan API och frontend har orsakat **få** produktionsbuggar de senaste sprintarna (mest fångas via integration-tester och reviewer).
- iOS är ändå manuell sync (Swift Codable är inte TypeScript-importerbar). En API-types-pattern på TypeScript-sidan löser inte iOS-problemet, bara webb-frontend-frågan.
- Etablera mönster utan tydlig återkommande smärtpunkt = prematur abstraktion.

---

## Nuvarande approach

### Web (Next.js frontend)

- Komponenter definierar **lokala interfaces** för API-respons:
  ```typescript
  interface Booking {
    id: string
    status: string
    customerNotes: string | null
  }

  const { data } = useSWR<Booking[]>(`/api/bookings`, fetcher)
  ```
- Vissa typer ligger i `src/types/` (delade mellan flera komponenter)
- Vissa ligger inline i komponentfilen
- Ingen automatisk koppling mot API-route-shape

### iOS (Swift)

- Native skärmar har egna Codable-structs (`BookingsModels.swift`, `CustomerModels.swift`, etc.)
- Sync med API:n sker manuellt vid feature-tillägg
- Bakåtkompatibilitet: nya fält görs `Optional<String>` etc. så gamla iOS-versioner inte kraschar

### API-routes

- `NextResponse.json(data)` — TypeScript-kompilatorn ser inte respons-shape utåt
- Ingen genererad OpenAPI/Swagger-dokumentation
- Routes-tester verifierar shape via inline-assertioner

### Hur typdrift idag fångas

1. **Integration-tester** kör route + parse:ar respons → fångar shape-brott
2. **Reviewer** läser diff och kollar manuellt om frontend ska uppdateras
3. **Runtime-fel** i komponent när fält saknas (sällan eftersom fields är `null`-tolerant)

---

## Triggers för att aktivera

Detta dokument bör utökas och en konkret pattern införas när **minst två** av dessa är sanna:

- 2+ produktionsbuggar på 6 månader orsakade av typdrift mellan API och frontend
- En frontend-komponent måste uppdateras 5+ gånger på en månad pga API-shape-ändringar utan att testet fångade det
- Vi börjar bygga en delbar SDK till tredjeparts-utvecklare (extern API-publik)
- Ett eget admin-tooling-projekt (separat repo) behöver konsumera Equinets API och vill ha typsäkerhet
- Vi får 3+ frontend-konsumenter (web + iOS-native + Android + watch + extern admin) — då blir manuell sync ohållbar

Inget av detta är sant idag.

---

## Möjliga vägar (jämförelse, för framtida beslut)

När triggers fyrar, dessa är möjliga vägar — bedöms då, inte nu:

### A. Delade types-filer (lättviktigt)

`src/types/api/<domain>.ts` exporterar request- och response-types. Både routes och frontend-komponenter importerar därifrån. Manuell uppdatering vid ändringar, men en enda källa.

**Fördel:** Nästan ingen infrastruktur, ingen build-step.
**Nackdel:** Fortfarande manuell — TypeScript verifierar inte att route faktiskt returnerar den typen.

### B. tRPC

End-to-end typsäkerhet utan separat schema. Frontend importerar typer direkt från backend-route.

**Fördel:** Fullständig typsäkerhet utan kodgenerering.
**Nackdel:** Ny stack, kräver tRPC-router istället av Next.js API-routes. Stor refactor.

### C. OpenAPI/Swagger + codegen

Generera typer från OpenAPI-spec. Kan användas för både frontend och iOS (Swift codegen).

**Fördel:** Multi-platform (TS + Swift + andra).
**Nackdel:** OpenAPI-spec måste underhållas, codegen-steg i build.

### D. Zod-schema som källa

Återanvänd Zod-validering-schema (vi använder dem redan för request-validering) också för respons-shape. Frontend importerar `z.infer<typeof X>` typ.

**Fördel:** Använder befintlig Zod-investering, ingen ny abstraktion.
**Nackdel:** Måste lägga till output-schemas för respons (idag bara input). Hjälper inte iOS.

### E. GraphQL

Schema-first med GraphQL-codegen.

**Fördel:** Stark typdiscipline, tooling.
**Nackdel:** REST → GraphQL-migration är stor.

---

## Bedömt minsta värde när vi väl gör det

Om triggers fyrar och vi måste välja: **börja med Variant A eller D** (lättviktigt). Migrera till B-E bara om A/D bevisas otillräckligt.

Pilot-skala: 1-2 kärndomäner (Booking, Provider) under 1 sprint. Mät typdrift-incidenter före och efter. Om noll förbättring → backa.

---

**Status:** DEFERRED. Inget mönster etablerat. Ingen kod påverkad.
