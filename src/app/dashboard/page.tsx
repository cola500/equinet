import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.userType === "provider") {
    redirect("/provider/dashboard")
  }

  redirect("/providers")
}
