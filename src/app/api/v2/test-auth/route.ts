import { NextRequest, NextResponse } from "next/server"

import { isFeatureEnabled } from "@/lib/feature-flags"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  if (!(await isFeatureEnabled("supabase_auth_poc"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: "Ej inloggad via Supabase Auth" },
        { status: 401 }
      )
    }

    const appMetadata = user.app_metadata ?? {}

    return NextResponse.json({
      authMethod: "supabase",
      user: {
        id: user.id,
        email: user.email,
      },
      claims: {
        userType: appMetadata.userType,
        isAdmin: appMetadata.isAdmin,
        providerId: appMetadata.providerId,
        stableId: appMetadata.stableId,
      },
    })
  } catch (err) {
    logger.error("Supabase Auth PoC error", { error: err })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
