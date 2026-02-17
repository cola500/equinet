/**
 * CustomerInsightService - Generates AI-powered insights for a provider's customer
 *
 * Takes customer booking history, notes, reviews, and horses as context,
 * and uses an LLM to generate structured insights: frequency, patterns,
 * risk flags, VIP score, and summary.
 */
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { Result } from "@/domain/shared/types/Result"

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface CustomerDataContext {
  bookings: Array<{
    bookingDate: string
    startTime: string
    status: string
    serviceName: string
    servicePrice: number
    horseName: string | null
    providerNotes: string | null
    cancellationMessage: string | null
  }>
  notes: Array<{ content: string; createdAt: string }>
  reviews: Array<{ rating: number; comment: string | null }>
  customerReviews: Array<{ rating: number; comment: string | null }>
  horses: Array<{ name: string; breed: string | null; specialNeeds: string | null }>
}

export interface CustomerMetrics {
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  noShowBookings: number
  totalSpent: number
  avgBookingIntervalDays: number | null
  lastBookingDate: string | null
  firstBookingDate: string | null
}

export interface CustomerInsight {
  frequency: string
  topServices: string[]
  patterns: string[]
  riskFlags: string[]
  vipScore: "low" | "medium" | "high"
  summary: string
  confidence: number
}

export type InsightErrorType = "NO_DATA" | "API_KEY_MISSING" | "INTERPRETATION_FAILED"

export interface InsightError {
  type: InsightErrorType
  message: string
}

// -----------------------------------------------------------
// Zod schema for LLM output validation
// -----------------------------------------------------------

const customerInsightSchema = z.object({
  frequency: z.string().default("Okänd"),
  topServices: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.slice(0, 3)),
  patterns: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.slice(0, 3)),
  riskFlags: z
    .array(z.string())
    .default([])
    .transform((arr) => arr.slice(0, 3)),
  vipScore: z.enum(["low", "medium", "high"]).default("low"),
  summary: z.string().default("Ingen sammanfattning tillgänglig"),
  confidence: z
    .number()
    .default(0)
    .transform((v) => Math.max(0, Math.min(1, v))),
})

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim()
  }
  return trimmed
}

// -----------------------------------------------------------
// System prompt
// -----------------------------------------------------------

