# Retrospektiv: Kundrecensioner (Provider -> Kund)

**Datum:** 2026-02-05
**Scope:** Leverantörer kan recensera kunder efter genomförda bokningar

---

## Resultat

- 9 nya filer, 6 ändrade filer (+1331 rader)
- 23 nya tester (6 domain service + 17 API route), alla TDD
- 1213 totala tester (alla gröna)
- Typecheck = 0 errors
- Tid: ~1 session (schema -> domain -> API -> UI)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma` | Ny `CustomerReview`-modell (immutabel, ingen `updatedAt`) |
| Domain | `CustomerReviewService.ts` | Affärsregler: 4 valideringssteg + Result-pattern |
| Infrastructure | `ICustomerReviewRepository.ts`, `CustomerReviewRepository.ts`, `MockCustomerReviewRepository.ts` | Interface + Prisma + Mock |
| API | `POST/GET /api/customer-reviews` | Zod-validering, session-baserad auth, strict schema |
| UI | `CustomerReviewDialog.tsx` | Stjärnbetyg + kommentar, baserad på befintliga ReviewDialog |
| Integration | `BookingDetailDialog.tsx`, `provider/bookings/page.tsx`, `provider/calendar/page.tsx` | "Recensera kund"-knapp + visa befintlig recension |

## Vad gick bra

### 1. Schema-först + TDD gav hög hastighet
Hela featuren (schema -> migration -> domain -> API -> UI) tog en session. Att följa befintliga patterns (ReviewService, ReviewRepository) eliminerade designbeslut.

### 2. Befintliga patterns var direkt återanvändbara
CustomerReviewService är nästan identisk med ReviewService, bara enklare (ingen reply/edit/delete). Samma Result-pattern, samma error-typer, samma test-struktur. Detta visar att DDD-Light-arkitekturen skalar bra.

### 3. Immutabel modell förenklar allt
Inga PUT/DELETE-endpoints, ingen `updatedAt`, ingen edit-mode i UI. Mindre kod = färre buggar. Rätt beslut för MVP -- redigering kan läggas till later om det behövs.

### 4. Strict Zod-schema blockerade IDOR-försök
Testet "should not allow providerId in request body" verifierar att `.strict()` avvisar extra fält. `providerId` tas alltid från session -- omöjligt att förfalska.

### 5. Select-pattern förhindrar dataläckor
`findByCustomerIdWithDetails` inkluderar INTE `customerReview` -- kunder ser aldrig sina egna omdömen från leverantörer. Medvetet designval.

## Vad kan förbättras

### 1. Ingen factory pattern för DI
`new CustomerReviewService({ ... })` skapas inline i route. Fungerar för denna enkla service (2 deps) men är inte skalbart. Vid 3+ dependencies bör factory användas.

**Prioritet:** LÅG -- bara 2 dependencies, inline DI är acceptabelt.

### 2. Ingen notifikation till kund
Kunden får ingen notis när leverantören lämnar en recension. Medvetet val för MVP -- kunder ska inte se sina reviews ännu.

**Prioritet:** LÅG -- avvakta beslut om kunder ska se reviews.

### 3. Inget genomsnittligt kundbetyg
Det finns inget aggregerat betyg per kund (som det finns för leverantörer). Kan behövas för att ge leverantörer en översikt.

**Prioritet:** MEDEL -- naturlig nästa steg om featuren används.

### 4. Saknar rate limiting på POST-endpoint
Route använder inte `rateLimiters.api` -- borde läggas till för att förhindra spam.

**Prioritet:** HÖG -- enkel fix, lägg till i nästa pass.

## Lärdomar för CLAUDE.md

| # | Lärdom | Detalj |
|---|--------|--------|
| 1 | Immutabla modeller förenklar MVP | Ingen PUT/DELETE = halverad API-yta, färre tester, enklare UI |
| 2 | Befintliga DDD-patterns skalar | Ny domän (CustomerReview) tog en bråkdel av tiden vs Review (pilot) |
| 3 | `strict()` på Zod är säkerhetskritiskt | Förhindrar IDOR via extra request body-fält |
| 4 | `select` i repository skyddar kundsidan | Medvetet exkludera data som ej ska exponeras |

## Nästa steg

1. Lägg till `rateLimiters.api` i POST-endpoint
2. Beslut: Ska kunder se sina kundrecensioner?
3. Eventuellt: Aggregerat kundbetyg (snitt per kund)
