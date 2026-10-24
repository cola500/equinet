---
title: "Implementationskontrakt – utförd bokning och betalning (C3 + C2)"
description: "Teknikbundet kontrakt för hur dagens Equinet ska verkställa BR-BOOK-001 och BR-PAY-001: komponenter, ansvar per lager, felkontrakt, testplan och risker"
category: architecture
status: draft
last_updated: 2026-10-24
tags: [specification, implementation, booking, payment, offline, ios, c2, c3]
depends_on:
  - docs/specifications/business-rules/booking-payment.md
  - docs/specifications/contracts/booking-payment-scenarios.md
related:
  - docs/specifications/traceability/booking-payment-matrix.md
  - docs/sprints/customer-purchase-readiness-2026-10.md
sections:
  - Syfte och status
  - Dataflöde
  - Data och tid
  - Var reglerna verkställs
  - Atomisk kontroll och skrivning
  - Felkontrakt
  - Klienter och UI
  - Offline
  - Databas
  - Testplan
  - Risker
  - Implementeringsordning
  - Icke-mål
---

# Implementationskontrakt – utförd bokning och betalning (C3 + C2)

## Syfte och status

Det här dokumentet beskriver **hur** dagens Equinet ska verkställa
`BR-BOOK-001` (C3) och `BR-PAY-001` (C2). Det skapar inga nya affärsregler.
Vid konflikt gäller affärsreglerna och scenarierna i `docs/specifications/`.

Status: **implementerad på branchen** `feature/c3-c2-booking-completion-payment`
(2026-10-24), väntar på review och Codex slutgranskning. Avvikelser från
planen under implementationen: knappen är en delad komponent
(`MarkCompletedButton`) i stället för ändringar direkt i dialogen; ägarskap
kontrolleras före tidskontrollen så att en annan leverantör får 404 och inte
ser sluttiden; den villkorade skrivningen görs med `updateMany` (en enda
`UPDATE`-sats) följd av en läsning, eftersom `update` med icke-unika villkor
inte garanterat är en sats. Planen godkändes 2026-10-24. Johan har godkänt de fyra UX-besluten;
Codex planeringsgranskning gav tre tekniska justeringar som är införda nedan
(atomisk kontroll, `timezone` till klienterna, röstloggens utfall).
Kodreferenser gäller `main` vid `4b9101ed` och är `[läst]` om inget annat
anges.

## Dataflöde

```text
Leverantör (webbkalender, bokningslista, röstlogg, iOS)
  → PUT /api/bookings/[id]  |  POST /api/voice-log/confirm
  → BookingService.updateStatus
      1. statusmaskin   2. roll   3. NYTT: sluttidskontroll (BR-BOOK-001)
  → PrismaBookingRepository.updateStatusWithAuth
      NYTT: villkorad UPDATE mot de lästa värdena (se Atomisk kontroll)

Kund (webb, kundens bokningslista)
  → POST /api/bookings/[id]/payment
  → PaymentService.processPayment
      1. ägarskap   2. redan betald   3. ÄNDRAS: endast completed (BR-PAY-001)
  → PaymentGateway (mock / Stripe)
```

## Data och tid

| Fält | Lagring | Kommentar |
|---|---|---|
| `bookingDate` | `DateTime` | Bara datumdelen är meningsfull. Lagras i tre varianter: midnatt UTC (API, `new Date("YYYY-MM-DD")`), lokal midnatt (seed/demo) och lokal 10:00 (E2E-seed). |
| `endTime` | Text `HH:mm` | Alltid samma dag som `startTime` och senare än den (`TimeSlot`). Inga bokningar över midnatt. |
| `timezone` | Text, standard `Europe/Stockholm` | Finns i schema och repository-typ men läses inte av någon logik i dag. Skickas i dag inte till klienterna. |
| `status` | Text | `pending`, `confirmed`, `completed`, `cancelled`, `no_show`. |

**Bokningens sluttid som tidpunkt** räknas fram i en ny ren funktion i
domänen, t.ex. `getBookingEndInstant({ bookingDate, endTime, timezone })`:

1. Kalenderdatum = datumet för `bookingDate` **uttryckt i bokningens
   tidszon**. Det ger rätt dag för alla tre lagringsvarianterna ovan; att
   läsa datumet i UTC skulle ge fel dag för lokal midnatt i Stockholm.
