import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSpeechRecognition } from "./useSpeechRecognition"

// Type augmentation for test globals
declare global {
  interface Window {
    isEquinetApp?: boolean
    equinetNative?: {
      onMessage: (message: { type: string; payload?: Record<string, unknown> }) => void
    }
    webkit?: {
      messageHandlers: {
        equinet: {
          postMessage: (message: { type: string; payload?: Record<string, unknown> }) => void
        }
      }
    }
  }
}

function setupNativeBridge() {
  ;(window as Window).isEquinetApp = true
  ;(window as Window).webkit = {
    messageHandlers: {
      equinet: {
        postMessage: vi.fn(),
      },
    },
  }
  ;(window as Window).equinetNative = {
    onMessage: vi.fn(),
  }
}

function cleanupNativeBridge() {
  delete (window as Window).isEquinetApp
  delete (window as Window).webkit
  delete (window as Window).equinetNative
}

describe("useSpeechRecognition - native bridge", () => {
  beforeEach(() => {
    setupNativeBridge()
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

    expect(window.webkit!.messageHandlers.equinet.postMessage).toHaveBeenCalledWith({
      type: "startSpeechRecognition",
    })
  })

  it("sends stopSpeechRecognition via bridge on stopListening", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      result.current.stopListening()
    })

    expect(window.webkit!.messageHandlers.equinet.postMessage).toHaveBeenCalledWith({
      type: "stopSpeechRecognition",
    })
  })

  it("updates transcript on speechTranscript bridge event", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      window.equinetNative!.onMessage({
        type: "speechTranscript",
        payload: { text: "Hej hästskötare" },
      })
    })

    expect(result.current.transcript).toBe("Hej hästskötare")
  })

  it("extracts confidence from speechTranscript payload", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      window.equinetNative!.onMessage({
        type: "speechTranscript",
        payload: { text: "Hovvård klar", isFinal: true, confidence: 0.92 },
      })
    })

    expect(result.current.confidence).toBe(0.92)
  })

  it("updates audioLevel on speechAudioLevel bridge event", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    expect(result.current.audioLevel).toBe(0)

    act(() => {
      window.equinetNative!.onMessage({
        type: "speechAudioLevel",
        payload: { level: 0.75 },
      })
    })

    expect(result.current.audioLevel).toBe(0.75)
  })

  it("resets audioLevel to 0 when recognition ends", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      window.equinetNative!.onMessage({
        type: "speechAudioLevel",
        payload: { level: 0.5 },
      })
    })
    expect(result.current.audioLevel).toBe(0.5)

    act(() => {
      window.equinetNative!.onMessage({ type: "speechRecognitionEnded" })
    })
    expect(result.current.audioLevel).toBe(0)
  })

  it("sets isListening on speechRecognitionStarted/Ended events", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    expect(result.current.isListening).toBe(false)

    act(() => {
      window.equinetNative!.onMessage({ type: "speechRecognitionStarted" })
    })

    expect(result.current.isListening).toBe(true)

    act(() => {
      window.equinetNative!.onMessage({ type: "speechRecognitionEnded" })
    })

    expect(result.current.isListening).toBe(false)
  })

  it("sets error on speechRecognitionError event", () => {
    const { result } = renderHook(() => useSpeechRecognition())

    act(() => {
      window.equinetNative!.onMessage({
        type: "speechRecognitionError",
        payload: { error: "permission_denied" },
      })
    })

    expect(result.current.error).toBe(
      "Taligenkänning nekades. Ge tillåtelse i Inställningar."
    )
    expect(result.current.isListening).toBe(false)
  })

  it("delegates non-speech events to original onMessage handler", () => {
    const originalHandler = vi.fn()
    window.equinetNative!.onMessage = originalHandler

    renderHook(() => useSpeechRecognition())

    act(() => {
      window.equinetNative!.onMessage({
        type: "someOtherEvent",
        payload: { data: "test" },
      })
    })

    expect(originalHandler).toHaveBeenCalledWith({
      type: "someOtherEvent",
      payload: { data: "test" },
    })
  })

  it("sends stopSpeechRecognition on unmount", () => {
    const { unmount } = renderHook(() => useSpeechRecognition())

    unmount()

    expect(window.webkit!.messageHandlers.equinet.postMessage).toHaveBeenCalledWith({
      type: "stopSpeechRecognition",
    })
  })
})

describe("useSpeechRecognition - no support", () => {
  it("reports isSupported as false when no web speech API and not native", () => {
    // Ensure no native bridge and no Web Speech API
    cleanupNativeBridge()
    const { result } = renderHook(() => useSpeechRecognition())
    expect(result.current.isSupported).toBe(false)
  })
})
