---
title: "Refactor Triggers"
description: "När ska en domän i Equinet lyftas till tydligare service/repo-pattern? Konkreta triggers, escalation levels och decision checklist. Refactor styrs av smärta, inte arkitekturpreferens."
category: architecture
status: active
last_updated: 2026-05-06
tags: [architecture, refactor, decision, triggers, ddd-light]
related:
  - ddd-light-pattern.md
  - service-without-repo-audit.md
  - domain-boundaries-discovery.md
  - api-types-pattern.md
sections:
  - 1. Syfte
  - 2. Refactor triggers
  - 3. Domain escalation levels
  - 4. Non-triggers
  - 5. Decision checklist
  - 6. Aktuella bevakningskandidater (2026-05-06)
  - 7. När triggern fyrar — vad gör vi
---

# Refactor Triggers

> Pragmatisk regelsamling för när vi ska refactor:a en domän i Equinet. Refactor utlöses av **konkret smärta**, inte estetik eller arkitekturpreferens.

---

## 1. Syfte

**Refactor är inte gratis.** Varje arkitektur-uppgradering har en kostnad: tid, risk för regressioner, ny mental modell att underhålla. Vi gör refactor när **kostnaden av att inte göra det** överstiger refactor-kostnaden.

**Värdet av detta dokument:** att stoppa över-arkitektur och spar-arkitektur från att göra felaktiga val. När någon föreslår "låt oss lägga till repository här" eller "det här borde vara separat domän" — använd checklistan i sektion 5 mot triggers i sektion 2.

**Komplettera, inte ersätta:**
- [ddd-light-pattern.md](ddd-light-pattern.md) — beskriver mönstret vi följer
- [service-without-repo-audit.md](service-without-repo-audit.md) — bedömning per domän just nu
- [domain-boundaries-discovery.md](domain-boundaries-discovery.md) — varför Equinets nuvarande struktur är rätt nivå

---

## 2. Refactor triggers

Detta är **konkreta, mätbara** signaler. Vid minst **två** av dessa i samma domän → överväg refactor.

### Smärta i kod

| # | Trigger | Hur du upptäcker |
|---|---------|------------------|
| **T1** | **3+ routes duplicerar samma Prisma-query** | Sök efter samma `select`-block eller `where`-clause i flera route-filer |
| **T2** | **Schemaändring kräver ändring i 3+ filer** | När du gör `prisma migrate dev` och ser att en `select`-audit krävs på flera platser |
| **T3** | **Samma domänregel implementerad på flera ställen** | T.ex. "om status === 'cancelled' visa ej" finns i route + komponent + service |
| **T4** | **Business rules ligger i API-routes istället för service** | Komplexa `if/else`-block, beräkningar, validation bortom Zod direkt i `route.ts` |
| **T5** | **Routes >200 rader med blandat ansvar** | En route gör auth + parsning + flera DB-anrop + business rules + HTTP-mappning på en gång |
| **T6** | **Tester kräver tung Prisma-mockning** | Test-filer >300 rader med 50%+ mock-setup. Eller: samma mock duplicerat i 3+ test-filer |

### Smärta i feature-tillägg

| # | Trigger | Hur du upptäcker |
|---|---------|------------------|
| **T7** | **Återkommande buggar i samma domän pga coupling** | Bugg-tracker eller Sentry visar 2+ bugs på 6 månader med "fel `select`-block" eller "missade fält" |
| **T8** | **Feature-tillägg tar oväntat lång tid pga arkitektur** | Story uppskattad till 2 dagar tar 5 dagar pga "måste först förstå hur X hänger ihop" |
| **T9** | **Reviewer flaggar samma typ av problem upprepat** | Code-review-kommentar 3+ gånger på samma domän: "borde gå via service", "duplicerat", "oklart kontrakt" |

### Smärta i kontrakt mellan delar

