/**
 * VoiceInterpretationService - Interprets transcribed speech from field workers
 *
 * Takes a voice transcript + the provider's current bookings as context,
 * and uses an LLM to extract structured data that maps to existing models:
 * - Booking.providerNotes + Booking.status
 * - HorseNote (category: farrier/veterinary/etc)
 * - Next visit suggestion
 */
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { Result } from "@/domain/shared"

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface BookingContext {
  id: string
  customerName: string
  horseName: string | null
  horseId: string | null
  serviceName: string
  startTime: string
  status: string
  horseBreed?: string | null
  horseSpecialNeeds?: string | null
  previousNotes?: string | null
}

export interface InterpretedVoiceLog {
  /** Matched booking from today's context */
  bookingId: string | null
  customerName: string | null
  horseName: string | null

  /** Should we mark this booking as completed? */
  markAsCompleted: boolean

  /** Work performed - maps to Booking.providerNotes */
  workPerformed: string | null

  /** Health observation - maps to HorseNote */
  horseObservation: string | null

  /** Category for the horse note */
  horseNoteCategory: "farrier" | "veterinary" | "general" | "medication" | null

  /** Suggestion for next visit in weeks */
  nextVisitWeeks: number | null

  /** Raw confidence score 0-1 for the booking match */
  confidence: number
}

export type VoiceLogErrorType =
  | "NO_TRANSCRIPT"
  | "NO_BOOKINGS"
  | "INTERPRETATION_FAILED"
  | "API_KEY_MISSING"

export interface VoiceLogError {
  type: VoiceLogErrorType
  message: string
}

// Runtime validation schema for LLM output
const interpretedVoiceLogSchema = z.object({
  bookingId: z.string().nullable().default(null),
  customerName: z.string().nullable().default(null),
  horseName: z.string().nullable().default(null),
  markAsCompleted: z.boolean().default(false),
  workPerformed: z.string().nullable().default(null),
  horseObservation: z.string().nullable().default(null),
  horseNoteCategory: z.enum(["farrier", "veterinary", "general", "medication"]).nullable().default(null),
  nextVisitWeeks: z.number().int().min(1).max(52).nullable().default(null),
  confidence: z.number().default(0).transform((v) => Math.max(0, Math.min(1, v))),
})

export interface VoiceInterpretationDeps {
  apiKey?: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

const BASE_SYSTEM_PROMPT = `Du är en assistent för hästtjänsteleverantörer (hovslagare, veterinärer, etc.) i Sverige.
Din uppgift är att tolka röstinspelningar från leverantörer som har utfört arbete ute i fält.

Du kommer att få en lista med dagens bokningar som kontext, plus en transkribering av vad leverantören sa.

Extrahera följande information och returnera som JSON:

{
  "bookingId": "ID:t för matchad bokning, eller null om ingen matchning",
  "customerName": "Kundens namn som nämndes",
  "horseName": "Hästens namn som nämndes",
  "markAsCompleted": true/false,
  "workPerformed": "Kort sammanfattning av utfört arbete",
  "horseObservation": "Hälsoobservationer om hästen, eller null",
  "horseNoteCategory": "farrier|veterinary|general|medication, eller null",
  "nextVisitWeeks": nummer i veckor, eller null,
  "confidence": 0.0-1.0
}

Regler:
- Matcha bokningar baserat på kundnamn och/eller hästnamn
- "Klar", "färdig", "genomförd" → markAsCompleted: true
- Hälsoobservationer separeras från utfört arbete
- horseNoteCategory baseras på tjänstetyp (hovvård → farrier, vaccination → veterinary, etc.)
- Om du inte kan matcha en bokning, sätt bookingId till null men fyll i resten
- Svara BARA med JSON, ingen annan text`

function buildSystemPrompt(vocabularyPrompt?: string): string {
  if (!vocabularyPrompt) return BASE_SYSTEM_PROMPT
  return BASE_SYSTEM_PROMPT + "\n" + vocabularyPrompt
}

/**
 * Strip markdown code block wrappers (```json ... ```) that LLMs sometimes add
 * despite being told to return raw JSON.
 */
function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith("```")) {
    // Remove opening ``` (with optional language tag) and closing ```
    return trimmed
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim()
  }
  return trimmed
}

export class VoiceInterpretationService {
  private apiKey: string | undefined

  constructor(deps?: VoiceInterpretationDeps) {
    this.apiKey = deps?.apiKey || process.env.ANTHROPIC_API_KEY
  }

  async interpret(
    transcript: string,
    todaysBookings: BookingContext[],
    vocabularyPrompt?: string
  ): Promise<Result<InterpretedVoiceLog, VoiceLogError>> {
    if (!transcript.trim()) {
      return Result.fail({
        type: "NO_TRANSCRIPT",
        message: "Ingen transkribering att tolka",
      })
    }

    if (!this.apiKey) {
      return Result.fail({
        type: "API_KEY_MISSING",
        message: "Anthropic API-nyckel saknas",
      })
    }

    const bookingList = todaysBookings.length > 0
      ? todaysBookings
          .map(
            (b) => {
              let line = `- ${b.startTime}: ${b.customerName}, häst: ${b.horseName || "ej angiven"}`
              if (b.horseBreed) line += ` (${b.horseBreed})`
              if (b.horseSpecialNeeds) line += ` [OBS: ${b.horseSpecialNeeds}]`
              line += `, tjänst: ${b.serviceName}, status: ${b.status}`
              if (b.previousNotes) line += ` [Föreg. notering: ${b.previousNotes.slice(0, 100)}]`
              line += ` [ID: ${b.id}]`
              return line
            }
          )
          .join("\n")
      : "Inga bokningar idag."

    const userMessage = `Dagens bokningar:
${bookingList}

Transkribering:
"${transcript}"`

    try {
      const client = new Anthropic({ apiKey: this.apiKey })

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: buildSystemPrompt(vocabularyPrompt),
        messages: [{ role: "user", content: userMessage }],
      })

      const content = response.content[0]
      if (content.type !== "text") {
        return Result.fail({
          type: "INTERPRETATION_FAILED",
          message: "Oväntat svar från AI",
        })
      }

      const cleanedText = stripMarkdownCodeBlock(content.text)
      const rawParsed = JSON.parse(cleanedText)
      const validated = interpretedVoiceLogSchema.safeParse(rawParsed)

      if (!validated.success) {
        return Result.fail({
          type: "INTERPRETATION_FAILED",
          message: "AI-svaret hade ogiltigt format",
        })
      }

      const result = validated.data

      // Prompt injection protection: verify bookingId exists in context
      if (result.bookingId && !todaysBookings.some((b) => b.id === result.bookingId)) {
        result.bookingId = null
      }

      // Clamp confidence to 0-1 (Zod schema handles this, but extra safety)
      return Result.ok(result as InterpretedVoiceLog)
    } catch (error) {
      return Result.fail({
        type: "INTERPRETATION_FAILED",
        message: `Kunde inte tolka röstinspelningen: ${error instanceof Error ? error.message : "Okänt fel"}`,
      })
    }
  }
}

// -----------------------------------------------------------
// Error mapping
// -----------------------------------------------------------

export function mapVoiceLogErrorToStatus(error: VoiceLogError): number {
  switch (error.type) {
    case "NO_TRANSCRIPT":
      return 400
    case "NO_BOOKINGS":
      return 400
    case "API_KEY_MISSING":
      return 503
    case "INTERPRETATION_FAILED":
      return 500
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createVoiceInterpretationService(): VoiceInterpretationService {
  return new VoiceInterpretationService()
}
