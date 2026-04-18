---
title: S35-3 Push-notifiering vid nytt meddelande
description: Done-fil för S35-3
category: done
status: done
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Docs
  - Lärdomar
---

# S35-3: Push-notifiering vid nytt meddelande

## Acceptanskriterier

- [x] MessageNotifier skapar in-app-notis (NotificationService) vid nytt meddelande
- [x] MessageNotifier skickar push-notis (PushDeliveryService) vid nytt meddelande
- [x] deepLink kund→leverantör: `/provider/bookings/{id}/messages`
- [x] deepLink leverantör→kund: `/customer/bookings/{id}`
- [x] Fire-and-forget: notisfel kastar aldrig undantag till anroparen
- [x] Notifiering triggas INTE om sendMessage misslyckas (status-gating, tom content etc.)
- [x] Feature-flag gate på service-nivå (defense in depth)
- [x] Symmetrisk: fungerar oavsett om kunden eller leverantören skickar

## Definition of Done

- [x] Inga TypeScript-fel, 0 lint-varningar
- [x] Säker (validering, fire-and-forget, ingen PII i logs)
- [x] Tester skrivna FÖRST — 6 MessageNotifier-tester, 3 ConversationService-notifiertester (inkl. provider-sender)
- [x] check:all 4/4 grön (4163 tester)
- [x] Feature branch `feature/s35-3-message-push`

## Reviews körda

- code-reviewer (security-reviewer): Inga blockers, inga majors. 3 minors (M1: test för provider-sender lagt till; M2: deepLink design-notering; M3: pre-existing GET rate-limit-mönsteravvikelse). 2 suggestions (lock-screen content, factory vs singleton).

## Docs uppdaterade

Ingen användarvänd docs-uppdatering för denna story — push-notiser är backend-implementation utan ny UI. Hjälpartikel och testing-guide berör messaging som helhet (täcks av S35-2 done-fil).

## Verktyg använda

- Läste patterns.md vid planering: ja (Factory pattern, fire-and-forget notifier)
- Kollade code-map.md för att hitta filer: ja (notification-domän, RouteAnnouncementNotifier)
- Hittade matchande pattern: RouteAnnouncementNotifierFactory.ts — exakt mall för MessageNotifierFactory

## Modell

claude-sonnet-4-6

## Lärdomar

- `PushDeliveryService` har intern `push_notifications`-flaggkontroll — MessageNotifier behöver inte dubblera den
- Symmetri-test (provider-sender) är enkelt att glömma när man skriver happy-path-tester för kund-sender. Security review fångade det.
- Factory-mönster är enkelt när beroenden är singletons — bara en rad konstruktion
