---
title: "GitHub Wiki -- strukturförslag"
description: "Föreslagen sidstruktur för Equinets GitHub Wiki, källmappning per sida och gap-analys. Wikin är en navigerbar portal -- repo-docs förblir source of truth."
category: plan
status: draft
last_updated: 2026-06-11
tags: [wiki, documentation, onboarding]
related:
  - docs/INDEX.md
sections:
  - Princip
  - Föreslagen wiki-struktur
  - Källmappning per sida
  - Saknade eller föråldrade dokument
  - Publiceringsregler
  - Nästa steg
---

# GitHub Wiki -- strukturförslag

> **Status:** Förslag. Inget publiceras till GitHub Wiki utan PO-Go.
> Drafts för de tre första sidorna finns i denna katalog.

## Princip

Wikin är en **portal**, inte en parallell sanning:

- Varje wiki-sida är kortare än källdokumenten och länkar alltid tillbaka till repo-docs.
- Detaljer (exakta env-värden, fullständiga runbooks, API-kontrakt) bor kvar i `docs/`.
- Wiki-sidor svarar på "var hittar jag X och vad är 30-sekundersversionen?" -- inte "allt om X".
- Vid konflikt mellan wiki och repo-doc gäller repo-doc. Wiki-sidan fixas.

## Föreslagen wiki-struktur

14 sidor, grupperade i sidebar-ordning:

```
Home                                  ← portal + "jag vill..."-tabell
├── Getting Started
│   ├── Developer-Onboarding          ← setup på 15 min
│   └── App-Overview                  ← vad Equinet är, personas, features
├── System
│   ├── Architecture-Overview         ← DDD-Light, lager, patterns
│   ├── Database-and-Migrations       ← Prisma, pooler, migrate-workflow
│   ├── Feature-Flags                 ← prioritetsordning, gating-mönster
│   └── API-Conventions               ← gemensamma route-mönster, säkerhet
├── Domains
│   ├── Payments                      ← Stripe, webhooks, test- vs live-mode
│   ├── Routes-and-Provider-Workday   ← ruttplanering, Dagens rutt (discovery)
│   └── Stable-and-Horse-Domain       ← stall/häst-API:er, stable_profiles-flagga
├── Delivery
│   ├── Environments-and-Deployments  ← lokal/staging/prod, deploy-ordning
│   ├── Demo-Data-and-Seed            ← demo-personas, seed-scripts, demo-läge
│   └── CI-Testing-and-Quality-Gates  ← check:all, E2E-spår, hooks, CI-jobb
└── Support
    ├── Operations-Runbooks           ← env-ändringar, incidenter, monitoring, backup
    └── Troubleshooting               ← gotchas-topplista + var man felsöker
```

Medvetet utelämnat ur wikin (för internt/processuellt eller för rörligt):
sprintar/status, retrospectives (länkas från Home), ideas/epics, user-research,
product-audit, `.claude/`-processregler (länkas från Onboarding som "AI-arbetsflöde").

## Källmappning per sida

