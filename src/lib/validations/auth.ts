import { z } from "zod"

/**
 * Password requirements configuration
 */
export const passwordRequirements = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[^A-Za-z0-9]/,
} as const

/**
 * Common weak passwords to block
 * In production, you could use a more comprehensive list or API like Have I Been Pwned
 */
const COMMON_PASSWORDS = [
  "password",
  "12345678",
  "123456789",
  "qwerty123",
  "password123",
  "admin123",
  "welcome123",
  "abc123456",
]

/**
 * Custom password validation
 */
function validatePassword(password: string): boolean {
  // Check for common passwords (case-insensitive)
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return false
  }

  // Check for repeating characters (e.g., "aaaaaa")
  if (/(.)\1{5,}/.test(password)) {
    return false
  }

  // Check for simple sequences (e.g., "123456", "abcdef")
  const sequences = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl"]
  for (const seq of sequences) {
    if (
      seq.includes(password.toLowerCase()) ||
      seq.split("").reverse().join("").includes(password.toLowerCase())
    ) {
      return false
    }
  }

  return true
}

// Shared registration schema that can be used on both client and server
export const registerSchema = z.object({
  email: z.string().email("Ogiltig email"),
  password: z.string()
    .min(passwordRequirements.minLength, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(passwordRequirements.hasUppercase, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(passwordRequirements.hasLowercase, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(passwordRequirements.hasNumber, "Lösenordet måste innehålla minst en siffra")
    .regex(passwordRequirements.hasSpecialChar, "Lösenordet måste innehålla minst ett specialtecken")
    .refine(validatePassword, {
      message: "Lösenordet är för svagt. Undvik vanliga lösenord, upprepningar och sekvenser.",
    }),
  firstName: z.string().min(1, "Förnamn krävs"),
  lastName: z.string().min(1, "Efternamn krävs"),
  phone: z.string().optional(),
  userType: z.enum(["customer", "provider"], {
    message: "Användartyp måste vara 'customer' eller 'provider'"
  }),
  // Provider-specifika fält (endast om userType är 'provider')
  businessName: z.string().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
}).strict()

export type RegisterInput = z.infer<typeof registerSchema>

// Helper function to check individual password requirements
export function checkPasswordRequirements(password: string) {
  return {
    minLength: password.length >= passwordRequirements.minLength,
    hasUpperCase: passwordRequirements.hasUppercase.test(password),
    hasLowerCase: passwordRequirements.hasLowercase.test(password),
    hasNumber: passwordRequirements.hasNumber.test(password),
    hasSpecialChar: passwordRequirements.hasSpecialChar.test(password),
  }
}

/**
 * Helper to validate a single password requirement
 * Used by the PasswordStrengthIndicator component
 */
export function validatePasswordRequirement(
  password: string,
  requirement: keyof typeof passwordRequirements
): boolean {
  switch (requirement) {
    case 'minLength':
      return password.length >= passwordRequirements.minLength
    case 'hasUppercase':
      return passwordRequirements.hasUppercase.test(password)
    case 'hasLowercase':
      return passwordRequirements.hasLowercase.test(password)
    case 'hasNumber':
      return passwordRequirements.hasNumber.test(password)
    case 'hasSpecialChar':
      return passwordRequirements.hasSpecialChar.test(password)
    default:
      return false
  }
}
