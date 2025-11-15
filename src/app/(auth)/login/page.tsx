"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error('Kunde inte logga in efter flera försök. Kontakta support om problemet kvarstår.')
    },
  })

  // Show success toast if user just registered
  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Kontot har skapats! Du kan nu logga in.", {
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
        setError("Ogiltig email eller lösenord")
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
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
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
