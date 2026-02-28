# Retrospektiv: Booking DDD-Light - BookingStatus VO + Factory (Fas 2)

**Datum:** 2026-02-01
**Scope:** BookingStatus value object, updateStatus() i BookingService, createBookingService() factory, PUT/POST route-migrering
**Foregaende:** [GroupBooking DDD-Light Migration (Fas 1.3)](./2026-02-01-ddd-light-groupbooking-migration.md)

---

## Resultat

- 2 nya filer (BookingStatus.ts, BookingStatus.test.ts)
- 4 andrade filer (BookingService.ts/test.ts, 2 route-filer, 1 route-test, index.ts)
- 1007/1007 tester grona, 0 TypeScript-fel
- 28 nya BookingStatus VO-tester
- 13 nya BookingService updateStatus-tester (42 totalt)
- 12 uppdaterade route-tester (7 PUT + 5 DELETE)
- ~60 rader inline DI-wiring borttagna fran POST-route
- Ny funktionalitet: status-transitionsvalidering (pending -> completed blockeras nu)

---

## Vad gick bra

### 1. TDD-cykeln fungerade felfritt
Varje steg foljde RED -> GREEN -> REFACTOR strikt. BookingStatus hade 28 tester som failade korrekt fore implementation. BookingService fick 13 nya tester som failade precis pa ratt stallen (updateStatus saknas, error-typer saknas). Noll overraskningar vid GREEN-fasen.

### 2. Value object-monstret ar bevisat skalbart
BookingStatus foljer exakt samma API som TimeSlot/Location: `static create()` -> `Result<T, string>`. Samma pattern funkar for alla domankoncept. Utvecklare som kanner TimeSlot forstadde omedelbart BookingStatus.

### 3. Factory-pattern eliminerade 60 rader duplicering
`createBookingService()` ersatter inline DI-wiring i POST-routen och ateranvands i PUT-routen. Exakt samma monster som `createGroupBookingService()` -- konsistens over domaner.

### 4. Route-test-uppdateringen var minimal
PUT-testerna bytte fran repository-mock till service-mock (samma monster som GroupBooking: `createBookingService: () => mockService`). Assertionerna (HTTP-status + response shape) var oforandrade. DELETE-testerna behvode NOLL andringar -- de anvander repo direkt och berordes inte.

### 5. Inkrementell migrering utan risk
Varje steg verifierades separat: VO-tester, service-tester, alla 122 booking-tester, sedan hela sviten (1007). Inget steg brot nagot som redan fungerade.

---

## Vad kan forbattras

### 1. PUT route-tester kopplade till mock-strategi
PUT-testerna mockar nu `@/domain/booking` (createBookingService + mappers). Om nagon annan fil importerar fran `@/domain/booking` i samma test-fil kan det ge problem. Mer isolerat an Prisma-mockar, men fortfarande en koppling.

### 2. Notifikationer fortfarande direkt i routes
PUT-routen har ~50 rader notifikationslogik (email + in-app). Framtida forbattring: flytta till en NotificationService med DI, sa routes bara anropar `notifyStatusChange(booking, actor)`.

### 3. MockBookingRepository saknar updateStatus-validering
MockBookingRepository.updateStatusWithAuth() validerar inte status-transitioner -- den bara andrar status direkt. Service-lagret validerar, men om nagon anropar repo direkt (t.ex. DELETE-routen) saknas valideringen. Inte ett problem idag, men bor dokumenteras.

### 4. Error-kontrakt designades med planen, inte ad-hoc
Till skillnad fran GroupBooking-migreringen (dar error-mappings "emergerade") var INVALID_STATUS_TRANSITION -> 400 och BOOKING_NOT_FOUND -> 404 bestamda i planen. Bekraftar rekommendationen fran forra retron: definiera error-kontrakt FORE implementation.

---

## Konkreta actions

### Gjort (i denna session)
- [x] BookingStatus value object med state machine
- [x] updateStatus() i BookingService
- [x] createBookingService() factory
- [x] PUT-route delegerar till service
- [x] POST-route anvander factory
- [x] Alla tester grona (1007/1007)

### Gor snart (medium)
- [ ] Flytta notifikationslogik fran PUT/POST-routes till dedikerad service
- [ ] Lagg till integration-test som verifierar pending -> completed blockeras end-to-end
- [ ] Dokumentera MockBookingRepository-begransningen (ingen status-validering)

### Gor vid nasta migrering (Fas 3: Auth)
- [ ] Samma monster: repo + service + factory
- [ ] Definiera error-kontrakt FORE implementation (bevisat bast)
- [ ] Overag om auth-routes beher NotificationService DI

---

## Learnings

Dessa learnings bor propageras till CLAUDE.md:

- **Value objects skalar**: BookingStatus foljer exakt samma pattern som TimeSlot/Location. `create()` -> `Result`, immutable, self-validating. Varje ny VO ar snabbare att bygga an foregaende.
- **Factory + VO = komplett service-lager**: `createBookingService()` + `BookingStatus.transitionTo()` ger routes en enda rad (`createBookingService().updateStatus(dto)`) istallet for 60+ rader DI + manuell validering.
- **Error-kontrakt fore implementation fungerar**: INVALID_STATUS_TRANSITION -> 400, BOOKING_NOT_FOUND -> 404 var bestamda i planen. Noll forvirring under implementation -- bekraftar GroupBooking-retrons rekommendation.
- **Inkrementell TDD med verifiering mellan steg**: VO -> service -> factory -> routes, med alla tester grona mellan varje steg. Ingen "big bang"-risk.
- **DELETE oforandrad = ratt scope**: Att medvetet exkludera DELETE fran scope (inget status-behov) forhindrade scope creep och holl sessionen fokuserad.

---

## Jamforelse med tidigare migreringar

| Metrik | Review (Fas 1.1) | Horse (Fas 1.2) | GroupBooking (Fas 1.3) | Booking VO (Fas 2) |
|--------|-------------------|------------------|------------------------|---------------------|
| Nya filer | 5 | 4 | 5 | 2 |
| Andrade filer | 6 | 6 | 14 | 5 |
| Nya tester | 14 | 17 | 25 | 41 |
| Totala tester | 915 | 940 | 968 | 1007 |
| Pattern | Repo + Service | Repo + Service | Repo + Service + Factory | VO + Service + Factory |
| Scope | 3 routes | 7 routes | 8 routes | 2 routes |

**Trend:** Varje migrering ar snabbare och mer fokuserad. Fas 2 hade flest nya tester (41) med farst andrade filer (5) -- value object-monstret ger hog test-tathet utan stor yttre paverkan.

---

*Skapad: 2026-02-01*
*Foregaende retrospektiv: [GroupBooking DDD-Light Migration](./2026-02-01-ddd-light-groupbooking-migration.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
