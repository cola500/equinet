import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-server"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (session.user.userType === "provider") {
    // Providers always land on the calendar (the strongest, most visual
    // workspace) instead of the counter-heavy dashboard, in all modes.
    redirect("/provider/calendar")
  }

  // Horse owners land on their home (their horses), not the public search.
  redirect("/hem")
}
