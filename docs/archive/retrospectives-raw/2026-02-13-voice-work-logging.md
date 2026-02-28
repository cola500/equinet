# Retrospektiv: Röstloggning för fältleverantörer

**Datum:** 2026-02-13
**Scope:** Ny feature -- röst/textbaserad arbetsloggning med AI-tolkning, plus säkerhetshärdning och UX-förbättringar efter granskning

---

## Resultat

- 10 nya filer, 2 ändrade filer, 0 migrationer
- 101 nya tester (alla TDD, alla gröna) -- 24 route, 15 service, 62 i MVP-commit
- 1601 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: 2 sessioner (MVP + granskning/härdning)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API | `voice-log/route.ts` | POST -- tar transkribering, hämtar dagens bokningar, anropar AI-tolkning |
| API | `voice-log/confirm/route.ts` | POST -- sparar tolkat resultat (notes, status, horse note) |
| Domain | `VoiceInterpretationService.ts` | Anthropic API-anrop, Zod-validering av LLM-output, bookingId-kontroll mot context |
| UI | `VoiceWorkLogDialog.tsx` | Stegvis dialog: inspela/skriv -> tolka -> förhandsgranska -> spara, med bulk-flöde |
| Hook | `useSpeechRecognition.ts` | Web Speech API (sv-SE), continuous mode, SSR-safe |
| Tester | `route.test.ts`, `confirm/route.test.ts`, `VoiceInterpretationService.test.ts` | 39 tester totalt |
| Config | `.env.example`, `package.json` | Anthropic SDK dependency, API-nyckel-dokumentation |
| UI (entry) | `provider/bookings/page.tsx` | Knapp för att öppna röstloggningsdialogen |

## Vad gick bra

### 1. Gransknings-först-approach fångade 6 blockerande problem
Tre specialistagenter (säkerhet, arkitektur, UX) granskade MVP-koden innan merge. Hittade: saknad rate limiting, saknad .strict(), horse note utan ägarskapskontroll, ingen LLM-output-validering, inga tester för confirm-route, UX utan bulk-flöde. Alla fixades i en session.

### 2. TDD fångade ownership-buggen direkt
Testet "verifies booking ownership before creating horse note" skrevs INNAN fixet (RED). Visade att originalkoden tillät horse note-skapande för valfri häst. Atomär `booking.providerId === provider.id`-check lades till.

### 3. Zod-validering av LLM-output förhindrar runtime-krascher
Istället för `JSON.parse(text) as InterpretedVoiceLog` validerar vi nu med Zod-schema + defaults. LLM kan returnera fel typer, saknade fält, eller confidence > 1 utan att appen kraschar. Transform clampar confidence till 0-1.

### 4. Prompt injection-skydd utan komplexitet
BookingId från LLM valideras mot context-listan (dagens bokningar). Om LLM returnerar ett ID som inte finns i context nullas det. Enkelt, effektivt, noll overhead.

## Vad kan förbättras

### 1. Confirm-route gör 3 saker utan $transaction
Uppdaterar providerNotes, markerar completed, skapar horse note -- sekventiellt utan transaction. Partiell failure möjligt. Actions-arrayen gör det transparent men inte perfekt.

**Prioritet:** LAG -- medvetet val för MVP, status-ändring är redan "non-fatal" by design.

### 2. Prisma direkt för horse note i confirm-route
`prisma.horseNote.create` bryter mot repository-pattern. Horse (kärndomän) borde gå via repository. Acceptabelt tillfälligt men bör refaktoreras om horse notes växer.

**Prioritet:** LAG -- enkel create med ownership-check, ingen komplex logik som motiverar repository.

### 3. Datum-filtrering med lokal tidzon
`date.setHours(0, 0, 0, 0)` i interpret-route använder serverns tidzon. I Vercel (UTC) kan det bli fel dag för leverantörer som loggar sent kväll svensk tid.

**Prioritet:** LAG -- fältarbetare loggar dagtid, Vercel kör UTC som är +1/-2h från Sverige.

## Patterns att spara

### LLM-output-validering med Zod
Definiera Zod-schema som matchar förväntat LLM-svar. Använd `safeParse()` + `.default()` för saknade fält + `.transform()` för clamping. Validera referens-ID:n mot känd context-lista (prompt injection-skydd).

### Gransknings-först för AI-features
AI-genererad kod behöver extra granskning: LLM-output valideras inte automatiskt, prompt injection är en risk, och kostnads-exponering kräver rate limiting. Kör säkerhets/arkitektur/UX-granskning INNAN merge.

### Speech API fallback-pattern
`isSupported` styr hela UI:t: mic-knapp döljs, titel ändras ("Röstloggning" -> "Arbetslogg"), placeholder anpassas. Textinmatning fungerar alltid som primärt gränssnitt.

### Bulk-flöde med "Logga nästa"
Done-steg visar "Stäng" + "Logga nästa". Reset:a state men behåll availableBookings (samma dag). Eliminerar 32+ interaktioner för leverantörer med 8 besök.

## Lärandeeffekt

**Nyckelinsikt:** AI-integrationer kräver defense-in-depth: Zod-validering av LLM-output, referens-ID-validering mot känd context (prompt injection), rate limiting (kostnadsskydd), och graceful degradation (text fallback). En `as`-cast på LLM-output är aldrig acceptabelt.
