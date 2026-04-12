---
title: "Equinet -- Dokumentationsindex"
description: "Centralt navigeringsdokument for all projektdokumentation"
category: root
status: active
last_updated: 2026-03-26
sections:
  - Arkitektur
  - Operations
  - Sakerhet
  - Testning
  - Guider
  - API-dokumentation
  - Planer (aktiva)
  - Retrospectives
  - Ideer & Backlog
  - Anvandarforskning
  - Sprintar
  - Arkiv
---

# Equinet -- Dokumentationsindex

> Centralt navigeringsdokument. For projektsetup, se [README.md](../README.md).

---

## Arkitektur

| Dokument | Beskrivning |
|----------|-------------|
| [database.md](architecture/database.md) | Databasschema, RLS, pooling, backup |
| [offline-pwa.md](architecture/offline-pwa.md) | Offline PWA-arkitektur (service worker, IndexedDB, sync) |
| [booking-flow.md](architecture/booking-flow.md) | Bokningsflode och betalning |
| [scaling.md](architecture/scaling.md) | Skalningsplan for 500 anvandare |
| [arkitektgenomlysning.md](architecture/arkitektgenomlysning.md) | Arkitekturgenomlysning |
| [architecture-review.md](architecture-review.md) | Arkitekturgenomgang Q1 2026 |
| [code-quality-review.md](code-quality-review.md) | Kodkvalitetsgenomgang Q1 2026 |
| [changeability-review.md](changeability-review.md) | Forandringsbarhet Q1 2026 |
| [booking-domain-review.md](booking-domain-review.md) | Bokningsdomanen -- genomlysning |
| [payment-domain-review.md](payment-domain-review.md) | Payment/checkout -- genomlysning |
| [technical-improvements-2026-q1.md](technical-improvements-2026-q1.md) | Teknikforbattringar Q1 2026 (sammanfattning) |
| [ios-executive-summary.md](ios-executive-summary.md) | iOS-app -- executive summary |
| [ios-architecture-review.md](ios-architecture-review.md) | iOS-app -- arkitektur, lager, hotspots |
| [ios-code-quality-review.md](ios-code-quality-review.md) | iOS-app -- kodkvalitet, mönster, testbarhet |
| [ios-refactoring-opportunities.md](ios-refactoring-opportunities.md) | iOS-app -- 13 prioriterade förbättringar |

## Operations

| Dokument | Beskrivning |
|----------|-------------|
| [ci-decisions.md](ci-decisions.md) | CI-beslut och lärdomar |
| [deployment.md](operations/deployment.md) | Komplett deploy-guide (Vercel + Supabase) |
| [load-testing.md](operations/load-testing.md) | Lasttest-baseline och resultat |
| [parallel-sessions.md](operations/parallel-sessions.md) | Guide for parallella utvecklingssessioner |

## Sakerhet

| Dokument | Beskrivning |
|----------|-------------|
| [pentest-2026-02-15.md](security/pentest-2026-02-15.md) | OWASP ZAP pentest-rapport (februari 2026) |
| [rls-findings.md](security/rls-findings.md) | Row Level Security-analys |
| [PENTEST-REPORT-2026-02-27.md](security/PENTEST-REPORT-2026-02-27.md) | Pentest-rapport (februari 2026, utokad) |

## Testning

| Dokument | Beskrivning |
|----------|-------------|
| [manual-testing.md](testing/manual-testing.md) | Manuell testguide for produktverifiering |
| [exploratory-coverage.md](testing/exploratory-coverage.md) | Exploratory test-coverage |
| [e2e-seed-plan.md](testing/e2e-seed-plan.md) | E2E seed-data strategi |
| [exploratory-session-1.md](testing/exploratory-session-1.md) | Forsta exploratory-session |
| [e2e-suite-review.md](e2e-suite-review.md) | E2E-svit genomlysning och kategorisering |

## Guider

