---
title: "S7-4: Voice logging AI-spike -- Plan"
description: "Research-spike: fungerar voice logging end-to-end? Vad saknas?"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Bakgrund
  - Forskningsfragor
  - Approach
  - Leverans
---

# S7-4: Voice logging AI-spike -- Plan

## Bakgrund

Voice logging (rostloggning) ar en feature som lat leverantorer diktera arbetsnoteringar
via tal istallet for att skriva. Systemet bestar av:

- **iOS SpeechRecognizer** (on-device, sv-SE) + Web Speech API (browser)
- **VoiceInterpretationService** (Anthropic Claude Sonnet/Haiku)
- **2 API routes**: `/api/voice-log` (tolka) + `/api/voice-log/confirm` (spara)
- **Feature flag**: `voice_logging` (default: true)

Alla tester mockar AI-anropet. Spike ska avgora om systemet fungerar pa riktigt.

## Forskningsfragor

1. **Fungerar VoiceInterpretationService med riktigt Anthropic-anrop?**
   - Modell: `claude-sonnet-4-5-20250929` -- korrekt modell-ID?
   - Prompt caching: `cache_control: { type: "ephemeral" }` -- stods?
   - Svar-format: tolkar Zod-schema korrekt?

2. **Ar ANTHROPIC_API_KEY konfigurerad?**
   - Lokal `.env`: JA (finns)
   - Vercel Production: JA (satt for 47d sedan)
   - Vercel Preview/Development: OKANT -- behover verifieras

3. **Fungerar det end-to-end?**
   - Tal -> transkribering -> API -> AI-tolkning -> strukturerad data -> spara
   - Vad hander vid tomt svar fran AI?
   - Vad hander utan bokningar (tom dag)?

4. **Vilka modell-IDn anvands?**
   - Sonnet: `claude-sonnet-4-5-20250929` -- stammer detta med aktuellt API?
   - Haiku: `claude-haiku-4-5-20251001` -- stammer detta?

5. **Ska flaggan vara pa eller av i produktion?**
   - Om allt fungerar: pa
   - Om nyckel saknas eller modell-ID ar fel: av tills fixat

## Approach

Research-only spike. Ingen kodandring.

1. **Granska VoiceInterpretationService.ts** -- modell-ID, prompt, felhantering
2. **Granska API routes** -- flodet, edge cases, error responses
3. **Verifiera modell-IDn** -- stammer de med Anthropics aktuella API?
4. **Verifiera env-konfiguration** -- alla miljoer
5. **Identifiera luckor** -- vad saknas for produktion?
6. **Dokumentera** -- `docs/research/voice-logging-spike.md`

## Leverans

- `docs/research/voice-logging-spike.md` -- fullstandig rapport
- Beslut: flaggan pa eller av
- Lista over eventuella fixar (utan att implementera dem)
