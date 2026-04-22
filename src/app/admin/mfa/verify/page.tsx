"use client"

import { useEffect, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLogger } from "@/lib/client-logger"

export default function MfaVerifyPage() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [factorLoaded, setFactorLoaded] = useState(false)

  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    async function loadFactor() {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        clientLogger.error("Failed to list MFA factors", listError)
        setFactorLoaded(true)
        return
      }

      const verifiedFactors = (data.totp ?? []).filter(
        (f: { status: string }) => f.status === "verified"
      )
      if (verifiedFactors.length > 0) {
        setFactorId(verifiedFactors[0].id)
      }
      setFactorLoaded(true)
    }

    loadFactor()
  }, [supabase])

  async function handleVerify() {
    if (!factorId) return

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code }),
      })

      if (res.status === 429) {
        setError("För många misslyckade försök. Försök igen om 15 minuter.")
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Något gick fel vid verifiering")
        return
      }

      // MFA verified -- full page reload so Next.js + Supabase session reflects aal2
      window.location.href = "/admin"
    } catch (err) {
      clientLogger.error("MFA verify failed", err)
      setError("Något gick fel vid verifiering")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && code.length === 6 && !loading) {
      handleVerify()
    }
  }

  if (!factorId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>MFA-verifiering</CardTitle>
          </CardHeader>
          <CardContent>
            {!factorLoaded ? (
              <p className="text-sm text-gray-600">Laddar...</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Ingen MFA-faktor hittades. Du behöver aktivera tvåfaktorsautentisering först.
                </p>
                <Button onClick={() => window.location.href = "/admin/mfa/setup"} className="w-full">
                  Aktivera MFA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tvåfaktorsautentisering</CardTitle>
          <CardDescription>
            Ange den 6-siffriga koden från din authenticator-app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="mfa-code" className="text-sm font-medium">
              Verifieringskod
            </label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-center text-2xl tracking-widest"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || loading}
            className="w-full"
          >
            {loading ? "Verifierar..." : "Verifiera"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
