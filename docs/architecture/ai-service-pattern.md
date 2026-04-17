---
title: "Pattern: AI Service-monster"
description: "Mall for AI-drivna tjanster med Zod-validering, prompt injection-skydd, rate limiting och DI"
category: architecture
status: active
last_updated: 2026-04-17
tags: [ai, pattern, zod, llm, anthropic]
related:
  - docs/architecture/patterns.md
  - src/domain/voice-log/VoiceInterpretationService.ts
  - src/domain/customer-insight/CustomerInsightService.ts
sections:
  - Problemet
  - Monstrets struktur
  - Steg 1 -- Zod-schema for AI-output
  - Steg 2 -- System prompt
  - Steg 3 -- Service-klass med DI
  - Steg 4 -- Prompt injection-skydd
  - Steg 5 -- Error handling och Result-typ
  - Steg 6 -- Rate limiting i API-routen
  - Steg 7 -- Factory och testning
  - Nar anvanda
  - Nar INTE anvanda
  - Kodreferenser
---

# Pattern: AI Service-monster

## Problemet

AI-modeller returnerar ostrukturerad text. Utan validering kan en AI-tjänst:

1. **Returnera ogiltigt format** -- parsningen kraschar, anvandaren far 500
2. **Hallucinera referens-IDn** -- "bokning X" dar X inte finns i kontexten
3. **Svamla over** -- arrays med 50 element nar UI:t vill ha 3
4. **Kosta pengar okontrollerat** -- utan rate limiting kan en loop gora 1000 anrop

## Monstrets struktur

```
API Route (rate limit + auth)
    |
    v
AI Service (DI for apiKey)
    |
    +-- buildUserMessage(context)
    +-- LLM-anrop (Anthropic SDK)
    +-- stripMarkdownCodeBlock()
    +-- JSON.parse()
    +-- Zod safeParse (validering + defaults + transforms)
    +-- Prompt injection-check (verifiera IDn mot kontext)
    |
    v
Result<T, Error>
```

## Steg 1 -- Zod-schema for AI-output

Definiera ett strikt schema med `.default()` pa varje falt sa att saknade falt inte kraschar:

```typescript
const insightSchema = z.object({
  summary: z.string().default("Ingen sammanfattning"),
  score: z.number().default(0).transform(v => Math.max(0, Math.min(1, v))),
  tags: z.array(z.string()).default([]).transform(arr => arr.slice(0, 3)),
  category: z.enum(["a", "b", "c"]).nullable().default(null),
})
```

**Nyckelprinciper:**

- `safeParse`, aldrig `parse` -- kasta aldrig pa ogiltigt AI-output
- `.default()` pa alla falt -- LLM kan glömma ett falt
- `.transform()` for att clampa numeriska varden och trunkera arrays
- `.nullable().default(null)` for optionella falt

## Steg 2 -- System prompt

```typescript
const SYSTEM_PROMPT = `Du ar en [rollbeskrivning].
Du far [beskrivning av input].

Returnera BARA JSON:
{
  "summary": "...",
  "score": 0.0-1.0,
  "tags": ["max 3"],
  "category": "a|b|c|null"
}

Regler:
- [domänspecifika regler]
- Svara BARA med JSON, ingen annan text`
```

**Tips:**
- Prompt caching: `cache_control: { type: "ephemeral" }` pa system-prompten (sparar ~90% pa upprepade anrop)
- Ha en `stripMarkdownCodeBlock()`-funktion -- LLM:er lagger ibland till ` ```json ` trots instruktioner

## Steg 3 -- Service-klass med DI

```typescript
export class MyAIService {
  private apiKey: string | undefined

  constructor(deps?: { apiKey?: string }) {
    this.apiKey = deps?.apiKey || process.env.ANTHROPIC_API_KEY
  }

