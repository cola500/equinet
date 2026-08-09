---
title: "GDPR -- Gap-register"
description: "Prioriterad lista över identifierade GDPR-luckor i Equinet, med risknivå och rekommenderad åtgärd"
category: security
status: active
last_updated: 2026-08-09
tags: [gdpr, security, privacy, gap-analysis, dataskydd]
related:
  - docs/security/gdpr-records-of-processing.md
  - docs/security/gdpr-subprocessor-register.md
  - docs/security/data-retention-policy.md
  - docs/security/supabase-rls-security-audit-2026-08-06.md
  - docs/architecture/messaging-domain.md
  - docs/product-audit/technical-risks.md
sections:
  - Syfte
  - Hur luckorna hittades
  - Sammanfattning
  - Hög prioritet
  - Medel prioritet
  - Låg prioritet
  - Redan medvetet uppskjutet
  - Vad som INTE är en lucka
  - Nästa steg
---

# GDPR -- Gap-register

## Syfte

Prioriterad lista över konkreta GDPR-luckor i Equinet, identifierade genom
kodgranskning (inte antaganden). Varje rad har en risknivå och en rekommenderad
åtgärd. **Inget i detta dokument är åtgärdat -- det är en inventering.**
Prioritering och beslut om vilka luckor som ska stängas, och i vilken ordning,
är ett produktbeslut för Johan.

## Hur luckorna hittades

1. Jämförde `src/app/api/export/my-data/route.ts` (dataexport, Art. 15/20) mot
   samtliga personuppgiftsmodeller i `prisma/schema.prisma`.
2. Jämförde `src/domain/account/AccountDeletionService.ts` (kontoradering, Art. 17)
   -- särskilt `deletePersonalRecords()` -- mot samma modeller, inklusive att läsa
   varje relations `onDelete`-beteende.
3. Läste `sentry.server.config.ts` för att se vad `beforeSend` faktiskt scrubbar.
4. Läste `CookieNotice.tsx` för att se om consent faktiskt hanteras.
5. Sökte efter cron/cleanup-jobb för `AdminAuditLog`.
6. Läste tidigare öppna frågor i `docs/product-audit/technical-risks.md` (R19) och
   `docs/architecture/messaging-domain.md` för att bekräfta/komplettera kända gap.