| Wiki-sida | Primära källor (source of truth) | Sekundära källor |
|-----------|----------------------------------|------------------|
| **Home** | `docs/INDEX.md`, `README.md` | `docs/roadmap.md` |
| **Developer-Onboarding** | `docs/guides/onboarding.md`, `README.md`, `.env.example` | `CLAUDE.md`, `docs/guides/gotchas.md` |
| **App-Overview** | `docs/the-equinet-story.md`, `README.md` | `docs/roadmap.md`, `docs/product-audit/feature-inventory.md` |
| **Architecture-Overview** | `docs/architecture/ddd-light-pattern.md`, `docs/architecture/patterns.md` | `docs/architecture/booking-flow.md`, `docs/architecture/refactor-triggers.md`, `docs/architecture/offline-pwa.md` |
| **Database-and-Migrations** | `docs/architecture/database.md`, `.claude/rules/prisma.md` | `docs/operations/environment-runbook.md`, `docs/guides/gotchas.md` (#24-25) |
| **Feature-Flags** | `docs/feature-flags-review.md`, `.claude/rules/feature-flags.md` | `docs/operations/feature-flag-rollout-checklist.md` |
| **API-Conventions** | `docs/API.md`, `.claude/rules/api-routes.md` | `docs/api/*.md` (17 endpoint-docs) |
| **Payments** | `docs/payment-domain-review.md`, `docs/architecture/stripe-webhook-architecture.md` | `docs/operations/provider-e2e-payment-runbook-2026-06.md`, `docs/architecture/payment-production-readiness.md` |
| **Routes-and-Provider-Workday** | `docs/architecture/provider-workday.md` | `docs/discovery/route-planning-audit-2026-06.md`, `docs/api/routes.md` |
| **Stable-and-Horse-Domain** | `docs/api/stables.md`, `docs/api/horses.md`, `docs/api/horse-intervals.md` | `docs/ideas/epic-stall.md` |
| **Environments-and-Deployments** | `docs/operations/environments.md`, `docs/operations/deployment.md`, `docs/operations/staging-environment-setup.md` | `docs/operations/deployment-verification-guide.md`, `docs/operations/url-configuration.md` |
| **Demo-Data-and-Seed** | `docs/demo-seed.md`, `docs/demo-mode.md` | `docs/operations/staging-demo-seed.md`, `docs/operations/demo-setup.md` |
| **CI-Testing-and-Quality-Gates** | `docs/ci-decisions.md`, `.claude/rules/testing.md`, `.claude/rules/e2e-playbook.md` | `docs/e2e-suite-review.md`, `docs/testing/manual-testing.md` |
| **Operations-Runbooks** | `docs/operations/environment-runbook.md`, `docs/operations/incident-runbook.md` | `docs/operations/monitoring.md`, `docs/operations/backup-policy.md`, `docs/operations/admin-recovery.md` |
| **Troubleshooting** | `docs/guides/gotchas.md` | `docs/operations/incident-runbook.md`, `CLAUDE.md` (Key Learnings) |

## Saknade eller föråldrade dokument

Identifierat under inventeringen (2026-06-11):

### Föråldrade

| Dokument | Problem | Status |
|----------|---------|--------|
| `docs/guides/onboarding.md` | Beskrev Docker Compose + `postgres:17-alpine` på port 5432 och `NEXTAUTH_SECRET` -- projektet kör Supabase CLI (port 54322) och Supabase Auth. | **Åtgärdad 2026-06-11** -- omskriven mot verkligt nuläge. |
| `docs/architecture/arkitektgenomlysning.md` | 2025-11-15. Listade "kritiska problem" som alla var fixade -- förvirrande för ny läsare. | **Åtgärdad 2026-06-11** -- arkiverad till `docs/archive/arkitektgenomlysning-2025-11.md` med historisk not. |
| `docs/operations/environments.md` | Aktiv och bra, men har en markerad drift-notis (staging serveras av separat Vercel-projekt) som "bör reconcilieras". | Kvarstår -- reconciliera översiktstabellen vid tillfälle. |

### Saknas

| Ämne | Behov | Prioritet |
|------|-------|-----------|
| Provider workday-/route-domänarkitektur | ~~Bara discovery-docs finns.~~ **Åtgärdad 2026-06-11** -- `docs/architecture/provider-workday.md` skapad. | Klar |
| Prod-cutover-runbook | Staging-setup är utförlig men ingen guide för domän-cutover av prod. | Medel |
| Prisma migration-workflow som egen guide | Spritt över gotchas, rules och environments.md. Wiki-sidan Database-and-Migrations kan tills vidare aggregera länkarna. | Låg |
| iOS-utvecklarguide | `ios-learnings.md` (rules) finns men ingen publik guide. Utanför wiki-scope v1. | Låg |

## Publiceringsregler

När PO-Go ges:

1. Wiki-sidnamn = filnamn utan `.md` (GitHub Wiki-konvention, bindestreck blir mellanslag i titeln).
2. **Strippa YAML-frontmattern** vid publicering -- GitHub Wiki renderar den som tabell. Frontmattern finns i draftsen för att uppfylla repo-standarden (`.claude/rules/documentation.md`).
3. Länkar mellan wiki-sidor: `[[Sidnamn]]`. Länkar till repo-docs: absolut URL `https://github.com/cola500/equinet/blob/main/docs/...` (wiki kan inte relativ-länka in i repot).
4. Lägg en `_Sidebar.md` med trädet ovan.
5. Sätt en banner på Home: "Source of truth är repo-dokumentationen -- denna wiki är en portal."

## Nästa steg

- [ ] PO-review av struktur + de tre draftsen (Home, Developer-Onboarding, Environments-and-Deployments)
- [x] Uppdatera `docs/guides/onboarding.md` (klart 2026-06-11, documentation reconciliation-slicen)
- [ ] Skriv resterande 11 sidor (varje sida ~30-60 min givet källmappningen ovan)
- [ ] Publicera till GitHub Wiki + `_Sidebar.md`
