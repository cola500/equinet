---
title: "S9-4 Done: Customer Insights AI-spike"
description: "Spike-resultat och modell-ID-fix"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S9-4 Done: Customer Insights AI-spike

## Acceptanskriterier

- [x] Las CustomerInsightService -- Anthropic Claude, modell `claude-sonnet-4-6`
- [x] API-nyckel konfigurerad -- ja, `ANTHROPIC_API_KEY` i `.env`
- [x] Fungerar end-to-end -- testat med realistisk data, ~11.7s svarstid, bra kvalitet
- [x] Beslut: flagga PA (default: true)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (auth, rate limit, IDOR, Zod-validering)
- [x] Tester skrivna och grona (31 befintliga tester for insights-domanen)
- [x] Research-dokument: `docs/research/customer-insights-spike.md`

## Avvikelser

### Bonus: Modell-ID-fix (bade customer insights + voice logging)

- Customer insights: `claude-sonnet-4-5-20250929` -> `claude-sonnet-4-6`
- Voice logging: `claude-sonnet-4-6-20250514` -> `claude-sonnet-4-6`

Voice logging-modellen (`claude-sonnet-4-6-20250514`) gav 404 fran Anthropic API.
Detta innebar att voice logging var trasig i produktion sedan S8-3.

### Inget end-to-end via UI

Spike testade API:t direkt (inte via inloggad session i webblasare).
AI-svaret validerades manuellt mot Zod-schemat -- korrekt format.

## Lardomar

1. **Daterade modell-ID:n kan bli ogiltiga.** Anthropic publicerar alias som
   `claude-sonnet-4-6` -- anvand dessa istallet for `claude-sonnet-4-6-20250514`.
   Alias pekar alltid pa senaste version.

2. **Verifiera AI-anrop med riktiga API-anrop.** Unit-tester mockar LLM:en --
   de fanger inte ogiltiga modell-ID:n. Spike med riktig nyckel behovs.

3. **Tva AI-tjanster med olika modell-ID:n = risk.** Nar vi uppgraderade voice
   logging i S8-3 borde customer insights ha uppgraderats samtidigt.
   Framtida approach: sok efter alla `model:` i codebasen vid modellbyte.
