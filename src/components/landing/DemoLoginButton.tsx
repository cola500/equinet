"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { setDemoSessionCookie } from "@/lib/demo-session"
import { Button } from "@/components/ui/button"
import { DEMO_PERSONAS } from "./demo-personas"

interface DemoLoginButtonProps {
  /** Button text. Defaults to the provider demo wording. */
  label?: string
  /** Demo account email. Defaults to the provider demo account. */
  email?: string
  /** Demo account password. Defaults to the provider demo account. */
  password?: string
  /**
   * Where to go after sign-in. Defaults to the provider calendar (landing
   * page). Pass "/dashboard" to let it route per userType (e.g. customer → /hem).
   */
  redirectTo?: string
}

export function DemoLoginButton({
  label = "Se demo som leverantör",
  email = DEMO_PERSONAS.provider.email,
  password = DEMO_PERSONAS.provider.password,
  redirectTo = "/provider/calendar",
}: DemoLoginButtonProps = {}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDemoLogin = async () => {
    setIsLoading(true)
    setError("")

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError("Kunde inte starta demo — kontakta oss om problemet kvarstår.")
        return
      }

      // Opt this browser session into demo presentation. Set BEFORE the refresh
      // so the re-run of the server layout reads the cookie and seeds
      // DemoSessionProvider with `true`.
      setDemoSessionCookie()

      router.push(redirectTo)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        variant="outline"
        className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8 border-primary text-primary hover:bg-primary hover:text-white"
        onClick={handleDemoLogin}
        disabled={isLoading}
        type="button"
      >
        {isLoading ? "Startar demo..." : label}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
