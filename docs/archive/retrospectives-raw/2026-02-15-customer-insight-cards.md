# Retrospektiv: Customer Insight Cards (Kundinsikter)

**Datum:** 2026-02-15
**Scope:** AI-genererade kundinsikter i kundregistret -- bokningsfrekvens, mönster, riskindikatorer och VIP-status

---

## Resultat

- 1 ändrad fil, 5 nya filer, 0 migrationer
- 21 nya tester (13 service + 8 route, alla TDD, alla gröna)
- 1695 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Domain | `CustomerInsightService.ts` | AI-tjänst: Anthropic Claude -> Zod-validering -> Result-typ |
| Domain (test) | `CustomerInsightService.test.ts` | 13 tester: error cases, parsing, array truncation, confidence clamping |
| API | `insights/route.ts` | POST-endpoint: auth -> rate limit -> kundrelation -> 4 parallella queries -> metrics -> AI |
| API (test) | `insights/route.test.ts` | 8 tester: auth, rate limit, relationship check, happy path, error paths |
| UI | `CustomerInsightCard.tsx` | React-komponent: knapp -> loader -> insiktsvy med VIP-badge, varningar, confidence |
| UI (integration) | `customers/page.tsx` | Import + placering mellan anteckningar och "Ta bort kund" |

## Vad gick bra

### 1. VoiceInterpretationService som mall
Hela CustomerInsightService byggdes genom att följa VoiceInterpretationService-mönstret exakt: constructor med `{ apiKey }`, Result-typ, Zod-schema med `.default()` och `.transform()`, `stripMarkdownCodeBlock()`, och `mapErrorToStatus()`. Noll designbeslut behövde tas -- allt var redan löst.

### 2. TDD fångade mock-bug direkt
Route-testet avslöjade att `mapInsightErrorToStatus` saknades i mocken av CustomerInsightService-modulen. Utan TDD hade detta gett svårhittade 500-fel i produktion. Fixades på ett försök.

### 3. Inga migrationer behövdes
All kunddata fanns redan i databasen (bokningar, anteckningar, recensioner). Insikterna beräknas on-the-fly med 4 parallella Prisma-queries + AI. Noll schemaändringar = noll deploy-risk.

### 4. Snabb implementation tack vare beprövade patterns
Hela featuren (service + route + UI + integration) tog en session. `/implement`-skillen exekverade 4 faser autonomt med TDD-verifikation mellan varje fas.

## Vad kan förbättras

### 1. Ingen caching av insikter
Varje klick på "Visa insikter" gör ett nytt AI-anrop (kostnad + latens). En enkel cachning (t.ex. 24h TTL i databas eller localStorage) skulle spara pengar och förbättra UX.

**Prioritet:** MEDEL -- rate limiting (20/min) skyddar mot missbruk, men caching vore bättre.

### 2. Metrics-beräkning dupliceras
`calculateMetrics()` i routen beräknar totalSpent, avgInterval etc. Liknande beräkningar kan finnas i kundregistrets befintliga kod. Vid fler analytics-features bör detta extraheras till en CustomerMetricsService.

**Prioritet:** LÅG -- metrics-funktionen är 30 rader och enkel. Extrahera först vid tredje användningen.

## Patterns att spara

### AI Service-mönster (tredje instansen)
Vi har nu tre AI-tjänster som följer samma mönster:
1. `VoiceInterpretationService.interpret()` -- röstlogg-tolkning
2. `VoiceInterpretationService.interpretQuickNote()` -- snabbanteckning
3. `CustomerInsightService.generateInsight()` -- kundinsikter

**Mönstret:**
- Constructor: `{ apiKey?: string }` med env-fallback
- Metod: `async method(context, ...): Promise<Result<T, Error>>`
- Zod-schema med `.default()` + `.transform()` + confidence clamping
- `stripMarkdownCodeBlock()` för LLM-svar
- Factory-funktion: `createXxxService()`
- Error-mapping: `mapXxxErrorToStatus()`

### POST utan body för AI-generering
Insikts-routen använder POST utan request body -- all data hämtas server-side. Kunden identifieras via URL-param, leverantören via session. Inga Zod-scheman behövs, ingen JSON-parsing. Enklare och säkrare.

## Lärandeeffekt

**Nyckelinsikt:** När man mockar en hel modul med `vi.mock()` måste ALLA exporterade funktioner/klasser inkluderas i mocken -- inte bara den primära klassen. `mapInsightErrorToStatus` var `undefined` i testet vilket gav 500 istället för det förväntade 400-svaret. Lösning: inkludera funktionen i mock-factory:en.
