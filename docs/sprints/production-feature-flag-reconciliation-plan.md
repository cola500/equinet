---
title: Production Feature Flag Reconciliation-plan (Workstream B)
description: Körbar plan för att reconcilera prod feature flags mot staging-paritet (demo_mode AV, stable_profiles AV, GA-flaggor PÅ, stripe_payments hanterat). Planering — ingen flagg-ändring förrän PO-godkännande.
category: sprint
status: draft
last_updated: 2026-06-10
tags: [production, feature-flags, parity, reconciliation]
depends_on:
  - docs/sprints/production-relaunch-plan.md
related:
  - docs/sprints/production-migration-apply-plan.md
  - src/lib/feature-flag-definitions.ts
sections:
  - Scope och status
  - 1. Nuläge (prod / staging / default)
  - 2. Avsedd prod-config (parity)
  - 3. Exakt vilka flaggor ändras
  - 4. Särskilda flaggor
  - 5. Föräldralösa rader
  - 6. Sekvensering och cache
  - 7. Verifiering före/efter
  - 8. Riskregister
  - 9. Go/No-Go — Workstream B
---

# Production Feature Flag Reconciliation-plan (Workstream B)

> Detaljering av **Workstream B** i [Production Parity-planen](production-relaunch-plan.md).
> **PLAN — ingen flagg-ändring i prod, ingen deploy, ingen seed** förrän §9 Go/No-Go är grön
> och Johan ger explicit klartecken. Workstream A (migrationer) är klar; B förutsätter den.

## Scope och status

Mål: prod **feature-flag-paritet** med staging = prod effektiva flaggor matchar stagings,
med **medvetna undantag** för demo_mode (AV i prod) och stripe_payments (AV — Stripe Live är
Post-Parity). Data lästa 2026-06-10 (prod + staging `FeatureFlag`-DB + stagings `/api/feature-flags`).

> **Prioritetsmodell:** effektivt värde = **env `FEATURE_*` > DB-override > kod-default**.
> Workstream B ändrar **DB-overriden**. Om en flagga är **env-tvingad** på prod räcker inte
> en DB-ändring — se §4 demo_mode och §6.

## 1. Nuläge (prod / staging / default)

Källor: prod `FeatureFlag`-DB (18 rader), staging `FeatureFlag`-DB (12 rader), stagings
**effektiva** config (`/api/feature-flags`), kod-default (`feature-flag-definitions.ts`, 17 flaggor).
Prod effektiva config kunde **inte** läsas (prod bakom Vercel Security Checkpoint, HTTP 429) —
prod DB används som arbetsvärde, env måste verifieras separat (§7).

| Flagga | Prod DB | Staging effektiv | Kod-default | Kommentar |
|--------|---------|------------------|-------------|-----------|
| voice_logging | **false** | true | true | GA — av i prod |
| route_planning | **false** | true | true | GA — av i prod |
| route_announcements | **false** | true | true | GA — av i prod |
| customer_insights | **false** | true | true | av i prod |
| self_reschedule | **false** | true | true | av i prod |
| offline_mode | true | true | true | paritet ✓ |
| follow_provider | false | false | true | medvetet av i båda ✓ |
| municipality_watch | false | false | true | medvetet av i båda ✓ |
| provider_subscription | false | false | false | paritet ✓ |
| help_center | true | true | true | paritet ✓ |
| stable_profiles | **true** | false | false | prod PÅ — ska AV |
| stripe_payments | **true** | true | false | särfall, se §4 |
| demo_mode | **true** | true | false | prod ska AV (undantag), se §4 |
| messaging | (ingen rad) | true | true | default-on; kräver migration 4–6 (klar) ✓ |
| push_notifications | (ingen rad) | (server) | false | paritet via default ✓ |

## 2. Avsedd prod-config (parity)

**Regel:** prod effektiv = stagings effektiva config, med **två medvetna undantag**:
1. `demo_mode` = **AV** i prod (staging är demo-miljön).
2. `stripe_payments` = **AV** i prod (Stripe Live är Post-Parity; ingen betalningsyta i prod
   förrän Workstream D är klar).

