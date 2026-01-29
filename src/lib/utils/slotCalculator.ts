/**
 * Time slot calculation utilities for booking availability
 */

export interface TimeSlot {
  startTime: string // "HH:mm" format
  endTime: string // "HH:mm" format
  isAvailable: boolean
}

export interface BookedSlot {
  startTime: string // "HH:mm" format
  endTime: string // "HH:mm" format
}

interface CalculateAvailableSlotsParams {
  openingTime: string // "HH:mm" format
  closingTime: string // "HH:mm" format
  bookedSlots: BookedSlot[]
  serviceDurationMinutes: number
  date?: string // "YYYY-MM-DD" format - the date for these slots
  currentDateTime?: Date // Current date/time for filtering past slots
  slotInterval?: number // Minutes between slot starts (defaults to serviceDurationMinutes)
}

/**
 * Convert "HH:mm" string to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes from midnight to "HH:mm" string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

/**
 * Check if two time ranges overlap
 * Range 1: [start1, end1)
 * Range 2: [start2, end2)
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Check if a slot is in the past
 */
function isSlotInPast(
  slotDate: string,
  slotStartTime: string,
  currentDateTime: Date
): boolean {
  // Parse slot date and time
  const [year, month, day] = slotDate.split("-").map(Number)
  const [hours, minutes] = slotStartTime.split(":").map(Number)

  const slotDateTime = new Date(year, month - 1, day, hours, minutes)
  return slotDateTime < currentDateTime
}

/**
 * Calculate available time slots for a day
 *
 * @param params - Opening/closing times, booked slots, and service duration
 * @returns Array of time slots with availability status
 */
export function calculateAvailableSlots(
  params: CalculateAvailableSlotsParams
): TimeSlot[] {
  const {
    openingTime,
    closingTime,
    bookedSlots,
    serviceDurationMinutes,
    date,
    currentDateTime,
    slotInterval = serviceDurationMinutes, // Default: slot interval = service duration
  } = params

  const openingMinutes = timeToMinutes(openingTime)
  const closingMinutes = timeToMinutes(closingTime)

  // No slots if opening equals or exceeds closing
  if (openingMinutes >= closingMinutes) {
    return []
  }

  const slots: TimeSlot[] = []

  // Generate slots at slotInterval intervals
  for (
    let startMinutes = openingMinutes;
    startMinutes + serviceDurationMinutes <= closingMinutes;
    startMinutes += slotInterval
  ) {
    const endMinutes = startMinutes + serviceDurationMinutes
    const startTime = minutesToTime(startMinutes)

    // Check if this slot overlaps with any booked slot
    const isBookedConflict = bookedSlots.some((booked) => {
      const bookedStart = timeToMinutes(booked.startTime)
      const bookedEnd = timeToMinutes(booked.endTime)
      return rangesOverlap(startMinutes, endMinutes, bookedStart, bookedEnd)
    })

    // Check if slot is in the past (only if date and currentDateTime provided)
    const isPast =
      date && currentDateTime
        ? isSlotInPast(date, startTime, currentDateTime)
        : false

    slots.push({
      startTime,
      endTime: minutesToTime(endMinutes),
      isAvailable: !isBookedConflict && !isPast,
    })
  }

  return slots
}
