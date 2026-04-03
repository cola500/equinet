---
title: "S9-4: Customer Insights AI-spike -- Resultat"
description: "Verifiering av customer_insights end-to-end med Anthropic Claude"
category: research
status: active
last_updated: 2026-04-03
sections:
  - Sammanfattning
  - Fynd
  - Kostnad
  - Kritiskt fynd -- trasigt modell-ID
  - Rekommendation
---

# S9-4: Customer Insights AI-spike

## Sammanfattning

Customer insights fungerar end-to-end. AI-genereringen producerar relevanta,
strukturerade insikter pa svenska. Modell-ID:t var forandrat och har uppgraderats.

**Beslut: Flagga PA (default: true) -- redo for produktion.**

## Fynd

### 1. API-nyckel

ANTHROPIC_API_KEY ar konfigurerad i `.env` (108 tecken, `sk-ant-api03-...`).
Fungerar mot Anthropic API.

### 2. Modell-ID

| Modell | Status |
|--------|--------|
| `claude-sonnet-4-5-20250929` (gammal, i customer insights) | Fungerar |
| `claude-sonnet-4-6-20250514` (i voice logging S8-3) | 404 -- TRASIGT |
| `claude-sonnet-4-6` (alias utan datum) | Fungerar |

**Atgard:** Bada tjanster uppdaterade till `claude-sonnet-4-6` (alias).
Aliases ar stabila och pekar automatiskt pa senaste version.

### 3. End-to-end-test (lokal)

Testat med realistisk kunddata (8 bokningar, 2 hastar, anteckningar):

- **Svarstid:** ~11.7s (forvantad for LLM-anrop)
- **Token-forbrukning:** 707 input + 394 output = ~1100 tokens
- **Svarskvalitet:** Bra. Korrekt VIP-score, relevanta monster, riskflaggor pa svenska
- **Zod-validering:** Skulle passera (ratt JSON-format, alla falt)
- **Cache:** Upstash Redis med 6h TTL -- nasta anrop ~5ms

### 4. Sakerhet

- Auth: OK (provider session + customer relationship check)
- Rate limiting: AI-specifik rate limiter (kostnadsskydd)
- IDOR: OK (customer maste tillhora provider)
- Loggning: Bara providerId + customerId + vipScore loggas (ingen kunddata)
- Systemprompten innehaller ingen kundspecifik data

### 5. Befintliga tester

- 11 unit-tester for insights-routen (alla grona)
- 14 unit-tester for CustomerInsightService (alla grona)
- 6 unit-tester for customer-insights-cache (alla grona)

## Kostnad

| Metrisk | Varde |
|---------|-------|
| Input tokens per anrop | ~700 |
| Output tokens per anrop | ~400 |
| Uppskattad kostnad per anrop | ~$0.005 |
| Cache-TTL | 6 timmar |
| On-demand (inte automatisk) | Ja, klick-baserad |

Med 100 leverantorer, 10 kunder var, 1 insikt per vecka:
~1000 anrop/vecka = ~$5/vecka. Mycket rimligt.

## Kritiskt fynd -- trasigt modell-ID

Voice logging (S8-3) anvande `claude-sonnet-4-6-20250514` som ger 404 fran
Anthropic API. Detta betyder att voice logging har varit trasig i produktion
sedan S8-3 mergades.

**Fixat i denna branch:** Bada tjanster uppdaterade till `claude-sonnet-4-6`.

## Rekommendation

1. **Flagga PA** -- customer_insights ar redo for produktion
2. **Modell-ID fix kritisk** -- voice logging ar trasig, samma fix behovs
3. **Anvand alias (`claude-sonnet-4-6`)** -- inte daterade ID:n som kan bli ogiltiga
4. **Overvakning** -- lagg till Vercel-alarm pa 500-svar fran insights-routen
