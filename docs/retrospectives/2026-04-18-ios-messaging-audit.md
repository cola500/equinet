---
title: "iOS Messaging Audit 2026-04-18"
description: "Systematisk audit av messaging-funktion i iOS-appen via mobile-mcp. Avslöjar två blockers."
category: retro
status: active
last_updated: 2026-04-18
tags: [ios, messaging, audit, mobile-mcp]
sections:
  - Setup och miljö
  - Audit-resultat per flöde
  - Fynd-tabell
  - Rotorsak
  - Rekommendation
  - Beslut om S38-2+
---

# iOS Messaging Audit 2026-04-18

**Sprint:** S38 · **Story:** S38-0 · **Genomförd:** 2026-04-18
**Verktyg:** mobile-mcp + kodgranskning (Swift + TypeScript)
**Miljö:** iPhone 16e Simulator (iOS 26.3), Next.js dev-server localhost:3000

---

## Setup och miljö

- iOS Simulator iPhone 16e bootad, Equinet.app installerad från DerivedData
- Dev-server startad: `npm run dev` (bekräftat via `/api/feature-flags`)
- Inloggad som `provider@example.com` (ProviderPass123!)
- Feature flag bekräftad: `messaging: defaultEnabled: true` (post-S37)
- En testbokning tillgänglig: "Hovslagning Standard 800 kr" (förfrågan, 13 apr 2026)

---

## Audit-resultat per flöde

| # | Flöde | Verktyg | Status | Anteckning |
|---|-------|---------|--------|------------|
| 1 | Öppna messaging-inkorg från TabBar | mobile-mcp screenshot | **BLOCKER** | Ingen Meddelanden-flik finns. TabBar: Översikt/Kalender/Bokningar/Mer. Mer-menyn har 11 objekt, ingen av dem är Meddelanden. |
| 2 | Klicka på tråd | mobile-mcp | **EJ TESTBAR** | Ingen entry point. Beror på fynd #1. |
| 3 | Skriva meddelande (tangentbord) | mobile-mcp | **EJ TESTBAR** | Beror på fynd #1. |
| 4 | VoiceTextarea | mobile-mcp | **EJ TESTBAR** | Beror på fynd #1. |
| 5 | Push-notifiering vid nytt meddelande | Push-system | **DELVIS** | Push-tillstånd beviljat i appen. Kräver riktig enhet för full verifiering. Simulatorn tar emot push om Apple Developer är konfigurerat. |
| 6 | Push deep-link → tråd | Kodgranskning | **BLOCKER** | `ConversationService.ts:134` skickar `/provider/bookings/{id}/messages` i push-payload. Sidan existerar inte (Next.js 404). Korrekt URL: `/provider/messages/{bookingId}`. |
| 7 | Offline-läsning | mobile-mcp | **EJ TESTBAR** | Beror på fynd #1. |
| 8 | Keyboard-hantering i tråd | mobile-mcp | **EJ TESTBAR** | Beror på fynd #1. |
| 9 | Haptic vid skicka | Manuell verifiering | **EJ TESTBAR** | Kräver riktig enhet + entry point. Känt: WebView saknar UIImpactFeedbackGenerator. |
| 10 | Svenska tecken å/ä/ö | mobile-mcp | **EJ TESTBAR** | Beror på fynd #1. Webb-sidan renderar korrekt (kontrollerat via Safari). |

---

## Fynd-tabell