2. Lokal tid = kalenderdatum + `endTime` i bokningens tidszon.
3. Omvandling till en absolut tidpunkt med `Intl.DateTimeFormat` och
   tidszonens förskjutning för just den tidpunkten, så att sommartid
   hanteras. Inget nytt paket behövs (`date-fns` v4 finns men inte
   tidszonsstöd; `Intl` räcker för en funktion).
4. Ogiltig tidszon ger ett fel och **stänger** (statusbytet avvisas och
   loggas med `logger.error`), i stället för att gissa en förskjutning.

**Serverns aktuella tid** injiceras som ett valfritt beroende i
`BookingServiceDeps`: `now?: () => Date`, med `() => new Date()` som
standard. Det följer mönstret med valfria beroenden i `BookingServiceDeps`.
Enhetstester skickar en fast tid; integrationstester använder
`vi.setSystemTime`.

## Var reglerna verkställs

| Regel | Auktoritativ plats | Kompletterande skydd |
|---|---|---|
| BR-BOOK-001 | `BookingService.updateStatus`, efter statusmaskin och rollkontroll, endast när ny status är `completed` | UI inaktiverar "Markera som genomförd" före sluttid (webb och iOS) – vägledning, inget skydd |
| BR-PAY-001 | `PaymentService.processPayment`: tillåtna statusar ändras från `confirmed`, `completed` till endast `completed` | Kundens "Betala"-knapp visas bara för `completed` |

Alla vägar som kan sätta `completed` på en bokning `[läst]`:

| Väg | Anropare | Går via `updateStatus` |
|---|---|---|
| `PUT /api/bookings/[id]` | Webbkalenderns detaljdialog, leverantörens bokningslista, webbens offlinekö, iOS (bokningslista, bokningsdetalj, kalender, iOS offlinekö) | Ja |
| `POST /api/voice-log/confirm` (`markAsCompleted`) | Röstloggning (webb) | Ja |

Övriga skrivningar av `"completed"` i koden gäller rutter, ruttstopp,
gruppbokningar och ruttordrar, inte bokningsstatus. Administratörens
bokningsroute sätter bara `cancelled`; annonsroutens bokningsstatus tillåter
bara `confirmed`/`cancelled`. Ingen ny väg får skriva `completed` direkt mot
databasen.

Enda vägen som startar en betalning är `POST /api/bookings/[id]/payment`
→ `PaymentService.processPayment`. `GET` på samma route läser bara status.

## Atomisk kontroll och skrivning

**Problem** `[läst]`: `updateStatus` läser bokningen med `findById` och
skriver sedan separat med `updateStatusWithAuth`, vars `WHERE` bara innehåller
`id` och ägare. En ombokning som hinner skriva ny dag eller sluttid mellan
läsning och skrivning gör att kontrollen gjordes mot värden som inte längre
gäller. Då kan en bokning markeras utförd före sin nya sluttid.

**Lösning** (ingen schemaändring, ingen ny tabell, inget nytt mönster utöver
ett valfritt argument):

1. `updateStatusWithAuth` får ett valfritt argument
   `expected?: { status, bookingDate, endTime, timezone }`. När det finns
   skrivs statusen med `updateMany` och värdena i samma `WHERE` som `id` och
   ägare: `UPDATE … WHERE id = ? AND providerId = ? AND status = ? AND
   bookingDate = ? AND endTime = ? AND timezone = ?`. `count = 0` ger `null`;
   annars läses den skrivna bokningen med samma `select` som tidigare.
2. `BookingService.updateStatus` skickar `expected` med exakt de värden som
   sluttidskontrollen använde, när ny status är `completed`.
3. Får tjänsten `null` trots att `expected` skickades, läser den bokningen en
   gång till. Finns den inte (eller tillhör någon annan): `BOOKING_NOT_FOUND`
   (404, oförändrat). Finns den: nytt fel `BOOKING_CHANGED_CONCURRENTLY`
   (409, "Bokningen ändrades samtidigt. Ladda om och försök igen."). Ingen
   automatisk omkörning; leverantören ser den nya tiden och försöker igen.
4. Omvänd ordning: ombokningens två skrivningar
   (`rescheduleWithOverlapCheck`, `providerRescheduleWithOverlapCheck`) får
   `status: { in: ['pending', 'confirmed'] }` i sitt `WHERE`. Har bokningen
   hunnit bli utförd skrivs ingen ny tid över den. Det är samma statusvillkor
   som ombokningen redan kontrollerar före transaktionen.

