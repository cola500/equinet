import type { NextAuthConfig } from "next-auth"

/**
 * Edge-compatible auth config.
 * This file MUST NOT import Prisma, bcrypt, or other Node.js-only modules.
 * Used by middleware which runs in Edge runtime.
 */
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
        return false
      }
      return true
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 12 * 60 * 60,
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
  providers: [], // Providers added in auth.ts (Node.js runtime)
}
