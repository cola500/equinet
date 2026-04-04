import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-server"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (session.user.userType === "provider") {
    redirect("/provider/dashboard")
  }

  redirect("/providers")
}
