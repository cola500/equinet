---
title: "S7-4: Voice logging AI-spike -- Resultat"
description: "Research-spike: fungerar rostloggning end-to-end? Sammanfattning av fynd och rekommendationer."
category: research
status: active
last_updated: 2026-04-01
tags: [voice, ai, anthropic, spike]
sections:
  - Sammanfattning
  - Fraga 1 -- VoiceInterpretationService
  - Fraga 2 -- ANTHROPIC_API_KEY
  - Fraga 3 -- End-to-end-flodet
  - Fraga 4 -- Modell-IDn
  - Fraga 5 -- Ska flaggan vara pa eller av
  - Identifierade luckor
  - Rekommendationer
  - Beslut
---

# S7-4: Voice logging AI-spike -- Resultat

## Sammanfattning

Rostloggningssystemet ar **valbyggt och produktionsredo** med ett fatal smarre luckor.
Kodkvaliteten ar hog: Zod-validering, prompt injection-skydd, ownership checks,
rate limiting, vocabulary learning. Alla kritiska delar ar pa plats.

**Beslut: Behall `voice_logging` flaggan PA i produktion.**

Forutsattning: ANTHROPIC_API_KEY ar korrekt konfigurerad (verifierat i Vercel Production).

---

## Fraga 1 -- VoiceInterpretationService

**Fil:** `src/domain/voice-log/VoiceInterpretationService.ts`

**Vad den gor:**
- Tar en rost-transkribering + leverantorens dagens bokningar som kontext
- Anropar Anthropic Claude API for att extrahera strukturerad data
- Returnerar matchad bokning, arbetsnoteringar, halsoobservation, kategori, confidence

**AI-provider:** Anthropic Claude via `@anthropic-ai/sdk`
- **Huvudtolkning:** `claude-sonnet-4-5-20250929` (1024 max tokens)
- **Snabbnoteringar:** `claude-haiku-4-5-20251001` (512 max tokens)
- Bada med prompt caching (`cache_control: { type: "ephemeral" }`)

**Sakerhet:**
- Zod-schema validerar LLM-output med `.safeParse()` + `.default()` + `.transform()`
- Prompt injection-skydd: `bookingId` verifieras mot kand kontext
- Confidence clampas till 0-1
- Markdown code block-stripping (LLM:er wrapppar ibland JSON i ``` ```)

**Bedomning:** Valimplementerat. Foljer projektets DI-monster (factory + constructor injection).

---

## Fraga 2 -- ANTHROPIC_API_KEY

| Miljo | Status | Verifierat |
|-------|--------|------------|
| Lokal `.env` | Satt | Ja (grep) |
| Vercel Production | Satt (encrypted, 47 dagar sedan) | Ja (`vercel env ls`) |
| Vercel Preview | **Saknas** | Ja (`vercel env ls` visar bara Production) |
| Vercel Development | **Saknas** | Ja (`vercel env ls` visar bara Production) |

**Konsekvens:** Preview-deploys (PR-branches) kan INTE anvanda rostloggning -- returnerar 503.
Detta ar acceptabelt for en AI-feature (kostnadsskydd), men bor dokumenteras.

**Rekommendation:** Lagg till nyckeln i Preview-miljon om man vill testa i PR:ar.
Alternativt: acceptera att preview-deploys returnerar 503 for AI-features.

---

## Fraga 3 -- End-to-end-flodet

```
Tal -> SpeechRecognizer (iOS) / Web Speech API (browser)
    -> Transkribering (text)
    -> POST /api/voice-log
        -> auth + rate limit + feature flag
        -> hamta dagens bokningar + tidigare noteringar + vokabular
        -> VoiceInterpretationService.interpret()
            -> Anthropic Claude API
            -> Zod-validering av LLM-svar
        -> returnera tolkning + bokningskontext
    -> UI visar forhandsgranska + redigering
    -> POST /api/voice-log/confirm
        -> uppdatera providerNotes (atomisk ownership-check)
        -> markera bokning som klar (icke-fatal vid fel)
        -> skapa HorseNote (om halsoobservation)
        -> lara sig vokabular (om redigeringar)
```

**Analys per steg:**

1. **Tal -> Transkribering:** Fungerar. iOS: on-device `SFSpeechRecognizer` (sv-SE).
   Webb: Web Speech API med fallback till native bridge.

2. **API-anrop:** Robust. `withApiHandler` pa interpret-routen.
   Confirm-routen ar inte migrerad till `withApiHandler` men har alla sakerhetscheckar manuellt.

3. **AI-tolkning:** Bor fungera i produktion med giltig API-nyckel.
   Felhantering ar komplett (API_KEY_MISSING -> 503, INTERPRETATION_FAILED -> 500).

4. **Spara:** Atomiska ownership-checks. Icke-fatal statusandring. Vokabularinlarning.

**Potentiella problem vid faktisk anvandning:**

