---
title: "Service-without-Repo Audit"
description: "Audit av domäner som har Service men ingen Repository. Per domän: data, komplexitet, rekommendation. Inga kodändringar."
category: architecture
status: active
last_updated: 2026-05-06
tags: [audit, architecture, domain-services, repository-pattern]
related:
  - ddd-light-pattern.md
  - domain-boundaries-discovery.md
sections:
  - Sammanfattning
  - Bedömningskriterier
  - Audit per domän
  - Rekommenderad ordning för uppgradering
  - Slutsats
---

# Service-without-Repo Audit (2026-05-06)

> Audit av 9 domäner som har Service men ingen Repository. Inget rörs i koden — bara analys och beslut. Driver framtida refactor-prioritet.

---

## Sammanfattning

Av de 9 auditade domänerna:

| Status | Antal | Domäner |
|--------|-------|---------|
| **OK utan repo** (rätt nivå idag) | 5 | Reminder, Data-retention, Customer-insight, Account, Accounting |
| **Bevaka** (kandidat om triggers fyrar) | 3 | Notification, Payment, Due-for-service |
| **Kandidat för repo senare** (närmar sig tröskeln) | 1 | Booking-series (sub-domän till Booking) |

**Inga akuta refactor-kandidater.** Alla nio fungerar inom DDD-Light-mönstret som det är beskrivet i [`ddd-light-pattern.md`](ddd-light-pattern.md).

Tre av dem (Notification, Payment, Due-for-service) har **låg-medel sannolikhet att kvalificera sig för repo-uppgradering** vid nästa större feature-tillägg i sin domän. De är värda att hålla koll på men inte att åtgärda i förebyggande syfte.

---

## Bedömningskriterier

För varje domän bedöms:

1. **Filer & routes** — vad finns idag, hur stor är ytan
2. **Prisma-duplicering** — anropar flera ställen samma queries
3. **Business logic-komplexitet** — beräkningar, validering, status, derived state
4. **Test-svårighet** — kräver tester DB-mocks eller integration-setup som hade förenklats med repo
5. **Rekommendation** — OK utan repo / Bevaka / Kandidat för repo senare

Kriterier för uppgradering till repo: minst **två** av "Prisma-duplicering hög", "Business logic komplex", "Test-svårighet hög".

---

## Audit per domän

### 1. Notification

| Fakta | Värde |
|-------|-------|
| Service-filer | 6 (`NotificationService`, `RouteAnnouncementNotifier`, `PushDeliveryService`, `MessageNotifier`, plus 2 factories) |
| Routes | 4 (`/api/notifications/*`, `/api/admin/notifications`) |
| Routes med direct Prisma | 1 av 4 (admin-CRUD) |
| Prisma-duplicering | **Medel** — multiple services anropar `prisma.notification.create/update/findMany` |
| Business logic | **Medel-hög** — fan-out till providers, push-delivery, fire-and-forget med error-handling |
| Test-svårighet | **Medel** — Notifier-pattern testas via mock på service-nivå redan |

**Rekommendation: Bevaka.** Domänen är på gränsen. Notifier-pattern är fungerande och tester använder dependency injection. Repository skulle isolera Prisma-mocks från service-tester men nuvarande setup är hanterbar.

**Trigger för uppgradering:** Om vi lägger till en 5:e route som behöver list/filter/aggregate notifications och måste manuellt skriva samma `select`-block. Eller om en kommande feature (t.ex. notification-grupp eller schemaläggning) kräver komplex query-logik.

### 2. Payment

| Fakta | Värde |
|-------|-------|
| Service-filer | 9 (`PaymentService`, `PaymentWebhookService`, `StripePaymentGateway`, `PaymentGateway`, `InvoiceNumberGenerator`, factories, mappers) |
| Routes | 1 direkt (`/api/bookings/[id]/payment`) + Stripe webhooks som kanske är externa |
| Routes med direct Prisma | 0 av 1 — disciplinerad service-användning |
| Prisma-duplicering | **Låg** — koncentrerad till få anrop |
| Business logic | **Hög** — Stripe webhook event-ID-dedup, refund/dispute, intent-state-maskin, fortnox-mapping |
| Test-svårighet | **Medel** — Gateway-pattern (Adapter) löser Stripe-mocking väl, men DB-state behöver fortfarande test-setup |

**Rekommendation: Bevaka.** Gateway-mönstret för Stripe är bra (tydlig adapter-pattern). Domänen har ingen repository men har två andra abstraktioner (Gateway + WebhookService) som täcker det viktigaste.

**Trigger för uppgradering:** Om vi börjar bygga payment-historik-vyer (refund-timeline, payment-method-list, dispute-history) som kräver flera olika queries på `Payment`-tabellen. Då blir en repo värdefull. Idag är det mest INSERT + UPDATE av enstaka rader.

