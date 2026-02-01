import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { logger, LogLevel, createContextLogger } from "./logger"

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Helper to parse the JSON log entry from console.log
  function getLogEntry(): Record<string, any> {
    expect(consoleLogSpy).toHaveBeenCalled()
    return JSON.parse(consoleLogSpy.mock.calls[0][0])
  }

  // --- Production mode (NODE_ENV=test, which is the default in vitest) ---
  // In non-development mode, all logs go through console.log as JSON

  describe("basic log levels (production/test mode)", () => {
    it("should log INFO level via console.log as JSON", () => {
      logger.info("Test info message")
      const entry = getLogEntry()
      expect(entry.level).toBe("INFO")
      expect(entry.message).toBe("Test info message")
    })

    it("should log ERROR level via console.log as JSON", () => {
      logger.error("Test error message")
      const entry = getLogEntry()
      expect(entry.level).toBe("ERROR")
      expect(entry.message).toBe("Test error message")
    })

    it("should log WARN level via console.log as JSON", () => {
      logger.warn("Test warn message")
      const entry = getLogEntry()
      expect(entry.level).toBe("WARN")
    })

    it("should log DEBUG level via console.log as JSON", () => {
      logger.debug("Test debug message")
      const entry = getLogEntry()
      expect(entry.level).toBe("DEBUG")
    })

    it("should include timestamp in ISO format", () => {
      logger.info("Timestamp test")
      const entry = getLogEntry()
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("should log FATAL level via console.log as JSON", () => {
      logger.fatal("Fatal error")
      const entry = getLogEntry()
      expect(entry.level).toBe("FATAL")
      expect(entry.message).toBe("Fatal error")
    })

    it("should include error details when Error object is provided", () => {
      const err = new Error("Something broke")
      logger.error("Error occurred", err)
      const entry = getLogEntry()
      expect(entry.error).toBeDefined()
      expect(entry.error.name).toBe("Error")
      expect(entry.error.message).toBe("Something broke")
      expect(entry.error.stack).toBeDefined()
    })

    it("should include context when provided", () => {
      logger.info("With context", { userId: "123", action: "login" })
      const entry = getLogEntry()
      expect(entry.context).toEqual({ userId: "123", action: "login" })
    })
  })

  // --- Development mode ---

  describe("development mode", () => {
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
      process.env.NODE_ENV = "development"
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it("should call console.info for logger.info() in development", async () => {
      // Need fresh import since NODE_ENV is checked at call time
      vi.resetModules()
      const { logger: devLogger } = await import("./logger")

      devLogger.info("Dev info")
      expect(consoleInfoSpy).toHaveBeenCalledOnce()
      expect(consoleInfoSpy.mock.calls[0][0]).toContain("INFO")
      expect(consoleInfoSpy.mock.calls[0][0]).toContain("Dev info")
    })

    it("should call console.error for logger.error() in development", async () => {
      vi.resetModules()
      const { logger: devLogger } = await import("./logger")

      devLogger.error("Dev error")
      expect(consoleErrorSpy).toHaveBeenCalledOnce()
      expect(consoleErrorSpy.mock.calls[0][0]).toContain("ERROR")
    })

    it("should call console.warn for logger.warn() in development", async () => {
      vi.resetModules()
      const { logger: devLogger } = await import("./logger")

      devLogger.warn("Dev warn")
      expect(consoleWarnSpy).toHaveBeenCalledOnce()
    })

    it("should call console.debug for logger.debug() in development", async () => {
      vi.resetModules()
      const { logger: devLogger } = await import("./logger")

      devLogger.debug("Dev debug")
      expect(consoleDebugSpy).toHaveBeenCalledOnce()
    })
  })

  // --- Specialized loggers ---

  describe("apiResponse", () => {
    it("should use ERROR level for 5xx status codes", () => {
      logger.apiResponse("GET", "/api/test", 500)
      const entry = getLogEntry()
      expect(entry.level).toBe("ERROR")
      expect(entry.message).toContain("GET /api/test - 500")
    })

    it("should use WARN level for 4xx status codes", () => {
      logger.apiResponse("POST", "/api/test", 404)
      const entry = getLogEntry()
      expect(entry.level).toBe("WARN")
    })

    it("should use INFO level for 2xx status codes", () => {
      logger.apiResponse("GET", "/api/test", 200)
      const entry = getLogEntry()
      expect(entry.level).toBe("INFO")
    })

    it("should include duration when provided", () => {
      logger.apiResponse("GET", "/api/test", 200, 42)
      const entry = getLogEntry()
      expect(entry.context.duration).toBe("42ms")
    })
  })

  describe("auth", () => {
    it("should use WARN level when success is false", () => {
      logger.auth("login_failed", "user-1", false)
      const entry = getLogEntry()
      expect(entry.level).toBe("WARN")
      expect(entry.message).toContain("Auth: login_failed")
      expect(entry.context.userId).toBe("user-1")
      expect(entry.context.success).toBe(false)
    })

    it("should use INFO level when success is true", () => {
      logger.auth("login_success", "user-1", true)
      const entry = getLogEntry()
      expect(entry.level).toBe("INFO")
    })
  })

  describe("security", () => {
    it("should use ERROR level for critical severity", () => {
      logger.security("brute_force_detected", "critical", { ip: "1.2.3.4" })
      const entry = getLogEntry()
      expect(entry.level).toBe("ERROR")
      expect(entry.message).toContain("Security: brute_force_detected")
      expect(entry.context.severity).toBe("critical")
      expect(entry.context.ip).toBe("1.2.3.4")
    })

    it("should use ERROR level for high severity", () => {
      logger.security("unauthorized_access", "high")
      const entry = getLogEntry()
      expect(entry.level).toBe("ERROR")
    })

    it("should use WARN level for medium severity", () => {
      logger.security("suspicious_activity", "medium")
      const entry = getLogEntry()
      expect(entry.level).toBe("WARN")
    })

    it("should use INFO level for low severity", () => {
      logger.security("login_attempt", "low")
      const entry = getLogEntry()
      expect(entry.level).toBe("INFO")
    })
  })

  describe("database", () => {
    it("should log at DEBUG level", () => {
      logger.database("findMany", "User", { count: 10 })
      const entry = getLogEntry()
      expect(entry.level).toBe("DEBUG")
      expect(entry.message).toContain("Database: findMany on User")
    })
  })

  // --- createContextLogger ---

  describe("createContextLogger", () => {
    it("should merge default context with per-call context", () => {
      const ctxLogger = createContextLogger({ requestId: "req-123" })
      ctxLogger.info("Test message", { extra: "data" })

      const entry = getLogEntry()
      expect(entry.context).toEqual({ requestId: "req-123", extra: "data" })
    })

    it("should allow per-call context to override default context", () => {
      const ctxLogger = createContextLogger({ env: "default" })
      ctxLogger.warn("Override test", { env: "overridden" })

      const entry = getLogEntry()
      expect(entry.context.env).toBe("overridden")
    })

    it("should work with all log levels", () => {
      const ctxLogger = createContextLogger({ source: "test" })

      ctxLogger.debug("debug msg")
      ctxLogger.info("info msg")
      ctxLogger.warn("warn msg")
      ctxLogger.error("error msg")
      ctxLogger.fatal("fatal msg")

      // In test mode, all go through console.log
      expect(consoleLogSpy).toHaveBeenCalledTimes(5)
    })
  })

  // --- Security documentation ---

  describe("security (documents current behavior)", () => {
    it("should pass context as-is without filtering sensitive fields", () => {
      logger.info("User login", { password: "secret123", email: "test@example.com" })

      const entry = getLogEntry()
      // Documents that the logger does NOT filter sensitive data
      expect(entry.context.password).toBe("secret123")
    })
  })
})
