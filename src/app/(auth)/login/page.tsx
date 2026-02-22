"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error('Kunde inte logga in efter flera försök. Kontakta support om problemet kvarstår.')
    },
  })

  // Show success toast for various states
  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Kontot har skapats! Kolla din e-post for att verifiera.", {
        duration: 5000,
      })
    }
    if (searchParams.get("verified") === "true") {
      toast.success("Din e-post har verifierats! Du kan nu logga in.", {
        duration: 5000,
      })
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === "EMAIL_NOT_VERIFIED") {
          setError("EMAIL_NOT_VERIFIED")
        } else {
          setError("Ogiltig email eller lösenord")
        }
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      setError("Något gick fel. Försök igen.")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Logga in på Equinet
          </CardTitle>
          <CardDescription className="text-center">
            Ange din email och lösenord för att logga in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && retryCount > 0 ? (
            <ErrorState
              title="Kunde inte logga in"
              description={error}
              onRetry={() => retry(async () => {
                const result = await signIn("credentials", {
                  email,
                  password,
                  redirect: false,
                })
                if (result?.error) {
                  throw new Error("Ogiltig email eller lösenord")
                }
                router.push("/dashboard")
                router.refresh()
              })}
              isRetrying={isRetrying}
              retryCount={retryCount}
              canRetry={canRetry}
              showContactSupport={retryCount >= 3}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && retryCount === 0 && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error === "EMAIL_NOT_VERIFIED" ? (
                  <div>
                    <p>Din e-post ar inte verifierad.</p>
                    <Link
                      href="/resend-verification"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Skicka nytt verifieringsmail
                    </Link>
                  </div>
                ) : (
                  error
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Lösenord</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80"
                  tabIndex={-1}
                >
                  Glömt lösenord?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Loggar in..." : "Logga in"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Har du inget konto?{" "}
              <Link
                href="/register"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Registrera dig här
              </Link>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">Laddar...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
