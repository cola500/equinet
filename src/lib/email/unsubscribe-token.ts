import { createHmac } from "crypto"

const PREFIX = "unsubscribe:"

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured")
  return secret
}

export function generateUnsubscribeToken(userId: string): string {
  return createHmac("sha256", getSecret())
    .update(PREFIX + userId)
    .digest("hex")
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId)
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return result === 0
}

export function generateUnsubscribeUrl(userId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const token = generateUnsubscribeToken(userId)
  return `${baseUrl}/api/email/unsubscribe?userId=${userId}&token=${token}`
}
