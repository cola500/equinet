"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHECKLIST_STEPS, ONBOARDING_STORAGE_KEY } from "./OnboardingChecklist"
import type { OnboardingStatus } from "./OnboardingChecklist"

interface OnboardingWelcomeProps {
  status: Omit<OnboardingStatus, "allComplete">
  onDismiss?: () => void
}

export function OnboardingWelcome({ status, onDismiss }: OnboardingWelcomeProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const dismissedAt = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (dismissedAt) {
      const dismissedTime = Number(dismissedAt)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (!isNaN(dismissedTime) && Date.now() - dismissedTime < sevenDays) {
        setDismissed(true)
      } else {
        localStorage.removeItem(ONBOARDING_STORAGE_KEY)
      }
    }
  }, [])

  if (dismissed) return null

  const completedCount = CHECKLIST_STEPS.filter((step) => status[step.key]).length
  const totalSteps = CHECKLIST_STEPS.length

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, String(Date.now()))
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <Card className="max-w-lg mx-auto border-green-200 bg-green-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Välkommen till Equinet!</CardTitle>
        <p className="text-sm text-gray-600">
          Följ stegen nedan för att komma igång med din profil.
        </p>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{completedCount} av {totalSteps} klara</span>
          </div>
          <div
            role="progressbar"
            aria-label="Onboarding-framsteg"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            className="w-full bg-gray-200 rounded-full h-2"
          >
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {CHECKLIST_STEPS.map((step) => {
            const isComplete = status[step.key]
            return (
              <div
                key={step.key}
                data-testid={`step-${step.key}-${isComplete ? "done" : "pending"}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  isComplete
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-white hover:border-green-300"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
                <span className={cn("flex-1", isComplete && "text-gray-500")}>
                  {step.label}
                </span>
                <Link href={step.href}>
                  <Button
                    variant={isComplete ? "ghost" : "default"}
                    size="sm"
                    type="button"
                    className="min-h-[44px] sm:min-h-0"
                  >
                    {isComplete ? "Redigera" : "Starta"}
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors w-full text-center"
          type="button"
        >
          Visa dashboard ändå
        </button>
      </CardContent>
    </Card>
  )
}