| # | Kategori | Allvar | Beskrivning | Fix-förslag | Fil |
|---|----------|--------|-------------|-------------|-----|
| F1 | Native-nav | **BLOCKER** | Messaging saknas helt i NativeMoreView. Ingen av 11 menyobjekt är "Meddelanden". Leverantören har ingen väg till meddelandeinkorgen i iOS-appen. | Lägg till `MoreMenuItem(label: "Meddelanden", icon: "message", path: "/provider/messages", section: "Dagligt arbete", featureFlag: "messaging")` i `allMenuSections` | `ios/Equinet/Equinet/NativeMoreView.swift:35-51` |
| F2 | Push deep-link | **BLOCKER** | `ConversationService` skickar `/provider/bookings/{id}/messages` som deep-link URL för leverantör. Sidan finns inte — korrekt sökväg är `/provider/messages/{bookingId}`. Leverantören tappar på push-notis och möts av 404. | Ändra `deepLink` till `` `/provider/messages/${input.booking.id}` `` för `isCustomerSender` | `src/domain/conversation/ConversationService.ts:133-135` |
| F3 | NativeBookingDetail | **MAJOR** | NativeBookingDetail (native Swift) saknar messaging-knapp/sektion. Även om F1 fixas (inkorg via Mer), kan leverantören inte snabbt svara från en specifik bokning utan att gå till inkorgen och hitta tråden manuellt. | Lägg till "Meddelanden"-knapp i NativeBookingsView bokningsdetalj som navigerar till `/provider/messages/{bookingId}` | `ios/Equinet/Equinet/NativeBookingsView.swift` (NativeBookingDetailView) |
| F4 | Kund deep-link | **OK** | Kundside deep-link (`/customer/bookings/{bookingId}`) navigerar korrekt till en sida med `MessagingSection` | Ingen åtgärd | `src/domain/conversation/ConversationService.ts:135` |
| F5 | Web-UI | **OK** | `ProviderNav` visar Meddelanden-flik med badge-count (unread). Web-sidan `/provider/messages` och `/provider/messages/{id}` renderar korrekt med svensk text | Ingen åtgärd | `src/components/layout/ProviderNav.tsx:49,71` |
| F6 | Haptic/WebView | **MINOR** | WebView saknar native haptic vid skicka-knapp. Acceptabelt för MVP — native-port löser det. | Lägg till native-haptic via bridge om/när native-port görs | N/A |
| F7 | Push-test | **INFO** | Full push-test kräver Apple Developer Program ($99) + riktig enhet eller TestFlight | Ingen åtgärd nu | N/A |

---

## Rotorsak

**Messaging implementerades i S35 (webb) och aktiverades i S37 (flag on), men NativeMoreView uppdaterades aldrig.**

Samma gap uppstår varje gång en ny feature läggs till i webb-ProviderNav utan att NativeMoreView synkroniseras. Webb-navigeringen (`ProviderNav.tsx`) och native-navigeringen (`NativeMoreView.swift`) är manuellt synkroniserade — det finns inget automatiskt.

`ConversationService.ts`-deep-link-buggen är ett separat fel: URL-konstruktionen följer booking-APIets URL-mönster (`/bookings/{id}/...`) istället för messaging-sidans URL-mönster (`/messages/{id}`).

---

## Rekommendation

**Scenario B: Fix 2 specifika blockers (ingen native-port nu)**

Prioritering:
1. **S38-2a (15 min):** Fixa deep-link URL i `ConversationService.ts`
2. **S38-2b (45 min):** Lägg till Meddelanden i `NativeMoreView` med feature flag-filtrering
3. **S38-2c (60 min, valfritt):** Lägg till messaging-knapp i `NativeBookingDetail` (navigerar till `/provider/messages/{bookingId}`)

**Native-port (full SwiftUI-inkorg + tråd-vy):** Skjut till separat sprint. WebView-versionen via `NativeMoreView` är acceptabel MVP för leverantörer. Estimat: 2-3 dagar för fullständig native-port.

---

## Beslut om S38-2+

Baserat på denna rapport: **Scenario B** — fix de 2 blockersna + valfritt messaging-knapp i bokningsdetalj.

Föreslagna stories:
- **S38-2:** Fixa messaging-blockers (deep-link URL + NativeMoreView-rad) — 1h
- **S38-3 (valfritt):** Messaging-knapp i native bokningsdetalj — 1h

Native-port av messaging-UI skjuts till bakloggen som "Messaging Slice 1 native iOS-port" vid relevant tidpunkt.
