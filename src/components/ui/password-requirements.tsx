import { Check, X } from "lucide-react"

interface PasswordRequirementsProps {
  password: string
  requirements: {
    minLength: boolean
    hasUpperCase: boolean
    hasLowerCase: boolean
    hasNumber: boolean
    hasSpecialChar: boolean
  }
}

export function PasswordRequirements({ password, requirements }: PasswordRequirementsProps) {
  if (!password) return null

  const allMet = Object.values(requirements).every(Boolean)

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className="font-medium text-gray-700">Lösenordskrav:</div>
      <div className="space-y-1">
        <RequirementItem met={requirements.minLength}>
          Minst 8 tecken
        </RequirementItem>
        <RequirementItem met={requirements.hasUpperCase}>
          En stor bokstav (A-Z)
        </RequirementItem>
        <RequirementItem met={requirements.hasLowerCase}>
          En liten bokstav (a-z)
        </RequirementItem>
        <RequirementItem met={requirements.hasNumber}>
          En siffra (0-9)
        </RequirementItem>
        <RequirementItem met={requirements.hasSpecialChar}>
          Ett specialtecken (!@#$%&*)
        </RequirementItem>
      </div>
      {allMet && (
        <div className="text-green-600 font-medium flex items-center gap-1 mt-2">
          <Check className="w-4 h-4" />
          Lösenordet uppfyller alla krav!
        </div>
      )}
    </div>
  )
}

function RequirementItem({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${met ? "text-green-600" : "text-gray-500"}`}>
      {met ? (
        <Check className="w-4 h-4 flex-shrink-0" />
      ) : (
        <X className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{children}</span>
    </div>
  )
}
