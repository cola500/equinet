# Retrospektiv: Kundregister och Aterbesoksplanering

**Datum:** 2026-02-06
**Scope:** 3 stories - kundlista, aterbesoksintervall per hast, "dags for besok"-vy

---

## Resultat

- 10 nya filer, 4 andrade filer
- 44 nya tester (11 kundlista + 15 interval + 8 reminder + 10 due-for-service), alla TDD
- 1277 totala tester (alla grona, inga regressioner)
- 1 ny Prisma-migration (`add_horse_service_interval`)
- Typecheck = 0 errors
- Tid: ~1 session (3 stories sekventiellt)

## Vad som byggdes

| Story | Lager | Filer | Beskrivning |
|-------|-------|-------|-------------|
| S1 | API | `provider/customers/route.ts` + test | Kundlista fran completed bookings, filter, sok, IDOR-skydd |
| S1 | UI | `provider/customers/page.tsx` | Expanderbara kundkort med hastar, sok, statusfilter |
| S2 | Schema | `schema.prisma` + migration | `HorseServiceInterval` junction-tabell (horse + provider) |
| S2 | API | `provider/horses/[horseId]/interval/route.ts` + test | PUT/GET/DELETE med upsert, access control, Zod-validering |
| S2 | Domain | `ReminderService.ts` + test | Override-logik: horse interval >> service default |
| S3 | API | `provider/due-for-service/route.ts` + test | Berakna dueDate, sortera overdue forst, statusbadges |
| S3 | UI | `provider/due-for-service/page.tsx` | Sammanfattningskort, filter, fargkodade statusbadges |
| Nav | UI | `ProviderNav.tsx` | "Kunder" + "Besoksplanering" tillagda |

## Vad gick bra

### 1. TDD-cykeln hojer kvaliteten och hastigheten
Varje API-route testades forst (RED -> GREEN -> REFACTOR). Totalt 44 tester skrivna fore implementation. Fangar:
- IDOR-skydd (provider ser bara sina egna kunder)
- Boundary cases (intervall 0, 53 avvisas)
- Deduplisering (flera bokningar -> unika kunder/hastar)
- Override-logik (horse interval overridar service default)

### 2. Ren query-feature (S1) kraver inget nytt schema
Kundlistan ar en ren aggregering fran Booking-tabellen. Ingen ny tabell behovdes, bara en smart query + JS-aggregering. Visar att befintligt schema ar valdesignat.

### 3. Junction-tabell (S2) ar ratt abstraktion
`HorseServiceInterval` med `@@unique([horseId, providerId])` loser problemet elegant: olika leverantorer kan ha olika intervall for samma hast. Upsert-pattern gor PUT idempotent.

### 4. ReminderService-anpassningen var minimal
Bara ~15 rader tillagda i `findDueReminders()` for att stodja override. Befintlig arkitektur (select-pattern, loop-baserad processing) gor det naturligt att lagga till en lookup per booking.

### 5. Befintliga patterns ateranvands konsekvent
- Auth: `auth()` + userType-check + provider lookup (samma som customers/search)
- Rate limiting: `rateLimiters.api(clientIp)` fore all logic
- Error handling: try-catch med `logger.error()` och Response-check
- Zod: `.strict()` pa input-schemas

## Vad kan forbattras

### 1. Kundlistan hamtar ALLA completed bookings
`prisma.booking.findMany()` utan paginering kan bli slow vid stora dataset. For MVP med <500 anvandare ar det OK, men vid tillvaxt bor vi antingen:
- Anvanda SQL-aggregering (GROUP BY) istallet for JS
- Lagga till paginering pa API:t

**Prioritet:** LAG -- prestanda ar fin for MVP-skalan.

### 2. Due-for-service gor en query per provider-override
`horseServiceInterval.findMany()` hamtar alla overrides pa en gang (bra!), men booking-queryn ar fortfarande N+1-risk vid stora dataset. En raw SQL-query som JOINar pa bade bookings och overrides vore effektivare.

**Prioritet:** LAG -- optimera vid behov.

### 3. Interval-UI saknas i kundvyn
Planen anger "Provider kan se/redigera fran kundvyn" men UI:t for att satta intervall (PUT-dialog pa hast) ar inte byggt. API:t finns - UI kan laggas till som nasta steg.

**Prioritet:** MEDEL -- API:t finns, UI-arbete kvar.

### 4. Ingen notifikation vid intervall-andringar
Kunden informeras inte nar leverantoren andrar aterbesoksintervall. Kan vara vaerdefullt for transparens.

**Prioritet:** LAG -- avvakta MVP-feedback.

## Patterns att spara

### Aggregering fran befintliga tabeller
Kundlistan visar att man kan bygga rika features utan nya tabeller -- bara smart query + Map-baserad deduplicering i JS. Snabbt att implementera, noll migreringsrisk.

### Junction-tabell for N:M overrides
`HorseServiceInterval(horseId, providerId)` ar ett bra monster for fall dar tva entiteter har en overridebar relation. Kan ateranvandas for t.ex. "favorit-leverantor per hast" eller "specialpris per kund".

### Status-berakning i API (inte DB)
Due-for-service-statusen (overdue/upcoming/ok) beraknas at runtime istallet for att lagras. Fordel: alltid aktuell, ingen synkronisering. Nackdel: berakning varje request. For var skala ar det ratt val.

## Larandeeffekt

**For utvecklaren:** Denna session visar DDD-Light i praktiken -- nasta gang du bygger en leverantorsvy som aggregerar fran bokningar, folj S1-monstret (query + Map + filter). For override-logik, folj S2 (junction-tabell + upsert).
