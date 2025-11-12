import { z } from "zod"

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
    .min(8, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(/[A-Z]/, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(/[a-z]/, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(/[0-9]/, "Lösenordet måste innehålla minst en siffra")
    .regex(/[^A-Za-z0-9]/, "Lösenordet måste innehålla minst ett specialtecken")
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
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  }
}