**Varför detta räcker:** PostgreSQL låser raden vid `UPDATE`. Om en annan
transaktion har ändrat raden när villkoret prövas, prövas `WHERE` på nytt mot
den senaste versionen (Read Committed). Antingen skrivs `completed` mot
oförändrade värden, eller så skrivs ingenting. Ingen transaktion, `SELECT …
FOR UPDATE` eller versionskolumn behövs.

## Felkontrakt

| Fall | Domänfel | HTTP | Meddelande (svenska) |
|---|---|---|---|
| `completed` före sluttid | Nytt `BookingError`: `{ type: 'COMPLETION_BEFORE_END_TIME', endTime: string }` | 400 | "Bokningen kan markeras som genomförd först efter bokad sluttid (kl. 11:00)." |
| Ogiltig tidszon på bokningen | Samma typ, loggas som fel | 400 | Samma meddelande utan klockslag |
| Bokningen ändrades mellan kontroll och skrivning | Nytt `BookingError`: `{ type: 'BOOKING_CHANGED_CONCURRENTLY' }` | 409 | "Bokningen ändrades samtidigt. Ladda om och försök igen." |
| Betalning när status ≠ `completed` | Befintligt `INVALID_STATUS` | 400 (oförändrat) | Ändras från "måste vara bekräftad" till "Bokningen kan betalas först när tjänsten är utförd." |

400 väljs för att följa befintliga regelbrott i domänen
(`INVALID_STATUS_TRANSITION`, `RESCHEDULE_WINDOW_PASSED`). Det gör också att
webbens offlinekö markerar mutationen som konflikt med serverns meddelande.
Klockslaget i meddelandet är bokningens lokala `endTime`. 409 vid samtidig
ändring följer befintliga `OVERLAP` och räknas också som konflikt i
webbens offlinekö.

**Röstloggens svar** (`POST /api/voice-log/confirm`) får ett uttryckligt
fält för markeringen, utöver befintliga `actions`:

| Utfall | `completion` |
|---|---|
| Markering inte begärd | `{ status: "not_requested" }` |
| Anteckning sparad och bokningen utförd | `{ status: "completed" }` |
| Anteckning sparad men statusbytet avvisat | `{ status: "rejected", reason: "<BookingError.type>", message: "<svenska>" }` |

HTTP-status är 200 i alla tre fallen, eftersom anteckningen sparades.
Klienten visar utfallet utifrån `completion.status`, inte utifrån
frånvaron av `"completed"` i `actions`.

## Klienter och UI

| Yta | Fil | Idag | Efter |
|---|---|---|---|
| Webbkalender, detaljdialog | `BookingDetailDialog.tsx` | Knappen visas för `confirmed` | Knappen visas men är inaktiverad före sluttid med text "Kan markeras som genomförd efter kl. 11:00" *(beslut 1)* |
| Leverantörens bokningslista | `src/app/provider/bookings/page.tsx` | Samma | Samma som kalendern |
| Webb, felmeddelande online | kalendersidan och bokningslistan | Generiskt "Kunde inte uppdatera bokning" | Visa serverns `error` |
| Röstloggning | `voice-log/confirm/route.ts`, `useVoiceWorkLog.ts` | Avvisad markering sväljs; "Arbetslogg sparad!" | Svaret säger att markeringen inte gjordes; UI visar "Arbetsloggen sparades, men bokningen kan markeras som genomförd först efter kl. 11:00." *(beslut 2)* |
| iOS bokningslista och detalj | `BookingsViewModel`, `NativeBookingsView`, `NativeBookingDetailView` | Optimistisk uppdatering, återställs tyst med felhaptik | Knapp inaktiverad före sluttid; avvisning ger synligt felmeddelande *(beslut 3)* |
| iOS kalender | `CalendarViewModel`, `BookingDetailSheet` | **Alla** fel – även 400 – läggs i `PendingActionStore`, som sedan kastar 4xx tyst | Bara nätverksfel köas; 4xx visas direkt *(beslut 3)* |
| Kundens bokningskort | `BookingCard.tsx` | "Betala" för `confirmed` och `completed` | Endast `completed` |
| Kund, bekräftad bokning | `BookingCard.tsx` | – | Kort text "Betalning öppnas när besöket är genomfört" *(beslut 4)* |

Klientkontrollerna använder enhetens klocka och kan ha fel. Servern avgör
alltid; därför måste varje klient också hantera ett 400- eller 409-svar
begripligt.

