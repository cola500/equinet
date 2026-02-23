export type DueStatus = "overdue" | "upcoming" | "ok"

export interface HorseServiceRecord {
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  lastServiceDate: Date
  intervalWeeks: number
}

export interface DueForServiceResult {
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  lastServiceDate: string
  daysSinceService: number
  intervalWeeks: number
  dueDate: string
  daysUntilDue: number
  status: DueStatus
}

const MS_PER_DAY = 1000 * 60 * 60 * 24
const UPCOMING_THRESHOLD_DAYS = 14

/**
 * Resolve which interval to use (3-tier priority):
 * 1. Customer interval (highest) -- customer decides
 * 2. Provider override -- professional recommendation
 * 3. Service default (lowest) -- fallback
 * Returns null if no source has an interval.
 */
export function resolveInterval(
  defaultWeeks: number | null,
  providerOverride: number | null | undefined,
  customerInterval?: number | null | undefined
): number | null {
  return customerInterval ?? providerOverride ?? defaultWeeks ?? null
}

/**
 * Calculate due-for-service status for a single horse+service pair.
 * Pure function -- no Prisma dependency, injectable `now` for testing.
 */
export function calculateDueStatus(
  record: HorseServiceRecord,
  now: Date = new Date()
): DueForServiceResult {
  const lastServiceDate = new Date(record.lastServiceDate)
  const dueDateMs = lastServiceDate.getTime() + record.intervalWeeks * 7 * MS_PER_DAY
  const dueDate = new Date(dueDateMs)

  const daysSinceService = Math.floor(
    (now.getTime() - lastServiceDate.getTime()) / MS_PER_DAY
  )
  const daysUntilDue = Math.floor(
    (dueDate.getTime() - now.getTime()) / MS_PER_DAY
  )

  let status: DueStatus
  if (daysUntilDue < 0) {
    status = "overdue"
  } else if (daysUntilDue <= UPCOMING_THRESHOLD_DAYS) {
    status = "upcoming"
  } else {
    status = "ok"
  }

  return {
    horseId: record.horseId,
    horseName: record.horseName,
    serviceId: record.serviceId,
    serviceName: record.serviceName,
    lastServiceDate: lastServiceDate.toISOString(),
    daysSinceService,
    intervalWeeks: record.intervalWeeks,
    dueDate: dueDate.toISOString(),
    daysUntilDue,
    status,
  }
}
