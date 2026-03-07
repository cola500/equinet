/**
 * Client-side structured logger
 *
 * Lightweight wrapper around console.* for client components.
 * Same API as server-side logger but without Prisma/Node.js dependencies.
 */

interface LogContext {
  [key: string]: unknown
}

function formatMessage(level: string, message: string): string {
  return `[${new Date().toISOString()}] ${level}: ${message}`
}

export const clientLogger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatMessage("DEBUG", message), context || "")
    }
  },

  info: (message: string, context?: LogContext) => {
    console.info(formatMessage("INFO", message), context || "")
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage("WARN", message), context || "")
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    console.error(formatMessage("ERROR", message), error || "", context || "")
  },
}