  async analyze(input: Input): Promise<Result<Output, MyError>> {
    // 1. Validera input
    if (!input.data) return Result.fail({ type: "NO_DATA", message: "..." })
    if (!this.apiKey) return Result.fail({ type: "API_KEY_MISSING", message: "..." })

    // 2. Bygg kontext-meddelande
    const userMessage = this.buildUserMessage(input)

    try {
      // 3. LLM-anrop
      const client = new Anthropic({ apiKey: this.apiKey })
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMessage }],
      })

      // 4. Parse + validera
      const text = stripMarkdownCodeBlock(response.content[0].text)
      const validated = mySchema.safeParse(JSON.parse(text))
      if (!validated.success) {
        return Result.fail({ type: "INTERPRETATION_FAILED", message: "Ogiltigt format" })
      }

      // 5. Post-validering (prompt injection-skydd)
      // ...

      return Result.ok(validated.data)
    } catch (error) {
      return Result.fail({ type: "INTERPRETATION_FAILED", message: `Fel: ${error.message}` })
    }
  }
}
```

**DI-motivering:** I tester kan du skicka in en falsk API-nyckel (eller inga deps alls) och mocka Anthropic SDK:t. I produktion laser konstruktorn fran env.

## Steg 4 -- Prompt injection-skydd

Om AI-outputen refererar till ett ID (bokning, kund, etc.), verifiera att IDt finns i den kontext du skickade:

```typescript
// Verifiera att LLM:en inte hittat pa ett booking-ID
if (result.bookingId && !todaysBookings.some(b => b.id === result.bookingId)) {
  result.bookingId = null  // Nollstall -- anvand inte ett hallucinerarat ID
}
```

**Regeln:** Lita aldrig pa att LLM:en returnerar korrekta IDn. Validera mot kand kontext.

## Steg 5 -- Error handling och Result-typ

Anvand `Result<T, E>` istallet for att kasta:

```typescript
type MyError = { type: "NO_DATA" | "API_KEY_MISSING" | "INTERPRETATION_FAILED"; message: string }

// I API-routen:
const result = await service.analyze(input)
if (!result.ok) {
  return NextResponse.json({ error: result.error.message }, { status: mapErrorToStatus(result.error) })
}
return NextResponse.json(result.value)
```

**Error mapping:**
- `NO_DATA` / `NO_TRANSCRIPT` -> 400 (klientens ansvar)
- `API_KEY_MISSING` -> 503 (systemfel, inte kundens fel)
- `INTERPRETATION_FAILED` -> 500 (AI misslyckades)

## Steg 6 -- Rate limiting i API-routen

AI-anrop ar dyra. Rate-limita generost men med ett tak:

```typescript
// I route.ts:
const allowed = await rateLimiters.api(ip)  // 100 req/min
if (!allowed) return NextResponse.json({ error: "For manga forfragninar" }, { status: 429 })
```

For AI-specifika endpoints kan du laga en strangare limiter (t.ex. 10 req/h per anvandare) for att skydda mot kostnadsexplosion.

## Steg 7 -- Factory och testning

```typescript
// Factory (production)
export function createMyAIService(): MyAIService {
  return new MyAIService()  // Laser API-nyckel fran env
}

// Test (mock)
const service = new MyAIService({ apiKey: "test-key" })
// + mocka Anthropic SDK
```

## Nar anvanda

- **Ny AI-feature** som tar strukturerad input och behover strukturerad output
- **Rostinspelning, insikter, sammanfattningar, klassificering** -- alla foljer samma mall
- **Nar LLM-output ska lagras eller visas i UI** -- validering ar obligatorisk

## Nar INTE anvanda

- **Enkel texttransformation** (t.ex. oversattning) -- regex eller enkel API racker
- **Real-time streaming** -- detta monster ar for batch/request-response
- **Nar exakt output kravs** -- LLM:er hallucinerar; om du behover 100% korrekthet, anvand deterministisk logik

## Kodreferenser

| Implementation | Fil | Modell |
|---------------|-----|--------|
| Rosttolkning (fullstandig bokning) | `src/domain/voice-log/VoiceInterpretationService.ts` | claude-sonnet-4-6 |
| Snabbanteckning (enkel not) | Samma fil, `interpretQuickNote()` | claude-haiku-4-5 |
| Kundinsikter | `src/domain/customer-insight/CustomerInsightService.ts` | claude-sonnet-4-6 |

### Gemensamma monster i bada implementationerna

1. **Zod med `.default()` + `.transform()`** pa alla falt
2. **`stripMarkdownCodeBlock()`** for att hantera LLM:er som lagger till ` ```json `
3. **`Result<T, E>`** istallet for exceptions
4. **Prompt injection-check** (verifiera IDn mot kontext-array)
5. **DI via konstruktor** (`{ apiKey?: string }`)
6. **Factory-funktion** for produktion
7. **Error mapping-funktion** (`mapXErrorToStatus`)
8. **Prompt caching** (`cache_control: { type: "ephemeral" }`)
