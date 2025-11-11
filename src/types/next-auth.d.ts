import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    userType: string
    providerId?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      userType: string
      providerId?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    userType: string
    providerId?: string | null
  }
}
