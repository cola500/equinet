"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"

// Public demo credentials — intentionally hardcoded, not secret
const DEMO_EMAIL = "erik.jarnfot@demo.equinet.se"
const DEMO_PASSWORD = "DemoProvider123!"

export function DemoLoginButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDemoLogin = async () => {
    setIsLoading(true)
    setError("")

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      })

      if (authError) {
        setError("Kunde inte starta demo — kontakta oss om problemet kvarstår.")
        return
      }

      router.push("/provider/dashboard")
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
        {isLoading ? "Startar demo..." : "Se demo som leverantör"}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
