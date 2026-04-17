---
title: "Återanvändbara mönster -- katalog"
description: "Centralt index över alla beprövade patterns i Equinet. Kolla här FÖRE du uppfinner nytt."
category: architecture
status: active
last_updated: 2026-04-17
tags: [patterns, architecture, reuse, catalog]
related:
  - CLAUDE.md
  - docs/architecture/booking-flow.md
  - docs/architecture/database.md
  - docs/architecture/offline-pwa.md
sections:
  - Hur katalogen används
  - Integration & externa system
  - Arkitektur & kod-organisation
  - Säkerhet
  - Data & persistens
  - UI & klient
  - Testning
  - Processer
  - Hur du lägger till ett nytt mönster
---

# Återanvändbara mönster -- katalog

**Princip:** Innan du uppfinner ett nytt sätt att lösa ett problem -- kolla här. Vi har troligen mött det förr.

## Hur katalogen används

1. Står du inför en ny design-utmaning? Sök först i denna katalog.
2. Hittar du ett matchande mönster? Kopiera strukturen.
3. Hittar du INTE ett mönster? Bygg lösningen, och **lägg till den här** när den är bevisad.
4. Agenter läser denna automatiskt via CLAUDE.md snabbreferens.

Tre regler:
- Mönstret måste vara **bevisat i produktion** (minst en användning).
- Det måste vara **återanvändbart** (inte bara Stripe-specifikt om det gäller alla webhooks).
- Det måste ha en **kort sammanfattning i en mening** så folk snabbt ser om det matchar.

---

## Integration & externa system

| Mönster | När | Fil |
|---------|-----|-----|
| **Webhook idempotency** | Externa system med at-least-once delivery (Stripe, Fortnox, ...) | [webhook-idempotency-pattern.md](webhook-idempotency-pattern.md) |
| **Fire-and-forget notifier med DI** | Skicka notis utan att blockera API-svar | `src/domain/notification/RouteAnnouncementNotifier.ts` |
| **Gateway abstraction** | Extern tjänst med möjliga utbyten (Stripe -> annan PSP, Resend -> annan email) | `src/domain/payment/PaymentGateway.ts` |

---

## Arkitektur & kod-organisation

| Mönster | När | Fil |
|---------|-----|-----|
| **Repository pattern** | Kärndomän (Booking, Horse, Provider, ...) | `src/infrastructure/persistence/<domain>/` |
| **DDD-Light** | Affärslogik -> domain service, validering -> value object, CRUD -> Prisma direkt | [booking-flow.md](booking-flow.md) |
| **Error mapper per domän** | Mappa domänfel till HTTP-statuskoder | `src/domain/<domain>/map<Domain>ErrorToStatus.ts` |
| **Factory pattern vid DI** | 3+ dependencies i en route | `src/domain/follow/FollowServiceFactory.ts` |
| **withApiHandler** | Ny API route -- auth + rate limit + error handling ur lådan | `src/lib/api-handler.ts` |
| **Kodkarta som navigering** | Domän → filer, feature flag → filer | [.claude/rules/code-map.md](../../.claude/rules/code-map.md) |

---

## Säkerhet

| Mönster | När | Fil |
|---------|-----|-----|
| **Webhook idempotency** | Se "Integration & externa system" ovan | -- |
| **Row Level Security (RLS)** | Databas-lagerskydd utöver applikationslogik | [database.md](database.md) |
| **Ownership guards i repository** | Kärndomän-queries med `findByIdForProvider` | `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` |
| **Rate limiter fail-closed** | Redis-fel -> 503, inte 500 eller tyst öppning | `src/lib/rate-limit.ts` |
| **Admin audit log** | Alla admin-API-operationer loggas automatiskt | `src/lib/api-handler.ts` (withApiHandler auth: "admin") |
| **MFA med TOTP** | Admin-konton (framtid: leverantörer) | [../security/mfa-admin.md](../security/mfa-admin.md) |
| **Select-block audit** | Nytt fält på kärnmodell -- kolla alla select:-block | Gotcha i MEMORY.md |
| **Test-endpoint-skydd** | `/api/test/*` bara i lokal + CI via `ALLOW_TEST_ENDPOINTS` env | `src/app/api/test/*/route.ts` |

---

## Data & persistens

