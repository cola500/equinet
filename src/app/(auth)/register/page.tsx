"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator"
import { toast } from "sonner"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"

export default function RegisterPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<"customer" | "provider">("customer")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error('Kunde inte registrera efter flera försök. Kontakta support om problemet kvarstår.')
    },
  })

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      userType: "customer",
      businessName: "",
      description: "",
      city: "",
    },
  })

  const password = form.watch("password")

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          userType,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Något gick fel")
      }

      // Redirect to check-email page
      router.push("/check-email")
    } catch (error: any) {
      const errorMessage = error.message || "Något gick fel vid registrering. Kontrollera din internetanslutning."
      setError(errorMessage)
      console.error("Registration error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Skapa ett konto på Equinet
          </CardTitle>
          <CardDescription className="text-center">
            Välj kontotyp och fyll i dina uppgifter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorState
              title="Kunde inte skapa konto"
              description={error}
              onRetry={() => retry(() => form.handleSubmit(onSubmit)())}
              isRetrying={isRetrying}
              retryCount={retryCount}
              canRetry={canRetry}
              showContactSupport={retryCount >= 3}
            />
          ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* User Type Selection */}
            <div className="space-y-2">
              <Label>Jag är en</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <button
                  type="button"
                  data-testid="user-type-customer"
                  onClick={() => {
                    setUserType("customer")
                    form.setValue("userType", "customer")
                  }}
                  className={`p-4 border-2 rounded-lg transition-all min-h-[80px] ${
                    userType === "customer"
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  <div className="font-semibold">Hästägare</div>
                  <div className="text-sm text-gray-600">
                    Jag vill boka tjänster
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="user-type-provider"
                  onClick={() => {
                    setUserType("provider")
                    form.setValue("userType", "provider")
                  }}
                  className={`p-4 border-2 rounded-lg transition-all min-h-[80px] ${
                    userType === "provider"
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  <div className="font-semibold">Tjänsteleverantör</div>
                  <div className="text-sm text-gray-600">
                    Jag erbjuder tjänster
                  </div>
                </button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Förnamn *</Label>
                <Input
                  id="firstName"
                  type="text"
                  {...form.register("firstName")}
                  disabled={isLoading}
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Efternamn *</Label>
                <Input
                  id="lastName"
                  type="text"
                  {...form.register("lastName")}
                  disabled={isLoading}
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                disabled={isLoading}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Lösenord *</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.password.message}
                </p>
              )}
              <PasswordStrengthIndicator password={password || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                {...form.register("phone")}
                disabled={isLoading}
              />
            </div>

            {/* Provider-specific fields */}
            <div className={`border-t pt-4 ${userType === "provider" ? "" : "hidden"}`}>
              <h3 className="font-semibold mb-4">Företagsinformation</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Företagsnamn *</Label>
                    <Input
                      id="businessName"
                      type="text"
                      {...form.register("businessName")}
                      disabled={isLoading}
                    />
                    {form.formState.errors.businessName && (
                      <p className="text-sm text-red-600">
                        {form.formState.errors.businessName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Beskrivning</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="Berätta om dina tjänster och erfarenhet..."
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Stad</Label>
                    <Input
                      id="city"
                      type="text"
                      {...form.register("city")}
                      disabled={isLoading}
                    />
                  </div>
                </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Skapar konto..." : "Skapa konto"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Har du redan ett konto?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Logga in här
              </Link>
            </div>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