| Flagga | Avsedd prod |
|--------|-------------|
| voice_logging | **true** |
| route_planning | **true** |
| route_announcements | **true** |
| customer_insights | **true** |
| self_reschedule | **true** |
| offline_mode | true |
| follow_provider | false |
| municipality_watch | false |
| provider_subscription | false |
| help_center | true |
| stable_profiles | **false** |
| stripe_payments | **false** (undantag) |
| demo_mode | **false** (undantag) |
| messaging | true (via default) |

## 3. Exakt vilka flaggor ändras

**8 ändringar** i prod `FeatureFlag`-DB (allt annat är redan i paritet):

| # | Flagga | Från | Till | Skäl |
|---|--------|------|------|------|
| 1 | voice_logging | false | **true** | GA-paritet med staging |
| 2 | route_planning | false | **true** | GA-paritet |
| 3 | route_announcements | false | **true** | GA-paritet |
| 4 | customer_insights | false | **true** | paritet |
| 5 | self_reschedule | false | **true** | paritet |
| 6 | stable_profiles | true | **false** | matcha staging (AV) |
| 7 | demo_mode | true | **false** | undantag — AV i prod (+ env-check, §4) |
| 8 | stripe_payments | true | **false** | undantag — Stripe Live Post-Parity |

**Körbara UPDATE (EXEKVERAS EJ NU — först efter Go):**
```sql
UPDATE "FeatureFlag" SET enabled = true
  WHERE key IN ('voice_logging','route_planning','route_announcements','customer_insights','self_reschedule');
UPDATE "FeatureFlag" SET enabled = false
  WHERE key IN ('stable_profiles','demo_mode','stripe_payments');
```
Alternativ metod: admin-panelens flagg-toggle (skriver DB **och** invaliderar server-cachen direkt).
Direkt SQL kräver att man inväntar cache-TTL (§6).

## 4. Särskilda flaggor

### demo_mode → AV (undantag, kräver MER än DB-flaggan)
`demo_mode` har specialhantering: koden läser även `NEXT_PUBLIC_DEMO_MODE` (env), och den
variabeln **bakas in i klient-bundeln vid build**. Full AV i prod kräver därför **tre** saker:
1. DB-flagga `demo_mode = false` (denna workstream)
2. `NEXT_PUBLIC_DEMO_MODE` **inte** `true` i prod-env (Workstream C)
3. Rebuild/redeploy så env bakas ut ur klient-bundeln (Workstream E)

→ **demo_mode-paritet spänner över B + C + E.** DB-ändringen här är nödvändig men inte
tillräcklig ensam. Verifiera prod-env i §7.

### stable_profiles → AV
Matchar staging (AV). Prod står på `true` idag (stale). Ren DB-ändring, ingen kod/env-koppling.

### stripe_payments → AV (undantag)
Stagings effektiva = `true` men i **test-mode** (demo-bart betalningsflöde). Prod är **inte**
demo-miljö (demo_mode av) och Stripe **Live är Post-Parity** (Fas 0). En betalningsyta i prod
som inte kan slutföra (inga live-keys) vore trasig UX, och med ev. stale/live-keys en
**säkerhetsrisk**. Därför: **stripe_payments AV i prod** tills Workstream D (Stripe Live) körs.
Detta är en medveten paritets-divergens, dokumenterad. (Prod står på `true` idag → ändras till
`false`, vilket även är en säkerhetsförbättring.)

### GA-flaggor → PÅ
voice_logging, route_planning, route_announcements, customer_insights, self_reschedule är GA
sedan april och finns i nuvarande prod-kod (före 160-commit-gapet) → säkra att slå på redan nu.

## 5. Föräldralösa rader (ej blocker)

