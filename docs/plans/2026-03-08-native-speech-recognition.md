---
title: "Native röstloggning via bridge -- Implementationsplan"
description: "Steg-för-steg plan för att integrera iOS SFSpeechRecognizer med webbappens röstloggning via native-web bridge"
category: plan
status: active
last_updated: 2026-03-08
tags: [ios, voice-logging, speech-recognition, bridge]
depends_on: [2026-03-08-native-speech-recognition-design.md]
sections:
  - Overview
  - Tasks
---

# Native röstloggning via bridge -- Implementationsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ersätt Web Speech API med native iOS SFSpeechRecognizer i iOS-appen, via bridge, så att röstloggning fungerar pålitligt på iOS.

**Architecture:** Bridge-only approach. Webappen skickar `startSpeechRecognition` via bridge, Swift startar `SFSpeechRecognizer` och streamar transkript tillbaka via `speechTranscript`-events. Webbappens befintliga wizard (AI-tolkning, preview, spara) är oförändrad.

**Tech Stack:** Swift/SFSpeechRecognizer + AVAudioEngine (iOS), TypeScript/React hooks (webb), WKScriptMessageHandler (bridge)

---

## Task 1: SpeechRecognizer.swift -- Native taligenkänning

**Files:**
- Create: `ios/Equinet/Equinet/SpeechRecognizer.swift`

**Step 1: Skapa SpeechRecognizer-klassen**

```swift
//
//  SpeechRecognizer.swift
//  Equinet
//
//  Wraps SFSpeechRecognizer + AVAudioEngine for streaming speech-to-text.
//  Communicates results back via a callback closure.
//

import Foundation
import Speech
import AVFoundation

@MainActor
final class SpeechRecognizer {

    enum RecognitionError: String {
        case notAvailable = "not_available"
        case permissionDenied = "permission_denied"
        case audioEngineError = "audio_engine_error"
        case recognitionFailed = "recognition_failed"
    }

    // Callbacks -- set by BridgeHandler
    var onStarted: (() -> Void)?
    var onTranscript: ((_ text: String, _ isFinal: Bool) -> Void)?
    var onEnded: ((_ reason: String) -> Void)?
    var onError: ((_ error: RecognitionError) -> Void)?

    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var silenceTimer: Timer?
    private let silenceTimeout: TimeInterval = 30.0

    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "sv-SE"))
    }

    // MARK: - Public API

    func start() {
        // Request permissions first
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                switch status {
                case .authorized:
                    self?.requestMicrophoneAndStart()
                case .denied, .restricted:
                    self?.onError?(.permissionDenied)
                case .notDetermined:
                    self?.onError?(.permissionDenied)
                @unknown default:
                    self?.onError?(.permissionDenied)
                }
            }
        }
    }

    func stop() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        recognitionRequest?.endAudio()
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
    }

    // MARK: - Private

    private func requestMicrophoneAndStart() {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            Task { @MainActor in
                if granted {
                    self?.startRecognition()
                } else {
                    self?.onError?(.permissionDenied)
                }
            }
        }
    }

    private func startRecognition() {
        guard let recognizer, recognizer.isAvailable else {
            onError?(.notAvailable)
            return
        }

        // Clean up any previous session
        stop()

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        // Prefer on-device recognition (offline support)
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        self.recognitionRequest = request

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            onError?(.audioEngineError)
            return
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        do {
            try audioEngine.start()
        } catch {
            onError?(.audioEngineError)
            return
        }

        onStarted?()
        resetSilenceTimer()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }

                if let result {
                    let text = result.bestTranscription.formattedString
                    let isFinal = result.isFinal
                    self.onTranscript?(text, isFinal)
                    self.resetSilenceTimer()

                    if isFinal {
                        self.stop()
                        self.onEnded?("final")
                    }
                }

                if let error {
                    let nsError = error as NSError
                    // Error code 1 = "no speech detected" -- not a real error
                    if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 1 {
                        self.stop()
                        self.onEnded?("silence")
                        return
                    }
                    print("[SpeechRecognizer] Error: \(error.localizedDescription)")
                    self.stop()
                    self.onError?(.recognitionFailed)
                }
            }
        }
    }

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: silenceTimeout, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.stop()
                self?.onEnded?("timeout")
            }
        }
    }
}
```

**Step 2: Verifiera att filen kompilerar**

Bygg i Xcode (Cmd+B). Inga kompileringsfel.

**Step 3: Commit**

```bash
git add ios/Equinet/Equinet/SpeechRecognizer.swift
git commit -m "feat: add SpeechRecognizer wrapper for iOS native speech-to-text"
```

