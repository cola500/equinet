/**
 * Structured logging utility
 *
 * Provides consistent logging across the application with different levels
 * In production, this could be extended to send logs to external services
 * like Sentry, Datadog, or CloudWatch
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Format log entry as JSON for structured logging
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry, null, process.env.NODE_ENV === "development" ? 2 : 0)
}

/**
 * Base logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  if (context) {
    entry.context = context
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  // In development, use console methods with colors
  if (process.env.NODE_ENV === "development") {
    const formattedMessage = `[${entry.timestamp}] ${level}: ${message}`

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context || "", error || "")
        break
      case LogLevel.INFO:
        console.info(formattedMessage, context || "", error || "")
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, context || "", error || "")
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage, context || "", error || "")
        break
    }
  } else {
    // In production, log as JSON
    console.log(formatLogEntry(entry))
  }
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Debug level - detailed information for debugging
   */
  debug: (message: string, context?: LogContext) => {
    log(LogLevel.DEBUG, message, context)
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, context?: LogContext) => {
    log(LogLevel.INFO, message, context)
  },

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn: (message: string, context?: LogContext) => {
    log(LogLevel.WARN, message, context)
  },

  /**
   * Error level - error messages for failures
   */
  error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) => {
    if (errorOrContext instanceof Error) {
      log(LogLevel.ERROR, message, context, errorOrContext)
    } else {
      log(LogLevel.ERROR, message, errorOrContext)
    }
  },

  /**
   * Fatal level - severe errors that cause application failure
   */
  fatal: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) => {
    if (errorOrContext instanceof Error) {
      log(LogLevel.FATAL, message, context, errorOrContext)
    } else {
      log(LogLevel.FATAL, message, errorOrContext)
    }
  },

  /**
   * Log API request
   */
  apiRequest: (method: string, path: string, context?: LogContext) => {
    log(LogLevel.INFO, `API Request: ${method} ${path}`, context)
  },

  /**
   * Log API response
   */
  apiResponse: (method: string, path: string, statusCode: number, duration?: number) => {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO
    log(level, `API Response: ${method} ${path} - ${statusCode}`, {
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
    })
  },

  /**
   * Log authentication event
   */
  auth: (event: string, userId?: string, success?: boolean, context?: LogContext) => {
    const level = success === false ? LogLevel.WARN : LogLevel.INFO
    log(level, `Auth: ${event}`, {
      userId,
      success,
      ...context,
    })
  },

  /**
   * Log database operation
   */
  database: (operation: string, model: string, context?: LogContext) => {
    log(LogLevel.DEBUG, `Database: ${operation} on ${model}`, context)
  },

  /**
   * Log security event
   */
  security: (event: string, severity: "low" | "medium" | "high" | "critical", context?: LogContext) => {
    const level =
      severity === "critical" || severity === "high" ? LogLevel.ERROR :
      severity === "medium" ? LogLevel.WARN :
      LogLevel.INFO

    log(level, `Security: ${event}`, {
      severity,
      ...context,
    })
  },
}

/**
 * Create a child logger with default context
 * Useful for adding request IDs or user IDs to all logs in a context
 */
export function createContextLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) =>
      logger.error(message, errorOrContext, { ...defaultContext, ...context }),
    fatal: (message: string, errorOrContext?: Error | LogContext, context?: LogContext) =>
      logger.fatal(message, errorOrContext, { ...defaultContext, ...context }),
  }
}
