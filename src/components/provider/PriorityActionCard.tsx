import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { isToday, isTomorrow } from "date-fns"

export interface PriorityRoute {
  id: string
  routeName: string
  routeDate: string
  startTime: string
  status: string
  stops?: Array<{ status: string }>
}

export interface PriorityAction {
  type: "pending" | "route-today" | "route-tomorrow" | "onboarding"
  message: string
  href: string
  variant: "warning" | "success" | "info" | "default"
}

/**
 * Pure function that determines which priority action to show.
 * Returns the FIRST matching action (highest priority) or null.
 */
export function getPriorityAction(
  pendingCount: number,
  routes: PriorityRoute[],
  onboardingComplete: boolean
): PriorityAction | null {
  // Priority 1: Pending bookings
  if (pendingCount > 0) {
    return {
      type: "pending",
      message:
        pendingCount === 1
          ? "Du har 1 ny förfrågan"
          : `Du har ${pendingCount} nya förfrågningar`,
      href: "/provider/bookings",
      variant: "warning",
    }
  }

  // Priority 2: Route today
  const routeToday = routes.find((r) => {
    const date = new Date(r.routeDate + "T00:00:00")
    return isToday(date)
  })
  if (routeToday) {
    return {
      type: "route-today",
      message: "Du har en rutt idag",
      href: `/provider/routes/${routeToday.id}`,
      variant: "success",
    }
  }

  // Priority 3: Route tomorrow
  const routeTomorrow = routes.find((r) => {
    const date = new Date(r.routeDate + "T00:00:00")
    return isTomorrow(date)
  })
  if (routeTomorrow) {
    return {
      type: "route-tomorrow",
      message: "Du har en rutt imorgon",
      href: `/provider/routes/${routeTomorrow.id}`,
      variant: "info",
    }
  }

  // Priority 4: Incomplete onboarding
  if (!onboardingComplete) {
    return {
      type: "onboarding",
      message: "Slutför din profil",
      href: "/provider/profile",
      variant: "default",
    }
  }

  return null
}

const variantStyles: Record<PriorityAction["variant"], string> = {
  warning: "border-yellow-300 bg-yellow-50",
  success: "border-green-300 bg-green-50",
  info: "border-blue-300 bg-blue-50",
  default: "border-gray-300 bg-gray-50",
}

interface PriorityActionCardProps {
  pendingCount: number
  routes: PriorityRoute[]
  onboardingComplete: boolean
}

export function PriorityActionCard({
  pendingCount,
  routes,
  onboardingComplete,
}: PriorityActionCardProps) {
  const action = getPriorityAction(pendingCount, routes, onboardingComplete)
  if (!action) return null

  return (
    <Link href={action.href}>
      <Card
        className={`mb-6 border-2 hover:shadow-md transition-shadow cursor-pointer ${variantStyles[action.variant]}`}
      >
        <CardContent className="py-4">
          <p className="font-medium">{action.message}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
