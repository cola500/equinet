# Retrospektiv: Kundrecensioner (Provider -> Kund)

**Datum:** 2026-02-05
**Scope:** Leverantorer kan recensera kunder efter genomforda bokningar

---

## Resultat

- 9 nya filer, 6 andrade filer (+1331 rader)
- 23 nya tester (6 domain service + 17 API route), alla TDD
- 1213 totala tester (alla grona)
- Typecheck = 0 errors
- Tid: ~1 session (schema -> domain -> API -> UI)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma` | Ny `CustomerReview`-modell (immutabel, ingen `updatedAt`) |
| Domain | `CustomerReviewService.ts` | Affarsregler: 4 valideringssteg + Result-pattern |
| Infrastructure | `ICustomerReviewRepository.ts`, `CustomerReviewRepository.ts`, `MockCustomerReviewRepository.ts` | Interface + Prisma + Mock |
| API | `POST/GET /api/customer-reviews` | Zod-validering, session-baserad auth, strict schema |
| UI | `CustomerReviewDialog.tsx` | Stjarnbetyg + kommentar, baserad pa befintliga ReviewDialog |
| Integration | `BookingDetailDialog.tsx`, `provider/bookings/page.tsx`, `provider/calendar/page.tsx` | "Recensera kund"-knapp + visa befintlig recension |

## Vad gick bra

### 1. Schema-forst + TDD gav hog hastighet
Hela featuren (schema -> migration -> domain -> API -> UI) tog en session. Att folja befintliga patterns (ReviewService, ReviewRepository) eliminerade designbeslut.

### 2. Befintliga patterns var direkt ateranvandbara
CustomerReviewService ar nastan identisk med ReviewService, bara enklare (ingen reply/edit/delete). Samma Result-pattern, samma error-typer, samma test-struktur. Detta visar att DDD-Light-arkitekturen skalar bra.

### 3. Immutabel modell forenklar allt
Inga PUT/DELETE-endpoints, ingen `updatedAt`, ingen edit-mode i UI. Mindre kod = farre buggar. Ratt beslut for MVP -- redigering kan laggas till later om det behovs.

### 4. Strict Zod-schema blockerade IDOR-forsok
Testet "should not allow providerId in request body" verifierar att `.strict()` avvisar extra falt. `providerId` tas alltid fran session -- omojligt att forfalska.

### 5. Select-pattern forhindrar datalackor
`findByCustomerIdWithDetails` inkluderar INTE `customerReview` -- kunder ser aldrig sina egna omdomen fran leverantorer. Medvetet designval.

## Vad kan forbattras

### 1. Ingen factory pattern for DI
`new CustomerReviewService({ ... })` skapas inline i route. Fungerar for denna enkla service (2 deps) men ar inte skalbart. Vid 3+ dependencies bor factory anvandas.

**Prioritet:** LAG -- bara 2 dependencies, inline DI ar acceptabelt.

### 2. Ingen notifikation till kund
Kunden far ingen notis nar leverantoren lamnar en recension. Medvetet val for MVP -- kunder ska inte se sina reviews annu.

**Prioritet:** LAG -- avvakta beslut om kunder ska se reviews.

### 3. Inget genomsnittligt kundbetyg
Det finns inget aggregerat betyg per kund (som det finns for leverantorer). Kan behovas for att ge leverantorer en oversikt.

**Prioritet:** MEDEL -- naturlig nasta steg om featuren andvands.

### 4. Saknar rate limiting pa POST-endpoint
Route anvander inte `rateLimiters.api` -- borde laggas till for att forhindra spam.

**Prioritet:** HOG -- enkel fix, lagg till i nasta pass.

## Lardomar for CLAUDE.md

| # | Lardom | Detalj |
|---|--------|--------|
| 1 | Immutabla modeller forenklar MVP | Ingen PUT/DELETE = halverad API-yta, farre tester, enklare UI |
| 2 | Befintliga DDD-patterns skalar | Ny doman (CustomerReview) tog en brakdel av tiden vs Review (pilot) |
| 3 | `strict()` pa Zod ar sakerhetskritiskt | Forhindrar IDOR via extra request body-falt |
| 4 | `select` i repository skyddar kundsidan | Medvetet exkludera data som ej ska exponeras |

## Naesta steg

1. Lagg till `rateLimiters.api` i POST-endpoint
2. Beslut: Ska kunder se sina kundrecensioner?
3. Eventuellt: Aggregerat kundbetyg (snitt per kund)
