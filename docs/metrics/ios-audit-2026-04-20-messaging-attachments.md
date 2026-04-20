---
title: "iOS Audit: Messaging Attachments (S46-3)"
description: "WebView-verifiering av bild-bilagor i messaging — S46 Slice 2"
category: audit
status: done
last_updated: 2026-04-20
sections:
  - Sammanfattning
  - Miljö
  - Kodfynd
  - Live-test
  - Backlog-fynd
  - Slutsats
---

# iOS Audit: Messaging Attachments

**Datum:** 2026-04-20  
**Sprint:** S46-3  
**Syfte:** Verifiera att bild-bilagor (S46-1/S46-2) fungerar korrekt i iOS WKWebView.

---

## Sammanfattning

Fil-picker fungerar korrekt per kod. Live-test blockerades av auth-problem i QA (se nedan). Inga kodändringar krävs i iOS-lagret — WKWebView hanterar `<input type="file" accept="image/*">` automatiskt sedan iOS 14.

---

## Miljö

- **Simulator:** iPhone 16e, iOS 26.3
- **App-target:** `-STAGING` → `equinet-app.vercel.app` (QA-miljö, Supabase `zzdamokfeenencuggjjp.supabase.co`)
- **Gren:** `feature/s46-3-ios-webview-verification`

---

## Kodfynd

### Fil-input implementation (båda rollerna)

Kund (`MessagingDialog.tsx:311`) och leverantör (`provider/messages/[bookingId]/page.tsx:316`) använder identisk implementation:

```html
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="sr-only"
  onChange={handleFileSelect}
  aria-hidden
/>
```

**Kontrollpunkter:**

| Kontroll | Status | Kommentar |
|----------|--------|-----------|
| `accept="image/*"` | ✅ | Öppnar iOS-fotopicker (gallery + kamera) |
| `capture`-attribut | — | Saknas — ingen direkt kameratrigger. Sprint-spec markerade detta som "valfritt". Accepterat. |
| `sr-only` + ref-trigger | ✅ | Dold input triggas av Paperclip-knapp. Standard iOS-pattern. |
| Reset (`value = ""`) | ✅ | Implementerat i `handleFileSelect` — samma fil kan väljas igen |

### WKWebView-konfiguration (`WebView.swift`)

```swift
config.allowsInlineMediaPlayback = true
```

Ingen `runOpenPanelWith`-delegate implementerad — **detta är korrekt**. Sedan iOS 14 hanterar WKWebView `<input type="file">` automatiskt via PHPickerViewController utan custom UIDelegate-kod. Apple lade till inbyggt stöd just för att undvika att appar behöver implementera egna fil-väljare.

### HEIC-hantering

WKWebView (Safari-engine) konverterar HEIC → JPEG automatiskt när en fil väljs via `<input type="file">`. JavaScript-lagret ser aldrig HEIC-formatet — det får en standard `image/jpeg` File-objekt. Ingen server-side konvertering behövs för detta flöde.

### CORS mot Supabase Storage

Supabase Storage-buckets returnerar signed URLs. WKWebView laddar dessa via `<img src="...">` utan cross-origin-problem eftersom det är GET-requests med giltig signatur, inte credentialed fetch. Inga CORS-headers behöver konfigureras för bildvisning.

---

## Live-test

### Genomfört

- ✅ App startad i simulator med `-STAGING`
- ✅ Inloggning via native login-skärm (QA-Supabase)
- ✅ Mer-menyn laddades korrekt (Meddelanden synlig)
- ✅ Meddelanden-WebView öppnades (`MoreWebView` med path `/provider/messages`)

### Blockerare: Auth-desync

**Fynd:** Efter native login visade både Bokningar och Meddelanden-WebView "Kunde inte ladda"-fel.

**Rotorsak:** Hybridappens auth har två separata lager:
1. **Native-lager:** MobileToken (JWT 90d) lagrat i Keychain — används av native SwiftUI-vyer
2. **WebView-lager:** Session-cookie i WKWebView cookie store — används av webb-sidan

Native login-flödet via Supabase Swift SDK sätter Supabase JWT i Keychain men startar inte automatiskt MobileToken-exchange (`/api/auth/native-session-exchange`) och sätter inte WebView-session-cookie.

**Konsekvens för auditen:** Kunde inte live-testa fil-picker i autentiserat tillstånd på QA.

**Konsekvens för användare:** Om en ny enhet installeras och användaren loggar in via native login kan appen hamna i ett inkonsekvent state där native-vyer och WebView-vyer misslyckas. Detta bör verifieras och eventuellt fixas i ett backlog-item.

---

## Backlog-fynd

### BLOCKER (potentiell) — Native login startar inte session-exchange

**Beskrivning:** Native login via Supabase Swift SDK (`signIn()`) sätter inte upp WebView-sessionen eller MobileToken korrekt på QA. WebView-sidor visas tomma trots att native login lyckades.

**Påverkan:** Kan drabba användare som installerar appen på ny enhet och loggar in. Behöver verifieras om detta är ett QA-specifikt problem eller reproducerbart i prod.

**Rekommendation:** Granska `AuthManager` — kontrollera om `native-session-exchange` anropas efter `signIn()` och om WebView cookie-store populeras korrekt.

**Prioritet:** Medel — bör verifieras och fixas före lansering.

### OBSERVATION — Inget `capture`-attribut

Fil-input har inget `capture="environment"`-attribut. Användaren presenteras med iOS standard fotopicker (galleri + kamera-alternativ). Sprint-spec markerade detta som valfritt och det är accepterat UX.

**Möjlig förbättring:** Lägga till `capture="environment"` ger direkt kamera-trigger för leverantörer som vill fotografera hästar/skador direkt. Låg prioritet, backlogg-kandidat.

---

## Slutsats

| Kontrollpunkt | Resultat |
|---------------|---------|
| Fil-picker öppnas i WKWebView | ✅ Fungerar per kod (iOS 14+ inbyggt stöd) |
| HEIC-konvertering | ✅ Hanteras automatiskt av Safari-engine |
| CORS mot Supabase Storage | ✅ Inget problem (GET + signed URL) |
| WKWebView-konfiguration komplett | ✅ Ingen extra konfiguration krävs |
| Live-test genomfört | ⚠️ Blockerat av auth-desync |
| Auth-desync native/WebView | ⚠️ Backlog-fynd — bör verifieras |
| `capture`-attribut | — Valfritt, inte implementerat |

**Bedömning:** Koden är korrekt implementerad för iOS. Inga blockers i WebView-lagret. Auth-desynk är ett separat problem som bör undersökas vidare.
