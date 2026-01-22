import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcrypt"
import { rateLimiters, resetRateLimit } from "./rate-limit"
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

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          },
          include: {
            provider: true
          }
        })

        if (!user || !user.passwordHash) {
          throw new Error("Ogiltig email eller lösenord")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error("Ogiltig email eller lösenord")
        }

        // Reset rate limit on successful login
        resetRateLimit(identifier)

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          userType: user.userType,
          providerId: user.provider?.id || null
        }
      }
    })
  ],
}

export const { handlers, signIn, signOut, auth } = NextAuth(fullConfig)

// Re-export authConfig for backward compatibility
export { authConfig }
