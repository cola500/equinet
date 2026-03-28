---
title: Förändringsbarhet -- Equinet
description: Bedömning av hur enkelt eller svårt det är att genomföra 7 typiska ändringar i kodbasen
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Ny användarroll
  - Ny bokningsregel
  - Ny notifikationstyp
  - Ny geografisk filtrering
  - Ny adminfunktion
  - Ny betalregel
  - Ny provider-feature bakom feature flag
  - Sammanfattning
---

# Förändringsbarhet -- Equinet

> Genomförd 2026-03-28. Baserad på faktisk kod, inte dokumentation.
> Bedömning: hur lätt/svårt varje ändring är utan att skapa kaos.

---

## 1. Ny användarroll

**Exempel**: Lägga till rollen "stable_owner" (stallägare) som separat roll vid sidan av provider/customer.

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `prisma/schema.prisma` -- User.userType | Lägg till värde (string, ingen enum) | Trivial |
| `src/types/next-auth.d.ts` | Utöka typdeklaration | Trivial |
| `src/lib/auth.config.ts` -- JWT + session callbacks | Propagera ny roll | Enkel |
| `middleware.ts` -- 3 hårdkodade rollblock (rad 27-77) | Nytt rollblock + paths | Medel |
| `src/hooks/useAuth.ts` -- rad 39-42 | Lägg till `isStableOwner` boolean | Enkel |
| ~66 API-routes med `userType !== "provider"` | Granska varje: ska stable_owner ha access? | **Hög** |
| `src/components/layout/` -- ProviderNav, CustomerLayout | Ny navigation eller villkor | Medel |
| `src/app/` -- filsystembaserad routing | Ny mapp `/stable/*` eller villkorlig i befintlig | Medel |
| `src/domain/auth/AuthService.ts` -- registreringsflöde | Hantera ny rolltyp | Enkel |

### Bedömning: SVART (3/5)

**Vad som stödjer ändringen:**
- `userType` är en sträng, inte enum -- inget schema-migration-problem
- `useAuth()` returnerar redan `isStableOwner` (baserat på stableId, inte userType)
- Middleware har tydlig struktur att utöka

**Vad som är fragilt:**
- **66 hårdkodade rollcheckar** i API-routes (strängjämförelser `!== "provider"`). Varje route måste granskas: ska den nya rollen ha åtkomst? Det finns inget centralt rollregister eller `requireRole()` utility.
- **Middleware har hårdkodade path-arrayer** per roll (rad 43-65). Skalar dåligt -- varje ny roll kräver en ny array.
- **Ingen roll-enum eller konstant** -- rollsträngar är spridda som literals genom hela kodbasen.

**Vad som borde förbättras:**
1. Skapa `src/lib/roles.ts` med konstanter och typdefinition
2. Skapa `requireRole(session, role)` utility (som `requireAdmin()`)
3. Refaktorera middleware till konfigurationsdriven rollmappning istället för hårdkodade arrayer

---

## 2. Ny bokningsregel

**Exempel**: "En kund får max 3 obekräftade bokningar samtidigt" eller "Bokning kräver minst 48h framförhållning".

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/domain/booking/BookingService.ts` -- `createBooking()` | Lägg till valideringsregel | Enkel |
| `src/domain/booking/BookingService.ts` -- feltyp | Utöka `BookingError` union | Trivial |
| `src/domain/booking/mapBookingErrorToStatus.ts` | Mappa ny feltyp -> HTTP-status | Trivial |
| `src/domain/booking/BookingService.test.ts` | Nytt testfall | Enkel |
| `IBookingRepository` / `PrismaBookingRepository` | Ev. ny query (t.ex. `countPendingByCustomer`) | Enkel-Medel |

### Bedömning: ENKELT (1/5)

**Vad som stödjer ändringen väl:**
- BookingService har en **tydlig valideringskedja** i `createBooking()`. Nya regler läggs till som steg i kedjan.
- **Diskriminerad union** för BookingError -- att lägga till `{ type: 'MAX_PENDING_EXCEEDED' }` är trivialt och typsäkert.
- **Error mapper** (`mapBookingErrorToStatus.ts`) centraliserar översättning till HTTP-status.
- **DI via BookingServiceDeps** -- nya beroenden (t.ex. `countPendingBookings`) injiceras utan att ändra konstruktorn av befintliga konsumenter.
- **Result<T, E>** gör felhantering explicit -- inget riskerar att kasta okontrollerade exceptions.

**Vad som är fragilt:**
- BookingService är redan 968 LOC. Varje ny regel gör filen större. Inget modulsystem för "booking rules" -- alla regler är inlinerade i `createBooking()`.
- Om regeln ska gälla även manuella bokningar (`createManualBooking()`) måste den läggas till separat -- det finns viss logik-duplicering mellan de två metoderna.

**Vad som borde förbättras:**
- Extrahera bokningsvalidering till en `BookingValidator`-klass med en lista av regler. Varje regel = en metod eller objekt. Gör det enkelt att lägga till/ta bort regler utan att redigera en 968-raders fil.

---

## 3. Ny notifikationstyp

**Exempel**: "Kunden får notis när leverantören ändrar sin prislista."

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/domain/notification/NotificationService.ts` -- `NotificationType` | Lägg till konstant | Trivial |
| `src/domain/notification/NotificationService.ts` -- `createAsync()` | Redan generisk, ingen ändring | Ingen |
| Triggande domänservice (t.ex. ServiceService) | Anropa `notificationService.createAsync()` | Enkel |
| `src/lib/email/notifications.ts` | Ny funktion `sendPriceChangeNotification()` | Enkel |
| `src/lib/email/templates.ts` | Ny HTML-template | Enkel men tråkigt |
| `src/domain/notification/PushDeliveryService.ts` | Redan generisk, ingen ändring | Ingen |
| Ev. nytt event i domänlagret | Ny eventtyp + handler | Enkel |

