---
title: "S9-4: Customer Insights AI-spike"
description: "Verifiera att customer_insights fungerar end-to-end med Anthropic API"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Vad vi redan vet
  - Spike-steg
  - Leverans
---

# S9-4: Customer Insights AI-spike

## Bakgrund

`customer_insights` ar en feature-flaggad AI-funktion (default ON) som genererar
kundinsikter via Anthropic Claude. Spiken ska verifiera att den fungerar
end-to-end och besluta om flaggan ska vara pa eller av i produktion.

## Vad vi redan vet (fran kodlasning)

| Aspekt | Detalj |
|--------|--------|
| AI-provider | Anthropic (Claude) |
| Modell | `claude-sonnet-4-5-20250929` |
| Service | `src/domain/customer-insight/CustomerInsightService.ts` |
| API route | `POST /api/provider/customers/[customerId]/insights` |
| Cache | Upstash Redis, 6h TTL, SHA-256 nyckel |
| UI | `CustomerInsightCard.tsx` -- on-demand knapp "Visa insikter" |
| Feature flag | `customer_insights` (default: true, clientVisible: true) |
| Env-var | `ANTHROPIC_API_KEY` (konfigurerad i .env) |
| Rate limiter | AI-specifik limiter |
| Sakerhet | Auth + IDOR-check (customer tillhor provider) |

## Spike-steg

### 1. Verifiera modell-ID (5 min)

Modellen `claude-sonnet-4-5-20250929` -- verifiera att det ar ett giltigt ID
via Anthropic docs/API. Om forandrat: uppdatera.

### 2. Testa lokalt end-to-end (15 min)

1. Starta dev-servern (`npm run dev`)
2. Logga in som leverantor
3. Ga till kundregistret, valj en kund med bokningshistorik
4. Klicka "Visa insikter"
5. Verifiera: far vi ett svar? Visar UI:t ratt data?
6. Testa refresh-knappen
7. Testa med kund utan bokningar (edge case)

### 3. Verifiera kostnad och sakerhet (10 min)

- Kolla att rate limiter ar rimlig (inte for generosa)
- Verifiera att systemprompten inte lackar kunddata till loggarna
- Uppskatta kostnad per anrop (~$0.01 per call OK?)

### 4. Dokumentera och besluta (15 min)

Skriv research-dokument med:
- Fungerar det? Ja/nej + eventuella problem
- Kostnad per anrop
- Rekommendation: flagga pa eller av
- Eventuella forandringar som behovs

## Leverans

- `docs/research/customer-insights-spike.md`
- Eventuell kodfix om modell-ID ar forandrat
- Beslut: flagga pa/av