---

## Task 2: BridgeHandler -- Nya meddelandetyper för tal

**Files:**
- Modify: `ios/Equinet/Equinet/BridgeHandler.swift`

**Step 1: Lägg till nya meddelandetyper i enum**

Lägg till efter `appDidEnterBackground`:

```swift
    case startSpeechRecognition = "startSpeechRecognition"
    case stopSpeechRecognition = "stopSpeechRecognition"
    case speechRecognitionStarted = "speechRecognitionStarted"
    case speechTranscript = "speechTranscript"
    case speechRecognitionEnded = "speechRecognitionEnded"
    case speechRecognitionError = "speechRecognitionError"
```

**Step 2: Lägg till SpeechRecognizer-property och setup-metod**

Lägg till i BridgeHandler-klassen:

```swift
    private let speechRecognizer = SpeechRecognizer()

    func setupSpeechCallbacks() {
        speechRecognizer.onStarted = { [weak self] in
            self?.sendToWeb(type: .speechRecognitionStarted)
        }

        speechRecognizer.onTranscript = { [weak self] text, isFinal in
            self?.sendToWeb(type: .speechTranscript, payload: [
                "text": text,
                "isFinal": isFinal,
            ])
        }

        speechRecognizer.onEnded = { [weak self] reason in
            self?.sendToWeb(type: .speechRecognitionEnded, payload: ["reason": reason])
        }

        speechRecognizer.onError = { [weak self] error in
            self?.sendToWeb(type: .speechRecognitionError, payload: ["error": error.rawValue])
        }
    }
```

**Step 3: Hantera inkommande meddelanden**

Uppdatera `handleMessage` switch:

```swift
        case BridgeMessageType.startSpeechRecognition.rawValue:
            speechRecognizer.start()
        case BridgeMessageType.stopSpeechRecognition.rawValue:
            speechRecognizer.stop()
```

**Step 4: Anropa setupSpeechCallbacks i attach**

I `attach(to:)` lägg till:

```swift
    func attach(to webView: WKWebView) {
        self.webView = webView
        setupSpeechCallbacks()
    }
```

**Step 5: Bygg i Xcode (Cmd+B), verifiera inga fel**

**Step 6: Commit**

```bash
git add ios/Equinet/Equinet/BridgeHandler.swift
git commit -m "feat: add speech recognition bridge messages"
```

---

## Task 3: Info.plist -- Privacy descriptions

**Files:**
- Modify: `ios/Equinet/Info.plist`

**Step 1: Lägg till mikrofon och taligenkänning-descriptions**

Lägg till före `</dict>` (slutet av filen):

```xml
	<key>NSSpeechRecognitionUsageDescription</key>
	<string>Equinet använder taligenkänning för att logga ditt arbete med rösten.</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>Equinet behöver tillgång till mikrofonen för röstloggning.</string>
```

**Step 2: Bygg i Xcode, verifiera inga fel**

**Step 3: Commit**

```bash
git add ios/Equinet/Info.plist
git commit -m "feat: add microphone and speech recognition privacy descriptions"
```

---

## Task 4: useSpeechRecognition.ts -- Native bridge path

**Files:**
- Modify: `src/hooks/useSpeechRecognition.ts`
- Create: `src/hooks/useSpeechRecognition.test.ts`

**Step 1: Skriv test för native bridge path**