### Bedömning: ENKELT (1.5/5)

**Vad som stödjer ändringen väl:**
- **NotificationService är helt generisk** -- `create({ userId, type, message, linkUrl, metadata })`. Ny typ kräver bara en ny strängkonstant, ingen kodändring i servicen.
- **Event-driven mönster** -- BookingEventHandlers visar mönstret: skapa event -> registrera handler -> handler anropar notificationService + emailService. Enkelt att kopiera.
- **Fire-and-forget** -- `notificationService.createAsync()` loggar fel tyst. Notifieringen kan aldrig ta ner huvudflödet.
- **PushDeliveryService** är generisk -- `sendToUser(userId, { title, body, url })`. Ingen ändring krävs.

**Vad som är fragilt:**
- **Email-templates** (`templates.ts`, 1,012 LOC) är monolitisk inline-HTML. Att lägga till en ny template betyder att filen växer ytterligare. Svårt att testa att HTML:en renderar korrekt.
- **Ingen template-testning** -- inga tester verifierar att email-output är korrekt.
- **NotificationDelivery dedup** (`RouteAnnouncementNotifier.ts`) måste manuellt implementeras om den nya notifikationen har dedup-krav.

**Vad som borde förbättras:**
- Migrera email-templates till React Email eller separata filer
- Skapa en generisk `sendNotification(type, recipient, data)` som automatiskt triggar in-app + email + push baserat på användarens preferenser

---

## 4. Ny geografisk filtrering

**Exempel**: "Filtrera leverantörer på län (region) istället för radie."

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/lib/geo/municipalities.ts` | Lägg till län-mappning | Enkel |
| `src/lib/geo/` | Ny modul `regions.ts` med län-data | Enkel |
| `src/app/api/providers/route.ts` | Ny filtreringsparameter + WHERE-villkor | Medel |
| `src/hooks/useGeoFiltering.ts` | Ny state för län-val | Enkel |
| UI-komponent (filter-panel) | Ny dropdown/chip-väljare | Enkel |

### Bedömning: ENKELT (1.5/5)

**Vad som stödjer ändringen väl:**
- **Välmodulariserad geo-modul** (`src/lib/geo/`) med separation: `distance.ts` (Haversine), `bounding-box.ts` (pre-filter), `municipalities.ts` (svensk data).
- **Municipalities redan listade** -- 290 kommuner i en statisk array. Att mappa kommun -> län är en dataändring, inte en arkitekturänding.
- **API-route (`/api/providers`) har redan geo-filtrering** med bounding box + Haversine post-filter. Nytt filter kan läggas som WHERE-villkor i Prisma-queryn.
- **useGeoFiltering hook** (112 LOC) är välstrukturerad -- lätt att utöka med `region`-state.

**Vad som är fragilt:**
- **Geo-data i municipalities.ts saknar län-koppling** (bara `{ name: string }`). Behöver utökas till `{ name: string, county: string }`.
- `/api/providers/route.ts` (284 LOC) har redan komplex filtrering. Ytterligare filter gör filen svårare att följa.
- **Raw SQL i providers-routen** (`DISTINCT ON`) -- att lägga till län-filter i raw SQL ökar underhållsbördan.

**Vad som borde förbättras:**
- Utöka `Municipality`-typen med län (county) redan nu -- det är en passiv dataändring
- Extrahera geo-filtrering i providers-routen till en dedikerad funktion

---

## 5. Ny adminfunktion

**Exempel**: "Admin-sida för att hantera stallprofiler" eller "Exportera användarstatistik."

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/app/admin/stables/page.tsx` | Ny sida | Enkel |
| `src/app/api/admin/stables/route.ts` | Ny API-route | Enkel |
| `src/lib/admin-auth.ts` -- `requireAdmin()` | Redan finns, återanvänd | Ingen |
| `src/components/layout/AdminNav.tsx` | Lägg till menyalternativ | Trivial |
| Tester | Ny testfil | Enkel |

