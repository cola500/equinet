import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Clock, Check } from "lucide-react"
import type { DueForServiceResult } from "@/domain/due-for-service/DueForServiceCalculator"

/**
 * Per-horse due-for-service badge: overdue (red), upcoming (amber) or "I tid"
 * (green). Renders nothing when the horse has no interval/due record.
 * Shared by /hem and /customer/horses.
 */
export function DueStatusBadge({
  dueItems,
  horseId,
}: {
  dueItems: DueForServiceResult[]
  horseId: string
}) {
  const item = dueItems.find((i) => i.horseId === horseId)
  if (!item) return null

  if (item.status === "overdue") {
    const days = Math.abs(item.daysUntilDue)
    const label = days === 1 ? "1 dag" : `${days} dagar`
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 gap-1">
        <AlertTriangle className="h-3 w-3" />
        <span>{item.serviceName}: {label} försenad</span>
      </Badge>
    )
  }

  if (item.status === "upcoming") {
    const days = item.daysUntilDue
    const label = days === 0 ? "Idag" : days === 1 ? "1 dag kvar" : `${days} dagar kvar`
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 gap-1">
        <Clock className="h-3 w-3" />
        <span>{item.serviceName}: {label}</span>
      </Badge>
    )
  }

  return (
    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 gap-1">
      <Check className="h-3 w-3" />
      <span>I tid</span>
    </Badge>
  )
}
