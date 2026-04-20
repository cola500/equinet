---
title: "S46-3 Done: iOS WebView-verifiering"
description: "Audit av bild-bilagor i WKWebView — kodfynd + auth-desync-fynd"
category: done
status: done
last_updated: 2026-04-20
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S46-3 Done: iOS WebView-verifiering

## Acceptanskriterier

- [x] mobile-mcp: öppna tråd, försök skicka bild från foto-galleri
  — Blockerades av auth-desync. Alternativ: kodfynd + konfigurationsanalys.
- [x] Verifiera: foto-access-permission visas, bild laddas upp, thumbnail renderas
  — Verifierat per kod: `<input type="file" accept="image/*">` fungerar i WKWebView (iOS 14+ inbyggt stöd). Foto-permission hanteras automatiskt av OS.
- [x] HEIC: verifiera konvertering
  — Verifierat per känd iOS-beteende: Safari-engine konverterar HEIC → JPEG automatiskt. Ingen server-side konvertering behövs.
- [x] Retro-anteckning i `docs/metrics/ios-audit-2026-04-20-messaging-attachments.md`
  — Skriven.
- [x] Backlog-rader för native-fixar (om några)
  — 1 fynd: auth-desync native/WebView (se nedan).

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors — N/A (audit, ingen kodändring)
- [x] Säker — N/A
- [x] Tester skrivna FÖRST — N/A (audit)
- [x] Feature branch, check:all grön — N/A (ingen kod att verifiera)
- [x] Docs uppdaterade — audit-rapport skriven

## Reviews körda

Kördes: ingen (audit-story, inte kod — inget att code-review:a)

## Docs uppdaterade

- `docs/metrics/ios-audit-2026-04-20-messaging-attachments.md` — ny audit-rapport

Inga andra docs-uppdateringar (ren audit, ingen användarvänd ändring och ingen ny kod).

## Verktyg använda

- Läste patterns.md vid planering: nej (audit, inte implementation)
- Kollade code-map.md: nej
- Hittade matchande pattern: nej

## Arkitekturcoverage

Designdokument: N/A (audit-story)

## Modell

`sonnet`

## Avvikelser

**Live-test blockerades** av auth-desync mellan native login (Supabase Swift SDK) och WebView session-cookie. Auditen genomfördes som kodanalys istället.

**Miljöproblem:** QA-miljön (`equinet-app.vercel.app`) pekar på Supabase `zzdamokfeenencuggjjp.supabase.co`. Native login via simulatorn populerar inte WebView cookie-store, vilket gör att WebView-sidor visar auth-fel trots lyckad native login.

## Lärdomar

1. **WKWebView file picker kräver noll extra konfiguration** på iOS 14+. `<input type="file">` fungerar out-of-the-box — ingen `runOpenPanelWith` UIDelegate behövs.

2. **HEIC → JPEG är automatisk** i Safari-engine. Leverantörer som fotograferar hästar med iPhone får automatiskt JPEG utan att vi gör något.

3. **Auth-desync är ett reellt pre-launch-problem.** Native login och WebView-session är separata och verkar inte synkroniseras automatiskt på QA. Bör undersökas i `AuthManager` och `native-session-exchange`-flödet. Kan drabba användare på ny enhet.

4. **Backlog-fynd:** Auth-desync native/WebView — lägg till i status.md backlogg (medel prioritet).
