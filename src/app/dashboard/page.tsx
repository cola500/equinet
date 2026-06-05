import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-server"
import { getFeatureFlags } from "@/lib/feature-flags"
import { isDemoModeWithFlags } from "@/lib/demo-mode"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (session.user.userType === "provider") {
    // Demo mode: land providers on the calendar (the strongest, most visual
    // workspace) instead of the counter-heavy dashboard. Full mode unchanged.
    const flags = await getFeatureFlags()
    redirect(isDemoModeWithFlags(flags) ? "/provider/calendar" : "/provider/dashboard")
  }

  // Horse owners land on their home (their horses), not the public search.
  redirect("/hem")
}
