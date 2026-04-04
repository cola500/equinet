"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface SessionUser {
  id: string
  email: string
  name: string
  userType: string
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
}

interface SessionContextType {
  user: SessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  status: "loading",
})

export function useSession() {
  return useContext(SessionContext)
}

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<SessionContextType["status"]>("loading")
  const supabaseRef = useRef(createSupabaseBrowserClient())

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session")
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setStatus("authenticated")
      } else {
        setUser(null)
        setStatus("unauthenticated")
      }
    } catch {
      setUser(null)
      setStatus("unauthenticated")
    }
  }, [])

  useEffect(() => {
    fetchUserProfile()

    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          fetchUserProfile()
        } else if (event === "SIGNED_OUT") {
          setUser(null)
          setStatus("unauthenticated")
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUserProfile])

  return (
    <SessionContext.Provider value={{ user, status }}>
      {children}
    </SessionContext.Provider>
  )
}