| Mönster | När | Fil |
|---------|-----|-----|
| **Offline mutation queue** | Skrivning när offline -> synk senare | [offline-pwa.md](offline-pwa.md) |
| **Offline read-through cache** | Läsning offline via IndexedDB | `src/lib/offline/offline-fetcher.ts` |
| **Atomic UPSERT via createMany skipDuplicates** | Dedup på UNIQUE constraint utan race condition | `src/domain/payment/PaymentWebhookService.ts` |
| **Terminal-state-guards** | Förhindra att ett state-machine zombifieras av sent event | `src/domain/subscription/SubscriptionService.ts` |
| **Payload-minimering** | select-block innehåller BARA fält UI:t renderar | Gotcha i `.claude/rules/api-routes.md` |
| **groupBy över hämta-alla** | Aggregering i DB, inte JS-loop | Gotcha i `.claude/rules/api-routes.md` |

---

## UI & klient

| Mönster | När | Fil |
|---------|-----|-----|
| **Mobil-först med ResponsiveDialog** | Modal -- drawer på mobil, dialog på desktop | `src/components/ui/responsive-dialog.tsx` |
| **Optimistic UI (iOS)** | Uppdatera UI direkt, revert vid fel | iOS learnings i `.claude/rules/ios-learnings.md` |
| **SWR + offline-fetcher** | Villkorlig global fetcher via feature flag | `src/components/providers/SWRProvider.tsx` |
| **Feature flag prioritet** | env > databas-override > kod-default | `src/lib/feature-flags.ts` |
| **useOfflineGuard** | Blockera mutation eller köa när offline | `src/hooks/useOfflineGuard.ts` |
| **Native Screen Pattern (iOS)** | WebView → SwiftUI-migrering | CLAUDE.md iOS-sektion |
| **CustomerLayout-wrapper** | Alla kundsidor får Header + BottomTabBar | `src/components/layout/CustomerLayout.tsx` |

---

## Testning

| Mönster | När | Fil |
|---------|-----|-----|
| **BDD dual-loop** | API routes + domain services -- yttre integration driver inre unit | `.claude/rules/testing.md` |
| **Enkel TDD** | iOS SwiftUI, utilities, simpel CRUD | `.claude/rules/testing.md` |
| **E2E seed + cleanup med tagged data** | Isolera test-data per spec | `e2e/setup/cleanup-utils.ts` |
| **Mock-repository via interface** | Byt PrismaX för MockX i tester | `src/infrastructure/persistence/<domain>/Mock*Repository.ts` |
| **Visual verification med Playwright MCP** | UI-ändringar -- verifiera i worktree före merge | `docs/retrospectives/` (lärdom) |

---

## Processer

| Mönster | När | Fil |
|---------|-----|-----|
| **Stationsflöde (6 steg)** | Varje story: PLAN -> RED -> GREEN -> REVIEW -> VERIFY -> MERGE | `.claude/rules/team-workflow.md` |
| **Parallella sessioner med worktrees** | 2 sessioner på olika domäner samtidigt | `.claude/rules/parallel-sessions.md` |
| **Worktree-agent-mönster** | Huvudsession spawnar isolated agent för docs-arbete | `.claude/rules/autonomous-sprint.md` |
| **Trunk-based hybrid** | Kod = PR, lifecycle-docs = direkt till main | `.claude/rules/commit-strategy.md` |
| **Sessionsfil istället för delad status.md** | Varje session skriver till egen fil -- inga merge-konflikter | `.claude/rules/auto-assign.md` |
| **Done-fil med Reviews + Docs-uppdaterade** | Obligatoriska sektioner vid story-avslut | `.claude/rules/auto-assign.md` |
| **Dependabot auto-merge för patch** | Bara patch-versioner, inte minor/major | `docs/operations/dependabot.md` |

---

## Hur du lägger till ett nytt mönster

När du har löst ett problem och inser "det här kan återanvändas":

1. **Skriv mönstret som ett eget dok** under `docs/architecture/<namn>-pattern.md` (om det behöver utrymme) eller referera till koden direkt (om det är litet).
2. **Lägg till rad i denna katalog** med: namn, när, länk.
3. **Commit som lifecycle-doc** -- direkt till main är OK för denna katalog.
4. **Uppdatera CLAUDE.md snabbreferens** om det är ett stort eller centralt mönster.

**Vad som kvalificerar som "pattern":**
- Används i minst två platser (aktuellt eller planerat)
- Har en klar avgränsning ("när använda, när INTE")
- Löser ett generellt problem, inte en one-off

**Vad som INTE är ett pattern:**
- En gotcha (de hör hemma i `docs/guides/gotchas.md`)
- En lärdom från en bug (de hör hemma i retros)
- Ett enstaka beslut utan återanvändning (det är arkitekturbeslut -- dokumentera i domain-doc)