| # | Trigger | Hur du upptäcker |
|---|---------|------------------|
| **T10** | **iOS/web API-kontrakt driftar isär** | iOS visar tom skärm eller "fel format" pga API-shape-ändring som inte synkades |
| **T11** | **Frontend-komponent måste uppdateras 5+ gånger på en månad pga API-shape-ändringar** | Reviewer eller felrapport visar samma typ av drift |
| **T12** | **Cross-domain-orkestrering är spretig** | "Skapa booking + skicka mail + uppdatera kalendar" finns spritt över 3 routes istället för 1 service-funktion |

---

## 3. Domain escalation levels

En domän kan sitta på olika "lagerdjup". Välj rätt nivå baserat på faktisk komplexitet, inte preferens.

### Level 0 — Direct Prisma in route

```
Route → Prisma direkt
```

**När:** Enkel CRUD utan business logic. Stöddomäner. Admin-tooling. En enskild route.

**Exempel idag:** AvailabilityException, AvailabilitySchedule, FeatureFlag, AdminAuditLog, små admin-endpoints.

**Tecken på att du är på fel nivå:** T1, T2, T3 från sektion 2.

### Level 1 — Service only (ingen repo)

```
Route → Service → Prisma
```

**När:** Domän har business logic men data-access är simpel/koncentrerad. Få konsumenter (1-3 routes). Cross-domain-orkestrering eller AI-integration.

**Exempel idag:** Reminder, Data-retention, Customer-insight, Account, Voice-log, Accounting (Gateway-pattern är en variant).

**Tecken på att du är på fel nivå:**
- T1, T2 (uppskala till L2)
- Service är 50 rader och bara wrappar Prisma → nedskala till L0

### Level 2 — Service + Repository

```
Route → Service → Repository → Prisma
```

**När:** Komplex business logic, flera konsumenter, schema-ändringar förväntas, tester behöver isolation.

**Exempel idag:** Booking, Provider, Service, Horse, CustomerReview, Follow, Subscription, Stable, Group-booking, Auth, Municipality-watch, Provider-customer-note, Review.

**Tecken på att du är på fel nivå:**
- Repo är 1:1-wrapper utan business value-add → nedskala till L1
- Domain logic börjar bli komplex med events, value objects → uppskala till L3

### Level 3 — Explicit domain model / value objects / domain events

```
Route → Service → Repository → Prisma
       ↓
    Value Objects (BookingStatus, Location, TimeSlot)
    Domain Events (BookingCreated, BookingConfirmed)
    Event Handlers (notify, log, sync calendar)
```

**När:** Domänen har komplex affärsstate-maskin. Cross-aggregate-koordinering. Återkommande logic som behöver namngivas.

**Exempel idag:** Booking har detta de facto (`BookingStatus`, `BookingEvents`, `BookingEventHandlers`). Routes med `Location`/`TimeSlot` value objects.

**Tecken på att du är på fel nivå:**
- Bara namngivning av befintlig logic, inget nytt värde → stanna på L2
- Affärsstate-maskinen blir så stor att den behöver event-sourcing eller CQRS → uppskala till L4 (sällan motiverat)

### Level 4 — Separat backend eller separat bounded context

```
Repo split, separate deploy, separate team, separate DB.
```

**När:**
- Multipla frontend-konsumenter med olika release-cykler (3+)
- Olika språk/runtimes per service
- Compliance/säkerhets-isolering krävd
- Team-storlek 5+ utvecklare

**Exempel idag:** Inga. Equinet är samlad.

**Tecken på att du är på fel nivå:**
- Splitten gör utveckling långsammare, inte snabbare → konsolidera tillbaka
- Team-storleken är 1-2 → backa till L2/L3

### Sammanfattning

| Level | Lager | Equinets antal domäner idag |
|-------|-------|------------------------------|
| L0 | Route → Prisma | ~107 routes (CRUD, stöddomäner) |
| L1 | Route → Service → Prisma | 9 domäner |
| L2 | Route → Service → Repo → Prisma | 13 domäner |
| L3 | + Value Objects + Domain Events | Booking (de facto) |
| L4 | Separat backend/repo | Inga |

**Bedömning:** Vi är på rätt fördelning. Inte för mycket, inte för lite.

---

## 4. Non-triggers

Detta ska **inte** utlösa refactor. Om du hör någon av dessa argument: stanna upp och kräv en konkret trigger ur sektion 2.

