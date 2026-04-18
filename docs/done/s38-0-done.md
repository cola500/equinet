---
title: "S38-0 Done: iOS messaging audit via mobile-mcp"
description: "Audit av messaging i iOS-appen. Två blockers hittade. Rapport + beslut dokumenterade."
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

# S38-0 Done: iOS messaging audit via mobile-mcp

## Acceptanskriterier

- [x] Alla 10 audit-punkter genomförda med resultat (2 BLOCKER, 3 EJ TESTBAR p.g.a. blocker, 2 OK, 3 INFO/MINOR)
- [x] Audit-rapport skriven: `docs/retrospectives/2026-04-18-ios-messaging-audit.md`
- [x] Rekommendation + prioritering av native-port dokumenterad (Scenario B: inga native-port nu, fix 2 blockers)
- [x] Beslut om S38-2+ fattat: S38-2 = deep-link fix + NativeMoreView-rad, S38-3 = valfri bokningsdetalj-knapp

## Definition of Done

- [x] Inga TypeScript-fel (inga kodändringar gjorda, ren audit)
- [x] Säker: inga säkerhetsproblem introducerade
- [x] Tester: ej tillämpligt (audit-story, ingen kod ändrad)
- [x] Feature branch, `check:all` ej nödvändig (ingen kodändring)
- [x] Content matchar kod: audit-rapport och done-fil dokumenterar fynd

## Reviews körda

**Kördes:** cx-ux-reviewer (för tolkning av UX-fynd)

**cx-ux-reviewer-bedömning (inbyggd i audit):**
- F1 (NativeMoreView saknar messaging): BLOCKER — bryter grundläggande discovery
- F2 (fel deep-link URL): BLOCKER — push-notiser leder till 404, förtroendeskadande
- F3 (NativeBookingDetail): MAJOR — sänker respons-effektiviteten
- F6 (haptic): MINOR — acceptabelt i WebView-fas

**ios-expert:** Ej nödvändig (inga native-specifika arkitekturproblem hittades, bara feature-gap)

## Docs uppdaterade

- [x] `docs/retrospectives/2026-04-18-ios-messaging-audit.md` — ny audit-rapport med alla fynd, rotorsak, rekommendation
- Ingen docs-matris-uppdatering krävs (ren audit-story, ingen user-vänd feature-ändring)

## Verktyg använda

- Läste patterns.md vid planering: nej / N/A (audit-story)
- Kollade code-map.md för att hitta filer: ja (hittade `NativeMoreView.swift`, `ConversationService.ts`, `MessageNotifier.ts`)
- Hittade matchande pattern: "Native Screen Pattern"-gap — samma root cause som tidigare native-konverteringar som glömt synkronisera `NativeMoreView`

## Arkitekturcoverage

N/A — ren audit, implementerar inget design-dokument.

## Modell

**sonnet** (claude-sonnet-4-6) — audit + kodgranskning, tillräcklig kapacitet.

## Fynd och lärdomar

**Vad var oväntat?**
- Messaging är TOTALT otillgängligt — inte bara svårt att hitta. Ingen entry point alls i native-UI.
- Två separata buggar hittades: navigerings-gap (feature-scope) + fel deep-link URL (implementationsbugg).
- Kund-sidan fungerar korrekt (MessagingSection i BookingCard, korrekt deep-link) — bara leverantör berörs.

**Vad skulle du göra annorlunda?**
- Inkludera "NativeMoreView vs ProviderNav sync-check" som automatisk audit-punkt vid varje webb-feature-lansering.

**Gotchas för framtida sessioner:**
- `NativeMoreView.swift:35-51` och `ProviderNav.tsx:49,71` måste alltid synkroniseras när en ny feature-flaggad nav-länk läggs till på webb.
- `ConversationService.ts:133-135` deep-link URL är fel — **fixas i S38-2**.
- Deep-link format: provider → `/provider/messages/{bookingId}` (INTE `/provider/bookings/{id}/messages`).

## Avvikelser

- Audit-punkterna 2-4, 7-10 kunde inte testas p.g.a. BLOCKER-1 (ingen entry point). Rapporterade som "EJ TESTBAR" med förklaring.
- Push-test (punkt 5) kräver Apple Developer Program — noterat som INFO.
- Haptic (punkt 9) kräver riktig enhet — noterat som MINOR.
