import { createHmac, timingSafeEqual } from "crypto"

/**
 * Verify Vercel cron request authenticity.
 *
 * Checks BOTH:
 * 1. Authorization: Bearer <CRON_SECRET> (timing-safe comparison)
 * 2. x-vercel-signature: HMAC-SHA256 of request body signed with CRON_SECRET
 *
 * For GET requests (no body), only the Bearer check is performed.
 * Vercel does not send x-vercel-signature for GET cron jobs.
 */
export function verifyCronAuth(
  authHeader: string | null,
  cronSecret: string | undefined,
  signatureHeader?: string | null,
  body?: string
): { ok: true } | { ok: false; status: 401 } {
  if (!cronSecret) {
    return { ok: false, status: 401 }
  }

  // Check 1: Bearer token (timing-safe to prevent side-channel leaks)
  const expected = `Bearer ${cronSecret}`
  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return { ok: false, status: 401 }
  }

  // Check 2: HMAC signature (only when signature header is present)
  if (signatureHeader && body !== undefined) {
    const expectedSignature = createHmac("sha256", cronSecret)
      .update(body)
      .digest("hex")

    if (
      signatureHeader.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
    ) {
      return { ok: false, status: 401 }
    }
  }

  return { ok: true }
}
