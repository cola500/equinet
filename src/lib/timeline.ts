// Timeline merge utility for horse health timeline
// Combines bookings and notes into a sorted timeline

export interface TimelineBooking {
  type: "booking"
  id: string
  date: string // ISO date
  title: string // Service name
  providerName: string
  status: string
  notes: string | null
}

export interface TimelineNote {
  type: "note"
  id: string
  date: string // ISO date
  title: string
  category: string
  content: string | null
  authorName: string
}

export type TimelineItem = TimelineBooking | TimelineNote

/**
 * Merge bookings and notes into a single sorted timeline.
 * Most recent items first.
 */
export function mergeTimeline(
  bookings: TimelineBooking[],
  notes: TimelineNote[]
): TimelineItem[] {
  const all: TimelineItem[] = [...bookings, ...notes]
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
