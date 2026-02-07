# Retrospektiv - Gruppbokning för stallgemenskaper

**Datum:** 2026-01-30
**Arbetsflöde:** Feature-implementation (schema -> API -> domain service -> UI)

## Sammanfattning

Implementerade komplett gruppbokningsfunktion: hästägare skapar en grupprequest med inbjudningskod, andra hästar på samma stall hakar på, och leverantören matchar och skapar sekventiella bokningar för alla deltagare.

### Resultat
- **2 nya Prisma-modeller**: GroupBookingRequest + GroupBookingParticipant
- **7 API-endpoints**: CRUD + join + available + match + participant removal
- **1 domain service**: GroupBookingService med sekventiell bokningslogik
- **6 UI-sidor**: 4 kund (lista, skapa, detalj, join) + 2 leverantör (lista, detalj+match)
- **Navigation**: Uppdaterad CustomerNav + ProviderNav
- **Invite code**: Kryptografiskt säker 8-teckens kod utan tvetydiga tecken

## Vad gick bra

### Databasschema-först
Att börja med Prisma-schemat och sedan bygga API/UI uppåt gav tydlig struktur. `GroupBookingRequest` + `GroupBookingParticipant` med unique constraint `(groupBookingRequestId, userId)` förhindrade dubbelanslutning redan på databasnivå.

### Domain Service för komplex logik
`GroupBookingService.matchRequest()` hanterar den mest komplexa logiken -- skapa sekventiella bokningsslottar för alla deltagare. Att isolera detta i en domain service (istället för direkt i route-handleren) gjorde koden testbar och återanvändbar.

### Invite code-design
Att exkludera tvetydiga tecken (0/O, 1/I/L) från koden gör den lättare att dela verbalt och skriva in manuellt. `crypto.randomBytes()` ger kryptografiskt säker randomisering.

### Atomic operations
Request-skapande + creator-som-deltagare är atomärt (en transaktion). Matchning använder `$transaction` för att säkerställa att alla bokningar skapas eller ingen.

### Notifikationer integrerade från start
Notify-anrop vid join, match, cancel och leave var med från början -- inte efterkonstruktion.

## Vad gick sämre

### Svenska tecken saknades genomgående
Alla 6 UI-sidor saknade å, ä, ö -- t.ex. "Öppen" istället för "Öppen", "hämta" istället för "hämta". Troligen skrivet på mobil eller terminal utan svenskt tangentbord. Krävde en separat fix-commit för ~60 textsträngar.

### Koden skrevs utan fullständig integration med befintliga typer
Notification-typ och hjälpfunktioner duplicerades istället för att importeras från befintliga moduler. Detta är ett känt mönster vid mobil-först-utveckling.

### Ingen TDD
UI-sidorna saknar tester. API-routes har tester men de skrevs inte först (RED-GREEN-REFACTOR). För en feature av denna storlek borde TDD ha använts.

## Lärdomar

### Sekventiell bokningslogik
Att skapa bokningar i rad (participant 1: 09:00-09:45, participant 2: 09:45-10:30, etc.) baserat på service.durationMinutes är en ren och begriplig modell. Alternativet (parallella bokningar med samma tid) hade varit enklare men orealistiskt för ambulerande tjänster.

### Invite code > URL-only
En 8-teckens kod som också kan delas som länk (`/join?code=ABC12345`) ger flexibilitet -- fungerar både verbalt och digitalt.

### Provider-perspektivet är annorlunda
Leverantörer ser "öppna grupprequests" (GET /available) och matchar -- de skapar inte grupprequests. Detta push/pull-mönster (kund pushar request, leverantör pullar och matchar) är annorlunda från vanlig bokning där kunden väljer leverantör.

### Status-transitions måste kontrolleras
`VALID_STATUS_TRANSITIONS` i PUT-endpointen förhindrar ogiltiga övergångar (t.ex. cancelled -> open). Terminal states (completed, cancelled) ska aldrig kunna ändras.

## Beslut & Actions

### Behåll
- **Schema-först approach** för nya features
- **Domain service** för komplex affärslogik
- **Atomic operations** för flerstegsoperationer
- **Notify-från-start** istället för efterkonstruktion

### Ändra
- **Skriv på desktop med rätt tangentbord** -- undvik systematiska teckenfel
- **Importera från befintliga moduler** -- sök efter existerande typer/funktioner före nyskrivning
- **TDD för API-routes** -- skriv tester först, särskilt för ny feature med komplex logik

### Överväga
- **Geo-filtrering i /available** -- filtrera grupprequests baserat på leverantörens serviceområde (TODO i koden)
- **E2E-tester** för gruppbokningsflöde -- hela kedjan från skapande till matchning
- **Stallkoncept** -- om vi vill gruppera användare per stall behöver vi en ny modell (Stable/Barn)
