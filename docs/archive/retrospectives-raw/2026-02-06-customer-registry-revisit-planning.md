# Retrospektiv: Kundregister och Återbesöksplanering

**Datum:** 2026-02-06
**Scope:** 3 stories - kundlista, återbesöksintervall per häst, "dags för besök"-vy

---

## Resultat

- 10 nya filer, 4 ändrade filer
- 44 nya tester (11 kundlista + 15 interval + 8 reminder + 10 due-for-service), alla TDD
- 1277 totala tester (alla gröna, inga regressioner)
- 1 ny Prisma-migration (`add_horse_service_interval`)
- Typecheck = 0 errors
- Tid: ~1 session (3 stories sekventiellt)

## Vad som byggdes

| Story | Lager | Filer | Beskrivning |
|-------|-------|-------|-------------|
| S1 | API | `provider/customers/route.ts` + test | Kundlista från completed bookings, filter, sök, IDOR-skydd |
| S1 | UI | `provider/customers/page.tsx` | Expanderbara kundkort med hästar, sök, statusfilter |
| S2 | Schema | `schema.prisma` + migration | `HorseServiceInterval` junction-tabell (horse + provider) |
| S2 | API | `provider/horses/[horseId]/interval/route.ts` + test | PUT/GET/DELETE med upsert, access control, Zod-validering |
| S2 | Domain | `ReminderService.ts` + test | Override-logik: horse interval >> service default |
| S3 | API | `provider/due-for-service/route.ts` + test | Beräkna dueDate, sortera overdue först, statusbadges |
| S3 | UI | `provider/due-for-service/page.tsx` | Sammanfattningskort, filter, färgkodade statusbadges |
| Nav | UI | `ProviderNav.tsx` | "Kunder" + "Besöksplanering" tillagda |

## Vad gick bra

### 1. TDD-cykeln höjer kvaliteten och hastigheten
Varje API-route testades först (RED -> GREEN -> REFACTOR). Totalt 44 tester skrivna före implementation. Fångar:
- IDOR-skydd (provider ser bara sina egna kunder)
- Boundary cases (intervall 0, 53 avvisas)
- Deduplisering (flera bokningar -> unika kunder/hästar)
- Override-logik (horse interval overridar service default)

### 2. Ren query-feature (S1) kräver inget nytt schema
Kundlistan är en ren aggregering från Booking-tabellen. Ingen ny tabell behövdes, bara en smart query + JS-aggregering. Visar att befintligt schema är väldesignat.

### 3. Junction-tabell (S2) är rätt abstraktion
`HorseServiceInterval` med `@@unique([horseId, providerId])` löser problemet elegant: olika leverantörer kan ha olika intervall för samma häst. Upsert-pattern gör PUT idempotent.

### 4. ReminderService-anpassningen var minimal
Bara ~15 rader tillagda i `findDueReminders()` för att stödja override. Befintlig arkitektur (select-pattern, loop-baserad processing) gör det naturligt att lägga till en lookup per booking.

### 5. Befintliga patterns återanvänds konsekvent
- Auth: `auth()` + userType-check + provider lookup (samma som customers/search)
- Rate limiting: `rateLimiters.api(clientIp)` före all logic
- Error handling: try-catch med `logger.error()` och Response-check
- Zod: `.strict()` på input-schemas

## Vad kan förbättras

### 1. Kundlistan hämtar ALLA completed bookings
`prisma.booking.findMany()` utan paginering kan bli slow vid stora dataset. För MVP med <500 användare är det OK, men vid tillväxt bör vi antingen:
- Använda SQL-aggregering (GROUP BY) istället för JS
- Lägga till paginering på API:t

**Prioritet:** LÅG -- prestanda är fin för MVP-skalan.

### 2. Due-for-service gör en query per provider-override
`horseServiceInterval.findMany()` hämtar alla overrides på en gång (bra!), men booking-queryn är fortfarande N+1-risk vid stora dataset. En raw SQL-query som JOINar på både bookings och overrides vore effektivare.

**Prioritet:** LÅG -- optimera vid behov.

### 3. Interval-UI saknas i kundvyn
Planen anger "Provider kan se/redigera från kundvyn" men UI:t för att sätta intervall (PUT-dialog på häst) är inte byggt. API:t finns - UI kan läggas till som nästa steg.

**Prioritet:** MEDEL -- API:t finns, UI-arbete kvar.

### 4. Ingen notifikation vid intervall-ändringar
Kunden informeras inte när leverantören ändrar återbesöksintervall. Kan vara värdefullt för transparens.

**Prioritet:** LÅG -- avvakta MVP-feedback.

## Patterns att spara

### Aggregering från befintliga tabeller
Kundlistan visar att man kan bygga rika features utan nya tabeller -- bara smart query + Map-baserad deduplicering i JS. Snabbt att implementera, noll migreringsrisk.

### Junction-tabell för N:M overrides
`HorseServiceInterval(horseId, providerId)` är ett bra mönster för fall där två entiteter har en overridebar relation. Kan återanvändas för t.ex. "favorit-leverantör per häst" eller "specialpris per kund".

### Status-beräkning i API (inte DB)
Due-for-service-statusen (overdue/upcoming/ok) beräknas at runtime istället för att lagras. Fördel: alltid aktuell, ingen synkronisering. Nackdel: beräkning varje request. För vår skala är det rätt val.

## Lärandeeffekt

**För utvecklaren:** Denna session visar DDD-Light i praktiken -- nästa gång du bygger en leverantörsvy som aggregerar från bokningar, följ S1-mönstret (query + Map + filter). För override-logik, följ S2 (junction-tabell + upsert).