const SYSTEM_PROMPT = `Du är en dataanalytiker för hästtjänsteleverantörer (hovslagare, veterinärer, etc.) i Sverige.
Du får kunddata (bokningshistorik, anteckningar, recensioner, hästar) och nyckeltal.

Analysera kunddatan och returnera en JSON-insikt:

{
  "frequency": "Beskrivning av bokningsfrekvens, t.ex. 'Regelbunden (var 6:e vecka)'",
  "topServices": ["Max 3 mest bokade tjänster"],
  "patterns": ["Max 3 beteendemönster, t.ex. 'Bokar alltid måndag fm'"],
  "riskFlags": ["Max 3 riskindikatorer, t.ex. '2 avbokningar senaste 3 mån'"],
  "vipScore": "low|medium|high",
  "summary": "1-2 meningar som sammanfattar kunden",
  "confidence": 0.0-1.0
}

Regler:
- VIP-score baseras på: antal bokningar, total omsättning, avboknings-/uteblivandefrekvens, recensioner
  - high: 10+ bokningar, hög omsättning, inga avbokningar/uteblivanden
  - medium: 3-9 bokningar, regelbunden
  - low: 1-2 bokningar eller hög avboknings-/uteblivandefrekvens
- Patterns: tidsval, frekvens, säsongsmönster, vilka hästar
- RiskFlags: hög avbokningsfrekvens, uteblivanden (no-show), långa intervall, negativa recensioner
- Svara BARA med JSON, ingen annan text
- Alla texter på svenska`

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class CustomerInsightService {
  private apiKey: string | undefined

  constructor(deps?: { apiKey?: string }) {
    this.apiKey = deps?.apiKey || process.env.ANTHROPIC_API_KEY
  }

  async generateInsight(
    data: CustomerDataContext,
    metrics: CustomerMetrics
  ): Promise<Result<CustomerInsight, InsightError>> {
    if (metrics.completedBookings === 0 && metrics.noShowBookings === 0) {
      return Result.fail({
        type: "NO_DATA",
        message: "Kunden har inga genomförda bokningar att analysera",
      })
    }

    if (!this.apiKey) {
      return Result.fail({
        type: "API_KEY_MISSING",
        message: "Anthropic API-nyckel saknas",
      })
    }

    const userMessage = this.buildUserMessage(data, metrics)

    try {
      const client = new Anthropic({ apiKey: this.apiKey })

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: [{ type: "text" as const, text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } }],
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
      const validated = customerInsightSchema.safeParse(rawParsed)

      if (!validated.success) {
        return Result.fail({
          type: "INTERPRETATION_FAILED",
          message: "AI-svaret hade ogiltigt format",
        })
      }

      return Result.ok(validated.data as CustomerInsight)
    } catch (error) {
      return Result.fail({
        type: "INTERPRETATION_FAILED",
        message: `Kunde inte generera kundinsikt: ${error instanceof Error ? error.message : "Okänt fel"}`,
      })
    }
  }

  private buildUserMessage(data: CustomerDataContext, metrics: CustomerMetrics): string {
    const sections: string[] = []

    // Metrics
    sections.push(`## Nyckeltal
- Totala bokningar: ${metrics.totalBookings}
- Genomförda: ${metrics.completedBookings}
- Avbokade: ${metrics.cancelledBookings}
- Uteblivna (no-show): ${metrics.noShowBookings}
- Total omsättning: ${metrics.totalSpent} kr
- Genomsnittligt intervall: ${metrics.avgBookingIntervalDays ? `${metrics.avgBookingIntervalDays} dagar` : "N/A"}
- Första bokning: ${metrics.firstBookingDate || "N/A"}
- Senaste bokning: ${metrics.lastBookingDate || "N/A"}`)

    // Bookings
    if (data.bookings.length > 0) {
      const bookingLines = data.bookings.map((b) => {
        let line = `- ${b.bookingDate} ${b.startTime}: ${b.serviceName} (${b.servicePrice} kr) - ${b.status}`
        if (b.horseName) line += `, häst: ${b.horseName}`
        if (b.providerNotes) line += ` [Anteckning: ${b.providerNotes}]`
        if (b.cancellationMessage) line += ` [Avbokning: ${b.cancellationMessage}]`
        return line
      })
      sections.push(`## Bokningar (senaste 12 mån)\n${bookingLines.join("\n")}`)
    }

    // Horses
    if (data.horses.length > 0) {
      const horseLines = data.horses.map((h) => {
        let line = `- ${h.name}`
        if (h.breed) line += ` (${h.breed})`
        if (h.specialNeeds) line += ` [Specialbehov: ${h.specialNeeds}]`
        return line
      })
      sections.push(`## Hästar\n${horseLines.join("\n")}`)
    }

    // Notes
    if (data.notes.length > 0) {
      const noteLines = data.notes.map((n) => `- ${n.createdAt}: ${n.content}`)
      sections.push(`## Leverantörsanteckningar\n${noteLines.join("\n")}`)
    }

    // Reviews
    if (data.reviews.length > 0) {
      const reviewLines = data.reviews.map(
        (r) => `- ${r.rating}/5${r.comment ? `: ${r.comment}` : ""}`
      )
      sections.push(`## Kundrecensioner (kund -> leverantör)\n${reviewLines.join("\n")}`)
    }

    if (data.customerReviews.length > 0) {
      const crLines = data.customerReviews.map(
        (r) => `- ${r.rating}/5${r.comment ? `: ${r.comment}` : ""}`
      )
      sections.push(`## Leverantörsrecensioner (leverantör -> kund)\n${crLines.join("\n")}`)
    }

    return sections.join("\n\n")
  }
}

// -----------------------------------------------------------
// Error mapping
// -----------------------------------------------------------

export function mapInsightErrorToStatus(error: InsightError): number {
  switch (error.type) {
    case "NO_DATA":
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

export function createCustomerInsightService(): CustomerInsightService {
  return new CustomerInsightService()
}