### Estetik

| # | Argument | Varför det är non-trigger |
|---|----------|---------------------------|
| **N1** | "DDD säger att vi ska ha Value Objects" | DDD är en metodologi, inte en regel. Equinet kör DDD-Light där det ger värde |
| **N2** | "Allt ska ha repo för konsistens" | Konsistens är inte värt boilerplate. L0-domäner är medvetet på Level 0 |
| **N3** | "Det här ser inte ut som ren arkitektur" | Ren arkitektur är ett mål, inte ett krav. Smärta överordnar estetik |
| **N4** | "Jag läste en blogg om hexagonal architecture" | Bra inspiration, men trigger måste komma från vår kodbas |
| **N5** | "Kompisen/konferensen sa att separat backend är bättre" | Andras kontext är inte vår. Bedöm mot triggers ovan |

### Storleksargument

| # | Argument | Varför det är non-trigger |
|---|----------|---------------------------|
| **N6** | "En route är 80 rader, det borde vara service" | Storlek är inte trigger. Komplexitet och duplicering är. En 80-radsroute som gör en sak är OK |
| **N7** | "En enstaka Prisma-query borde gå via repo" | T0/L0 är medvetet val. Lägga till repo för 1 query = boilerplate |
| **N8** | "Det här är en liten CRUD-route, men på sikt..." | Bygg för dagens problem, inte hypotetiska framtider. Trigger fyrar när framtiden faktiskt kommer |

### Process-perfektionism

| # | Argument | Varför det är non-trigger |
|---|----------|---------------------------|
| **N9** | "Vi borde ha 100% repo-coverage" | Vi har medvetet inte det. Stöddomäner är på L0 |
| **N10** | "Audit-dokumentet säger 'bevaka' så vi borde göra det nu" | "Bevaka" betyder bevaka, inte agera. Vänta på trigger |
| **N11** | "Andra projekt jag jobbat på hade tydligare separation" | Andra projekt har annan kontext. Använd triggers för Equinet |
| **N12** | "Jag har tid över denna sprint" | Tid över är inte ett refactor-skäl. Använd den till tester, dokumentation, gotchas eller pre-build-guards |

---

## 5. Decision checklist

Innan du startar refactor — gå igenom dessa **6 frågor**. Om du inte kan svara konkret på minst 4 av dem → vänta.

### 1. Vilken konkret smärta finns?

Beskriv specifikt. Inte "domänen är rörig" — utan "samma `select`-block med `customerId` finns i 5 routes" eller "schema-ändring förra veckan tvingade ändring i 4 filer".

**Bra svar:** "Notification har 4 routes där 3 av dem duplicerar `findMany`-query med samma `where`/`orderBy`."
**Dåligt svar:** "Det skulle vara renare med repo."

### 2. Hur ofta händer den?

Räkna konkreta gånger. En enstaka miss = inte trigger. Återkommande pattern = trigger.

**Bra svar:** "3 produktionsbuggar senaste 2 månader pga `select`-block-drift i Booking."
**Dåligt svar:** "Det kan hända igen."

### 3. Vilka filer påverkas?

Lista exakta filer som har problemet. Refactor-scope blir tydligare.

**Bra svar:** `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/native/bookings/route.ts`. Alla har samma `select`-block med 14 fält.
**Dåligt svar:** "Bookings i allmänhet."

### 4. Kan vi lösa med mindre ändring?

Innan refactor — kolla om det finns en mindre fix:
- Extrahera `select`-block till en konstant (delat), inte ny repo
- Lägga till en helper-funktion i en befintlig service
- Inline-fix i de 2-3 berörda filerna

**Tumregel:** Om problemet kan lösas med <50 raders ändring utan att introducera ny abstraktion — gör den fixen istället.

### 5. Vad är kostnaden?

Estimera:
- Hur många filer rörs?
- Hur många nya tester behövs?
- Hur många befintliga tester måste uppdateras?
- Hur lång tid (timmar/dagar)?
- Risk för regressioner?

