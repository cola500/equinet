import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", origin)
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  // Route via /dashboard so the server redirects per userType
  // (provider -> /provider/calendar, horse owner -> /hem).
  // Never hard-code a role-specific landing here.
  return NextResponse.redirect(new URL("/dashboard", origin))
}
