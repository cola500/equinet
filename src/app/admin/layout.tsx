import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Server-side admin guard. Renders before any client admin page hydrates,
// so non-admin users never receive admin UI markup. Middleware also checks
// this, but admin pages are `"use client"` and can be served from the
// Vercel CDN before middleware runs in some prefetch flows.
export default async function AdminLayoutGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAdmin = (user?.app_metadata?.isAdmin as boolean) ?? false

  if (!user || !isAdmin) {
    redirect("/")
  }

  return <>{children}</>
}