**Notering:** `InvoiceNumberGenerator` använder Prisma direkt för atomic counter. Det är OK — det är en specifik infra-uppgift och inte business logic.

### 3. Reminder

| Fakta | Värde |
|-------|-------|
| Service-filer | 2 (`BookingReminderService`, `ReminderService`) |
| Routes | 2 (cron: `booking-reminders`, `send-reminders`) |
| Routes med direct Prisma | 0 av 2 |
| Prisma-duplicering | **Låg** — services anropar Prisma men på olika sätt |
| Business logic | **Låg-medel** — find bookings to remind, send mail, log result |
| Test-svårighet | **Låg** — cron-routes är ledan-fungerande, services testbara |

**Rekommendation: OK utan repo.** Två cron-jobb är inte tillräckligt för att motivera ny abstraktion. Logiken är CRUD-tunn (find + send + mark sent).

**Trigger för uppgradering:** Inga uppenbara. Om vi lägger till multi-channel-reminders (push + email + SMS) kan service-strukturen behöva växa, men inte nödvändigtvis till repo.

### 4. Data-retention

| Fakta | Värde |
|-------|-------|
| Service-filer | 1 (`DataRetentionService`) |
| Routes | 1 (cron: `/api/cron/data-retention`) |
| Routes med direct Prisma | 0 av 1 |
| Prisma-duplicering | **Ingen** — en konsument |
| Business logic | **Medel** — GDPR-radering med soft-delete, varningar, retention-policy |
| Test-svårighet | **Låg-medel** — service med mock-prisma räcker |

**Rekommendation: OK utan repo.** En cron + en service är inte överarbete. Retention-logik är viktigt men inte komplext nog att motivera repo-abstraktion.

**Trigger för uppgradering:** Om vi får retention-policys per domän/tabell (Booking 1y, Message 5y, Audit 7y, etc.) som skulle behöva flera queries och flera test-paths. Idag är policy enhetlig.

### 5. Due-for-service

| Fakta | Värde |
|-------|-------|
| Service-filer | 3 (`DueForServiceService`, `DueForServiceLookup`, `DueForServiceCalculator`) |
| Routes | 3 (`/api/customer/due-for-service`, `/api/native/due-for-service`, `/api/provider/due-for-service`) |
| Routes med direct Prisma | 2 av 3 (native + provider använder Prisma direkt; customer använder service) |
| Prisma-duplicering | **Hög** — native + provider-route duplicerar logik som customer-routen använder via service |
| Business logic | **Medel-hög** — interval-calc, overdue-detection, sortering, three view-modes |
| Test-svårighet | **Medel** — calculator är ren funktion (lätt), Lookup mot DB kräver mock |

**Rekommendation: Bevaka — närmast tröskeln.** Detta är den mest sannolika kandidaten i listan. Två av tre routes använder Prisma direkt och duplicerar logik som customer-routen får via service. Det är ett klassiskt symptom: stöddomänen som vuxit till kärn-storlek.

**Trigger för uppgradering:** Antingen (a) en fjärde route som behöver due-for-service-data → bör motivera lyft till repo, eller (b) schema-ändring som tvingar uppdatering i alla 3 routes → samma trigger.

**Mitigering tills dess:** Tänk efter när nya routes tillkommer. Om de är samma `select`-pattern som befintliga, lyft i stället till service.

### 6. Voice-log

| Fakta | Värde |
|-------|-------|
| Service-filer | 2 (`VoiceInterpretationService`, `VocabularyService`) |
| Routes | 2 (`/api/voice-log`, `/api/voice-log/confirm`) |
| Routes med direct Prisma | 2 av 2 (båda) |
| Prisma-duplicering | **Låg** — bara två routes och de gör olika saker |
| Business logic | **Hög** — AI-integration (Anthropic), structured output, confirm-flow |
| Test-svårighet | **Medel** — mock Anthropic + mock Prisma |

**Rekommendation: OK utan repo.** Två routes som båda är AI-tunga. Komplexiteten ligger i prompt-engineering och structured output, inte data-access. Repo skulle inte hjälpa.

**Trigger för uppgradering:** Inga uppenbara. Skulle aktiveras om voice-log får list/history/edit-flöden, men just nu är det "diktera + bekräfta + spara".

### 7. Customer-insight

| Fakta | Värde |
|-------|-------|
| Service-filer | 1 (`CustomerInsightService`) |
| Routes | 1 (`/api/provider/customers/[customerId]/insights`) |
| Routes med direct Prisma | 0 av 1 (servicen anropas) |
| Prisma-duplicering | **Ingen** |
| Business logic | **Medel** — AI-genererad insight, cache, fallback |
| Test-svårighet | **Låg** — service med tydligt kontrakt |