```typescript
// src/hooks/useSpeechRecognition.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSpeechRecognition } from "./useSpeechRecognition"

// Mock window.isEquinetApp and bridge
function setupNativeBridge() {
  ;(window as Record<string, unknown>).isEquinetApp = true

  const postMessage = vi.fn()
  ;(window as Record<string, unknown>).webkit = {
    messageHandlers: {
      equinet: { postMessage },
    },
  }
  ;(window as Record<string, unknown>).equinetNative = {
    onMessage: vi.fn(),
  }

  return { postMessage }
}

function cleanupNativeBridge() {
  delete (window as Record<string, unknown>).isEquinetApp
  delete (window as Record<string, unknown>).webkit
  delete (window as Record<string, unknown>).equinetNative
}

describe("useSpeechRecognition", () => {
  describe("native bridge path", () => {
    let bridge: { postMessage: ReturnType<typeof vi.fn> }

    beforeEach(() => {
      bridge = setupNativeBridge()
    })

    afterEach(() => {
      cleanupNativeBridge()
    })

    it("reports isSupported as true in native app", () => {
      const { result } = renderHook(() => useSpeechRecognition())
      expect(result.current.isSupported).toBe(true)
    })

    it("sends startSpeechRecognition via bridge on startListening", () => {
      const { result } = renderHook(() => useSpeechRecognition())

      act(() => {
        result.current.startListening()
      })

      expect(bridge.postMessage).toHaveBeenCalledWith({
        type: "startSpeechRecognition",
        payload: { language: "sv-SE" },
      })
    })

    it("sends stopSpeechRecognition via bridge on stopListening", () => {
      const { result } = renderHook(() => useSpeechRecognition())

      act(() => {
        result.current.startListening()
      })

      act(() => {
        result.current.stopListening()
      })

      expect(bridge.postMessage).toHaveBeenCalledWith({
        type: "stopSpeechRecognition",
      })
    })

    it("updates transcript on speechTranscript bridge event", () => {
      const { result } = renderHook(() => useSpeechRecognition())

      act(() => {
        result.current.startListening()
      })

      // Simulate bridge sending transcript
      act(() => {
        const handler = (window as Record<string, unknown>)
          .equinetNative as Record<string, unknown>
        const onMessage = handler.onMessage as (msg: Record<string, unknown>) => void
        onMessage({
          type: "speechTranscript",
          payload: { text: "Hej detta är ett test", isFinal: false },
        })
      })

      expect(result.current.transcript).toBe("Hej detta är ett test")
    })

    it("sets isListening to false on speechRecognitionEnded", () => {
      const { result } = renderHook(() => useSpeechRecognition())

      act(() => {
        result.current.startListening()
      })

      // Simulate started event
      act(() => {
        const handler = (window as Record<string, unknown>)
          .equinetNative as Record<string, unknown>
        const onMessage = handler.onMessage as (msg: Record<string, unknown>) => void
        onMessage({ type: "speechRecognitionStarted" })
      })

      expect(result.current.isListening).toBe(true)

      act(() => {
        const handler = (window as Record<string, unknown>)
          .equinetNative as Record<string, unknown>
        const onMessage = handler.onMessage as (msg: Record<string, unknown>) => void
        onMessage({
          type: "speechRecognitionEnded",
          payload: { reason: "user" },
        })
      })

      expect(result.current.isListening).toBe(false)
    })

    it("sets error on speechRecognitionError", () => {
      const { result } = renderHook(() => useSpeechRecognition())

      act(() => {
        result.current.startListening()
      })

      act(() => {
        const handler = (window as Record<string, unknown>)
          .equinetNative as Record<string, unknown>
        const onMessage = handler.onMessage as (msg: Record<string, unknown>) => void
        onMessage({
          type: "speechRecognitionError",
          payload: { error: "permission_denied" },
        })
      })

      expect(result.current.error).toBe(
        "Taligenkänning nekades. Ge tillåtelse i Inställningar."
      )
      expect(result.current.isListening).toBe(false)
    })
  })

  describe("web speech API path", () => {
    it("reports isSupported based on browser API", () => {
      // No isEquinetApp set, no SpeechRecognition -- should be false
      const { result } = renderHook(() => useSpeechRecognition())
      expect(result.current.isSupported).toBe(false)
    })
  })
})
```

**Step 2: Kör testerna -- verifiera att de FAILAR (RED)**

```bash
npm run test:run -- --reporter=dot src/hooks/useSpeechRecognition.test.ts 2>&1 | tail -20
```

Förväntat: FAIL (funktionaliteten finns inte ännu)

**Step 3: Implementera native bridge path i hooken**

Ersätt hela `src/hooks/useSpeechRecognition.ts` med:

