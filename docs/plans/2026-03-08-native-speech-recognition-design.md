---
title: "Native röstloggning via bridge"
description: "Design för att ersätta Web Speech API med iOS SFSpeechRecognizer via native-web bridge"
category: plan
status: active
last_updated: 2026-03-08
tags: [ios, voice-logging, speech-recognition, bridge]
sections:
  - Kontext
  - Approach
  - Bridge-protokoll
  - Swift-implementation
  - Webb-integration
  - Filer
  - Verifiering
---

# Design: Native röstloggning via bridge

## Kontext

Equinets röstloggning låter leverantörer diktera arbetsnoteringar som AI tolkar och matchar mot bokningar. Idag används Web Speech API (`sv-SE`) i webbappen. I WKWebView på iOS har Web Speech API inkonsekvent stöd -- ibland saknas det helt. Native `SFSpeechRecognizer` löser detta och ger dessutom:

- Offline-taligenkänning (on-device modell)
- Streaming med lägre latens
- Bättre svenska
- Möjlighet till Action Button-integration framöver

## Approach: Bridge-only

Webbappen triggar native taligenkänning via bridge. Swift fångar tal och streamar tillbaka transkript. Webbappens befintliga wizard-UI (AI-tolkning, preview, spara) används oförändrat. Minst risk, mest återanvändning.

```
[WebView] Tryck mikrofon
    | bridge: startSpeechRecognition
[Swift]  SFSpeechRecognizer startar
[Swift]  Streaming text -> bridge
    | bridge: speechTranscript
[WebView] Visar live-text i textarea
[WebView] Resten av flödet (AI, preview, spara) oförändrat
```

## Bridge-protokoll

### Nya meddelandetyper

| Riktning | Typ | Payload | Beskrivning |
|----------|-----|---------|-------------|
| JS -> Swift | `startSpeechRecognition` | `{ language: "sv-SE" }` | Starta inspelning |
| JS -> Swift | `stopSpeechRecognition` | - | Stoppa inspelning |
| Swift -> JS | `speechRecognitionStarted` | - | Bekräfta att inspelning startade |
| Swift -> JS | `speechTranscript` | `{ text, isFinal }` | Streaming-resultat |
| Swift -> JS | `speechRecognitionEnded` | `{ reason }` | Avslutad (user/error/timeout) |
| Swift -> JS | `speechRecognitionError` | `{ error }` | Fel (permission/ej tillgänglig) |

### Befintliga typer (oförändrade)

requestPush, pushTokenReceived, pushPermissionDenied, networkStatus, appDidBecomeActive, appDidEnterBackground

## Swift-implementation

### SpeechRecognizer.swift (NY)

- `SFSpeechRecognizer(locale: Locale("sv-SE"))` + `AVAudioEngine`
- Streaming: `recognitionTask(with: request)` med `result.bestTranscription.formattedString`
- Skickar interim-resultat (`isFinal: false`) och final-resultat (`isFinal: true`) via bridge
- Permission-hantering: `SFSpeechRecognizer.requestAuthorization` + `AVAudioSession.recordPermission`
- Auto-stop efter 30s tystnad
- Cleanup vid stop (stoppa audio engine, avsluta recognition task)

### BridgeHandler.swift (ändra)

- Nya cases i `BridgeMessageType` enum
- Delegerar `startSpeechRecognition`/`stopSpeechRecognition` till SpeechRecognizer
- SpeechRecognizer callback -> `sendToWeb()` för transkript/fel

### Info.plist (ändra)

- `NSSpeechRecognitionUsageDescription`: "Equinet använder taligenkänning för att logga ditt arbete med rösten."
- `NSMicrophoneUsageDescription`: "Equinet behöver tillgång till mikrofonen för röstloggning."

## Webb-integration

### useSpeechRecognition.ts (ändra)

Hooken detekterar om den körs i native-appen (`window.isEquinetApp === true`) och byter strategi:

**Native path:**
- `startListening()` -> bridge: `startSpeechRecognition`
- `stopListening()` -> bridge: `stopSpeechRecognition`
- Lyssnar på `speechTranscript`-events via `window.equinetNative.onMessage`
- `isSupported` = `true` (SFSpeechRecognizer finns på iOS 17+)

**Web path (oförändrad):**
- Använder Web Speech API som idag
- Fallback om `window.isEquinetApp` är `false`/`undefined`

**Samma interface utåt:** `transcript`, `isListening`, `isSupported`, `startListening()`, `stopListening()`, `clearTranscript()`

## Filer

| Fil | Ändring |
|-----|---------|
| `ios/Equinet/Equinet/SpeechRecognizer.swift` | NY |
| `ios/Equinet/Equinet/BridgeHandler.swift` | Ändra (nya meddelandetyper) |
| `ios/Equinet/Info.plist` | Ändra (usage descriptions) |
| `src/hooks/useSpeechRecognition.ts` | Ändra (native bridge path) |

Ingen ändring i: API routes, domain services, UI-komponenter, wizard-flöde.

## Verifiering

### iOS (manuellt i Xcode Simulator/device)
- [ ] Tryck mikrofon i röstloggning -> permission-dialog visas
- [ ] Tal fångas och visas live i textarea (streaming)
- [ ] Stoppa -> final transkript skickas
- [ ] Hela flödet fungerar: diktera -> AI tolkar -> preview -> spara
- [ ] Felhantering: neka permission -> felmeddelande visas
- [ ] Offline: taligenkänning fungerar utan internet (on-device modell)

### Webb (befintliga tester)
- [ ] `useSpeechRecognition.test.ts` -- befintliga tester passerar
- [ ] Nytt test: native bridge path mockas och verifieras
- [ ] Typecheck: 0 errors
