---
title: "Feature Flag Portfolio Audit"
description: "Source of truth för feature flag-portföljen efter Edge Config-retirement och mekaniska GA-retirements. Listar pensionerade flaggor samt klassificering (Keep / Parked / Product decision) för varje kvarvarande flagga med motivering, rekommenderad åtgärd och omprövnings-trigger."
category: operations
status: active
last_updated: 2026-06-14
tags: [feature-flags, audit, portfolio, retirement, supabase, ai-kill-switch]
related:
  - .claude/rules/feature-flags.md
  - docs/operations/feature-flag-source-of-truth-debt.md
  - docs/operations/feature-flag-rollout-checklist.md
sections:
  - Bakgrund
  - Pensionerade flaggor (retired)
  - Klassificering av kvarvarande flaggor
  - Detaljerad motivering per flagga
  - AI-/integritets-kill-switchar (särskild not)
  - route_planning (parkerad)
---

# Feature Flag Portfolio Audit

> Source of truth för feature flag-portföljen. Genomförd 2026-06-14. Uppdatera denna
> fil när en flagga pensioneras, parkeras eller omklassificeras.

## Bakgrund

- **Edge Config retirement är klar.** Edge Config-lagret är borttaget ur aktiv resolution
  (kod raderad, prod-store-nyckel borttagen, prod-env-variabler borttagna).
- **Supabase DB är enda source of truth** (beslut B, 2026-06-13). Prioritetsordning:
  env `FEATURE_X` > Supabase `FeatureFlag` DB > kod-default (`defaultEnabled`). Prod och
  staging är separata Supabase-projekt → separata flaggvärden. DB läses med 30 s cache.
  Se [feature-flag-source-of-truth-debt.md](../operations/feature-flag-source-of-truth-debt.md).
- **Mekaniska GA-retirements är genomförda.** De flaggor som var rena "alltid på, GA"
  har pensionerats (se nedan). Kvarvarande flaggor är alla **behåll eller produktbeslut** —
  ingen är längre en ren pensioneringskandidat.

## Pensionerade flaggor (retired)

Dessa flaggor är borttagna som feature flags. Funktionen lever kvar (GA, alltid på) eller
har ersatts av annat styrmedel (env / provider-setting).

| Flagga | Hur pensionerad | Not |
|--------|-----------------|-----|
| `supabase_auth_poc` | Borttagen | PoC-flagga, ej längre relevant |
| `messaging` | Borttagen (GA) | Meddelanden alltid på |
| `demo_mode` | → env | Styrs nu enbart av `NEXT_PUBLIC_DEMO_MODE`, ingen DB-rad |
| `help_center` | Borttagen (GA) | Hjälpcenter alltid på |
| `self_reschedule` | → provider-setting | Flyttad från flagga till leverantörsinställning |
| `follow_provider` | Borttagen (GA), #413 | Kund-feature, alltid på |
| `municipality_watch` | Borttagen (GA), #413 | Kommunbevakning, alltid på |
| `route_announcements` | Borttagen (GA), #414 | Rutt-annonser alltid på. **OBS:** funktionen läser fortfarande `route_planning`-gated API:er — se [route_planning](#route_planning-parkerad) |

Alla tre i sista batchen (`follow_provider`, `municipality_watch`, `route_announcements`)
deployades till prod via #415 och är verifierade.

## Klassificering av kvarvarande flaggor

| Flagga | Klassificering | Kort motiv |
|--------|----------------|-----------|
| `route_planning` | **Parked** | Produktkoncept ej verifierat; 0 RouteOrders senaste 90 dagar |
| `customer_insights` | **Keep** | AI-kostnads-/säkerhets-kill-switch (liten yta) |
| `voice_logging` | **Keep** | AI-/integritets-/kostnads-kill-switch (röstdata → extern AI) |
| `offline_mode` | **Keep** | Äkta toggle — komplex PWA/offline-kedja |
| `stripe_payments` | **Keep** | Äkta toggle — betalning av i prod |
| `provider_subscription` | **Product decision** | Ej lanserad — kräver affärsbeslut |
| `stable_profiles` | **Product decision** | In-progress — kräver produktbeslut |
| `push_notifications` | **Keep / internal ops** | Intern drift-toggle (APNs) |
| `data_retention` | **Keep / internal compliance/ops** | GDPR-radering, drift-/compliance-toggle |

**Klassificeringsbegrepp:**

- **Keep** — flaggan har ett äkta operativt/legalt/tekniskt syfte (av/på-spärr). Pensionera inte.
- **Parked** — funktionen är inte verifierad. Ta varken bort eller pensionera flaggan nu;
  vänta på produktsignal innan vi investerar mer.
- **Product decision** — funktionen är inte färdiglanserad. Beslut om lansering/borttagning
  ligger hos product owner, inte i teknisk audit.

## Detaljerad motivering per flagga

### `route_planning` — Parked
- **Motivering:** Produktkonceptet (rutt-order/annons-marknadsplats) är inte verifierat.
  Prod-data visar **0 nya RouteOrders senaste 90 dagar** (179 historiska, sannolikt seed/tidig
  test). Dagens bokningar i kartvy (`/provider/today`) verkar lösa ett tydligare behov.
- **Rekommenderad åtgärd:** Behåll flaggan som-den-är (default `true`). Pensionera den INTE
  (det skulle cementera en vilande feature) och ta INTE bort funktionen ännu (`route_announcements`
  beror på dess API:er).
