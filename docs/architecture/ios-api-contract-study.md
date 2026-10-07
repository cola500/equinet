---
title: "iOS-API-kontraktsförstudie"
description: "Kartläggning av alla kontrakt mellan iOS-appen och backend/webb (endpoints, session exchange, WebView-brygga, push, widget, versionering), riskklassning, rekommenderad kontraktsmodell, testgap och triggers för framtida repo-utbrytning"
category: architecture
status: active
last_updated: 2026-10-07
tags: [ios, api, contract, monorepo, native, webview, push, widget]
depends_on:
  - docs/architecture/api-types-pattern.md
  - .claude/rules/ios-learnings.md
related:
  - docs/plans/ios-repo-extraction-plan.md
  - docs/ios-architecture-review.md
sections:
  - Sammanfattning
  - Metod och begränsningar
  - Gemensamma kontraktsregler
  - Endpoint-inventering
  - Övriga kontrakt
  - Fynd
  - Ändringsrisk
  - Rekommenderad kontraktsmodell
  - Testgap
  - Beslut och triggers
---

# iOS-API-kontraktsförstudie

> Förstudie 2026-10-07. Ingen produktionskod eller test är ändrad. iOS ligger kvar i monorepot (se [Beslut och triggers](#beslut-och-triggers)). Migrationsplan för en eventuell framtida flytt: [ios-repo-extraction-plan.md](../plans/ios-repo-extraction-plan.md).

## Sammanfattning

- **46 operationer (metod + sökväg), ca 25 distinkta sökvägar** anropas av iOS (45 med auth, 1 mot publika `/api/feature-flags`), plus Supabase Auth direkt via Swift SDK. 29 `route.ts` ligger under `src/app/api/native/`; 2 av dem (`help`, `help/[slug]`) anropas inte av iOS.
- **Det finns inget maskinläsbart kontrakt.** Ingen OpenAPI/schemafil, handskrivna Codable-modeller, ingen delad fixture, ingen versionshandshake (ingen app-version skickas, ingen min-version kontrolleras).
- **Starkaste kopplingen är inte REST-API:et utan WebView:** appen laddar ca 20 webbsidor (`/provider/*`, `/login`, `/dashboard`), injicerar CSS/viewport-script och pratar med webben via en JS-brygga. Webbändringar kan bryta appen utan att något API ändras.
- **Två verkliga kontraktsbrott hittades** (se [Fynd](#fynd)): widgetens svarsformat matchar inte iOS-modellen (verifierat), och webben anropar en endpoint som inte finns (`/api/auth/mobile-token`).
- **Rekommenderad modell:** manuellt dokumenterat kontrakt + delade JSON-fixtures som testas från båda hållen (Vitest + XCTest) + en liten versionshandshake. Ingen OpenAPI-generering eller Swift-klientgenerering nu.

## Metod och begränsningar

Underlaget är statisk läsning: alla `route.ts` under `src/app/api/native/` samt övriga routes iOS anropar, `APIClient.swift`, `AuthManager.swift`, `AppDelegate.swift`, `BridgeHandler.swift`, `AppConfig.swift`, `WidgetBooking.swift`, `src/lib/native-bridge.ts`, `PushDeliveryService.ts` och testfilernas namn. Widget-avvikelsen är verifierad genom att kompilera en isolerad kopia av Swift-structarna med `swiftc` och avkoda ett svar i backendens format.

Inte gjort: ingen app kördes, ingen produktionsdata eller Vercel-/APNs-konfiguration lästes, request-schemas (Zod) är inte genomgångna fält för fält, och testtäckning är bedömd från filnamn och grep, inte radtäckning. Fältnivåspecifikation per endpoint är därför en uppgift för kontraktsslicen (se [Testgap](#testgap)).

## Gemensamma kontraktsregler

Gäller alla `/api/native/*` om inget annat anges.

| Område | Nuvarande beteende |
|--------|--------------------|
| Auth | `getAuthUser(request)` ([auth-dual.ts](../../src/lib/auth-dual.ts)): cookie först, sedan `Authorization: Bearer <Supabase access token>`. iOS skickar alltid Bearer. |
| Rate limit | `rateLimiters.api` efter auth (undantag: `provider/profile` PUT = `profileUpdate`, `services` POST = `serviceCreate`). 429 `{error}`; `RateLimitServiceError` ger 503. |
| Felformat | `{ "error": "<svensk text>" }`, ibland med `details` vid 400. Texten är inte kontrakt; statuskoden är det. |
| Statuskoder | 401 ej inloggad, 403 åtkomst nekad (t.ex. ej provider), 404 saknad resurs/provider **eller feature-flagga av**, 400 ogiltig JSON/validering, 409 dubblett, 415 fel filtyp, 429, 503, 500. |
| Request-validering | Zod med `.strict()`: okända fält i request avvisas med 400. |
| iOS-hantering | `APIClient.performRequest`: 401 -> Supabase-refresh + ett omförsök; 429 -> `rateLimited(retryAfter)`; allt annat utanför 2xx -> `serverError(code)`. Felkroppen loggas (förhandsvisning) men visas aldrig. Cache-policy `reloadIgnoringLocalCacheData`. |
| Avkodning | Standard `JSONDecoder()` utan datumstrategi: datum är strängar, fältnamn måste matcha exakt, ett icke-optionellt Swift-fält som saknas eller är `null` fäller hela avkodningen. Okända extra fält ignoreras. |

## Endpoint-inventering

Förkortningar. **Anv.** = anropas av `Swift`, `WebView` eller båda; alla rader nedan anropas av native Swift, och webben har egna anrop till samma route enligt kolumnen. **Test BE** = backend `route.test.ts` (mockade enhetstester av routens eget svar). **Test iOS** = XCTest som avkodar svaret. **Klass**: S stabil, K intern men bör formaliseras, T tätt kopplad till implementation, V versionskänslig, B blockerande för utbrytning (se [Ändringsrisk](#ändringsrisk)).

Alla rader: auth Bearer, felhantering enligt tabellen ovan, om inget annat står.

### Dashboard, kalender, bokningar

| # | Metod + sökväg | iOS-funktion | Svar (toppnivå) | Notering | Test BE / iOS | Klass |
|---|----------------|--------------|-----------------|----------|---------------|-------|
| 1 | GET `/api/native/dashboard` | Dashboard | `todayBookings, todayBookingCount, upcomingBookingCount, pendingBookingCount, reviewStats, onboarding, ...` | Aggregat formade efter vyn | Ja / ja (APIClientTests) | T |
| 2 | GET `/api/native/calendar?from&to` | Kalender | `{ bookings: [...], ... }` | Query valideras `.strict()` + refine; 400 vid fel | Ja / ja (CalendarModelsTests) | K |
| 3 | GET `/api/native/bookings?status` | Bokningslista | lista | `status` valideras, 400 vid ogiltig | Ja / ja (BookingsModelsTests) | K |
| 4 | PUT `/api/bookings/{id}` | Statusändring (knapp + push-actions) | bokning | Delad med webben; `status` enum `pending,confirmed,cancelled,completed,no_show`, valfri `cancellationMessage`. iOS skickar status som sträng | Ja + integration / nej | V |
| 5 | POST `/api/native/bookings/{id}/review` | Betygsätt kund | recension, 201 | 409 vid dubblett, 403/404 ägarskap | Ja / nej | K |
| 6 | POST `/api/native/bookings/{id}/quick-note` | Snabbanteckning | uppdaterad bokning | `{ providerNotes }` | Ja / nej | K |
| 7 | POST `/api/native/calendar/exceptions` | Skapa undantag | `{...date}`, 201 | Zod-schema `.strict()` | Ja / nej | K |
| 8 | DELETE `/api/native/calendar/exceptions/{date}` | Ta bort undantag | `{ message, date }` | Datum `YYYY-MM-DD` i sökvägen | Ja / nej | K |

### Kunder, hästar, anteckningar

| # | Metod + sökväg | Svar | Test BE / iOS | Klass |
|---|----------------|------|---------------|-------|
| 9 | GET `/api/native/customers?status&query` | `{ customers }` | Ja / nej | K |
| 10 | POST `/api/native/customers` | `{ id/... }` (iOS läser `CustomerCreateResponse`) | Ja / nej | K |
| 11 | PUT `/api/native/customers/{id}` | uppdaterad kund | Ja / nej | K |
| 12 | DELETE `/api/native/customers/{id}` | `{ message }` | Ja / nej | K |
| 13 | GET `.../customers/{id}/horses` | `{ horses }` | Ja / nej | K |
| 14 | POST `.../horses` | häst, 201 | Ja / nej | K |
| 15 | PUT `.../horses/{horseId}` | uppdaterad häst | Ja / nej | K |
| 16 | DELETE `.../horses/{horseId}` | `{ message }` | Ja / nej | K |
| 17 | GET `.../customers/{id}/notes` | `{ notes }` | Ja / nej | K |
| 18 | POST `.../notes` | anteckning, 201 | Ja / nej | K |
| 19 | PUT `.../notes/{noteId}` | anteckning | Ja / nej | K |
| 20 | DELETE `.../notes/{noteId}` | (tomt/`message`) | Ja / nej | K |

### Tjänster, profil, recensioner, konto

| # | Metod + sökväg | Svar | Test BE / iOS | Klass |
|---|----------------|------|---------------|-------|
| 21 | GET `/api/native/services` | `{ services }` | Ja / nej (endast ViewModel-test) | K |
| 22 | POST `/api/native/services` | `{ service }`, 201 | Ja / nej | K |
| 23 | PUT `/api/native/services/{id}` | `{ service }` | Ja / nej | K |
| 24 | DELETE `/api/native/services/{id}` | `{ message }` | Ja / nej | K |
| 25 | GET `/api/native/provider/profile` | hela provider-objektet (ingen wrapper) | Ja / nej | T |
| 26 | PUT `/api/native/provider/profile` | uppdaterad profil | Ja / nej | T |
| 27 | POST `/api/native/provider/upload` | multipart in, `{ url }` 201; 415 fel typ | Ja / nej | K |
| 28 | GET `/api/native/reviews?page` | `{ reviews: [id, rating, comment, reply, repliedAt, ...], ... }` | Ja / nej | K |
| 29 | POST `/api/reviews/{id}/reply` | svar | Ja / nej | K |
| 30 | DELETE `/api/reviews/{id}/reply` | (tomt) | Ja / nej | K |
| 31 | DELETE `/api/account` | konto raderat; kräver `password` + `confirmation` | Ja / nej | K |

### Insikter, uppföljning, annonser, gruppbokningar

| # | Metod + sökväg | Svar | Notering | Test BE / iOS | Klass |
|---|----------------|------|----------|---------------|-------|
| 32 | GET `/api/native/insights?months` | `serviceBreakdown, timeHeatmap, customerRetention, kpis, previousKpis, hasPreviousPeriod, ...` | Aggregat | Ja / nej (endast ViewModel-test) | T |
| 33 | GET `/api/native/due-for-service?filter` | `{ items }` | | Ja / nej (endast ViewModel-test) | K |
| 34 | GET `/api/native/announcements` | `{ announcements }` | | Ja / nej (endast ViewModel-test) | K |
| 35 | POST `/api/native/announcements` | annons, 201 | Zod `.strict()`, 400 "Ogiltig kommun" | Ja / nej | K |
| 36 | POST `.../announcements/{id}/cancel` | `{ success: true }` | **404 om flaggan `route_planning` är av** | Ja / nej | V |
| 37 | GET `.../announcements/{id}/detail` | detaljobjekt | | Ja / nej | K |
| 38 | PATCH `.../announcements/{id}/bookings/{bookingId}` | uppdaterad | Zod `.strict()` | Ja / nej | K |
| 39 | GET `/api/native/group-bookings/available` | `{ requests }` | 403 om ej provider | **Nej** / nej | K |
| 40 | GET `/api/native/group-bookings/{id}` | resultatobjekt | Roll avgörs av `providerId` | **Nej** / nej | K |
| 41 | POST `/api/native/group-bookings/{id}/match` | `{ message, bookingsCreated, ... }` | Zod `.strict()` | **Nej** / nej | K |

### Push, widget, flaggor, session

| # | Metod + sökväg | Svar | Notering | Test BE / iOS | Klass |
|---|----------------|------|----------|---------------|-------|
| 42 | POST `/api/device-tokens` | token registrerad | **404 om `push_notifications` av**; 409 om token tillhör annan användare; 429 vid tokengräns | Ja / nej | V |
| 43 | DELETE `/api/device-tokens` | tom/ok | samma flagga | Ja / nej | V |
| 44 | GET `/api/widget/next-booking` | `{ booking, updatedAt }` | **Bryter mot iOS-modellen, se Fynd 1** | Ja (verifierar nästat format) / nej | B |
| 45 | GET `/api/feature-flags` | `{ flags: { [namn]: bool } }` | Publik, ingen auth, `no-store` | Ja / ja (APIClientTests) | S |
| 46 | POST `/api/auth/native-session-exchange` | `{ success: true }` + `Set-Cookie` | Se [Övriga kontrakt](#övriga-kontrakt) | Ja / ja (AuthManagerTests) | B |

Ej anropade av iOS: `GET /api/native/help`, `GET /api/native/help/{slug}` (hjälptexter ligger lokalt i `HelpArticles.swift`; ingen anropsplats hittad). `GET /api/auth/session` används inte av iOS.

Webben anropar inga `/api/native/*`-routes; de är iOS-only. Övriga routes (4, 29-31, 42-46) delas med webben, vilket gör dem känsligare för webbändringar.

## Övriga kontrakt

### WebView-session exchange

1. iOS loggar in via Supabase Swift SDK och får `access_token` + `refresh_token`.
2. `POST /api/auth/native-session-exchange` med `Authorization: Bearer <access_token>` och `X-Refresh-Token: <refresh_token>` (headern ersatte request body i S49-0).
3. Servern verifierar token (`supabase.auth.getUser`), anropar `setSession` och sätter Supabase SSR-cookies via `Set-Cookie`.
4. iOS läser cookies ur `HTTPCookieStorage.shared`, filtrerar på bas-host (`filterCookies`) och injicerar i `WKHTTPCookieStore`. Upp till flera omförsök med injicerbar fördröjning.

Kontraktspunkter: header-namn, cookienamn och domän (Supabase SSR-formatet), svar `{ success: true }`, 401 `Ogiltig token`. **Svagheten:** om `X-Refresh-Token` saknas eller `setSession` misslyckas returneras ändå 200 utan cookies. iOS märker det bara via en varning i loggen ("no cookies found"). Test: BE `route.test.ts`, iOS `AuthManagerTests`.

### WebView-brygga (JS <-> Swift)

- JS -> Swift: `window.webkit.messageHandlers.equinet.postMessage({ type, payload })`. iOS hanterar `requestPush`, `startSpeechRecognition`, `stopSpeechRecognition`, `requestCalendarSync`, `userDidLogout`; övriga typer loggas som okända.
- Swift -> JS: `window.equinetNative?.onMessage({ type, payload })` med bl.a. `pushTokenReceived`, `pushPermissionDenied`, `networkStatus`, tal- och kalendersynkhändelser.
- Webbsidan: `src/lib/native-bridge.ts` (`isNativeApp`, `notifyNativeLogout`), `useSpeechRecognition.ts`, `InstallPrompt.tsx` (`window.isEquinetApp`).
- Meddelandetyperna är strängar i två kodbaser utan delad definition. Test: `BridgeHandlerTests` (iOS), `useSpeechRecognition.test.ts` (webb) testar varsin sida med egna mockar.
- Webbroutes som appen laddar är också kontrakt: `/login`, `/dashboard` och `/provider/{profile,services,reviews,insights,help,group-bookings,due-for-service,customers,calendar,bookings,announcements,voice-log,route-planning,messages,horse-timeline/*}`. Ett omdöpt eller borttaget webbpath ger en trasig flik i appen.

### Push-payload (backend -> APNs -> iOS)

Byggs i [PushDeliveryService.ts](../../src/domain/notification/PushDeliveryService.ts): `aps.alert {title, body}`, `aps.sound`, `badge`, `aps.category` (valfri), samt toppnivåfälten `url` (relativ webbsökväg, t.ex. `/provider/bookings`) och `bookingId` (valfri).

iOS ([AppDelegate.swift](../../ios/Equinet/Equinet/AppDelegate.swift)) förutsätter: kategorin `BOOKING_REQUEST` med åtgärderna `CONFIRM_ACTION`/`DECLINE_ACTION` (läser `bookingId` och anropar `PUT /api/bookings/{id}` med `confirmed`/`cancelled`), och vid vanlig tryckning `url` som relativ webbsökväg som laddas i WebView. Backend skickar `BOOKING_REQUEST` (`BookingEventHandlers.ts`) och `MESSAGE` (`MessageNotifier.ts`; iOS har ingen särskild kategori för den).

Kontraktspunkter som ingen testar mot varandra: nycklarna `url`/`bookingId`/`aps.category`, kategori- och åtgärds-ID:n, att `url` är en webbväg, **och APNs-topic = app-bundle-ID** (se Fynd 3).

### Widgetdata

Appen hämtar `GET /api/widget/next-booking` (bakgrundsuppdatering i `AppDelegate`, och via `BridgeHandler`) och lagrar `WidgetData` i App Group `group.com.equinet.shared` (`SharedDataManager`). Widgeten läser bara lokalt. Kontraktet är alltså: svarsformatet (se Fynd 1) plus App Group-ID och `WidgetData`-formatet (internt för appen, versionskänsligt vid app-uppdatering eftersom widget och app delar lagring).

### Deep links och callbacks

Inga URL-scheman, universal links eller associated domains finns i iOS-projektet. Det enda "deep link"-kontraktet är push-`url` ovan och `NotificationCenter.navigateToURL` internt. iOS har ingen hantering av auth-callbacks (e-postverifiering, lösenordsåterställning); de ligger på webben.

### Versions- och kompatibilitetskontroll

Finns inte. iOS skickar ingen `X-App-Version`/User-Agent-header, backend har ingen min-version-kontroll, och det finns ingen "uppdatera appen"-väg. En gammal app får samma svar som en ny, och brott visar sig som `decodingError` eller `serverError` i en enskild vy. `MARKETING_VERSION=1.0` och `CURRENT_PROJECT_VERSION=1` tyder på att appen ännu inte distribuerats brett (antagande, bekräfta). Det är i så fall det billigaste läget att införa en handshake.

### Autentisering och tokenlivscykel

- Inloggning: Supabase Swift SDK direkt mot Supabase (URL + anon-nyckel per miljö hårdkodade i `AppConfig.swift`). JWT-claims (`providerId`, `userType`, `isAdmin`) kommer från Custom Access Token Hook.
- Sessionen lagras av SDK:n/`KeychainHelper`; `APIClient` använder aktuell access token och gör en refresh + ett omförsök vid 401.
- Backend verifierar Bearer i `getAuthUser` (slår upp `providerId` i databasen).
- Logout: iOS rensar WebView-cookies (domänfiltrerat och explicit); webben meddelar via `userDidLogout`.
- Den gamla egna mobil-JWT-modellen (`MobileTokenService`) är borttagen, men rester finns kvar (se Fynd 2).
- **Miljökonfiguration i binären:** `AppConfig.baseURL`, `supabaseURL` och anon-nycklar för local/staging/prod. Byte av domän, Supabase-projekt eller anon-nyckel kräver en ny app-release. Anon-nycklar är publika av design, men ändå en release-koppling.

## Fynd

1. **Widget-kontraktet är trasigt (verifierat).** Backend returnerar `booking.customer.{firstName,lastName}` och `booking.service.name` (nästlat, även i backendens test), men iOS `WidgetBooking` kräver platta fält `customerFirstName`, `customerLastName`, `serviceName` utan `CodingKeys`. Avkodning av ett svar i backendens format ger `keyNotFound: customerFirstName` (kört med `swiftc` mot isolerade structar). Båda anropsplatserna fångar felet och loggar (`Widget background refresh failed` / generisk catch), så widgeten får sannolikt aldrig bokningsdata och felet syns inte för användaren. Varken backend- eller iOS-tester fångar det eftersom ingen testar mot den andras format. Detta är ett produktionsrelevant fel, inte bara ett dokumentationsgap.
2. **Död endpoint i webben.** `src/lib/native-bridge.ts` (`requestMobileTokenForNative`, anropas från `login/page.tsx`) gör `POST /api/auth/mobile-token`, men routen finns inte. iOS hanterar inte meddelandet `requestMobileToken` (går till "Unknown message type"). Felet sväljs (`.catch(() => {})`). Rester: rate limiter-prefixet `ratelimit:mobile-token`, Keychain-servicenamnet `com.equinet.mobile-token`.
3. **APNs-topic-risk.** `PushDeliveryService` faller tillbaka på `APNS_BUNDLE_ID || "com.equinet.app"`, `.env.example` säger `com.equinet.app`, men appens bundle-ID är `com.equinet.Equinet` (och `docs/operations/apns-setup.md` anger det senare). Är variabeln inte satt i miljön skickas push till fel topic. Inte kontrollerat mot Vercel-miljöerna i denna förstudie.
4. **`Retry-After` läses men skickas inte.** iOS läser headern vid 429; i granskade routes och `rate-limit.ts` sätts den inte, så `retryAfter` är alltid `nil`.
5. **Inga versionssignaler** (se ovan).
6. **Feature-flaggor ger 404.** Flaggstyrda routes (annonsering, device-tokens) svarar 404 när flaggan är av, vilket iOS inte kan skilja från en saknad resurs.
7. **Session exchange svarar 200 utan cookies** vid saknad refresh token (se ovan).
8. **Oanvända native-routes** (`help`, `help/[slug]`) och **gruppbokningsroutes utan tester** (`group-bookings/*`, 3 st).

## Ändringsrisk

Klassning: **S** stabil/bakåtkompatibel, **K** intern men bör formaliseras, **T** tätt kopplad till nuvarande implementation, **V** versionskänslig, **B** blockerande för en framtida utbrytning (ingen säker oberoende release utan åtgärd).

| Klass | Kontrakt |
|-------|----------|
| S | `GET /api/feature-flags` (publik, testad båda sidor, explicit cache-policy) |
| K | Merparten av CRUD-routes (rader 2, 3, 5-24, 27-31, 33-35, 37-41): enkla `{wrapper}`-former, Zod-validerade, backend-testade men utan iOS-avkodningstest |
| T | Dashboard, insights (aggregat formade efter vyn), `provider/profile` (returnerar provider-objektet utan stabil projektion): nya fält är oskadliga, men omformning slår direkt mot appen |
| V | `PUT /api/bookings/{id}` (delas med webben, statusmaskin), device-tokens och annons-cancel (flaggstyrda, 404-semantik), push-payloadens nycklar/kategorier |
| B | WebView-bryggan + de ~20 inlästa webbvägarna, session exchange (header/cookie/domän), widget-svaret (trasigt idag), push-topic/bundle-ID, hårdkodad miljökonfiguration (URL:er, Supabase, anon-nycklar), avsaknad av versionshandshake |

**Kan släppas oberoende av iOS-release** (gäller så länge appen är ny nog att ignorera okända fält, vilket standard-`JSONDecoder` gör): nya fält i svar, nya endpoints, interna refaktoreringar bakom samma svar, ändrade felmeddelandetexter, snävare rate limits inom rimliga värden, nya push-kategorier som iOS ignorerar.

**Kräver att iOS-versionen finns ute först (eller samtidig release):** att ta bort/döpa om svarsfält, byta wrapper-nyckel (`{customers}` -> annat), ändra ett fält till `null` som iOS har icke-optionellt, ändra statusvärden/enum-strängar, **lägga till ett obligatoriskt request-fält** eller byta namn (alla `.strict()`-scheman avvisar det gamla), ändra 401/403/404-semantik, ta bort en route, ändra session-exchange-headers/cookienamn, ändra push-nycklar eller kategori-/åtgärds-ID:n, byta Supabase-projekt eller anon-nyckel, byta `APNS_BUNDLE_ID`, döpa om en webbväg som appen laddar eller ändra bryggans meddelandetyper.

Eftersom ingen min-version-kontroll finns kan gamla appversioner inte tvingas uppdateras: varje "kräver iOS-release" är i praktiken en bakåtkompatibilitetsförpliktelse så länge en gammal app kan finnas på en enhet.

## Rekommenderad kontraktsmodell

Alternativ som bedömts:

| Alternativ | Passar nu? |
|-----------|------------|
| Versionerad OpenAPI | Nej, ännu. 46 operationer utan befintlig specifikation: att skriva och underhålla en spec för hand är dubbelarbete mot Zod; att generera den ur Zod är ett eget verktygsprojekt. Värdet uppstår först vid separat repo/team. |
| Genererad Swift-klient | Nej. Kräver OpenAPI, ger stor genererad kod i ett 133-filers projekt med handskrivna modeller och en enda utvecklare. |
| Schemavaliderade DTO:er (Zod i backend) | Delvis: request-sidan är redan Zod `.strict()`. Response-sidan är inte schemavaliderad. |
| Manuellt dokumenterat API + kontraktstester | **Ja, kärnan.** |

**Minsta rimliga lösning (rekommenderas, i denna ordning):**

1. **Delade JSON-fixtures som sanning.** Katalogen `contracts/ios/` (eller motsvarande) med ett exempelsvar per endpoint iOS anropar (och push/widget/bryggmeddelanden). Samma filer läses av (a) en Vitest-test som kör respektive route (mockad Prisma, som idag) och bekräftar att svaret *strukturellt matchar* fixturen, och (b) en XCTest som avkodar fixturen med den riktiga Codable-modellen. Ändras ett svar eller en modell utan den andra går ett test rött. Detta hade fångat widgetfelet.
2. **Ett kort kontraktsdokument** (en tabell per endpoint: metod, sökväg, auth, request, svar, felkoder, stabilitet) som växer ur [inventeringen ovan](#endpoint-inventering). Ingen separat spec-fil.
3. **Versionshandshake (liten, additiv):** iOS skickar `X-App-Version` (marknadsversion + build) på alla anrop; backend loggar den och kan svara `426 Upgrade Required` från en konfigurerbar min-version, bara på `/api/native/*`. Börja med enbart loggning och en `X-Min-App-Version`-konstant; tvinga inget förrän det behövs.
4. **Bryggkontrakt som delad konstantlista** för meddelandetyper (en TypeScript-typ och motsvarande Swift-enum som testas mot samma fixtureslista).

Detta ger oberoende verifiering av kontraktet från båda hållen, men utan generatorer, nya beroenden eller ny infrastruktur. OpenAPI/genererad klient omprövas först om iOS får eget team eller repo (se triggers).

## Testgap

Prioriterad ordning (värde per insats). Inget av detta är implementerat.

| Prio | Gap | Förslag | Skydd mot |
|------|-----|---------|-----------|
| 1 | Widget: backend och iOS testar olika format; felet i produktion är tyst | Fixture `widget-next-booking.json` + Vitest på routen + XCTest som avkodar `WidgetBookingResponse`. Fixa först felet (egen slice). | Request/response-format |
| 2 | De flesta iOS-modeller saknar avkodningstest mot ett riktigt svar (bara Bookings, Calendar, Dashboard och FeatureFlags har det enligt grep av `decode(` i testfilerna; ViewModel-tester bedöms inte avkoda riktiga svar, ej verifierat i detalj) | Fixtures för dashboard, calendar, bookings, customers/horses/notes, services, profile, reviews, insights, due-for-service, announcements, group-bookings; en XCTest per modell | Request/response, bakåtkompatibilitet |
| 3 | Push-payload testas bara på backendsidan (`PushDeliveryService.test.ts`) och iOS-hanteringen mot egna mockar | Fixture för `BOOKING_REQUEST`- och `MESSAGE`-payload; backendtest bygger payloaden och jämför mot fixturen; iOS-test matar `userInfo` ur samma fixture till action-hanteringen. Lägg till test som verifierar att `APNS_BUNDLE_ID` aldrig faller tillbaka på ett värde som inte är appens bundle-ID. | Push-payload |
| 4 | Session exchange: 200 utan cookies maskerar fel | Backendtest för saknad `X-Refresh-Token` och `setSession`-fel (beslut först: ska det bli 4xx?), iOS-test för "200 utan cookies" | WebView-session exchange |
| 5 | Webb <-> brygga: typer i två kodbaser | Delad lista över meddelandetyper och ett test per sida mot den; ta bort `requestMobileToken`-resten (egen slice) | Brygga |
| 6 | Inga tester för gammal appversion | När handshaken finns: test att `/api/native/*` med för låg `X-App-Version` ger avsett svar, och att saknad header tolereras | Gammal appversion |
| 7 | Auth/behörighet: route-tester är mockade, IDOR/ägarskap mot native-routes testas enhetsvis men inte integrerat; `group-bookings/*` saknar tester helt | Lägg `route.test.ts` för de tre gruppbokningsroutes (401, 403 ej provider, 404, 400, lyckat) och vid behov `route.integration.test.ts` för ägarskapskritiska routes (kunder, anteckningar) | Autentisering och behörigheter |
| 8 | Webbvägar appen laddar | Enkel lista över de ~20 vägarna som ett test kontrollerar mot `src/app/` (finns sidan?) | WebView-kopplingen |

## Beslut och triggers

**Beslut (2026-10-07):** iOS ligger kvar i monorepot. Skälen är kopplingsgraden (WebView-brygga, 29 native-routes ändrade tillsammans med appen: 56 av 104 iOS-commits rör även annat), avsaknad av kontrakt och version, en utvecklare och att inget av problemen en separation löser är akut.

**Triggers.** Utbrytning omprövas när minst en av dessa inträffar:

1. iOS får en **självständig releasecykel** (TestFlight/App Store i takt som skiljer sig från webben).
2. Ett **separat team eller separat ägarskap** etableras.
3. **iOS-CI belastar eller komplicerar** huvudrepot väsentligt (macOS-minuter, kötid, pre-push/hook-brus).
4. **Separata åtkomstbehörigheter** krävs (extern konsult, annan åtkomstnivå).
5. **API-kontraktet är versionerat och kan verifieras oberoende** (fixtures + handshake enligt ovan, ev. OpenAPI).
6. **Monorepots storlek eller verktygsprestanda** blir ett konkret, mätbart problem.

Rimliga förberedelser som är värda att göra oavsett utbrytning (kräver separat godkännande, inte påbörjade): Fynd 1 och 2 som egna buggslices, fixture-baserade kontraktstester (Testgap 1-3), versionshandshake (modell punkt 3), gruppbokningstester.

Registrerat i backloggen: [backlog.md](../sprints/backlog.md#ios) ("iOS-kontrakt och repo-utbrytning").