### Bedömning: MYCKET ENKELT (0.5/5)

**Vad som stödjer ändringen väl:**
- **`requireAdmin()` utility finns** -- en rad ger fullständig admin-auth.
- **Admin-routes följer ett konsekvent mönster** -- rate limit -> auth -> requireAdmin -> Prisma query. Enkelt att kopiera.
- **AdminNav har enkel struktur** -- lägg till objekt i array.
- **Middleware skyddar alla `/admin/*` och `/api/admin/*`** automatiskt (rad 27-40).
- **Inget feature flag-krav** -- adminfunktioner behöver normalt inte flaggas.

**Vad som är fragilt:**
- Inget. Admin-delen av appen är den mest förändringsvänliga.

**Vad som borde förbättras:**
- Inget specifikt. Mönstret fungerar bra.

---

## 6. Ny betalregel

**Exempel**: "Betalning krävs inom 24h efter bekräftelse, annars avbokas automatiskt" eller "Delbetalning tillåts för bokningar över 2000 kr."

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/domain/payment/PaymentService.ts` | Utöka `processPayment()` eller ny metod | Enkel |
| `src/domain/payment/PaymentGateway.ts` | Ev. utöka interface (delbetalning) | Medel |
| `src/domain/booking/BookingService.ts` | Ev. koppla betalstatus -> bokningsstatus | Medel |
| `prisma/schema.prisma` -- Payment-modell | Ev. nya fält (partialAmount, deadline) | Enkel |
| Cron job (`/api/cron/`) | Ny schemalagd kontroll (24h-deadline) | Enkel |
| Tester | Nya testfall i PaymentService.test.ts | Enkel |

### Bedömning: MEDEL (2/5)

**Vad som stödjer ändringen väl:**
- **PaymentService använder gateway-pattern** (`IPaymentGateway` interface). Betallogik är skild från gateway-implementation. Nya regler läggs i servicen, inte i gatewayn.
- **Result<T, E>** för felhantering -- nya feltyper (`PAYMENT_DEADLINE_EXPIRED`, `PARTIAL_PAYMENT_NOT_ALLOWED`) integreras smidigt.
- **Factory DI** (`createPaymentService()`) -- nya beroenden injiceras via deps.
- **Cron-mönster finns redan** i projektet (`/api/cron/`) -- att lägga till en schemalagd betalningskontroll följer befintligt mönster.

**Vad som är fragilt:**
- **MockPaymentGateway returnerar alltid success** -- all betallogik testas bara mot happy path. Att testa felscenarier (declined, timeout, partial) kräver att mocken utökas.
- **Koppling booking <-> payment** -- PaymentService och BookingService är separata domäner. En regel som "avboka om ej betald inom 24h" kräver koordinering mellan dem. Idag finns ingen tydlig orkestreringsmekanism för cross-domain-logik.
- **Webhook-hantering** -- nya Stripe-events (t.ex. `payment_intent.payment_failed`) måste läggas till i webhook-routern manuellt.

**Vad som borde förbättras:**
- Utöka MockPaymentGateway med konfigurerbara scenarier (decline, timeout, partial)
- Överväg ett `PaymentPolicy`-pattern som kapslar regler (deadline, delbetalning, etc.) separat från service-logiken

---

## 7. Ny provider-feature bakom feature flag

**Exempel**: "Leverantörer kan skicka SMS-påminnelser till kunder" (ny feature, ska kunna stängas av).

### Påverkade delar

| Fil/område | Typ av ändring | Svårighet |
|------------|---------------|-----------|
| `src/lib/feature-flag-definitions.ts` | Lägg till flag-definition | Trivial |
| `src/app/api/sms-reminder/route.ts` | Ny API-route med `isFeatureEnabled()` | Enkel |
| `src/app/provider/sms-reminder/page.tsx` | Ny UI-sida med `useFeatureFlag()` | Enkel |
| `src/components/layout/ProviderNav.tsx` | Lägg till `featureFlag: "sms_reminder"` i nav | Trivial |
| `BottomTabBar` / `CustomerLayout` | Om synligt för kunder: lägg till gate | Enkel |
| `.env` + `playwright.config.ts` | E2E env override | Trivial |
| Test per route | Feature flag disabled -> 404 | Enkel |

### Bedömning: ENKELT (1/5)

**Vad som stödjer ändringen väl:**
- **Feature flag-systemet är moget och väldokumenterat.** `.claude/rules/feature-flags.md` har en komplett checklista.
- **ProviderNav har `featureFlag`-property** på nav items -- villkorlig visibility utan extra kod.
- **Server-side `isFeatureEnabled()`** med cache + env-override fungerar direkt.
- **Client-side `useFeatureFlag()`** med FeatureFlagProvider polling fungerar direkt.
- **Testmönster dokumenterat** -- `vi.mock("@/lib/feature-flags")` + `mockIsFeatureEnabled.mockResolvedValueOnce(false)` -> 404.
- **Minimum 3 filer** för en basic feature flag (definition + 1 API gate + nav).

**Vad som är fragilt:**
- **Feature flag spridning** -- om featuren har flera API-routes, flera UI-sidor, och nav-gating i både desktop och mobil, blir det 6-10 filer att ändra. Ingen automatisk enforcement att alla endpoints har gating.
- **E2E kräver manuell konfiguration** -- `FEATURE_X=true` måste läggas till i `.env` och `playwright.config.ts webServer.env`.
- **Ingen automatisk validering** att alla routes för en feature faktiskt har flag-gating (utom `npm run flags:validate` som inte körs i CI).

**Vad som borde förbättras:**
- Kör `flags:validate` i CI för att fånga saknad gating
- Överväg middleware-baserad flag-gating per path-prefix (t.ex. alla `/api/sms-reminder/*` routes gatas automatiskt)

---

## Sammanfattning

### Förändringsvänlighet per scenario

| Scenario | Svårighet | Antal filer | Främsta hinder |
|----------|-----------|-------------|----------------|
| 1. Ny användarroll | Svår (3/5) | 50-70+ | 66 hårdkodade rollcheckar, ingen roll-enum |
| 2. Ny bokningsregel | Enkel (1/5) | 3-5 | BookingService växer, men strukturen stödjer det |
| 3. Ny notifikationstyp | Enkel (1.5/5) | 4-6 | Email-templates är monolitisk HTML |
| 4. Ny geografisk filtrering | Enkel (1.5/5) | 4-6 | Geo-modul är välstrukturerad |
| 5. Ny adminfunktion | Mycket enkel (0.5/5) | 3-4 | Inga hinder |
| 6. Ny betalregel | Medel (2/5) | 4-8 | Cross-domain-koordinering booking/payment |
| 7. Ny feature bakom flag | Enkel (1/5) | 3-10 | Moget system, dokumenterad checklista |

### Mest förändringsvänliga delar

1. **Admin-panelen** -- `requireAdmin()` utility, automatiskt middleware-skydd, konsekvent mönster, oberoende av resten av appen. Snabbast att utöka.

2. **Notifikationssystemet** -- Generisk service, event-driven, fire-and-forget. Ny notifikationstyp = ny strängkonstant + handler. Inga strukturella ändringar.

3. **Feature flag-systemet** -- Moget, dokumenterat, med checklista och validering. Ny feature = 3 filer minimum. ProviderNav stödjer `featureFlag`-property nativt.

4. **Geo-modulen** -- Isolerad i `src/lib/geo/`, ren separation av beräkning (distance.ts), pre-filter (bounding-box.ts) och data (municipalities.ts). Lätt att lägga till nya filtreringstyper.

5. **Domänvalidering (bokningsregler)** -- Result-pattern, diskriminerad union för feltyper, DI via deps-interface. Nya regler slussas in naturligt i valideringskedjan.

### Mest fragila delar

1. **Rollsystemet** -- 66 hårdkodade strängjämförelser i API-routes, inga roll-konstanter, middleware med manuella path-arrayer. En ny roll kräver granskning av 50-70 filer. **Största förändringsrisken i hela kodbasen.**

2. **API-route boilerplate** -- Varje route har 10-20 rader identisk auth/rate-limit/parse-logik som kopierats manuellt. En ändring i mönstret (som session 106 auth null-check sweep) kräver uppdatering av alla 159 routes. Ingen centraliserad wrapper.

3. **BookingService storlek** (968 LOC) -- Strukturen stödjer nya regler bra (Result, error types), men filen växer med varje regel. Reschedule-logik (130+ LOC) och manuella bokningar delar validering med vanliga bokningar men har subtila skillnader -- risk för divergens.

4. **Email-templates** (1,012 LOC inline HTML) -- Varje ny notifikationstyp kräver ny HTML i samma monolitiska fil. Ingen testning, ingen förhandsgranskning, ingen komponentstruktur.

5. **Cross-domain-koordinering** (booking <-> payment) -- Ingen orkestreringsmekanism. Regler som spänner över domäner (t.ex. "avboka om ej betald") kräver manuell koppling mellan separata services utan gemensam transaktionskontext.