**Bokningens tidszon till klienterna.** Klienterna räknar sluttiden i
bokningens `timezone`, inte i enhetens. Fältet läggs till i de svar som
matar knapparna:

| Svar | Fil | Konsument |
|---|---|---|
| `GET /api/bookings` (leverantör, Supabase-select) via `useBookings` | `src/app/api/bookings/route.ts` | bokningslistan och kalenderns `BookingDetailDialog` `[läst]` |
| `GET /api/native/bookings` | `src/app/api/native/bookings/route.ts` | iOS `BookingsModels.swift` |
| `GET /api/native/calendar` | `src/app/api/native/calendar/route.ts` | iOS `CalendarModels.swift` |

Swift-modellerna får `let timezone: String?` (valfritt för
bakåtkompatibilitet). Saknas fältet eller är det ogiltigt använder iOS
`Europe/Stockholm`, som är databasens standardvärde – inte enhetens
tidszon. Webben använder samma ren funktion som servern
(`getBookingEndInstant`), som inte beror på webbläsarens tidszon.

## Offline

**Webb** (`offline_mode` på) `[läst]`:

- Kalenderns statusbyte köas via `guardMutation` med `PUT`-body
  `{ status: 'completed' }`.
- Vid synk avgör serverns tid vid mottagning (SC-BOOK-008). 400 markerar
  mutationen som `conflict` och sparar `HTTP 400: <meddelande>`.
- Bannern "1 ändring kunde inte synkas" öppnar köns lista, där meddelandet
  och knapparna "Försök igen"/"Ignorera" visas. Ett nytt försök efter
  sluttiden lyckas, eftersom servern då har en senare tid.
- Kvarstående risk: den optimistiska statusen "Genomförd" ligger kvar i
  vyn tills konflikten löses (SWR-nyckeln revalideras inte). Ingen ändring
  föreslås i denna slice; klientens förkontroll gör fallet ovanligt.

**iOS** `[läst]`: `PendingActionStore` köar statusbyten som misslyckas och
försöker igen vid start och när nätet kommer tillbaka; 4xx kastas utan
användarbesked. Med beslut 3 köas bara nätverksfel, så en avvisning före
sluttid visas direkt i stället för att försvinna. Ett köat statusbyte som
avvisas vid senare synk loggas fortfarande bara – det är ett befintligt gap
som dokumenteras men inte löses här.

## Databas

**Ingen schemaändring.** `bookingDate`, `endTime` och `timezone` räcker.
`timezone` har standardvärde och kräver ingen migrering. Ingen migration
föreslås.

## Testplan

Scenario-ID skrivs först i testnamnet, t.ex.
`it("SC-BOOK-004 – avvisar completed en minut före sluttid", …)`.

**C3 – domän (RED först)**

| Test | Fil | Scenario |
|---|---|---|
| Sluttid vintertid: 2026-11-10 11:00 Stockholm = 10:00 UTC | `BookingTime.test.ts` (ny) | SC-BOOK-006 |
| Sluttid sommartidens första dag: 2027-03-28 11:00 = 09:00 UTC | `BookingTime.test.ts` | SC-BOOK-007 |
| Samma sluttid oavsett lagringsvariant (UTC-midnatt, lokal midnatt, lokal 10:00) | `BookingTime.test.ts` | – (datarobusthet) |
| Ogiltig tidszon ger fel | `BookingTime.test.ts` | – |
| 11:30 tillåts; 07:00, 10:30, 10:59 avvisas; 11:00 tillåts | `BookingService.test.ts` › `updateStatus` | SC-BOOK-001–005 |
| Avvisning skriver inte till repository | `BookingService.test.ts` | SC-BOOK-002 |
| Serverklocka i UTC: 10:30 UTC tillåts, 09:30 UTC avvisas | `BookingService.test.ts` | SC-BOOK-006 |
| Befintligt livscykeltest får en tid efter sluttid | `BookingService.test.ts` | – |
| Nytt fel → 400 och meddelande med klockslag | `mapBookingErrorToStatus.test.ts` | SC-BOOK-002 |
| Konkurrens: ombokning efter kontrollen men före skrivningen → `BOOKING_CHANGED_CONCURRENTLY`, status förblir `confirmed` | `BookingService.test.ts` (Mock-repository med villkorad skrivning) | SC-BOOK-002 |
| `completed` skickar `expected` med lästa `status`, `bookingDate`, `endTime`, `timezone`; andra statusbyten skickar inget | `BookingService.test.ts` | – |
| `BOOKING_CHANGED_CONCURRENTLY` → 409 | `mapBookingErrorToStatus.test.ts` | – |

