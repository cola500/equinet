---
title: "Domain Boundaries Discovery"
description: "Praktisk bedömning: ska Equinet ha tydligare backend/domänseparation, separat backend-repo, och formell DDD? Konkret beslut per dimension med data från nuvarande state."
category: architecture
status: active
last_updated: 2026-05-06
tags: [architecture, ddd, domain-driven-design, repository-pattern, monorepo, discovery]
sections:
  - TL;DR
  - 1. Nuvarande arkitektur
  - 2. Var domänlogiken bor idag
  - 3. Coupling-risker
  - 4. DDD-värde per domän
  - 5. Repository pattern
  - 6. Separat backend-repo
  - 7. Entity Framework-jämförelse
  - 8. Rekommendation
  - 9. Minsta nästa slice
---

# Domain Boundaries Discovery

> **Inga kodändringar. Ingen refaktor.** Praktisk bedömning baserad på data från nuvarande kodbas och faktiska smärtpunkter, inte arkitekturteori.

---

## TL;DR

Equinet kör redan **DDD-Light** med tydlig service+repository-struktur för kärndomäner. Det fungerar bra. Att eskalera till "full DDD" eller separat backend-repo skulle **just nu** introducera mer komplexitet än det löser. Tre konkreta åtgärder rekommenderas, inga är arkitektur-omstrukturering.

| Område | Beslut |
|--------|--------|
| Separat backend-repo | **Inte nu.** För tidigt — symptomerna saknas. |
| Formell DDD (Aggregate Root, Value Object, etc.) | **Inte nu.** Formell DDD ger inte tillräckligt värde för Equinet just nu, givet teamstorlek, komplexitet och befintlig DDD-Light-struktur. |
| Repository pattern | **Behåll och utöka.** Redan på plats för 36 implementationer. Lägg till vid nya kärndomäner. |
| Domain services | **Behåll.** 80 service-filer fungerar som kontrakt mellan API och DB. |
| Backend/frontend-separation | **Bättre nu än vad det ser ut som** — Server Components anropar inte Prisma direkt, alla 182 API-routes är formell entry point. |

---

## 1. Nuvarande arkitektur

### Stack

- **Next.js 16 App Router** — frontend (Server + Client Components) + API routes i samma repo
- **Prisma 6** — ORM mot PostgreSQL
- **Supabase** — Auth (med Custom Access Token Hook), DB, Storage, RLS
- **Vercel** — deployment, regions `fra1`
- **iOS** — hybrid WKWebView med native skärmar i `ios/Equinet/`

### Konkret data (mätt 2026-05-06)

| Mått | Antal |
|------|-------|
| API-routes totalt | 182 |
| Routes som importerar Prisma direkt | 107 (≈60 %) |
| Routes som importerar domain services | 75 (≈40 %) |
| Domain service-filer | 80 |
| Repository-implementationer | 36 (Mock + Prisma per kärndomän) |
| Native iOS-routes (`/api/native/*`) | 29 |
| Server components som anropar Prisma direkt utanför API | **0** |

> Sista raden är värd att notera: ingen `page.tsx` eller `layout.tsx` läser DB direkt. Det betyder att **frontend-renderingen redan är skild från DB-lagret** — alla läsningar går via API-routes (eller Server Components som anropar service-funktioner som returnerar data via repos).

### Lager idag

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│  ┌────────────────┐  ┌──────────────────┐              │
│  │ Web (Next.js)  │  │ iOS (WKWebView   │              │
│  │ - Components   │  │  + Native screens)│             │
│  └────────┬───────┘  └────────┬─────────┘              │
└───────────┼──────────────────┼──────────────────────────┘
            │ fetch/SWR        │ Bearer JWT
            ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│  API Layer (src/app/api/**/route.ts)        182 routes  │