**Rekommendation: OK utan repo.** En route + en service. Inget behov.

**Trigger för uppgradering:** Inga. Om AI-insights skulle bli flera olika kategorier (revenue, frequency, retention) med separata endpoints, skulle service kunna delas — men fortfarande utan repo.

### 8. Account

| Fakta | Värde |
|-------|-------|
| Service-filer | 1 (`AccountDeletionService`) |
| Routes | 1 (`/api/account`) |
| Routes med direct Prisma | 0 av 1 |
| Prisma-duplicering | **Ingen** |
| Business logic | **Medel-hög** — cascading delete, GDPR, soft-delete-flow |
| Test-svårighet | **Medel** — viktig att testa noggrant pga GDPR |

**Rekommendation: OK utan repo.** En specifik operation (DELETE account) med komplex business logic. Service är rätt nivå. Repo skulle bara wrappa Prisma 1:1.

**Trigger för uppgradering:** Inga. Account-domänen handlar nästan enbart om radering.

### 9. Accounting

| Fakta | Värde |
|-------|-------|
| Service-filer | 3 (`AccountingGateway`, `FortnoxGateway`, `InvoiceMapper`) |
| Routes | 0 — används bara internt av Payment + Settings |
| Routes med direct Prisma | n/a |
| Prisma-duplicering | **Ingen** |
| Business logic | **Medel** — Fortnox-mapping, OAuth-token-encryption |
| Test-svårighet | **Låg** — Gateway-mönster med mock |

**Rekommendation: OK utan repo.** Detta är en Gateway-domän (extern integration), inte en data-domän. Repo passar inte. Gateway-pattern är rätt val.

---

## Booking-series (notering)

`BookingSeriesService` ligger i `src/domain/booking/` (inte egen domän) men har 3 dedikerade routes (`/api/booking-series/*`) som **alla** använder Prisma direkt.

| Fakta | Värde |
|-------|-------|
| Service-filer | 1 (`BookingSeriesService` inom Booking-domän) |
| Routes | 3 |
| Routes med direct Prisma | 3 av 3 |
| Prisma-duplicering | **Medel-hög** — query-mönster mellan routes liknar varandra |

**Rekommendation: Kandidat för uppgradering.** Antingen (a) lyfta `BookingSeries` till egen domän med eget repo, eller (b) konsolidera Prisma-anrop i `BookingSeriesService` så routes anropar bara service.

**Att överväga:** Logiskt sett tillhör BookingSeries Booking-aggregate (= en serie är en samling bokningar). Att skilja den i egen repo skulle bryta upp aggregaten. Bättre alternativ: utöka `BookingService` (eller `BookingSeriesService`) att exponera de operations routes behöver, så routes går via service, inte direkt Prisma.

**Trigger:** Vid nästa schema-ändring som påverkar BookingSeries → konsolidera.

---

## Rekommenderad ordning för uppgradering

Om vi någonsin tar oss an dessa (= triggers fyrar), prioritera:

1. **Booking-series** — konsolidera Prisma-anrop i service istället för direkt i routes. Inte ny repo, bara service-utvidgning. ~2-3 timmar.
2. **Due-for-service** — om en fjärde route eller schema-ändring kommer, lyft till full repo-pattern. ~4-6 timmar.
3. **Notification** — om routes växer till 5+ med duplicerade queries, lyft till repo. ~6-8 timmar.
4. **Payment** — bara om payment-historik-vyer byggs som kräver komplexa queries. Lägg till `IPaymentRepository` ovanpå Gateway. ~6-8 timmar.

De andra fem (Reminder, Data-retention, Customer-insight, Account, Accounting) bedöms inte att behöva uppgradering inom överblickbar framtid.

---

## Slutsats

**Inga akuta åtgärder krävs.** DDD-Light-mönstret som [ddd-light-pattern.md](ddd-light-pattern.md) beskriver fungerar som tänkt: kärndomäner med repo, stöddomäner utan repo. De 9 auditade domänerna sitter inom rätt kategori.

**Tre av dem (Notification, Payment, Due-for-service)** har medelhög sannolikhet att kvalificera sig för uppgradering vid nästa större feature-tillägg i sin domän. **Booking-series är värd en konsolidering** av direkt-Prisma-anrop till service vid nästa schema-ändring som påverkar den.

**Rekommendation framåt:** Vid varje nytt feature-arbete i någon av "bevaka"-domänerna → kör snabb-trigger-check (5-10 min) mot detta dokument innan implementation. Det undviker att vi gör direkt-Prisma-route nummer 5 utan att ha tänkt på lyft.

---

**Ingen kod ändrad. Inget refactor utfört. Audit endast.**