```typescript
"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseSpeechRecognitionReturn {
  /** Current transcript text */
  transcript: string
  /** Whether recognition is currently active */
  isListening: boolean
  /** Whether speech recognition is supported */
  isSupported: boolean
  /** Start listening */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Clear transcript */
  clearTranscript: () => void
  /** Set transcript manually */
  setTranscript: (text: string) => void
  /** Error message if any */
  error: string | null
}

// SpeechRecognition instance interface (Web Speech API)
interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
}

// -- Native bridge types --

interface NativeBridgeMessage {
  type: string
  payload?: Record<string, unknown>
}

function isNativeApp(): boolean {
  return typeof window !== "undefined" && (window as Record<string, unknown>).isEquinetApp === true
}

function sendBridgeMessage(type: string, payload?: Record<string, unknown>): void {
  const webkit = (window as Record<string, unknown>).webkit as
    | { messageHandlers?: { equinet?: { postMessage: (msg: unknown) => void } } }
    | undefined
  const msg = payload ? { type, payload } : { type }
  webkit?.messageHandlers?.equinet?.postMessage(msg)
}

// Error messages in Swedish
const NATIVE_ERROR_MESSAGES: Record<string, string> = {
  permission_denied: "Taligenkänning nekades. Ge tillåtelse i Inställningar.",
  not_available: "Taligenkänning är inte tillgänglig på denna enhet.",
  audio_engine_error: "Kunde inte starta mikrofonen.",
  recognition_failed: "Taligenkänningen misslyckades. Försök igen.",
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isNative = isNativeApp()

  // Support: native app always supported, web checks browser API
  const isSupported =
    isNative ||
    (typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window))

  // -- Native bridge message handler --

  useEffect(() => {
    if (!isNative) return

    const originalOnMessage = (
      (window as Record<string, unknown>).equinetNative as Record<string, unknown> | undefined
    )?.onMessage

    const handler = (msg: NativeBridgeMessage) => {
      switch (msg.type) {
        case "speechRecognitionStarted":
          setIsListening(true)
          break
        case "speechTranscript": {
          const text = msg.payload?.text as string
          if (text) {
            setTranscript(text)
          }
          break
        }
        case "speechRecognitionEnded":
          setIsListening(false)
          break
        case "speechRecognitionError": {
          const errorCode = (msg.payload?.error as string) || "recognition_failed"
          setError(NATIVE_ERROR_MESSAGES[errorCode] || `Fel: ${errorCode}`)
          setIsListening(false)
          break
        }
      }

      // Call original handler for non-speech messages
      if (typeof originalOnMessage === "function") {
        originalOnMessage(msg)
      }
    }

    // Override onMessage to intercept speech events
    const equinetNative = (window as Record<string, unknown>).equinetNative as Record<
      string,
      unknown
    >
    equinetNative.onMessage = handler

    return () => {
      // Restore original handler
      equinetNative.onMessage = originalOnMessage
    }
  }, [isNative])

  // -- Start listening --

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Taligenkänning stöds inte i denna webbläsare")
      return
    }

    setError(null)

    // Native path: send bridge message
    if (isNative) {
      sendBridgeMessage("startSpeechRecognition", { language: "sv-SE" })
      return
    }

    // Web Speech API path (unchanged)
    const w = window as unknown as WindowWithSpeechRecognition
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("Taligenkänning stöds inte i denna webbläsare")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "sv-SE"
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let _interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          _interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => (prev ? prev + " " + finalTranscript : finalTranscript))
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        return
      }
      setError(`Fel vid taligenkänning: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, isNative])

  // -- Stop listening --

  const stopListening = useCallback(() => {
    if (isNative) {
      sendBridgeMessage("stopSpeechRecognition")
      setIsListening(false)
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [isNative])

  const clearTranscript = useCallback(() => {
    setTranscript("")
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNative) {
        sendBridgeMessage("stopSpeechRecognition")
      } else if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isNative])

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
    error,
  }
}
```

**Step 4: Kör testerna -- verifiera att de PASSERAR (GREEN)**

```bash
npm run test:run -- --reporter=dot src/hooks/useSpeechRecognition.test.ts 2>&1 | tail -20
```

**Step 5: Kör typecheck**

```bash
npm run typecheck 2>&1
```

**Step 6: Commit**

```bash
git add src/hooks/useSpeechRecognition.ts src/hooks/useSpeechRecognition.test.ts
git commit -m "feat: add native speech recognition bridge path in useSpeechRecognition hook"
```

---

## Task 5: Slutverifiering

**Step 1: Full test suite**

```bash
npm run test:run -- --reporter=dot 2>&1 | tail -10
```

Alla 3063+ tester ska passera.

**Step 2: Typecheck + lint + swedish**

```bash
npm run typecheck 2>&1
npm run lint 2>&1
npm run check:swedish 2>&1
```

**Step 3: Xcode-build**

Bygg iOS-appen i Xcode (Cmd+B). Verifiera inga kompileringsfel.

**Step 4: Manuellt test i Simulator/device**

- [ ] Öppna röstloggning i appen
- [ ] Tryck mikrofon -> permission-dialog visas (mikrofon + taligenkänning)
- [ ] Tala -> transkript visas live i textarea
- [ ] Stoppa -> final transkript skickas
- [ ] Resten av wizard fungerar (AI-tolkning, preview, spara)
- [ ] Neka permission -> felmeddelande visas i UI

**OBS:** SFSpeechRecognizer fungerar inte i Simulator -- kräver fysisk enhet för fullständigt test. I Simulator verifierar vi att bridge-meddelandena skickas korrekt (synligt i Xcode console).