│  - auth + rate limit + Zod validation                   │
│  - delegate to domain service OR direct Prisma          │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Domain Services (src/domain/<name>/*.ts)  80 files     │
│  - business logic                                       │
│  - error mapping (mapXErrorToStatus)                    │
│  - depends on Repository interface                      │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Repositories (src/infrastructure/persistence/<name>/)  │
│  - IRepository interface                                │
│  - MockRepository (for tests)                           │
│  - PrismaRepository (for runtime)                       │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Prisma Client (src/lib/prisma.ts) → PostgreSQL         │
└─────────────────────────────────────────────────────────┘
```

Detta är **redan en lagerseparation**. Den följer inte exakt Hexagonal/Onion-mönstret, men har flesta egenskaperna.

---

## 2. Var domänlogiken bor idag

### Tydlig fördelning per domän

Från `.claude/rules/code-map.md` finns 21 namngivna domäner med varierande layer-struktur:

| Domän-typ | Antal | Service? | Repository? | Exempel |
|-----------|-------|----------|-------------|---------|
| **Kärndomän** (CLAUDE.md repo-obligatoriskt) | 8 | Ja | Ja | Booking, Provider, Service, Horse, CustomerReview, Follow, Subscription, Stable |
| **Annan domän med repo** | 4 | Ja | Ja | Auth, Group-booking, Municipality-watch, Provider-customer-note, Review |
| **Service utan repo** (stöddomän) | 9 | Ja | Nej | Account, Customer-insight, Data-retention, Due-for-service, Notification, Payment (gateway-pattern), Reminder, Voice-log, Booking-series |
| **Direkt Prisma i route** | ~107 routes | Nej | Nej | AvailabilityException, AvailabilitySchedule, FeatureFlag, små CRUD-endpoints |

### Var domänlogiken faktiskt ligger

- **Kärndomäner:** I service-fil. Routes är tunna (auth → validate → service → response).
- **Stöddomäner med service:** I service-fil. Repo skulle vara overkill.
- **Enkel CRUD:** Direkt i route med Prisma. Ingen domänlogik egentligen.

### Frontend-coupling till backend

- Komponenter använder **TanStack/SWR** som anropar `/api/*`-endpoints.
- Type-säkerhet: API returnerar `NextResponse.json(data)` — typer regenereras inte automatiskt mot frontend. Frontend har egen interface-definition i `src/types/`.
- iOS native skärmar har egna **request/response-typer** definierade i Swift (`BookingsModels.swift`, `CustomerModels.swift`, etc.) — manuell synkronisering vid API-ändringar.

**Detta är en käll till coupling-risker** (sektion 3).

---

## 3. Coupling-risker

### A. Frontend ↔ API-types (medel)

API-respons-shapes är **inte typgenererade** mot frontend. Om en route ändrar `select`-block → frontend-komponenten kan tyst vara fel.

**Mitigering idag:** Manuell typsynk + integration-tester. Inte automatiskt.

**Eskalering:** Bara ett problem om vi har många kontrakt-brott. I praktiken hänt sällan (testsviten + reviewer fångar oftast).

### B. API routes ↔ Prisma direkt (medel-hög)

**107 av 182 routes (60 %) importerar Prisma direkt.** Det inkluderar några ord-domain-routes som har vuxit och egentligen borde ha service+repo.

**Smärtpunkt:** Ändringar i schema kräver "hitta alla `select`-block i alla routes" (vi har stött på det flera gånger — se `gotchas.md`-noter om "Nytt fält på Booking → 6 select-block"). Ett service-lager som returnerar typade DTOs hade isolerat den smärtan.

**Mitigering idag:** Kärndomäner använder service+repo (Booking är ett bra exempel — `select` finns på ett ställe i `PrismaBookingRepository`). Stöddomäner använder Prisma direkt.

**Eskalering om:** En specifik domän börjar få schema-ändringar som tvingar oss att uppdatera 5+ routes manuellt. Då är det dags att lyfta den till repo-pattern.

### C. Domain logic ↔ database schema (låg)

Repositories abstraherar Prisma-objekten till domain-types för kärndomäner. Stöddomäner har direkt schema-koppling, men de är små och CRUD-tunga.

**Inte ett akut problem.** Skulle bli det om vi hade flera databaser (vi har bara PostgreSQL).

### D. iOS ↔ web/API contracts (medel)

29 native-routes i `/api/native/*` är medvetet separata från web-routes. Det isolerar iOS-kontrakt från webb-API-iteration.

**Smärtpunkt:** Manuell synk av Swift Codable-structs vs API-respons-shape. När en route lägger till ett fält måste iOS-modellen uppdateras eller fältet ignoreras.

**Mitigering idag:** Optionella Codable-fält (`String?`) är konvention. Bakåtkompatibilitet bevaras automatiskt om nya fält är optional.

**Eskalering om:** Vi får många native-routes och iOS-utvecklingen blir hindrad av kontrakts-osäkerhet. Inte där än.

### E. Test-coupling till Prisma (låg)

Routes som använder Prisma direkt kräver mock-Prisma vid test (= mer mock-setup). Routes med service+repo kan testas via `MockRepo`-klass (= renare).

**Inte ett akut problem.** Vi har 4375+ tester som körs grön. Mock-setup är hanterbar.

---

## 4. DDD-värde per domän

DDD ger värde när **domänlogiken är komplex** och språket mellan kod och produktledning behöver harmoniseras. För enkel CRUD är DDD overkill.

| Domän | Komplexitet | DDD-värde | Kommentar |
|-------|-------------|-----------|-----------|
| **Booking** | Hög | **Hög** | Status-maskin, dubbelbokningsskydd, betalning, återkommande-serier. Här finns redan service+repo + `BookingStatus.ts` + `BookingValidation.ts` + `BookingEvents.ts` — i princip Aggregate Root-mönstret utan att kalla det så. Bara att fortsätta. |
| **Payment** | Hög | Medel | Stripe-integration via `PaymentGateway`-pattern (Adapter). Refund/dispute/webhook-event-dedup. Domain logic finns men är kopplad till Stripe-kontrakt. Mer DDD skulle introducera "PaymentMethod" som Value Object — möjligen onödigt. |
| **Provider/Service** | Medel | Låg-medel | Provider och Service är CRUD med några business rules (priser, varaktighet, intervall). Repository finns. Aggregate Root-tänkande skulle inte ändra mycket. |
| **Route planning** | Hög | Hög | Komplex domän (geografisk distance, OSRM, time slots, route optimization). Idag spridd över `RouteService`, `TravelTimeService`, `Location.ts` (Value Object), `TimeSlot.ts` (Value Object). Faktiskt redan ganska DDD. Värde: dokumentera explicit som "Routes är ett aggregate". |
| **Horse/Stable** | Medel | Låg | Horse-Stable är en relation. Repository finns. Inga komplexa business rules. |
| **Notifications** | Medel | Låg | Notifier-pattern är fungerande (`RouteAnnouncementNotifier`, `NotificationService`). Mer DDD skulle introducera "DomainEvent" formellt — onödigt om publish-subscribe redan funkar. |

### Slutsats

Vi gör redan informell DDD där den behövs (Booking, Payment, Routes). Vi har Value Objects (Location, TimeSlot, BookingStatus). Det fungerar. Att lägga till formell DDD-terminology hade varit dokumentation-uppgift snarare än kodförändring.

**Var det INTE skulle hjälpa:** AvailabilityException, FeatureFlag, AdminAuditLog, små CRUD-endpoints. De är data, inte domän.

---

## 5. Repository pattern — bedöm var det ger mest värde

### Vad det ger

- **Test-isolation:** Service kan testas mot `MockRepo` utan databas
- **Schema-isolation:** Schema-ändringar fångas på ett ställe (repo) istället för spridda i 5+ routes
- **Kontrakt-tydlighet:** `IRepository`-interface är explicit kontrakt mot DB-lagret
- **Refactor-säkerhet:** Byta DB-lager (om någonsin behövs) blir lättare

### Vad det kostar

- **Boilerplate:** Tre filer per domän (Interface, Mock, Prisma)
- **Indirection:** En till nivå att läsa när man felsöker
- **Maintainenance:** Mock måste hållas synkad med Prisma (= extra arbete vid feature-tillägg)

### Var det ger mest värde just nu

**Behåll för 8 kärndomäner** — de är komplexa nog att motivera abstraktionen.

**Lägg INTE till** för:
- Stöddomäner (AvailabilityException, AvailabilitySchedule, FeatureFlag, AdminAuditLog) — för enkla
- Engångs-CRUD-endpoints
- Domäner som är "data" snarare än "business"

**Värt att överväga vid:**
- En domän som idag bara har `Service` (utan repo) växer och får 5+ routes som kallar samma Prisma-queries → lyft till repo-pattern
- Specifika kandidater idag som kan vara på gränsen: `Notification`, `Payment` (har gateway men inte repo). Bedöm vid nästa stora feature-tillägg.

### Anti-pattern att undvika

- Repository **över Prisma direkt** med 1:1-mappning (= bara en tunn wrapper). Det är abstraktionsbrus.
- Repository som **läcker Prisma-typer** (returnerar `Prisma.BookingGetPayload<...>`). Då är det inget skydd.
- Repository som **inte används** (lagts till "för säkerhets skull"). Bara döda kodvägar.

Vi gör inget av detta idag — bra.

---

## 6. Separat backend-repo

### För/nackdelar

| | För | Mot |
|---|-----|-----|
| **Deploy-isolering** | Backend kan deployas oberoende av frontend | Vercel + Next.js är optimerat för combined deploy. Splitting introducerar två deploy-pipelines. |
| **Team-separation** | Två team kan jobba parallellt utan stepping-on-toes | Vi har inte två team. Det är dig + en handfull AI-agenter. |
| **Olika tech-stacks** | Backend kan vara Go/Rust/Python | Vår TypeScript-stack täcker hela appen. Splitting kräver ny stack-investering. |
| **Type-säkerhet** | Generera client SDK från backend-types | Idag manuell typsynk. SDK-generering kan göras i monorepo också (tRPC, GraphQL Codegen). |
| **Vercel cold-start** | Mindre frontend-bundle om backend är separat | Knappast — Next.js code-splitting hanterar det. |
| **CI-tid** | Backend-tester kan köras separat | Redan möjligt med vitest filtering. |

### När det är värt (inte än)

- **Multipla frontend-konsumenter:** Web + iOS + Android + Apple Watch + extern API-integrationer. Vi har web + iOS, men iOS är via WKWebView + native — använder samma backend. **Behov: 3+ frontend-typer med olika release-cykler.**
- **Olika team:** Backend-team + frontend-team som vill iterera oberoende. **Behov: 5+ utvecklare.**
- **Olika prestandaprofil:** Backend behöver Rust för CPU-intensiv, frontend behöver Next.js. **Behov: Specifik perf-issue som kräver byte.**
- **Compliance/säkerhet:** Backend måste isoleras i specifik infra. **Behov: Reglerad bransch eller säkerhetsincident.**

Inget av detta är sant idag.

### När det är **för tidigt** (= idag)

- Teamet är 1 person + AI-agenter
- Same-repo-flow funkar (commit, deploy, rollback)
- Ingen demonstrerad smärta från coupling
- Vercel-stack är optimerad för monorepo

### Risk för ökad komplexitet vid splitting

| Risk | Sannolikhet | Påverkan |
|------|-------------|----------|
| Två deploy-pipelines att underhålla | Hög | Hög |
| Type-drift mellan repos | Hög | Medel |
| Auth-state-sync (cookie-domain, JWT-rotation) | Medel | Hög |
| CI dubblering (lint, test, build × 2) | Hög | Medel |
| Lokal dev-setup | Hög | Medel — `npm run dev` startar två servrar |
| Refactor-overhead (api change → frontend update) | Hög | Medel |

**Sammanfattat:** Att splitta nu skulle kosta ~1-2 sprintar i refactor + ny CI/CD-setup, för att lösa problem vi inte har.

### Påverkan på Vercel/CI/staging om vi någonsin splittar

- Två separata Vercel-projekt
- Två custom domains (vi har redan separata för prod/staging — inget skulle ändras där)
- Auth: backend exponerar API på subdomän, frontend anropar via CORS — komplicerar Supabase Auth-cookies
- Staging-mönster måste replikeras för båda repos

---

## 7. Entity Framework-jämförelse

Vänskaplig clarification — för det fall någon föreslagit "EF-liknande ORM mellan domän och databas" som om vi saknar det:

| EF (.NET) | Prisma (vår stack) | Skillnad |
|-----------|---------------------|----------|
| `DbContext` | `PrismaClient` | Båda är ORM/data-access |
| Entities (POCO med navigation properties) | Prisma-modeller | Båda mappar tabeller till klasser/typer |
| `DbSet<Entity>` | `prisma.entity` | Båda är fluent query-builders |
| Code-First Migrations | `prisma migrate` | Båda genererar SQL-migrations från modell-definition |
| Change Tracking | Inte i Prisma (manuell) | EF spårar entity-state automatiskt; Prisma kräver explicit save |
| Lazy Loading | Inte i Prisma | EF kan ladda relationer on-access; Prisma kräver explicit `include`/`select` |
| LINQ | TypeScript Prisma Client | Liknande typsäkerhet |

### Vad Prisma fyller (= ORM-rollen)

✅ Schema-definition i `prisma/schema.prisma`
✅ Auto-genererad typsäker klient
✅ Migrations-system
✅ Query-builder med typsäkerhet
✅ Relations (1:N, N:N, etc.)

### Vad Prisma INTE löser jämfört med tydligt domänlager

❌ **Domain logic separation** — Prisma är data-access, inte business logic. Du måste själv bygga domain layer ovanpå (= det vi gör med `src/domain/`).
❌ **Aggregate boundaries** — Prisma vet inte att en Booking + dess Payment + dess Notification är en logisk enhet. Du implementerar det i Service.
❌ **Domain Events** — Inget pub/sub inbyggt. Vi använder `BookingEventHandlers.ts` + fire-and-forget för det.
❌ **Validation rules** — Prisma har inte business-rule-engine. Vi använder Zod + service-validation.
❌ **Identity & sessioning** — Supabase Auth gör detta, inte Prisma.

### Vad EF har som vi saknar (om någon argumenterar för det)

- **Change tracking:** EF kan auto-spara förändrade objekt. I Prisma måste man explicit anropa `update`. **Vår preferens:** explicit är bättre — färre överraskande writes.
- **Lazy loading:** EF kan ladda relationer on-access. I Prisma måste man explicit `include`. **Vår preferens:** explicit är bättre — undviker N+1-fällor.
- **Identity column.** Prisma har detta också (`@id @default(cuid())`).

**Slutsats:** Prisma fyller ORM-rollen för vår stack. Det vi saknar (domain layer) är en separat fråga som vi redan löser med `src/domain/`.

---

## 8. Rekommendation

### Do **now**

1. **Dokumentera nuvarande DDD-Light-mönstret explicit.** Vi har det, men dokumentationen är spridd över `code-map.md`, `CLAUDE.md`, individuella domain-services. En enskild `docs/architecture/ddd-light-pattern.md` (~30 min) skulle förenkla onboarding och referens vid framtida domain-tillägg. **Värde: hög, kostnad: låg.**
2. **Audit "service utan repo"-domäner mot vilka som har vuxit till kärn-storlek.** Specifikt: Notification (3+ services, men ingen repo), Payment (Gateway-pattern, ingen repo). Bedöm om de behöver lyftas. **Värde: medel, kostnad: 1h audit + eventuellt 1 dag refactor om vi flyttar någon.**
3. **Lägg till TypeScript-types för API-respons** så att frontend kan importera typad shape från backend. Idag dubbelt definiering. Skulle kunna göras med en lättviktig `src/types/api/<domain>.ts`-fil per domän som exporterar både request och response-types. **Värde: medel, kostnad: 1-2h per domän.**

### Do **later** (när trigger-villkoret uppfylls)

| Action | Trigger |
|--------|---------|
| Lyft `Notification` till repo-pattern | När 5+ routes anropar samma Prisma-queries direkt |
| Introducera tRPC för end-to-end typsäkerhet | När API-shape-drift orsakar 2+ produktionsbuggar på 6 månader |
| Strukturera Booking explicit som Aggregate Root med Domain Events | När vi behöver event-sourcing eller reaktiv arkitektur (= troligen aldrig för Equinet) |
| Lyfta `Payment` till repo (separat från Gateway) | När betalningsflöden får mer state att läsa (refund history, dispute timeline) |

### Do **not** yet

| Don't | Varför |
|-------|--------|
| Splitta backend till separat repo | Inga av "när det är värt"-villkoren uppfyllda. Skulle kosta sprintar för noll mätbart värde. |
| Införa formell DDD-terminology i hela kodbasen | Vi har redan informell DDD där den behövs. Ren omdöpning är dokumentation, inte kod. |
| Byta Prisma till annan ORM | Prisma fyller sin roll. Ingen smärtpunkt motiverar bytet. |
| Generera frontend SDK från backend types | Manuell synk fungerar. SDK-generation introducerar build-step. Bara om kontrakt-drift blir frekvent. |
| Refactor alla 107 "Prisma-i-route" till service+repo | 80 % av dem är CRUD utan business logic. Repository skulle bara vara wrapper. |

---

## 9. Minsta nästa slice

Om vi ska göra något åt domänarkitektur i nästa session, **här är den minsta meningsfulla:**

### Slice: "DDD-Light pattern dokumenterad + service-without-repo audit"

**Tid:** ~3 timmar.

**Inget i prod-kod ändras.** Bara dokumentation + audit.

**Steg:**

1. Skapa `docs/architecture/ddd-light-pattern.md` (~1h):
   - Förklara vår 4-lager-struktur (Route → Service → Repo → Prisma)
   - Lista de 8 kärndomänerna och deras filer (kopiera från `code-map.md`)
   - Lista undantag (stöddomäner med direkt Prisma — och varför)
   - Inkludera Booking som referens-exempel
   - Lägg till "när lyfta en Service till Repo-pattern"-checklista

2. Audit "Service utan Repo"-domäner (~1h):
   - För varje: räkna routes som kallar servicen
   - För varje: räkna direct Prisma-anrop i routes som hör till samma domän
   - Slutsats per domän: "OK utan repo" eller "kandidat för uppgradering"

3. Skapa `docs/architecture/api-types-pattern.md` om man tycker det är värt (~1h):
   - Förslag på `src/types/api/<domain>.ts`-mönster
   - Beslut om vi gör det stegvis (per ny route) eller batch

**Output:** En arkitektur-doc + en audit-rapport. Ingen kod, ingen refactor. Beslut om eventuella nästa-slice-storyn dokumenterat.

**Inte i denna slice:** repo-pattern-uppgradering, frontend SDK-generering, repo-split.

---

## Vad jag inte tar ställning till

- **Multi-database-strategi.** Om vi någonsin lägger till en analytics-DB eller en cache-DB är det separata diskussioner.
- **Event Sourcing eller CQRS.** Bookings rapporterar events, men vi event-sourcear inte. Inte motiverat med vår skala.
- **gRPC eller GraphQL.** REST + JSON funkar för nu. Skulle bara byta om mobil-bandbredd eller API-volym blir specifikt issue.

---

**Slut på rapport. Ingen kod ändrad. Inga commits. Inga arkitektur-omstruktureringar utförda.**
