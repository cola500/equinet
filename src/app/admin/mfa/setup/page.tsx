"use client"

import { useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLogger } from "@/lib/client-logger"

type SetupStep = "start" | "qr" | "success"

export default function MfaSetupPage() {
  const [step, setStep] = useState<SetupStep>("start")
  const [qrCode, setQrCode] = useState("")
  const [secret, setSecret] = useState("")
  const [factorId, setFactorId] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const supabase = createSupabaseBrowserClient()

  async function handleEnroll() {
    setLoading(true)
    setError("")

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      })

      if (enrollError) {
        setError(enrollError.message)
        return
      }

      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep("qr")
    } catch (err) {
      clientLogger.error("MFA enrollment failed", err)
      setError("Något gick fel vid aktivering av MFA")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setLoading(true)
    setError("")

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })

      if (challengeError) {
        setError(challengeError.message)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })

      if (verifyError) {
        setError("Felaktig kod. Kontrollera din authenticator-app och försök igen.")
        return
      }

      setStep("success")
    } catch (err) {
      clientLogger.error("MFA verification failed", err)
      setError("Något gick fel vid verifiering")
    } finally {
      setLoading(false)
    }
  }

  if (step === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>MFA aktiverat</CardTitle>
            <CardDescription>
              Tvåfaktorsautentisering är nu aktiverat för ditt konto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Du kommer att behöva din authenticator-app varje gång du loggar in som admin.
            </p>
            <Button onClick={() => window.location.href = "/admin"} className="w-full">
              Gå till admin
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === "qr") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Skanna QR-koden</CardTitle>
            <CardDescription>
              Öppna din authenticator-app (Google Authenticator, Authy, etc.)
              och skanna QR-koden nedan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              {/* Render QR SVG as img data URI to avoid XSS from dangerouslySetInnerHTML */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`}
                alt="QR-kod for MFA-aktivering"
                className="w-48 h-48"
              />
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-gray-500">
                Kan du inte skanna? Skriv in koden manuellt
              </summary>
              <code className="block mt-2 p-2 bg-gray-100 rounded text-xs break-all">
                {secret}
              </code>
            </details>

            <div className="space-y-2">
              <label htmlFor="verify-code" className="text-sm font-medium">
                Ange 6-siffrig kod från appen
              </label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || loading}
              className="w-full"
            >
              {loading ? "Verifierar..." : "Verifiera och aktivera"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // step === "start"
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aktivera tvåfaktorsautentisering</CardTitle>
          <CardDescription>
            Skydda ditt admin-konto med en extra säkerhetsnivå.
            Du behöver en authenticator-app som Google Authenticator eller Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            onClick={handleEnroll}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Förbereder..." : "Börja aktivering"}
          </Button>

          <Button
            variant="outline"
            onClick={() => window.location.href = "/admin"}
            className="w-full"
            type="button"
          >
            Avbryt
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