Borttagna ur kod (GA 2026-04-25), rader kvar i prod-DB och ignoreras av koden:
`customer_invite`, `business_insights`, `due_for_service`, `group_bookings`, `recurring_bookings`.
Påverkar inte paritet. **Kan** städas (`DELETE FROM "FeatureFlag" WHERE key IN (...)`) men är
ej blocker — gör det separat vid tillfälle, inte i denna workstream.

## 6. Sekvensering och cache

- **Ordning:** B körs efter A (klar), före E (deploy), per huvudplanen.
- **Säkert på nuvarande prod-kod:** GA-flaggorna finns i prod-koden idag; demo_mode-av och
  stripe_payments-av är rena säkerhetsförbättringar oavsett kodversion.
- **Cache:** `getFeatureFlags()` cachar 30s server-side; `FeatureFlagProvider` pollar 60s
  client-side. Direkt SQL-UPDATE → ändring syns inom ~30–90s. Admin-API-toggle invaliderar
  server-cachen direkt. demo_mode-klientbeteende ändras dock först vid **rebuild** (§4).

## 7. Verifiering före/efter

**Före (read-only):**
- [ ] Läs prod `FeatureFlag`-DB (bekräfta de 8 utgångsvärdena i §3 oförändrade)
- [ ] **Verifiera prod-env `NEXT_PUBLIC_DEMO_MODE`** (Vercel) — är den `true`? (avgör om demo_mode kräver env-ändring i C)
- [ ] Bekräfta stagings effektiva config som målbild (`/api/feature-flags`)

**Efter (read-only):**
- [ ] Prod `FeatureFlag`-DB: de 8 ändringarna applicerade (5 → true, 3 → false)
- [ ] Prod `/api/feature-flags` (när nåbar): effektiv config matchar §2-målet
      — undantag: demo_mode kan visa `true` tills env C + deploy E är klara
- [ ] Inga oavsiktliga ändringar på övriga flaggor (diff mot §1)
- [ ] Stagings config oförändrad (rör ej staging)

## 8. Riskregister

| Risk | Sannolikhet | Konsekvens | Mitigering |
|------|-------------|------------|------------|
| demo_mode förblir på pga env `NEXT_PUBLIC_DEMO_MODE` | **Hög** (sannolikt env-satt) | Demo-UX i prod | DB-flagga av + verifiera/åtgärda env i C + rebuild i E (§4) |
| GA-flagga på men prod-kod saknar feature | Låg | Bruten vy | GA sedan april, finns i prod-kod; verifiera i smoke (F) |
| stripe_payments på exponerar betalningsyta | Eliminerad | — | Sätts till AV i denna workstream |
| Direkt SQL hinner inte invalidera cache | Låg | Kort fördröjning (~30–90s) | Vänta TTL eller toggla via admin-API |
| Råkar ändra fel flagga / staging | Låg | Felkonfig | Exakta `WHERE key IN (...)`; rör aldrig staging-projektet |
| Föräldralösa rader förvirrar | Låg | Låg | Lämnas; städas separat (§5) |

## 9. Go/No-Go — Workstream B

Får STARTA endast när:
- [ ] §2 avsedd prod-config godkänd av PO (inkl. stripe_payments AV-beslut)
- [ ] Före-verifiering körd (§7) — prod DB-utgångsläge + prod `NEXT_PUBLIC_DEMO_MODE`-status känd
- [ ] Metod vald (direkt SQL via MCP, eller admin-API-toggle)
- [ ] Johan ger explicit klartecken

Räknas KLAR när:
- [ ] 8 flaggor ändrade i prod DB (verifierat)
- [ ] Diff mot §1 visar inga oavsiktliga ändringar
- [ ] Effektiv config matchar §2 (med demo_mode-undantaget noterat tills C+E klara)
- [ ] Staging oförändrad

> **Efter Workstream B:** prod-flaggor i paritet (utom demo_mode-env som slutförs i C+E).
> Nästa: Workstream C (env: `NEXT_PUBLIC_DEMO_MODE` + saknade vars) → E (deploy) → F (smoke).
> Ingen flagg-ändring, env-ändring eller deploy förrän respektive Go/No-Go är grön.