**Tumregel:** Om kostnaden är >2 dagar och triggern är "1 trigger fyrad 1 gång" — vänta på fler signaler.

### 6. Hur verifieras förbättringen?

Mät något konkret. Inte "det blir snyggare" — utan "regressions-test fångar nu fall som tidigare missades" eller "nästa schema-ändring berör bara 1 fil istället för 5".

**Bra svar:** "Efter refactor: lägg till `endTime` på Booking ska bara kräva ändring i `PrismaBookingRepository.ts`."
**Dåligt svar:** "Koden blir bättre."

---

## 6. Aktuella bevakningskandidater (2026-05-06)

Från [service-without-repo-audit.md](service-without-repo-audit.md). Inga akuta. Bevaka triggers nedan vid nästa feature-arbete i berörd domän.

| Domän | Aktuell nivå | Trigger som skulle eskalera | Föreslaget hopp |
|-------|--------------|------------------------------|-----------------|
| **Booking-series** (sub-domän till Booking) | L0/L1 mix (3 routes med direct Prisma + 1 service) | Nästa schema-ändring som påverkar BookingSeries → T2 | Service-konsolidering (~2-3h) — inte ny repo, bara att routes går via `BookingSeriesService` |
| **Due-for-service** | L1 (service finns men 2 av 3 routes använder Prisma direkt) | 4:e route som behöver due-for-service-data → T1 | L1 → L2 (full repo-pattern, ~4-6h) |
| **Notification** | L1 (6 service-filer, 4 routes) | 5+ routes med duplicerade queries → T1 | L1 → L2 (~6-8h) |
| **Payment** | L1+ (Gateway-pattern istället av repo) | Payment-historik/dispute/refund-vyer som kräver flera olika queries → T1 | Lägg till `IPaymentRepository` ovanpå Gateway (~6-8h) |

**Viktigt:** Inget av detta ska göras i förebyggande syfte. Vänta på att trigger fyrar konkret.

### Rekommenderad ordning OM triggers fyrar

1. Booking-series — billigast, mest värde per timme
2. Due-for-service — närmast tröskeln redan
3. Notification — vid större notification-feature
4. Payment — bara om payment-historik byggs

---

## 7. När triggern fyrar — vad gör vi

Steg-för-steg när du har bestämt att refactor är motiverad:

1. **Kolla decision checklist (sektion 5)** — kan du svara konkret på minst 4 frågor?
2. **Spec en story:** beskriv smärtan (= triggers fyrade), valt level (L1/L2/L3), filer som rörs, förväntad effort
3. **Använd checklistor i [ddd-light-pattern.md](ddd-light-pattern.md):**
   - "Checklista för ny domän" om det är ny domän
   - "Checklista för att lyfta en domän till repo-pattern" om L1 → L2
4. **Pilot-testa:** lyft en domän först, mät innan/efter (lines of code, test-tid, antal `select`-block i routes)
5. **Skriv retro:** dokumentera om refactor-effort matchade estimering, om triggern faktiskt löstes, om non-triggers smyger sig in

### Anti-pattern: gradvis refactor utan klar trigger

Att "lite i taget" lyfta saker till repo varje sprint utan tydlig trigger leder till att hälften av domänerna blir L2 utan motivering. Det blir både kostnad (boilerplate) och förlorad fokus från riktiga features. **Vänta på smärta. Reagera på smärta. Gör inget på "för säkerhets skull".**

---

## Sammanfattning

| Princip | Konkret |
|---------|---------|
| Refactor styrs av smärta | Sektion 2 listar 12 mätbara triggers |
| Inte av estetik | Sektion 4 listar 12 vanliga non-triggers |
| Bedöm på rätt nivå | Sektion 3 har 5 escalation levels (L0-L4) |
| Mät innan du börjar | Sektion 5 har 6-fråga-checklista |
| Bevaka, agera inte | Sektion 6 har dagens kandidater — alla ska bevakas, inga ska åtgärdas idag |

**Tumregel:** Om någon säger "vi borde refactor:a X" — fråga "vilken trigger har fyrat?". Om inget tydligt svar → svara nej, vänta på smärta.