- **Omprövnings-trigger:** Riktig användarsignal för rutt-marknadsplatsen (nya RouteOrders från
  verkliga kunder), ELLER beslut att ta bort hela rutt-order-funktionen (då krävs separat
  removal-discovery som även omfattar `route_announcements`).

### `customer_insights` — Keep
- **Motivering:** AI-genererade kundinsikter (Anthropic, `claude-sonnet-4-6`) — kostar per anrop.
  Liten yta (1 server-route, 1 inbäddat kort i kundregistret). Flaggan är en operativ av/på-spärr
  för en AI-funktion.
- **Rekommenderad åtgärd:** Behåll flaggan. Ingen retirement.
- **Omprövnings-trigger:** Beslut att helt avveckla AI-insikter, eller väsentligt ändrad
  kostnads-/leverantörsbild för Anthropic.

### `voice_logging` — Keep
- **Motivering:** Röstbaserad arbetsloggning med AI-tolkning. Störst yta av AI-flaggorna:
  2 server-routes (`rateLimit: "ai"`), webb-sida + nav, **iOS native taligenkänning**
  (SpeechRecognizer/QuickNoteSheet/BridgeHandler). Röstinspelningar + transkript kan skickas
  till extern AI-processor (Anthropic) → integritets-/GDPR-relevant.
- **Rekommenderad åtgärd:** Behåll flaggan. Ingen retirement. Starkaste behåll-kandidaten i
  hela portföljen.
- **Omprövnings-trigger:** Ändrad dataskydds-/personuppgiftsbedömning, byte av AI-processor,
  eller beslut att avveckla röstloggning.

### `offline_mode` — Keep
- **Motivering:** Styr hela PWA-/offline-kedjan (Service Worker, IndexedDB, mutation queue,
  sync-engine). Komplex, riskfylld yta som vi vill kunna stänga av snabbt.
- **Rekommenderad åtgärd:** Behåll som äkta toggle.
- **Omprövnings-trigger:** Offline-läget bedöms stabilt och permanent (GA), då kan retirement
  övervägas — men först efter bevisad stabilitet i prod.

### `stripe_payments` — Keep
- **Motivering:** Betalning via Stripe i bokningsflödet. Default `false` i prod (betalning av).
  Äkta toggle för att slå på/av betalflödet.
- **Rekommenderad åtgärd:** Behåll som äkta toggle.
- **Omprövnings-trigger:** Beslut att lansera betalningar permanent.

### `provider_subscription` — Product decision
- **Motivering:** Stripe-baserad prenumerationsavgift för leverantörer. Default `false` —
  ej lanserad. Klassisk affärsmodell-fråga.
- **Rekommenderad åtgärd:** Inget tekniskt beslut. Product owner avgör om/när det lanseras.
- **Omprövnings-trigger:** Affärsbeslut om monetisering.

### `stable_profiles` — Product decision
- **Motivering:** Stallprofiler (stallägare publicerar stallplatser, bjuder in hästägare).
  Default `false` — funktionen är in-progress. Stor yta (många routes + UI).
- **Rekommenderad åtgärd:** Inget tekniskt beslut. Product owner avgör lansering.
- **Omprövnings-trigger:** Beslut att lansera eller avbryta stallprofiler.

### `push_notifications` — Keep / internal ops
- **Motivering:** APNs-push till iOS-appen. `clientVisible: false` (intern). Default `false`.
  Drift-toggle.
- **Rekommenderad åtgärd:** Behåll som intern drift-toggle.
- **Omprövnings-trigger:** Push GA i alla miljöer.

### `data_retention` — Keep / internal compliance/ops
- **Motivering:** Automatisk GDPR-radering av inaktiva konton (2 år + 30 dagars varning).
  `clientVisible: false` (intern). Default `false`. Compliance-/drift-toggle med stor
  konsekvens (raderar data) — vill kunna styra exakt.
- **Rekommenderad åtgärd:** Behåll som intern compliance-toggle.
- **Omprövnings-trigger:** GDPR-rutinen bedöms permanent och säker att alltid ha på.

## AI-/integritets-kill-switchar (särskild not)

Två flaggor behålls uttryckligen som **kill-switchar för AI-funktioner**, inte som teknisk skuld:

- **`customer_insights`** behålls som **AI-kostnads-/säkerhets-kill-switch.** Funktionen anropar
  Anthropic per kundinsikt; flaggan ger möjlighet att omedelbart stänga av om kostnaden spikar
  eller modellen missköter sig.
- **`voice_logging`** behålls som **AI-/integritets-/kostnads-kill-switch**, särskilt eftersom
  **röst/transkript kan gå till en extern AI-processor** (Anthropic). Flaggan är en av/på-spärr
  med både kostnads- och dataskyddsvärde och täcker hela kedjan (webb + iOS native taligenkänning).

## route_planning (parkerad)

`route_planning` **parkeras** eftersom produktkonceptet (rutt-order/annons-marknadsplats) inte
är verifierat, och **dagens bokningar i kartvy** (`/provider/today`, "Dagens rutt") verkar lösa
ett tydligare behov (exekvering av redan bekräftade bokningar) än manuell ruttplanering
(demand-generation). De två är olika jobb och delar bara kart-visualiseringen
(`RouteMapVisualization`).

**Viktig koppling:** `route_planning` + det redan flagg-pensionerade `route_announcements` är
**samma feature** — kundsidan `/announcements` hämtar det `route_planning`-gated API:et
`/api/route-orders/announcements`. En framtida borttagning måste därför hantera båda tillsammans.
Funktionen använder Leaflet (inte Mapbox — en tidigare backlog-rad var felaktig på den punkten).
