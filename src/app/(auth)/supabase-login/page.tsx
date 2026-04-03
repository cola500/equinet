import { redirect } from "next/navigation"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { SupabaseLoginForm } from "./SupabaseLoginForm"

export default async function SupabaseLoginPage() {
  const enabled = await isFeatureEnabled("supabase_auth_poc")

  if (!enabled) {
    redirect("/login")
  }

  return <SupabaseLoginForm />
}
