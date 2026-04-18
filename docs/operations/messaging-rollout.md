---
title: "Messaging Rollout"
description: "Rollout-plan och observationsguide för messaging-funktionen (S37)"
category: operations
status: active
last_updated: 2026-04-18
sections:
  - Bakgrund
  - Rollback-procedur
  - Observationsplan
  - Metrics-förslag
---

# Messaging Rollout

## Bakgrund

Messaging-funktionen (kund↔leverantör per bokning) levererades i S35 och gömdes bakom feature flag (`messaging: defaultEnabled: false`). S36 granskade implementationen och hittade 2 MAJOR-fynd. S37 åtgärdade dem och satte flaggan till `defaultEnabled: true`.

**Aktiverat:** 2026-04-18

## Rollback-procedur

Om problem uppstår: gå till admin-panelen → System → Feature flags → stäng av "Meddelanden".

Effekt: omedelbar (30s cache-TTL). Ingen databasmigrering behövs — meddelanden bevaras i databasen, bara UI och API-gating stängs.

Alternativt via miljövariabel: sätt `MESSAGING=false` i Vercel och deploya om.

## Observationsplan (dag 1-7 efter aktivering)

| Vad | Var | Frekvens |
|-----|-----|----------|
| `MessageNotifier`-fel | Sentry — sök `MessageNotifier` | Dagligen |
| Antal skickade meddelanden/dag | Server-loggar — sök `message.sent` | Dagligen |
| Support-rapporter om meddelandeproblem | Direkt till Johan | Vid behov |
| 500-fel på `/api/bookings/*/messages` | Sentry och Vercel Functions-loggar | Dagligen |

**Tröskel för rollback:** Mer än 3 unika `MessageNotifier`-fel per dag, eller om kunder rapporterar att de inte kan se/skicka meddelanden.

## Metrics-förslag (ej blockerande)

- Messaging-aktivering-rate: andel leverantörer med minst 1 skickat meddelande/vecka
- Genomsnittlig svarstid: tid från kund-meddelande till leverantörs-svar
- Konverteringsrate: bokningar med minst 1 meddelande vs utan

Implementera i dashboard om användning är hög efter 7 dagar.
