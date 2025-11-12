/**
 * Environment variable validation
 *
 * Ensures all required environment variables are present and valid
 * Fails fast on startup if configuration is invalid
 */

import { z } from "zod"

/**
 * Schema for environment variables
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // NextAuth
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters for security"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),

  // Optional: Port (for custom deployments)
  PORT: z.string().optional(),
})

/**
 * Parsed and validated environment variables
 */
export type Env = z.infer<typeof envSchema>

/**
 * Validate environment variables
 * Throws error if validation fails - application should not start with invalid config
 */
function validateEnv(): Env {
  try {
    const env = envSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      PORT: process.env.PORT,
    })

    // Additional validation for production
    if (env.NODE_ENV === "production") {
      // Ensure HTTPS in production
      if (env.NEXTAUTH_URL && !env.NEXTAUTH_URL.startsWith("https://")) {
        console.warn(
          "⚠️  WARNING: NEXTAUTH_URL should use HTTPS in production for security"
        )
      }

      // Ensure strong secret in production
      if (env.NEXTAUTH_SECRET.length < 64) {
        console.warn(
          "⚠️  WARNING: NEXTAUTH_SECRET should be at least 64 characters in production for enhanced security"
        )
      }

      // Warn if using SQLite in production
      if (env.DATABASE_URL.includes("file:")) {
        console.warn(
          "⚠️  WARNING: Using SQLite in production. Consider using PostgreSQL for better performance and reliability."
        )
      }
    }

    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:")
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`)
      })
      console.error("\n💡 Make sure you have a .env.local file with all required variables.")
      console.error("See .env.example for reference.\n")
    }
    throw new Error("Environment validation failed")
  }
}

/**
 * Validated environment variables
 * Import this instead of process.env for type safety
 */
export const env = validateEnv()

/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === "development"

/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === "production"

/**
 * Check if running in test
 */
export const isTest = env.NODE_ENV === "test"
