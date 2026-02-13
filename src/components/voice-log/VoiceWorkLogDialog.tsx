"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { useVoiceWorkLog } from "@/hooks/useVoiceWorkLog"
import { Mic, MicOff, Send, Loader2, Check, Pencil, Plus } from "lucide-react"

interface VoiceWorkLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after successful save */
  onSuccess?: () => void
}

export function VoiceWorkLogDialog({
  open,
  onOpenChange,
  onSuccess,
}: VoiceWorkLogDialogProps) {
  const {
    transcript,
    setTranscript,
    isListening,
    isSupported,
    toggleMic,
    step,
    interpreted,
    availableBookings,
    isEditing,
    editedWork,
    editedObservation,
    setIsEditing,
    setEditedWork,
    setEditedObservation,
    handleInterpret,
    handleBookingChange,
    handleConfirm,
    handleLogNext,
    reset,
  } = useVoiceWorkLog({ onSuccess })

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isSupported ? "Röstloggning" : "Arbetslogg"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isSupported
              ? "Berätta vad du har gjort \u2014 appen tolkar och sparar åt dig."
              : "Beskriv utfört arbete \u2014 appen tolkar och sparar åt dig."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Record */}
          {(step === "record" || step === "interpret") && (
            <>
              {/* Mic button -- only shown when speech is supported */}
              {isSupported && (
                <div className="flex flex-col items-center gap-3">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={toggleMic}
                    disabled={step === "interpret"}
                    className={`w-20 h-20 rounded-full ${
                      isListening
                        ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-200"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    aria-label={isListening ? "Stoppa inspelning" : "Starta inspelning"}
                  >
                    {isListening ? (
                      <MicOff className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </Button>
                  <p className="text-sm text-gray-500" aria-live="polite">
                    {isListening
                      ? "Lyssnar... Tryck för att stoppa"
                      : "Tryck för att börja prata"}
                  </p>
                </div>
              )}

              {/* Transcript text area */}
              <div>
                <Label htmlFor="voice-transcript">
                  {isSupported ? "Transkribering" : "Beskriv utfört arbete"}
                </Label>
                <Textarea
                  id="voice-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={
                    isSupported
                      ? "Här dyker texten upp medan du pratar, eller skriv direkt..."
                      : "T.ex. 'Klar med Stella hos Anna. Verkade alla fyra. Framhovarna var uttorkade. Nästa besök om 8 veckor.'"
                  }
                  rows={4}
                  className="mt-1"
                  disabled={step === "interpret"}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {isSupported
                    ? "Du kan redigera texten innan du skickar den."
                    : "Skriv fritt \u2014 AI tolkar och sorterar informationen."}
                </p>
              </div>

              {/* Loading indicator */}
              {step === "interpret" && (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Tolkar...</span>
                </div>
              )}
            </>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && interpreted && (
            <div className="space-y-3">
              {/* Match info + booking selector */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Matchad bokning</h4>
                  {interpreted.confidence >= 0.7 ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                      Hög säkerhet
                    </span>
                  ) : interpreted.confidence >= 0.4 ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                      Medel \u2014 kontrollera valet nedan
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                      Låg \u2014 välj rätt bokning nedan
                    </span>
                  )}
                </div>

                {/* Booking selector dropdown */}
                {availableBookings.length > 0 && (
                  <div className="mb-2">
                    <Select
                      value={interpreted.bookingId || ""}
                      onValueChange={handleBookingChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Välj bokning..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBookings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.startTime} \u2014 {b.customerName}
                            {b.horseName ? ` (${b.horseName})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {interpreted.bookingId ? (
                  <div className="text-sm space-y-1">
                    {interpreted.customerName && (
                      <p>
                        <span className="text-gray-500">Kund:</span>{" "}
                        {interpreted.customerName}
                      </p>
                    )}
                    {interpreted.horseName && (
                      <p>
                        <span className="text-gray-500">Häst:</span>{" "}
                        {interpreted.horseName}
                      </p>
                    )}
                    {interpreted.markAsCompleted && (
                      <p className="text-green-600 font-medium">
                        Markeras som genomförd
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-600">
                    Ingen bokning kunde matchas. Välj en bokning i listan ovan.
                  </p>
                )}
              </div>

              {/* Work performed */}
              {(interpreted.workPerformed || isEditing) && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Utfört arbete</Label>
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Redigera
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedWork}
                      onChange={(e) => setEditedWork(e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm mt-1 p-2 bg-blue-50 rounded">
                      {interpreted.workPerformed}
                    </p>
                  )}
                </div>
              )}

              {/* Horse observation */}
              {(interpreted.horseObservation || isEditing) && (
                <div>
                  <Label>Hästnotering</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedObservation}
                      onChange={(e) => setEditedObservation(e.target.value)}
                      rows={2}
                      className="mt-1"
                      placeholder="Hälsoobservation..."
                    />
                  ) : (
                    <p className="text-sm mt-1 p-2 bg-amber-50 rounded">
                      {interpreted.horseObservation}
                      {interpreted.horseNoteCategory && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({interpreted.horseNoteCategory})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Next visit */}
              {interpreted.nextVisitWeeks && (
                <div className="text-sm p-2 bg-purple-50 rounded">
                  <span className="text-gray-500">Nästa besök:</span>{" "}
                  om {interpreted.nextVisitWeeks} veckor
                </div>
              )}
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-medium">Sparat!</p>
            </div>
          )}

          {/* Saving indicator */}
          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              <p className="text-sm text-gray-500">Sparar...</p>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter>
          {step === "record" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Avbryt
              </Button>
              <Button
                onClick={handleInterpret}
                disabled={!transcript.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                Tolka
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleLogNext}>
                Tillbaka
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!interpreted?.bookingId}
              >
                <Check className="w-4 h-4 mr-2" />
                Spara allt
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Stäng
              </Button>
              <Button onClick={handleLogNext}>
                <Plus className="w-4 h-4 mr-2" />
                Logga nästa
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
