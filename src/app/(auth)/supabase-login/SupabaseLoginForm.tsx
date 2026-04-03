"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLogger } from "@/lib/client-logger"

export function SupabaseLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.toLowerCase().includes("not confirmed")) {
          setError("EMAIL_NOT_CONFIRMED")
        } else {
          setError("Ogiltig email eller lösenord")
        }
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError("Något gick fel. Försök igen.")
      clientLogger.error("Supabase login error:", err)
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && error !== "EMAIL_NOT_CONFIRMED" && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {error === "EMAIL_NOT_CONFIRMED" && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <p>Din e-post är inte verifierad.</p>
                <Link
                  href="/resend-verification"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Skicka nytt verifieringsmail
                </Link>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="supabase-email">Email</Label>
              <Input
                id="supabase-email"
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
                <Label htmlFor="supabase-password">Lösenord</Label>
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
                  id="supabase-password"
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

            <div className="text-center text-xs text-gray-400">
              <Link href="/login" className="hover:text-gray-600">
                Använd vanlig inloggning
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
