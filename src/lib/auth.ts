import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { rateLimiters, resetRateLimit } from "./rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import type { NextAuthConfig } from "next-auth"
import { authConfig } from "./auth.config"

// Full config with Credentials provider (for Node.js runtime only)
const fullConfig: NextAuthConfig = {
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Ogiltig email eller lösenord")
        }

        // Rate limiting - 5 attempts per 15 minutes per email
        const identifier = (credentials.email as string).toLowerCase()
        const isAllowed = await rateLimiters.login(identifier)
        if (!isAllowed) {
          throw new Error("För många inloggningsförsök. Försök igen om 15 minuter.")
        }

        const service = createAuthService()
        const result = await service.verifyCredentials(
          credentials.email as string,
          credentials.password as string
        )

        if (result.isFailure) {
          throw new Error(result.error.message)
        }

        // Reset rate limit on successful login
        await resetRateLimit(identifier)

        return result.value
      }
    })
  ],
}

export const { handlers, signIn, signOut, auth } = NextAuth(fullConfig)

// Re-export authConfig for backward compatibility
export { authConfig }
