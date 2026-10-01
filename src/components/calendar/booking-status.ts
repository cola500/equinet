import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  XCircle,
  type LucideIcon,
} from "lucide-react"

// Single source of truth for how a booking status looks in the calendar.
// Each surface picks the variant that fits it, but the hue is shared so a given
// colour means the same status everywhere (block, badge, month dot, legend).
// Class strings are written out in full so Tailwind can detect them.
export interface BookingStatusStyle {
  label: string
  icon: LucideIcon | null
  /** Week/day calendar block: tinted background + coloured border + dark text */
  block: string
  /** Detail dialog badge */
  badge: string
  /** Month view booking chip */
  dot: string
  /** Legend swatch */
  swatch: string
}

export type BookingStatusKey =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "paid"

const STYLES: Record<BookingStatusKey, BookingStatusStyle> = {
  pending: {
    label: "Väntar på svar",
    icon: Clock,
    block: "bg-yellow-50 border-yellow-500 text-yellow-900",
    badge: "bg-yellow-100 text-yellow-800",
    dot: "bg-yellow-400",
    swatch: "bg-yellow-50 border-l-2 border-yellow-500",
  },
  confirmed: {
    label: "Bekräftad",
    icon: CheckCircle2,
    block: "bg-green-50 border-green-600 text-green-900",
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-400",
    swatch: "bg-green-50 border-l-2 border-green-600",
  },
  completed: {
    label: "Genomförd",
    icon: Check,
    block: "bg-blue-50 border-blue-600 text-blue-900",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-400",
    swatch: "bg-blue-50 border-l-2 border-blue-600",
  },
  cancelled: {
    label: "Avbokad",
    icon: XCircle,
    block: "bg-red-50 border-red-500 text-red-900",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-400",
    swatch: "bg-red-50 border-l-2 border-red-500",
  },
  no_show: {
    label: "Ej infunnit",
    icon: AlertTriangle,
    block: "bg-orange-50 border-orange-500 text-orange-900",
    badge: "bg-orange-100 text-orange-800",
    dot: "bg-orange-400",
    swatch: "bg-orange-50 border-l-2 border-orange-500",
  },
  paid: {
    label: "Betald",
    icon: CreditCard,
    block: "bg-emerald-100 border-emerald-600 text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
    swatch: "bg-emerald-100 border-l-2 border-emerald-600",
  },
}

/** Statuses shown in the calendar colour legend, in display order. */
export const LEGEND_STATUS_KEYS: BookingStatusKey[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "paid",
]

export function getLegendStatusStyle(key: BookingStatusKey): BookingStatusStyle {
  return STYLES[key]
}

/** Paid overrides the booking status. Unknown statuses fall back to grey. */
export function getBookingStatusStyle(
  status: string,
  isPaid: boolean
): BookingStatusStyle {
  if (isPaid) return STYLES.paid
  if (Object.hasOwn(STYLES, status) && status !== "paid") {
    return STYLES[status as BookingStatusKey]
  }
  return {
    label: status,
    icon: null,
    block: "bg-gray-100 border-gray-500 text-gray-900",
    badge: "bg-gray-100 text-gray-800",
    dot: "bg-gray-400",
    swatch: "bg-gray-100 border-l-2 border-gray-500",
  }
}
