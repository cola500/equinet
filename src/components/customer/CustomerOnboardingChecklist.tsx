"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface OnboardingStatus {
  profileComplete: boolean
  hasHorses: boolean
  hasBookings: boolean
  hasReviews: boolean
  allComplete: boolean
}

interface ChecklistStep {
  key: keyof Omit<OnboardingStatus, "allComplete">
  label: string
  href: string
}

const CHECKLIST_STEPS: ChecklistStep[] = [
  { key: "profileComplete", label: "Fyll i din profil", href: "/customer/profile" },
  { key: "hasHorses", label: "Lägg till en häst", href: "/customer/horses" },
  { key: "hasBookings", label: "Gör din första bokning", href: "/providers" },
  { key: "hasReviews", label: "Lämna en recension", href: "/customer/bookings" },
]

const STORAGE_KEY = "equinet_customer_onboarding_dismissed"

export function CustomerOnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === "true") {
      setIsDismissed(true)
    }
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/customer/onboarding-status")
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Error fetching customer onboarding status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setIsDismissed(true)
  }

  if (isLoading || isDismissed || status?.allComplete) {
    return null
  }

  if (!status) {
    return null
  }

  const completedCount = CHECKLIST_STEPS.filter(step => status[step.key]).length
  const totalSteps = CHECKLIST_STEPS.length

  return (
    <Card className="border-green-200 bg-green-50/50" data-testid="customer-onboarding">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Kom igång</CardTitle>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dölj checklistan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {completedCount} av {totalSteps} klara
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {CHECKLIST_STEPS.map((step) => {
            const isComplete = status[step.key]
            return (
              <Link
                key={step.key}
                href={step.href}
                className={cn(
                  "flex items-center gap-3 p-2 -mx-2 rounded-md transition-colors",
                  isComplete
                    ? "text-gray-500"
                    : "text-gray-900 hover:bg-green-100/50"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
                <span className={cn(isComplete && "line-through")}>
                  {step.label}
                </span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