**C3 – API och klienter**

| Test | Fil | Scenario |
|---|---|---|
| PUT före sluttid → 400 med meddelande; efter → 200 (`vi.setSystemTime`) | `bookings/[id]/route.integration.test.ts` | SC-BOOK-002, SC-BOOK-001 |
| `updateStatusWithAuth` lägger `status`, `bookingDate`, `endTime`, `timezone` i samma `WHERE`; `P2025` → `null` | `PrismaBookingRepository.test.ts` (ny, Prisma mockad) | SC-BOOK-002 |
| PUT: villkorad skrivning utan träff när bokningen finns → 409 | `bookings/[id]/route.integration.test.ts` | SC-BOOK-002 |
| Ombokning (kund och leverantör) skriver bara över `pending`/`confirmed` | `PrismaBookingRepository.test.ts` | – |
| `timezone` finns i svaren | `native/bookings/route.test.ts`, `native/calendar/route.test.ts`, `bookings/route.test.ts` | SC-BOOK-007 |
| Röstlogg: anteckning sparas, `completion.status` är `rejected` med orsak och meddelande | `voice-log/confirm/route.test.ts` | SC-BOOK-002 |
| Röstlogg: anteckning sparas och `completion.status` är `completed` | `voice-log/confirm/route.test.ts` | SC-BOOK-001 |
| Röstloggens besked för båda utfallen (`describeVoiceLogResult`) | `useVoiceWorkLog.test.ts` (ny) | SC-BOOK-001, -002 |
| Offlinekö: 400 sparar serverns meddelande som konflikt (finns delvis) | `sync-engine.test.ts` | SC-BOOK-008 |
| Mottagningstiden avgör: samma body avvisas före och godkänns efter sluttid | `bookings/[id]/route.integration.test.ts` | SC-BOOK-008 |
| Knapp inaktiverad med förklaring före sluttid, aktiv vid och efter; Stockholm när tidszon saknas | `MarkCompletedButton.test.tsx` (ny, delas av kalenderdialogen och bokningslistan) | SC-BOOK-001, -003, -005 |
| iOS: regel för om knappen är aktiv, i bokningens tidszon; texter och felmeddelanden | `BookingCompletionRulesTests` (ny) | SC-BOOK-002, -004, -005, -007 |
| iOS: `timezone` avkodas och följer med i kopior | `BookingsModelsTests`, `CalendarModelsTests` | SC-BOOK-007 |
| iOS: 4xx köas inte, nätverksfel och 5xx köas | `PendingActionStoreTests` | SC-BOOK-002 |
| iOS: avvisad markering ger synligt fel (lista och kalender) | `BookingsViewModelTests`, `CalendarViewModelTests` | SC-BOOK-002 |
| Befintligt offline-E2E: seed flyttas till passerad tid | `e2e/offline-mutations.spec.ts` | SC-BOOK-008 |

**C2**

| Test | Fil | Scenario |
|---|---|---|
| `completed` tillåts | `PaymentService.test.ts` | SC-PAY-001 |
| `pending`, `cancelled`, `no_show` avvisas | `PaymentService.test.ts` | SC-PAY-002, -004, -005 |
| `confirmed` avvisas (ersätter "succeeds for confirmed booking") | `PaymentService.test.ts` | SC-PAY-003 |
| Nytt felmeddelande | `mapPaymentErrorToStatus.test.ts` | SC-PAY-003 |
| API: `confirmed` → 400 (verklig `PaymentService`) | `payment/route.integration.test.ts` | SC-PAY-003 |
| "Betala" bara för `completed`; text för `confirmed` | `BookingCard.test.tsx` (ny) | SC-PAY-002, -003 |

**Vertikal E2E** (ny spec, mock-betalning, `stripe_payments` påslagen i
testet): bekräftad bokning med passerad sluttid → leverantören markerar
genomförd → kunden ser och genomför betalning → "Betald". Negativt fall i
samma spec: bekräftad bokning senare idag – leverantörens knapp är
inaktiverad och kunden ser ingen "Betala". (SC-BOOK-001, SC-BOOK-003,
SC-PAY-001, SC-PAY-003)

SC-PAY-006 testas inte: det beror på den öppna frågan Q-PAY-002.

