'use client'

import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validatePasswordRequirement } from '@/lib/validations/auth'

interface PasswordStrengthIndicatorProps {
  password: string
}

type PasswordRequirement = {
  key: 'minLength' | 'hasUppercase' | 'hasLowercase' | 'hasNumber' | 'hasSpecialChar'
  label: string
  check?: (pwd: string) => boolean
}

const requirementGroups: Array<{
  title: string
  requirements: PasswordRequirement[]
}> = [
  {
    title: 'Längd',
    requirements: [
      { key: 'minLength' as const, label: 'Minst 8 tecken' }
    ]
  },
  {
    title: 'Innehåll',
    requirements: [
      { key: 'hasUppercase' as const, label: 'Stor bokstav (A-Z)' },
      { key: 'hasLowercase' as const, label: 'Liten bokstav (a-z)' },
      { key: 'hasNumber' as const, label: 'Siffra (0-9)' },
      { key: 'hasSpecialChar' as const, label: 'Specialtecken (!@#$%&*)' }
    ]
  }
]

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const hasStartedTyping = password.length > 0

  const getRequirementState = (req: PasswordRequirement) => {
    if (!hasStartedTyping) return 'neutral'

    const isValid = req.check
      ? req.check(password)
      : validatePasswordRequirement(password, req.key)

    return isValid ? 'met' : 'unmet'
  }

  const allRequirements = requirementGroups.flatMap(g => g.requirements)
  const metCount = allRequirements.filter(r => getRequirementState(r) === 'met').length
  const allMet = metCount === allRequirements.length && hasStartedTyping

  return (
    <div className="mt-3 space-y-3 text-sm" data-testid="password-strength-indicator">
      <div className="font-medium text-gray-700">Lösenordskrav:</div>

      {/* ARIA live region */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {hasStartedTyping && `Lösenordsstyrka: ${metCount} av ${allRequirements.length} krav uppfyllda`}
      </div>

      {/* Visual groups */}
      <div role="list" aria-label="Lösenordskrav" className="space-y-3">
        {requirementGroups.map(group => (
          <div key={group.title}>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.requirements.map(req => {
                const state = getRequirementState(req)
                const Icon = state === 'met' ? CheckCircle2 :
                            state === 'neutral' ? Circle : XCircle

                const colorClass = state === 'met' ? 'text-green-600' :
                                  state === 'neutral' ? 'text-gray-400' : 'text-gray-500'

                return (
                  <div
                    key={req.key}
                    role="listitem"
                    aria-label={`${req.label}: ${state === 'met' ? 'uppfyllt' : 'ej uppfyllt'}`}
                    className={cn("flex items-center gap-2 transition-colors", colorClass)}
                    data-testid={`requirement-${req.key}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{req.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Success message */}
      {allMet && (
        <div
          role="alert"
          className="flex items-center gap-2 text-green-600 font-medium mt-2 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>Lösenordet uppfyller alla krav!</span>
        </div>
      )}
    </div>
  )
}
