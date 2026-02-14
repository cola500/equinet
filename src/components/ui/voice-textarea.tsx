"use client"

import * as React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import { Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"

interface VoiceTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  id?: string
  disabled?: boolean
}

/**
 * Textarea with inline microphone button for speech-to-text.
 *
 * Progressive enhancement: if Speech API is not supported (e.g. Firefox),
 * renders a plain textarea without the mic button.
 *
 * NOTE: `onChange` takes a string, NOT a ChangeEvent.
 */
export function VoiceTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  className,
  id,
  disabled,
}: VoiceTextareaProps) {
  const {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechRecognition()

  const preRecordingValueRef = useRef("")
  const [isRecording, setIsRecording] = useState(false)

  // Sync transcript to value while recording
  useEffect(() => {
    if (isRecording && isListening) {
      const pre = preRecordingValueRef.current
      const combined = pre + (pre && transcript ? " " : "") + transcript
      if (combined !== value) {
        onChange(combined)
      }
    }
  }, [transcript, isRecording, isListening])

  // Handle recording stop (e.g. speech API auto-stops)
  useEffect(() => {
    if (isRecording && !isListening) {
      setIsRecording(false)
    }
  }, [isListening, isRecording])

  const toggleRecording = useCallback(() => {
    if (disabled) return

    if (isRecording) {
      stopListening()
      setIsRecording(false)
    } else {
      preRecordingValueRef.current = value
      clearTranscript()
      startListening()
      setIsRecording(true)
    }
  }, [isRecording, value, disabled, stopListening, clearTranscript, startListening])

  return (
    <div className="relative">
      <textarea
        data-slot="textarea"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isSupported && "pr-12",
          className
        )}
      />
      {isSupported && !disabled && (
        <button
          type="button"
          onClick={toggleRecording}
          className={cn(
            "absolute right-2 bottom-2 rounded-full p-2 transition-colors",
            isRecording
              ? "bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
              : "text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 shadow-sm bg-white"
          )}
          aria-label={isRecording ? "Stoppa inspelning" : "Starta röstinmatning"}
        >
          {isRecording ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
      )}
      {isRecording && (
        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-red-600" aria-live="polite">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          Lyssnar...
        </div>
      )}
    </div>
  )
}
