import type { DebugLogEntry } from "./db"
import { debugLog } from "./debug-logger"

export interface BugReportInput {
  description: string
  userAgent: string
  screenWidth: number
  screenHeight: number
  isStandalone: boolean
  isOnline: boolean
  isAuthenticated: boolean
  currentUrl: string
  featureFlags: Record<string, boolean>
  debugLogs: DebugLogEntry[]
}

export function generateBugReport(input: BugReportInput): string {
  const now = new Date().toISOString()
  const lines: string[] = []

  lines.push("=== EQUINET BUGGRAPPORT ===")
  lines.push(`Tid: ${now}`)
  lines.push(`Beskrivning: ${input.description}`)
  lines.push("")

  lines.push("-- Enhet --")
  lines.push(`User-Agent: ${input.userAgent}`)
  lines.push(`Skärm: ${input.screenWidth}x${input.screenHeight}`)
  lines.push(`Standalone: ${input.isStandalone ? "Ja" : "Nej"}`)
  lines.push(`Online: ${input.isOnline ? "Ja" : "Nej"}`)
  lines.push("")

  lines.push("-- Auth --")
  lines.push(`Inloggad: ${input.isAuthenticated ? "Ja" : "Nej"}`)
  lines.push("")

  lines.push("-- Sida --")
  lines.push(`URL: ${input.currentUrl}`)
  lines.push("")

  lines.push("-- Feature Flags --")
  for (const [key, value] of Object.entries(input.featureFlags)) {
    lines.push(`${key}: ${value}`)
  }
  lines.push("")

  lines.push(`-- Debug-loggar (senaste ${input.debugLogs.length}) --`)
  if (input.debugLogs.length === 0) {
    lines.push("Inga loggar")
  } else {
    for (const log of input.debugLogs) {
      const time = new Date(log.timestamp).toISOString().slice(11, 23)
      lines.push(`[${time}] [${log.category}] [${log.level}] ${log.message}`)
    }
  }
  lines.push("")
  lines.push("=== SLUT PÅ RAPPORT ===")

  return lines.join("\n")
}

export async function submitBugReport(input: BugReportInput): Promise<string> {
  const report = generateBugReport(input)

  await debugLog("bugreport", "info", "Buggrapport skapad", {
    description: input.description,
  })

  try {
    await navigator.clipboard.writeText(report)
  } catch {
    // Clipboard may not be available in all contexts
  }

  return report
}
