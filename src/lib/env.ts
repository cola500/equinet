/**
 * Environment variable validation
 *
 * Ensures all required environment variables are present and valid
 * Fails fast on startup if configuration is invalid
 */

import { z } from "zod"
import { logger } from "@/lib/logger"

/**
 * Schema for environment variables
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Supabase Auth
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),

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
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      PORT: process.env.PORT,
    })

    // Additional validation for production
    if (env.NODE_ENV === "production") {
      // Warn if using SQLite in production
      if (env.DATABASE_URL.includes("file:")) {
        logger.warn("WARNING: Using SQLite in production. Consider using PostgreSQL for better performance and reliability.")
      }
    }

    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Invalid environment variables", { issues: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) })
      logger.error("Make sure you have a .env.local file with all required variables. See .env.example for reference.")
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
