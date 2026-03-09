"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import Link from "next/link"
import { clientLogger } from "@/lib/client-logger"

interface InviteInfo {
  stableName: string
  stableMunicipality: string | null
  email: string
  expiresAt: string
}

type PageState = "loading" | "valid" | "accepted" | "error"
type ErrorType = "expired" | "used" | "not_found" | "email_mismatch" | "generic"

function mapErrorCode(code?: string): ErrorType {
  switch (code) {
    case "TOKEN_EXPIRED": return "expired"
    case "TOKEN_USED": return "used"
    case "TOKEN_NOT_FOUND": return "not_found"
    case "EMAIL_MISMATCH": return "email_mismatch"
    default: return "generic"
  }
}

export default function StableInvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [state, setState] = useState<PageState>("loading")
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [errorType, setErrorType] = useState<ErrorType>("generic")
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/stables/invites/${token}`)
        if (res.ok) {
          const data = await res.json()
          setInvite(data)
          setState("valid")
        } else {
          const data = await res.json()
          setErrorMessage(data.error || "Inbjudan kunde inte hittas")
          setErrorType(mapErrorCode(data.code))
          setState("error")
        }
      } catch (err) {
        clientLogger.error("Failed to fetch invite", err)
        setErrorMessage("Något gick fel")
        setErrorType("generic")
        setState("error")
      }
    }

    if (token) fetchInvite()
  }, [token])

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      const res = await fetch(`/api/stables/invites/${token}/accept`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setInvite((prev) =>
          prev ? { ...prev, stableName: data.stableName } : prev
        )
        setState("accepted")
      } else {
        const data = await res.json()
        setErrorMessage(data.error || "Kunde inte acceptera inbjudan")
        setErrorType(mapErrorCode(data.code))
        setState("error")
      }
    } catch (err) {
      clientLogger.error("Failed to accept invite", err)
      setErrorMessage("Något gick fel")
      setErrorType("generic")
      setState("error")
    } finally {
      setIsAccepting(false)
    }
  }

  const callbackUrl = `/invite/stable/${token}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center space-y-4">
          {(state === "loading" || authLoading) && (
            <>
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"
                role="status"
                aria-label="Laddar..."
              />
              <p className="text-gray-500">Laddar inbjudan...</p>
            </>
          )}

          {state === "valid" && !authLoading && invite && (
            <>
              <h1 className="text-2xl font-bold">Inbjudan till stall</h1>
              <p className="text-gray-600">
                Du har blivit inbjuden till{" "}
                <strong>{invite.stableName}</strong>
                {invite.stableMunicipality && (
                  <span> i {invite.stableMunicipality}</span>
                )}
                .
              </p>
              <p className="text-sm text-gray-500">
                Genom att acceptera kan du koppla dina hästar till stallet och
                se stallets profil.
              </p>
              {invite.expiresAt && (
                <p className="text-xs text-gray-400">
                  Inbjudan går ut{" "}
                  {new Date(invite.expiresAt).toLocaleDateString("sv-SE")}
                </p>
              )}

              {isAuthenticated ? (
                <div className="pt-4 space-y-3">
                  <Button
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full"
                  >
                    {isAccepting ? "Accepterar..." : "Acceptera inbjudan"}
                  </Button>
                </div>
              ) : (
                <div className="pt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Du behöver logga in för att acceptera inbjudan.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="flex-1">
                      <Button className="w-full">
                        Logga in
                      </Button>
                    </Link>
                    <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        Skapa konto
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {state === "accepted" && invite && (
            <>
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <h1 className="text-2xl font-bold">
                Du är nu med i {invite.stableName}!
              </h1>
              <p className="text-gray-600">
                Du kan nu koppla dina hästar till stallet via deras profilsida.
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => router.push("/customer/horses")}
                  className="w-full"
                >
                  Gå till mina hästar
                </Button>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="text-red-500 text-4xl mb-2">
                <span aria-hidden="true">&#10007;</span>
              </div>
              <h1 className="text-xl font-bold">
                {errorType === "expired" ? "Inbjudan har gått ut" :
                 errorType === "used" ? "Inbjudan redan använd" :
                 errorType === "not_found" ? "Inbjudan hittades inte" :
                 errorType === "email_mismatch" ? "Fel e-postadress" :
                 "Inbjudan otillgänglig"}
              </h1>
              <p className="text-gray-600">
                {errorType === "expired"
                  ? "Be stallägaren skicka en ny inbjudan."
                  : errorType === "used"
                    ? "Inbjudan har redan använts."
                    : errorType === "email_mismatch"
                      ? "Inbjudan är skickad till en annan e-post. Logga in med rätt konto."
                      : errorMessage}
              </p>
              <div className="pt-4 space-y-2">
                {errorType === "used" && (
                  <Link href="/customer/horses">
                    <Button className="w-full">
                      Gå till mina hästar
                    </Button>
                  </Link>
                )}
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Gå till startsidan
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
