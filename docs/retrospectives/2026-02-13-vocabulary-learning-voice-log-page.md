# Retrospektiv: Vokabulärinlärning + Dedikerad röstloggningssida

**Datum:** 2026-02-13
**Scope:** Automatisk vokabulärinlärning från leverantörskorrigeringar + flytt av röstloggning från dialog till egen sida

---

## Resultat

- 10 ändrade filer, 5 nya filer, 1 ny migration
- 29 nya tester (alla TDD, alla gröna)
- 1630 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma`, `migration.sql` | `vocabularyTerms String?` på Provider |
| Domain | `VocabularyService.ts` (ny) | Parse, addCorrections, formatForPrompt, detectSignificantChanges |
| Domain | `VoiceInterpretationService.ts` (ändrad) | `vocabularyPrompt` parameter i `interpret()` |
| API | `voice-log/route.ts` (ändrad) | Injicerar vokabulär i LLM-prompten |
| API | `voice-log/confirm/route.ts` (ändrad) | Fångar korrigeringar, sparar som vokabulär |
| Hook | `useVoiceWorkLog.ts` (ny) | Extraherad wizard-logik från VoiceWorkLogDialog |
| UI | `voice-log/page.tsx` (ny) | Dedikerad sida `/provider/voice-log` |
| UI | `VoiceWorkLogDialog.tsx` (refaktorerad) | Använder `useVoiceWorkLog` hook istället för intern state |
| UI | `bookings/page.tsx` (ändrad) | Navigation till sida istället för dialog-öppning |
| Types | `IProviderRepository.ts` (ändrad) | `vocabularyTerms` på Provider-interfacet |

## Vad gick bra

### 1. TDD fångade nästningsfel direkt
Testerna för VoiceInterpretationService kompilerade inte pga en `})` som hamnade utanför `describe("interpret")`. Syntaxfelet hittades omedelbart av testrunner -- ingen felsökning behövdes.

### 2. Chunk-baserad diff-algoritm var rätt abstraktion
Första implementationen använde en ordvis pointer-approach som missade insertions ("Verkade alla fyra" -> "Verkade om alla fyra"). Bytet till common prefix/suffix-approach löste alla testfall och är enklare att resonera kring.

### 3. Hook-extrahering gav ren arkitektur
Att flytta all wizard-state till `useVoiceWorkLog` innebar att:
- Sidan och dialogen delar exakt samma logik
- Vocabulary-learning (originalWorkPerformed-tracking) kunde läggas till på ett ställe
- Dialog-komponenten gick från 490 rader till 347 rader

### 4. /implement-skill fungerade sömlöst
Fas-för-fas med RED -> GREEN -> typecheck mellan varje fas fångade IProviderRepository-felet i fas 3 (vocabularyTerms saknades i domain-typen) innan det kunde sprida sig.

## Vad kan förbättras

### 1. Diff-algoritmen är förenklad
`detectSignificantChanges` hanterar bara en sammanhängande ändring per textjämförelse (common prefix + suffix). Flera ändringar i samma text (t.ex. "Verkade Stellansen alla fyra" -> "Raspade Stella alla fyra") fångar bara den första diff-chunken.

**Prioritet:** LÅG -- en korrigering per tolkning är det vanliga fallet. Kan uppgraderas till LCS-baserad diff om behov uppstår.

### 2. Ingen hook-test
`useVoiceWorkLog` har ingen dedikerad testfil. Logiken testas indirekt via API-route-tester och typecheck, men `renderHook`-tester med fetch-mockar skulle ge bättre coverage.

**Prioritet:** MEDEL -- hooken innehåller mest state-management och fetch-anrop, men vocabulary-learning-flödet (originalWorkPerformed -> confirm body) testas bara genom API-testerna.

## Patterns att spara

### Vokabulärinlärning via edit-diff
När användaren redigerar AI-output, spara `originalX` i state vid interpret-steget. Vid confirm, skicka med `originalX` om det skiljer sig från det redigerade. Backend kör `detectSignificantChanges` -> `addCorrections` -> `prisma.provider.update`. Nästa gång injiceras vokabulären via `formatForPrompt` -> `buildSystemPrompt`. Max 50 termer (FIFO).

### Hook-extrahering för dialog -> sida-migration
1. Extrahera ALL state + handlers till custom hook
2. Lägg till ny state som behövs (t.ex. `originalWorkPerformed`)
3. Bygg sida som använder hooken
4. Refaktorera dialogen att använda samma hook
5. Uppdatera navigering (router.push istf setState)

### Nullable textfält för JSON-data
`vocabularyTerms String?` istället för JSONB -- enklare migration (bara `ADD COLUMN TEXT`), inga index-behov, Prisma hanterar det som vanlig sträng. Service-lagret parsar med `JSON.parse` + Zod-liknande validering i `parseVocabulary()`. Robust mot korrupt data (returnerar tom vokabulär vid parsfel).

## Lärandeeffekt

**Nyckelinsikt:** Att bygga "lärande" AI-features kräver tre lager: (1) fånga korrigeringar vid bekräftelse, (2) persistera dem strukturerat, (3) injicera dem i prompten. Det viktigaste designbeslutet var att göra varje lager oberoende testbart -- VocabularyService har inga beroenden, VoiceInterpretationService tar prompten som parameter, och confirm-routen orkestrerar. Denna separation gjorde TDD naturlig och varje fas kunde verifieras isolerat.