7. En andra, oberoende faktakontrollsomgång (separat agent, samma dag) verifierade
   varje konkret påstående på nytt mot koden -- den hittade ytterligare fyra gap
   (#3b, #5b, #5c, #5d, #7b nedan) som första genomgången missade, plus ett
   felaktigt påstående om Apple/APNs-radens innehåll (korrigerat i
   `gdpr-subprocessor-register.md`).

## Sammanfattning

| # | Lucka | Prioritet |
|---|-------|-----------|
| 1 | `AdminAuditLog` har ingen retention/radering | Hög |
| 2 | Kontoradering missar `ProviderCustomerNote.content` | Medel |
| 3 | Enhets-/inbjudningstokens raderas aldrig (cascade utlöses aldrig) | Medel |
| 3b | `Stable`/`StableSpot`/`StableInviteToken`-adressdata raderas aldrig (samma cascade-brist som #3, men med full adress + kontaktuppgifter) | Medel-Hög |
| 4 | Kontoradering anonymiserar inte `RouteOrder`/`RouteStop` | Medel |
| 5 | Dataexport saknar tre datakällor (se detalj) | Medel |
| 5b | `ProviderVerification` (certifieringsdata) rörs inte av kontoradering | Medel |
| 5c | `BugReport` (fritext, kan innehålla PII) rörs inte av kontoradering | Medel |
| 5d | `Booking.providerNotes`/`horseInfo` nollställs inte vid kontoradering (bara `customerNotes` gör det) | Medel |
| 6 | Cookie-notice är ingen samtyckesmekanism | Låg |
| 7 | Sentry scrubbar inte all PII | Låg |
| 7b | Push-notiser till Apple/APNs innehåller avsändarnamn + meddelandeutdrag, inte bara enhetstoken | Låg-Medel |
| 8 | `data_retention`-flaggan är avstängd i produktion | Låg-info |
| 9 | Ingen DPIA genomförd | Info |
| 10 | DPA-status overifierad för samtliga personuppgiftsbiträden | Info (se subprocessor-registret) |

## Hög prioritet

### 1. `AdminAuditLog` saknar retention -- sparas för evigt

**Vad:** `AdminAuditLog` (rad 1009 i schema) loggar `userEmail`, `ipAddress`,
`userAgent` för varje admin-åtgärd, automatiskt via `withApiHandler`
(`src/lib/api-handler.ts:174-191`). Det finns ingen TTL, inget cron-jobb och
ingen manuell rensningsrutin. `data-retention-policy.md` nämner generiskt
"Loggar (server): 1 år" men specificerar inte denna tabell, och ingen kod
verkställer det för `AdminAuditLog`.

**Varför det är allvarligt:** Detta är inte en teoretisk risk --
`docs/security/supabase-rls-security-audit-2026-08-06.md` bekräftar att exakt
denna tabell **saknade RLS** fram till nyligen, och att 52 rader med IP-adresser
var läsbara av `anon`-rollen i produktion innan det åtgärdades. RLS-hålet är
stängt, men datan som låg exponerad hade inte behövt finnas kvar så länge om
en retention-policy funnits från början. Lagringsminimering (Art. 5.1.e)
uppfylls inte för denna tabell idag.

**Rekommenderad åtgärd:** Lägg till `AdminAuditLog` i retention-policyn (t.ex.
12 månader) och återanvänd samma cron-mönster som `DataRetentionService`
redan implementerar. Litet, avgränsat arbete -- passar som egen slice.

## Medel prioritet

### 2. `ProviderCustomerNote` anonymiseras inte vid kundens kontoradering

**Vad:** `ProviderCustomerNote.content` (fritext OM en kund, skriven av
leverantören, se schema rad 723) rensas inte av
`AccountDeletionService.deletePersonalRecords()`. Kundens övriga data
anonymiseras, men leverantörens anteckningar om samma kund ligger kvar,
kopplade till `customerId`.

**Rekommenderad åtgärd:** Avgör om dessa anteckningar ska raderas eller
anonymiseras vid kundens kontoradering (jämförbart med hur `HorseNote` redan
hanteras). Kräver ett litet produktbeslut: har leverantören ett berättigat
intresse att behålla anteckningen (t.ex. bokföringsskäl) även efter att
kunden raderat sitt konto?

### 3. Enhets- och inbjudningstokens raderas aldrig vid kontoradering

**Vad:** `MobileToken`, `DeviceToken` och `CustomerInviteToken` har
`onDelete: Cascade` mot `User` i schemat -- men `AccountDeletionService`
**anonymiserar** `User`-raden (ett `UPDATE`), den raderas aldrig. Cascade
utlöses därför aldrig, och dessa tre tabeller behåller sina poster kopplade
till det anonymiserade kontots (oförändrade) `userId` på obestämd tid.

**Rekommenderad åtgärd:** Lägg till explicit `deleteMany`-anrop för dessa tre
modeller i `deletePersonalRecords()`, samma mönster som redan används för
`PushSubscription`, `Follow` m.fl. i samma metod. Litet, mekaniskt arbete.

### 3b. `Stable`/`StableSpot`/`StableInviteToken` raderas aldrig -- samma cascade-brist som #3, men mer känslig data

**Vad:** Samma rotorsak som lucka #3: dessa tre modeller har `onDelete: Cascade`
mot `User`, men `AccountDeletionService` anonymiserar `User`-raden (UPDATE)
istället för att radera den, så cascaden utlöses aldrig. Skillnaden mot #3 är
att `Stable` innehåller full adress, stad, postnummer, kommun, GPS-koordinater
samt kontakt-e-post och kontakttelefon -- betydligt känsligare data än en
enhetstoken.

**Rekommenderad åtgärd:** Samma tekniska lösning som #3 (explicit `deleteMany`
i `deletePersonalRecords()`), men prioritera denna högre än #3 på grund av
datakänsligheten. Kan göras i samma slice som #3 -- det är samma buggmönster.

### 4. `RouteOrder`/`RouteStop` anonymiseras inte vid kontoradering

**Vad:** Kundinitierade ruttbeställningar (`RouteOrder.customerId`,
adress + GPS-koordinater i `RouteStop`) rörs inte av kontoraderingsflödet.

**Rekommenderad åtgärd:** Avgör om detta ska anonymiseras (adress/GPS null)
på samma sätt som `Booking.customerNotes`, eller om ruttdata ska behandlas
som leverantörens verksamhetsdata (berättigat intresse) på samma sätt som
anonymiserad bokningshistorik. Kräver ett litet produktbeslut.

### 5. Dataexporten (Art. 15/20) täcker inte all data som lagras om en användare

**Vad:** `GET /api/export/my-data` inkluderar profil, hästar, bokningar,
egna `HorseNote`, recensioner och leverantörsdata -- men **inte**:
- `ProviderCustomerNote` (anteckningar OM kunden, skrivna av leverantören)
- `Message`/`Conversation` (meddelandeinnehåll)
- `RouteOrder`/`RouteStop` (kundinitierade ruttbeställningar)

Detta besvarar den öppna frågan i `docs/product-audit/technical-risks.md`
(R19: "Oklart om export/radering täcker all data korrekt") -- svaret är nej,
inte fullständigt.

**Rekommenderad åtgärd:** Lägg till dessa tre datakällor i exportroutens
JSON/CSV-output. Meddelandeinnehåll kräver ett produktbeslut om huruvida hela
konversationen (inkl. motpartens meddelanden) ska ingå eller bara den
exporterande användarens egna meddelanden.

### 5b. `ProviderVerification` rörs inte av kontoradering

**Vad:** Leverantörens certifierings-/utbildningsuppgifter (titel, utfärdare,
år) anonymiseras inte av `anonymizeProvider()` när leverantören raderar sitt
konto.

**Rekommenderad åtgärd:** Lägg till i `anonymizeProvider()`-flödet, eller
avgör om detta ska raderas separat.

### 5c. `BugReport` rörs inte av kontoradering

**Vad:** `BugReport` innehåller fritext (`title`, `description`,
`reproductionSteps`) och `userAgent`, med en valfri koppling till `userId`.
Rensas eller anonymiseras aldrig vid kontoradering. Redan flaggad i
`docs/security/supabase-rls-security-audit-2026-08-06.md` som en tabell som
"kan innehålla PII i beskrivningar".

**Rekommenderad åtgärd:** Avgör om `userId`-kopplingen ska nollställas vid
kontoradering (innehållet i sig kan vara relevant att behålla för
produktutveckling, men kopplingen till en specifik raderad användare bör
sannolikt tas bort).

### 5d. `Booking.providerNotes`/`horseInfo` nollställs inte vid kontoradering

**Vad:** Endast `Booking.customerNotes` nollställs av `anonymizeBookings()`
(`data: { customerNotes: null }`). `providerNotes` och `horseInfo` -- som
båda kan innehålla kundrelaterad fritext -- rörs inte, trots att bokningen i
övrigt behandlas som anonymiserad.

**Rekommenderad åtgärd:** Avgör om `providerNotes`/`horseInfo` ska nollställas
på samma sätt som `customerNotes`, eller om leverantören har ett berättigat
intresse att behålla dem (t.ex. som del av sin egen verksamhetshistorik).

## Låg prioritet

### 6. Cookie-notice är en informationsbanner, inte en samtyckesmekanism

**Vad:** `CookieNotice.tsx` visar ett meddelande med en "Stäng"-knapp. Det
finns inget opt-in/opt-out per cookiekategori. Detta är primärt en
ePrivacy-fråga (cookielagen) snarare än en ren GDPR-fråga, men de två
regelverken hänger ihop i praktiken eftersom analytics-cookies räknas som
personuppgiftsbehandling.

**Rekommenderad åtgärd:** Bygg om till en faktisk samtyckesmekanism om
tjänsten sätter några cookies som kräver samtycke (utöver strikt nödvändiga
auth-cookies). Kräver UX-/produktbeslut om kategorier -- större arbete,
föreslogs som separat slice i scope-valet för detta dokumentationspaket.

### 7. Sentry scrubbar inte all PII

**Vad:** `sentry.server.config.ts` tar bara bort `cookie`- och
`authorization`-headers i `beforeSend`. Övrig PII i request-context,
breadcrumbs eller felmeddelanden (t.ex. om en e-postadress råkar hamna i en
exception-message) scrubbas inte.

**Rekommenderad åtgärd:** Utöka `beforeSend` med ytterligare fältrensning
(e-post-regex, IP-maskning om Sentry inte redan gör det på plattformsnivå).
Litet, avgränsat arbete.

### 7b. Push-notiser till Apple/APNs innehåller meddelandeinnehåll, inte bara enhetstoken

**Vad:** `MessageNotifier.ts` skickar avsändarnamn och ett utdrag (80 tecken)
av meddelandetexten i push-payloaden när ett nytt meddelande skickas
(`PushDeliveryService.sendAPNs`). Det innebär att meddelandeinnehåll --
personuppgifter enligt registret ovan -- överförs till Apples infrastruktur,
inte bara en opersonlig enhetstoken. Redan delvis känt: `messaging-domain.md`
listar "Privacy-note om push-preview" som en öppen punkt från en tidigare
security-review, men det har inte tidigare kopplats till subprocessor-/
tredjelandsöverföringsfrågan.

**Rekommenderad åtgärd:** Avgör om push-notiser ska vara generiska ("Du har
ett nytt meddelande") istället för att inkludera ett textutdrag, vilket
skulle eliminera överföringen av meddelandeinnehåll till Apple helt. Litet
UX-avvägningsbeslut (mindre informativ notis vs. mindre dataöverföring).

### 8. `data_retention`-flaggan är byggd men avstängd

**Vad:** Hela retention-/anonymiseringsflödet för inaktiva konton finns
implementerat (`DataRetentionService`, cron, e-postmall) men är gated bakom
en feature flag som är **av som default** i produktion, enligt
`data-retention-policy.md`. Det innebär att lagringsminimering (Art. 5.1.e)
för inaktiva konton inte verkställs i praktiken idag, trots att policyn är
skriven och koden finns.

**Rekommenderad åtgärd:** Detta är explicit **inte** något att slå på som en
del av detta dokumentationsarbete -- att aktivera flaggan innebär att
verklig användardata i produktion automatiskt anonymiseras, vilket är en
irreversibel dataoperation och ett produktbeslut som kräver Johans
uttryckliga godkännande (RED-beslut enligt `docs/agent-operations/`).
Rekommenderas som en egen, tydligt avgränsad uppföljning.

## Redan medvetet uppskjutet

Dessa är inte nya fynd -- de är redan dokumenterade avvägningar i repot och
tas med här för fullständighet:

- **`Message.senderId` anonymiseras inte separat vid kontoradering.**
  Dokumenterat i `docs/architecture/messaging-domain.md` (D7, rad 609):
  Cascade från `Booking` räcker för MVP, partiell anonymisering av
  `senderId` är planerad som separat PR "om Dataskyddsombudet kräver det".
  Notera: detta gap överlappar delvis med lucka #5 (export) och #3
  (kontoradering) ovan -- men är redan ett känt, medvetet beslut, inte ett
  nytt fynd.

## Vad som INTE är en lucka

- **`Horse.specialNeeds` m.fl. hästfält räknas inte som Art. 9-särskild
  kategori** eftersom hästen inte är en registrerad fysisk person. Se
  resonemang i `gdpr-records-of-processing.md`.
- **RLS-säkerheten** är i gott skick -- `supabase-rls-security-audit-2026-08-06.md`
  visar noll kvarvarande High-fynd. Detta gap-register handlar om
  lagringsminimering och fullständighet i DSR-flöden, inte om åtkomstkontroll.
- **Export och radering (Art. 15/17/20) finns och fungerar** för
  huvuddelen av datan -- de är inte "saknade" funktioner, bara ofullständiga
  i periferin (se luckor #2--#5).

## Nästa steg

Detta gap-register är en inventering, inte en åtgärdsplan. Rekommenderat
nästa steg: Johan prioriterar vilka luckor (om några) som ska bli egna,
avgränsade slices, i fallande prioritetsordning (#1 → #5 → #6/#7 → #8 som
separat produktbeslut). Ingen kod har ändrats som en del av detta dokument.

## Ändringslogg

| Datum | Ändring |
|-------|---------|
| 2026-08-09 | Första versionen, kompletterad efter oberoende faktakontroll samma dag med luckor #3b, #5b, #5c, #5d och #7b. Del av GDPR-dokumentationspaketet (se `docs/agent-operations/`). |
