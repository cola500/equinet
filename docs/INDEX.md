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

## Operations

| Dokument | Beskrivning |
|----------|-------------|
| [deployment.md](operations/deployment.md) | Komplett deploy-guide (Vercel + Supabase) |
| [load-testing.md](operations/load-testing.md) | Lasttest-baseline och resultat |
| [parallel-sessions.md](operations/parallel-sessions.md) | Guide for parallella utvecklingssessioner |

## Sakerhet

| Dokument | Beskrivning |
|----------|-------------|
| [pentest-2026-02-15.md](security/pentest-2026-02-15.md) | OWASP ZAP pentest-rapport (februari 2026) |
| [rls-findings.md](security/rls-findings.md) | Row Level Security-analys |

## Testning

| Dokument | Beskrivning |
|----------|-------------|
| [manual-testing.md](testing/manual-testing.md) | Manuell testguide for produktverifiering |
| [exploratory-coverage.md](testing/exploratory-coverage.md) | Exploratory test-coverage |
| [e2e-seed-plan.md](testing/e2e-seed-plan.md) | E2E seed-data strategi |
| [exploratory-session-1.md](testing/exploratory-session-1.md) | Forsta exploratory-session |

## Guider

| Dokument | Beskrivning |
|----------|-------------|
| [gotchas.md](guides/gotchas.md) | Vanliga gotchas och losningar |
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

*Senast uppdaterad: 2026-02-28*