| Dokument | Beskrivning |
|----------|-------------|
| [gotchas.md](guides/gotchas.md) | Vanliga gotchas och lösningar |
| [agents.md](guides/agents.md) | Agent-team guide for Claude Code |
| [voice-logging.md](guides/voice-logging.md) | Rostloggning -- arkitektur och anvandning |
| [feature-docs.md](guides/feature-docs.md) | Anvandardokumentation for funktioner |

## API-dokumentation

| Dokument | Beskrivning |
|----------|-------------|
| [auth.md](api/auth.md) | Auth API |
| [bookings.md](api/bookings.md) | Bookings API |
| [providers.md](api/providers.md) | Providers API |
| [customers.md](api/customers.md) | Customers API |
| [horses.md](api/horses.md) | Horses API |
| [routes.md](api/routes.md) | Routes API |
| [group-bookings.md](api/group-bookings.md) | Group Bookings API |
| [admin.md](api/admin.md) | Admin API |
| [voice-and-ai.md](api/voice-and-ai.md) | Voice & AI API |

## Produktanalys & Demo

| Dokument | Beskrivning |
|----------|-------------|
| [demo-mode.md](demo-mode.md) | Demo-lage -- vad som visas/doljs, hur man startar |
| [demo-seed.md](demo-seed.md) | Demo-data: tjänster, kunder, hästar, bokningar |
| [demo-go-no-go.md](demo-go-no-go.md) | Go/no-go genomgang av demo-flodet |
| [product-audit/UX-GENOMLYSNING.md](product-audit/UX-GENOMLYSNING.md) | UX-genomlysning |
| [product-audit/feature-inventory.md](product-audit/feature-inventory.md) | Fullständig inventering av alla 47 features |
| [product-audit/user-flows.md](product-audit/user-flows.md) | Viktigaste användarflödena med status och blockerare |
| [product-audit/demo-readiness.md](product-audit/demo-readiness.md) | Bedömning av vad som är demo-bart idag |
| [product-audit/demo-mvp-proposal.md](product-audit/demo-mvp-proposal.md) | Minimal demo-MVP med steg-för-steg-script |
| [product-audit/technical-risks.md](product-audit/technical-risks.md) | Tekniska risker för demo/MVP |
| [product-audit/recent-changes.md](product-audit/recent-changes.md) | Förändringsinventering jan-mar 2026 |

## Planer (aktiva)

| Dokument | Beskrivning |
|----------|-------------|
| [better-auth-migration.md](plans/better-auth-migration.md) | Better Auth-migrering |
| [feature-flag-hardening.md](plans/feature-flag-hardening.md) | Feature flag-hardening |
| [mobile-design-improvements.md](plans/mobile-design-improvements.md) | Mobil design-forbattringar |
| [offline-pwa-roadmap.md](plans/offline-pwa-roadmap.md) | Offline PWA roadmap |
| [refactoring.md](plans/refactoring.md) | Refactoring-plan |

## Retrospectives

Se [retrospectives/README.md](retrospectives/README.md) for konsoliderade sammanfattningar (67 sessioner).

| Dokument | Beskrivning |
|----------|-------------|
| [2026-ios-dashboard-pilot-retro.md](retrospectives/2026-ios-dashboard-pilot-retro.md) | DashboardViewModel-pilot: lärdomar och stopping point |
| [2026-03-29-ios-review-ci-optimization.md](retrospectives/2026-03-29-ios-review-ci-optimization.md) | iOS-review, teststrategi och CI-optimering |

## Ideer & Backlog

| Dokument | Beskrivning |
|----------|-------------|
| [ux-backlog.md](ideas/ux-backlog.md) | UX-backlog |
| [due-for-service-plan.md](ideas/due-for-service-plan.md) | Dags-for-besok-plan |
| [route-announcement-ux-analysis.md](ideas/route-announcement-ux-analysis.md) | Ruttannonsering UX-analys |

## Anvandarforskning

Se [user-research/README.md](user-research/README.md) for intervjuer och marknadsanalys.

## Sprintar

Se [sprints/](sprints/) for sprint-planer.

## Arkiv

Avslutade planer, ersatta dokument och 67 rå retrospectives finns i [archive/](archive/).

---

*Senast uppdaterad: 2026-03-29*
