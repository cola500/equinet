import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { passwordRequirements } from "@/lib/validations/auth"
import { z } from "zod"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Nuvarande lösenord krävs"),
  newPassword: z.string()
    .min(passwordRequirements.minLength, "Lösenordet måste vara minst 8 tecken")
    .max(72, "Lösenordet är för långt")
    .regex(passwordRequirements.hasUppercase, "Lösenordet måste innehålla minst en stor bokstav")
    .regex(passwordRequirements.hasLowercase, "Lösenordet måste innehålla minst en liten bokstav")
    .regex(passwordRequirements.hasNumber, "Lösenordet måste innehålla minst en siffra")
    .regex(passwordRequirements.hasSpecialChar, "Lösenordet måste innehålla minst ett specialtecken"),
}).strict()

export async function POST(request: NextRequest) {
  try {
    // Auth — must be logged in
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Rate limit (reuses passwordReset limiter: 3 per hour per IP)
    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.passwordReset(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många försök. Vänta innan du försöker igen." },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    // Parse + validate body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validation = changePasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: validation.error.issues },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Verify current password via Supabase anon client
    // (separate client so existing session is not affected)
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: verifyError } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (verifyError) {
      return NextResponse.json(
        { error: "Felaktigt nuvarande lösenord" },
        { status: 401 }
      )
    }

    // Update password via admin API
    const adminClient = createSupabaseAdminClient()
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )
    if (updateError) {
      logger.error("Failed to update password via admin API", new Error(updateError.message))
      return NextResponse.json(
        { error: "Kunde inte uppdatera lösenordet. Försök igen." },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Lösenordet har uppdaterats." })
  } catch (error) {
    logger.error("Change password error", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
