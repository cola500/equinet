"use client"

import { createContext, useContext } from "react"

/**
 * Per-session demo presentation signal, seeded server-side from the demo cookie
 * (see demo-session-server.ts) and exposed to client components.
 *
 * The value is fixed for the lifetime of a rendered tree: a demo session is
 * entered via a demo-login button (which sets the cookie and calls
 * router.refresh(), re-running the layout with a fresh value) and left via
 * logout (a full navigation). There is therefore no client-side mutation — the
 * context value follows the server prop directly, which keeps SSR and hydration
 * in agreement (no useState that could go stale against a changed prop).
 */
const DemoSessionContext = createContext<boolean>(false)

interface DemoSessionProviderProps {
  initialDemoSession: boolean
  children: React.ReactNode
}

export function DemoSessionProvider({
  initialDemoSession,
  children,
}: DemoSessionProviderProps) {
  return (
    <DemoSessionContext.Provider value={initialDemoSession}>
      {children}
    </DemoSessionContext.Provider>
  )
}

/** True when the current browser session entered through a demo-login button. */
export function useDemoSession(): boolean {
  return useContext(DemoSessionContext)
}
