"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseSpeechRecognitionReturn {
  /** Current transcript text */
  transcript: string
  /** Whether recognition is currently active */
  isListening: boolean
  /** Whether the browser supports speech recognition */
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
  /** Audio level from native bridge (0.0 - 1.0) */
  audioLevel: number
  /** Confidence score from native bridge (0.0 - 1.0) */
  confidence: number | null
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

// Window augmentation for vendor-prefixed SpeechRecognition
interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
}

// Native bridge types
interface BridgeMessage {
  type: string
  payload?: Record<string, unknown>
}

// Helpers for native iOS bridge
function isNativeApp(): boolean {
  return typeof window !== "undefined" && (window as Window & { isEquinetApp?: boolean }).isEquinetApp === true
}

function sendBridgeMessage(type: string, payload?: Record<string, unknown>): void {
  const w = window as Window & {
    webkit?: { messageHandlers: { equinet: { postMessage: (msg: BridgeMessage) => void } } }
  }
  w.webkit?.messageHandlers?.equinet?.postMessage(
    payload ? { type, payload } : { type }
  )
}

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
  const [audioLevel, setAudioLevel] = useState(0)
  const [confidence, setConfidence] = useState<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Check browser support (native app OR Web Speech API)
  const isSupported =
    typeof window !== "undefined" &&
    (isNativeApp() || "SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  // Native bridge: intercept onMessage for speech events
  useEffect(() => {
    if (!isNativeApp()) return

    const w = window as Window & {
      equinetNative?: { onMessage: (msg: BridgeMessage) => void }
    }
    if (!w.equinetNative) return

    const originalHandler = w.equinetNative.onMessage

    w.equinetNative.onMessage = (message: BridgeMessage) => {
      switch (message.type) {
        case "speechRecognitionStarted":
          setIsListening(true)
          break
        case "speechTranscript":
          setTranscript((message.payload?.text as string) ?? "")
          if (message.payload?.confidence != null) {
            setConfidence(message.payload.confidence as number)
          }
          break
        case "speechAudioLevel":
          setAudioLevel((message.payload?.level as number) ?? 0)
          break
        case "speechRecognitionEnded":
          setIsListening(false)
          setAudioLevel(0)
          break
        case "speechRecognitionError": {
          const errorKey = (message.payload?.error as string) ?? "recognition_failed"
          setError(NATIVE_ERROR_MESSAGES[errorKey] ?? NATIVE_ERROR_MESSAGES.recognition_failed)
          setIsListening(false)
          setAudioLevel(0)
          break
        }
        default:
          // Delegate non-speech events to original handler
          originalHandler?.(message)
      }
    }

    return () => {
      // Restore original handler on cleanup
      if (w.equinetNative) {
        w.equinetNative.onMessage = originalHandler
      }
      sendBridgeMessage("stopSpeechRecognition")
    }
  }, [])

  const startListening = useCallback(() => {
    if (isNativeApp()) {
      setError(null)
      sendBridgeMessage("startSpeechRecognition")
      return
    }

    if (!isSupported) {
      setError("Taligenkänning stöds inte i denna webbläsare")
      return
    }

    setError(null)

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
        // Not a real error, just silence
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
  }, [isSupported])

  const stopListening = useCallback(() => {
    if (isNativeApp()) {
      sendBridgeMessage("stopSpeechRecognition")
      setIsListening(false)
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript("")
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
    error,
    audioLevel,
    confidence,
  }
}