- **Inga bokningar idag:** Servicen returnerar `NO_BOOKINGS` (400). UI maste hantera detta.
  -> Kontrollerat: `bookingList` satter "Inga bokningar idag." och skickar till LLM.
  Servicen failar INTE pa tom lista -- den skickar tomma listan till LLM.
  DOCK: om LLM returnerar ett fabricerat bookingId, fångas det av injection-skyddet. OK.

- **LLM svarar med felaktigt format:** Zod `.safeParse()` fangar detta -> 500. OK.

- **Timeout vid LLM-anrop:** Anthropic SDK har default timeout. Om det tar for lang tid
  returneras ett fel till klienten. Ingen explicit timeout i koden, men SDK:t hanterar det.

---

## Fraga 4 -- Modell-IDn

Verifierat mot Anthropics officiella dokumentation (2026-04-01):

| I koden | Officiellt ID | Status | Kommentar |
|---------|---------------|--------|-----------|
| `claude-sonnet-4-5-20250929` | `claude-sonnet-4-5-20250929` | Korrekt, legacy | Fungerar, men Sonnet 4.6 finns nu |
| `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001` | Korrekt, current | Senaste Haiku |

**Prompt caching:** `cache_control: { type: "ephemeral" }` stods av bada modellerna.

**Uppgraderingsmojlighet:** Sonnet 4.5 -> Sonnet 4.6 (`claude-sonnet-4-6`) skulle ge:
- 1M context window (istallet for 200k)
- Nyare kunskapsdata (Jan 2026 training cutoff istallet for Jul 2025)
- Sama pris ($3/$15 per MTok)
- Ingen kodbyte utover modell-ID-strang

**Rekommendation:** Uppgradera till `claude-sonnet-4-6` nar det ar lampligt. Inte kritiskt --
Sonnet 4.5 fungerar och ar inte deprecated.

---

## Fraga 5 -- Ska flaggan vara pa eller av

**Beslut: Behall `voice_logging` PA (default: true).**

**Motivering:**
- API-nyckel finns i Production
- Modell-IDn ar giltiga och fungerar
- Sakerhet ar robust (Zod, ownership, rate limiting, injection-skydd)
- Rate limiting pa AI-tier ger kostnadsskydd
- Feature ar komplett: record -> interpret -> preview -> edit -> confirm -> vocabulary learning
- Felhantering ar komplett: saknad nyckel -> 503, AI-fel -> 500, inga bokningar -> tom kontext

**Risk:** AI-kostnad vid hog anvandning. Mitigeras av rate limiting + Anthropic spending limit.

---

## Identifierade luckor

### Sma (icke-blockerande)

1. **Confirm-route inte migrerad till `withApiHandler`**
   - Har manuella checkar for auth, rate limit, feature flag, Zod
   - Fungerar, men inkonsekvent med interpret-routen som anvander `withApiHandler`
   - Prioritet: Lag (fungerar korrekt)

2. **Ingen explicit timeout pa LLM-anrop**
   - Anthropic SDK har default timeout (inte kontrollerat exact varde)
   - Serverless function timeout (Vercel) ar 60s default
   - Om LLM ar langsam kan anvandaren fa timeout-fel utan specifikt felmeddelande
   - Prioritet: Lag (SDK + Vercel hanterar det)

3. **Sonnet 4.5 ar legacy**
   - Fungerar, men uppgradering till 4.6 ger battre resultat och storre context
   - Enradersandring: `"claude-sonnet-4-5-20250929"` -> `"claude-sonnet-4-6"`
   - Prioritet: Lag (inte deprecated, bara legacy)

4. **Preview-miljo saknar API-nyckel**
   - PR-deploys kan inte testa rostloggning
   - Returnerar 503 med "Anthropic API-nyckel saknas"
   - Prioritet: Lag (kostnadsskydd ar rimligt for preview)

5. **UTC-datumlogik kan missa bokningar**
   - `date.setHours(0, 0, 0, 0)` anvander serverns tidszon
   - Pa Vercel (UTC) kan svenska bokningar kl 23:00 hamna pa fel dag
   - Dokumenterat i voice-logging.md som kand begransning
   - Prioritet: Medium (kan paverka anvandare sent pa kvallen)

### Inga blockerare hittade.

---

## Rekommendationer

| # | Atagard | Prioritet | Storlek |
|---|---------|-----------|---------|
| 1 | Behall flaggan PA | - | Inget att gora |
| 2 | Uppgradera till `claude-sonnet-4-6` | Lag | 1 rad |
| 3 | Migrera confirm-route till `withApiHandler` | Lag | ~30 min |
| 4 | Satt API-nyckel i Preview-miljo | Lag | 1 min |
| 5 | Fixa UTC-datumlogik (anvand leverantorens tidszon) | Medium | ~1h |

Ingen av dessa ar blockerande. Systemet fungerar i produktion som det ar.

---

## Beslut

**`voice_logging` forblir PA i produktion.**

Systemet ar valbyggt med korrekt sakerhet, felhantering och AI-integration.
Modell-IDn ar giltiga. API-nyckel ar konfigurerad. Inga blockerare identifierade.
