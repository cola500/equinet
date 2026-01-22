import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcrypt"
import { rateLimiters, resetRateLimit } from "./rate-limit"
import type { NextAuthConfig } from "next-auth"

// Separate config for use in middleware (can't include Prisma/bcrypt in Edge)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.userType = user.userType
        token.providerId = user.providerId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.userType = token.userType as string
        session.user.providerId = token.providerId as string | null
      }
      return session
    },
    // Authorization callback for middleware
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtectedRoute =
        nextUrl.pathname.startsWith('/provider') ||
        nextUrl.pathname.startsWith('/customer') ||
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/api/bookings') ||
        nextUrl.pathname.startsWith('/api/routes') ||
        nextUrl.pathname.startsWith('/api/route-orders') ||
        nextUrl.pathname.startsWith('/api/services') ||
        nextUrl.pathname.startsWith('/api/profile') ||
        nextUrl.pathname.startsWith('/api/provider')

      if (isProtectedRoute && !isLoggedIn) {
        return false // Redirect to login
      }
      return true
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 12 * 60 * 60, // Update session every 12 hours if active
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [], // Providers added in full config below
}

// Full config with Credentials provider (for non-Edge runtime)
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
