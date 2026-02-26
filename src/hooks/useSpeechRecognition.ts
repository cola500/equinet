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

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Check browser support
  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  const startListening = useCallback(() => {
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
  }
}
