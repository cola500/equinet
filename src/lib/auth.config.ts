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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.userType = user.userType
        token.isAdmin = user.isAdmin ?? false
        token.providerId = user.providerId
        token.stableId = user.stableId
      }
      // Support session refresh after stable creation
      if (trigger === "update" && token.id) {
        // stableId will be set via session.update() from client
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.userType = token.userType as string
        session.user.isAdmin = (token.isAdmin as boolean) ?? false
        session.user.providerId = token.providerId as string | null
        session.user.stableId = token.stableId as string | null ?? null
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtectedRoute =
        nextUrl.pathname.startsWith('/provider') ||
        nextUrl.pathname.startsWith('/customer') ||
        nextUrl.pathname.startsWith('/stable/') ||
        nextUrl.pathname === '/stable' ||
        nextUrl.pathname.startsWith('/admin') ||
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/api/admin') ||
        nextUrl.pathname.startsWith('/api/bookings') ||
        nextUrl.pathname.startsWith('/api/routes') ||
        nextUrl.pathname.startsWith('/api/route-orders') ||
        nextUrl.pathname.startsWith('/api/services') ||
        nextUrl.pathname.startsWith('/api/profile') ||
        nextUrl.pathname.startsWith('/api/provider') ||
        nextUrl.pathname.startsWith('/api/stable/')

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
