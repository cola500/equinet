---
title: "S38-2 Done: Fixa messaging-blockers (deep-link + NativeMoreView)"
description: "Åtgärdar BLOCKER-1 (NativeMoreView saknar Meddelanden) och BLOCKER-2 (fel deep-link URL)"
category: guide
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Fynd och lärdomar
---

# S38-2 Done: Fixa messaging-blockers

## Acceptanskriterier

- [x] Deep-link URL fixad i `ConversationService.ts`: `/provider/messages/${bookingId}` (var `/provider/bookings/${id}/messages`)
- [x] `NativeMoreView.swift`: Meddelanden-rad tillagd med `featureFlag: "messaging"`
- [x] `MessageNotifier.test.ts`: Stale fixtures uppdaterade (7 ställen)
- [x] `ConversationService.test.ts`: 2 nya tester för deepLink-URLs
- [x] `check:all` 4/4 grön (4167 tester)

## Definition of Done

- [x] Inga TypeScript-fel (`npm run typecheck`)
- [x] Säker (inga nya auth/injection-ytor)
- [x] Tester: RED → GREEN (2 nya ConversationService-tester, 7 MessageNotifier-fixtures uppdaterade)
- [x] Feature branch, 4/4 gates gröna

## Reviews körda

**code-reviewer (post-implementation):** Kördes. Hittade 2 Important:
1. Stale fixtures i MessageNotifier.test.ts — **fixat** (search-and-replace alla 7 instanser)
2. Kund-deepLink `/customer/bookings/{id}` löser till list-sida, inte specific tråd — **dokumenterat** som avsiktligt i testet (MessagingSection finns i BookingCard på den sidan; dedikerad kundinkorg är separat follow-up)

**Inga blockers kvar.**

## Docs uppdaterade

- Kommentar i `ConversationService.test.ts` klargör kund-deepLink-beteendet
- Ingen docs-matris-uppdatering krävs (intern buggfix, inte ny användarvänd feature)

**Obs:** `docs/testing/testing-guide.md` och hjälpartiklar uppdateras i S38-1 (messaging M7-gap).

## Verktyg använda

- Läste patterns.md vid planering: nej (liten avgränsad fix, pattern självklart)
- Kollade code-map.md: ja, verifierade domän-filer
- Hittade matchande pattern: MoreMenuItem-mönstret (exakt samma initialiserings-form som övriga rader)

## Arkitekturcoverage

N/A — buggfixar mot S38-0-audit, inget design-dokument.

## Modell

**sonnet** (claude-sonnet-4-6) — buggfix + testskrivning.

## Fynd och lärdomar

**Vad var oväntat?**
- xcodebuild kan inte detektera iOS Simulator som destination (Xcode 26.4 kräver iOS 26.4, simulator kör 26.3). Visuell verifiering av Swift-ändringen gjordes inte. Swift-syntax verifierades med `swiftc -parse`.
- `MessageNotifier.test.ts` hade 7 instanser av fel URL — alla i test-input-data (inte expected-assertions), vilket gör att tester inte failade. Silently stale documentation.

**Vad skulle du göra annorlunda?**
- Kör alltid `grep -r "deepLink\|provider/bookings.*messages"` i test-filer när en URL ändras.

**Gotchas för framtida sessioner:**
- xcodebuild-destinationsdetektering är trasig i Xcode 26 när iOS 26.4 saknas men 26.3 finns. Fallback: `swiftc -parse` för syntaxkontroll + manuell build via Xcode GUI.
- Kund-deepLink `/customer/bookings/{id}` är intentional shortcut — uppdatera till `/customer/messages/{id}` om/när kundinkorg byggs.

## Avvikelser

- iOS visuell verifiering (Meddelanden visas i Mer-meny) gjordes inte med mobile-mcp pga xcodebuild-problem. Swift-syntaxen verifierades med `swiftc -parse`. Ändringen är ett rent deklarativt array-tillägg identiskt med övriga MoreMenuItem-rader.
