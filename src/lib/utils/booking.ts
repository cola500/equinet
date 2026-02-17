/**
 * Utility functions for booking-related operations
 */

/**
 * Calculate end time in HH:MM format from start time and duration
 * @param startTime - Start time in HH:MM format (e.g., "10:00")
 * @param durationMinutes - Duration in minutes
 * @returns End time in HH:MM format (e.g., "11:30")
 */
export function calculateEndTimeHHMM(
  startTime: string,
  durationMinutes: number
): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60)
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}

/**
 * Calculate the end time of a booking based on start time and duration
 * @param startTime - ISO string of start time
 * @param durationMinutes - Duration in minutes
 * @returns ISO string of end time
 */
export function calculateBookingEndTime(
  startTime: string,
  durationMinutes: number
): string {
  const start = new Date(startTime)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return end.toISOString()
}

/**
 * Check if a booking time is in the past
 * @param bookingTime - ISO string of booking time
 * @returns true if booking is in the past
 */
export function isBookingInPast(bookingTime: string): boolean {
  const booking = new Date(bookingTime)
  const now = new Date()
  return booking < now
}

/**
 * Check if two bookings overlap
 * @param booking1Start - Start time of booking 1
 * @param booking1Duration - Duration of booking 1 in minutes
 * @param booking2Start - Start time of booking 2
 * @param booking2Duration - Duration of booking 2 in minutes
 * @returns true if bookings overlap
 */
export function doBookingsOverlap(
  booking1Start: string,
  booking1Duration: number,
  booking2Start: string,
  booking2Duration: number
): boolean {
  const b1Start = new Date(booking1Start)
  const b1End = new Date(b1Start.getTime() + booking1Duration * 60000)
  const b2Start = new Date(booking2Start)
  const b2End = new Date(b2Start.getTime() + booking2Duration * 60000)

  return b1Start < b2End && b2Start < b1End
}

/**
 * Format booking status to Swedish
 * @param status - Booking status
 * @returns Swedish status text
 */
export function formatBookingStatus(
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
): string {
  const statusMap = {
    pending: 'Väntande',
    confirmed: 'Bekräftad',
    completed: 'Genomförd',
    cancelled: 'Avbokad',
    no_show: 'Ej infunnit',
  }
  return statusMap[status]
}