## Risker

| Risk | Hantering |
|---|---|
| Befintliga tester markerar framtida bokningar som utförda (offline-E2E 3 och 5 dagar fram; ev. fler enhetstester) | Tester som kodar det förbjudna beteendet ändras till passerad tid. Ingen regel ändras. |
| `bookingDate` lagras i flera varianter | Öster om UTC läses datumet i bokningens tidszon, väster om UTC i UTC; en tidsstämpel utan zon (Supabase REST) tolkas som UTC. Samma regel i webb, server och iOS; täcks av test. |
| Enhetens klocka fel | Servern avgör; klienterna hanterar 400. |
| iOS-köns tysta 4xx-kastning vid senare synk | Dokumenteras som kvarstående gap (inte i denna slice). |
| Kvarstående från `/code-review` 2026-10-24 (mindre, dokumenteras) | (a) iOS-vyerna aktiverar inte knappen av sig själv vid sluttiden; det sker vid nästa omritning, t.ex. dra-för-att-uppdatera (webben har en timer). ios-expert föreslår som uppföljning en skärmvis `tick` vid `scenePhase == .active` och var 60:e sekund. (b) Kundens ombokning som krockar med en samtidig markering får ombokningens krockmeddelande. (c) Raderas bokningen mellan den villkorade skrivningen och läsningen svarar tjänsten 404 trots att statusen skrevs. |
| iOS saknar serverns felmeddelande (`APIError.serverError(Int)`) | iOS visar en lokal text per statuskod för statusbytet (400 vid `completed`, 409). Servern avgör fortfarande; att föra fram serverns text kräver ändrad `APIError` och hör inte till slicen. |
| Öppna betalningsförsök skapade vid `confirmed` före C2 kan fortfarande slutföras hos Stripe | Gäller staging/sandbox (prod kör mock). Hör till C1/Q-PAY-002, inte denna slice. |
| `BookingService` (667 rader) växer | Tidslogiken läggs i egen fil; `updateStatus` får bara ett anrop. |
| Samtidig ombokning | Villkorad skrivning i båda riktningar; konkurrenstest på domännivå och kontroll av `WHERE` i repositoryt. Hinner bokningen bli utförd före en ombokning ger ombokningen samma svar som vid krock (`null` från repositoryt) – ovanligt och ofarligt. Atomiciteten i själva databasen provkörs inte mot riktig PostgreSQL i enhetstesterna – den bygger på radlås i `UPDATE`. |

## Implementeringsordning

1. C3 RED: `BookingTime`, `BookingService.updateStatus` inklusive
   konkurrensfallet, felmappning, API, röstloggens svar, `timezone` i svaren.
2. C3 GREEN: `getBookingEndInstant`, `now`-beroende, nya fel, villkorad
   skrivning, ombokningens statusvillkor, `timezone` i select-blocken.
3. C3 klienter: webbknappar och felmeddelanden, röstlogg, iOS, offline-E2E-seed.
4. C3 verifiering: `check:all`, iOS-sviter (nivå 1), offline-E2E.
5. C2 RED → GREEN: `PaymentService`, felmeddelande, integrationstest.
6. C2 UI: `BookingCard`.
7. Vertikal E2E.
8. Dokument: hjälpartiklar (`customer/betalning-och-kvitto.md`,
   `provider/hantera-bokningar.md`, `provider/offline-lage.md` vid behov),
   `docs/testing/testing-guide.md`, `docs/architecture/booking-flow.md`,
   detta kontrakt och spårbarhetsmatrisen.
9. Reviews: `/code-review`, därefter `/security-review` (ändrade API-routes)
   och cx-ux-reviewer vid behov; ios-expert för Swift-ändringarna.
10. Codex slutgranskning före commit och PR.

## Icke-mål

- Ingen override eller undantag för tidig markering.
- C1 (ett betalningsförsök), D1, Connect, kvitto, moms, refund, C4–C7.
- Ingen ändring av webhookens hantering eller av befintliga öppna
  betalningsförsök.
- Ingen schemaändring, ingen datamigrering av bokningar som redan markerats
  utförda före sluttid (Q-PAY-002).
- Ingen ändring av ombokningsfönstrets tidsberäkning (`RESCHEDULE_WINDOW_PASSED`),
  även om den använder serverns lokala tid (`setHours`) – noteras som "watch".
- Ingen generell omarbetning av iOS offlinekö utöver att 4xx inte köas.
