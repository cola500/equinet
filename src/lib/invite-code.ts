import { randomBytes } from "crypto"

/**
 * Generate a unique 8-character invite code.
 * Uses uppercase letters and digits, excluding ambiguous characters (0/O, 1/I/L).
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateInviteCode(): string {
  const bytes = randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}
