// Utility functions for data export (JSON -> CSV conversion)

/**
 * Escape a CSV field value.
 * Wraps in double quotes if the value contains commas, newlines, or quotes.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of flat objects to CSV string.
 * Uses the keys from the first object as headers.
 */
export function objectsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""

  const headers = Object.keys(rows[0])
  const headerLine = headers.map(escapeCsvField).join(",")
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(",")
  )

  return [headerLine, ...dataLines].join("\n")
}

/**
 * Flatten booking data for CSV export.
 */
export interface FlatBooking {
  bookingId: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  serviceName: string
  providerName: string
  horseName: string
  customerNotes: string
}

export function flattenBookings(
  bookings: Array<{
    id: string
    bookingDate: string | Date
    startTime: string
    endTime: string
    status: string
    service?: { name: string } | null
    provider?: { businessName: string } | null
    horse?: { name: string } | null
    horseName?: string | null
    customerNotes?: string | null
  }>
): FlatBooking[] {
  return bookings.map((b) => ({
    bookingId: b.id,
    bookingDate:
      b.bookingDate instanceof Date
        ? b.bookingDate.toISOString().split("T")[0]
        : String(b.bookingDate).split("T")[0],
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    serviceName: b.service?.name || "",
    providerName: b.provider?.businessName || "",
    horseName: b.horse?.name || b.horseName || "",
    customerNotes: b.customerNotes || "",
  }))
}

/**
 * Flatten horse notes for CSV export.
 */
export interface FlatNote {
  noteId: string
  horseName: string
  category: string
  title: string
  content: string
  noteDate: string
  authorName: string
}

export function flattenNotes(
  notes: Array<{
    id: string
    category: string
    title: string
    content?: string | null
    noteDate: string | Date
    horse?: { name: string } | null
    author?: { firstName: string; lastName: string } | null
  }>,
  horseName?: string
): FlatNote[] {
  return notes.map((n) => ({
    noteId: n.id,
    horseName: n.horse?.name || horseName || "",
    category: n.category,
    title: n.title,
    content: n.content || "",
    noteDate:
      n.noteDate instanceof Date
        ? n.noteDate.toISOString().split("T")[0]
        : String(n.noteDate).split("T")[0],
    authorName: n.author
      ? `${n.author.firstName} ${n.author.lastName}`
      : "",
  }))
}

// --- User profile ---

function formatDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().split("T")[0]
    : String(value).split("T")[0]
}

export interface FlatUserProfile {
  email: string
  firstName: string
  lastName: string
  phone: string
  userType: string
  city: string
  address: string
  createdAt: string
}

export function flattenUserProfile(user: {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  userType: string
  city?: string | null
  address?: string | null
  createdAt: Date | string
}): FlatUserProfile {
  return {
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
    userType: user.userType,
    city: user.city || "",
    address: user.address || "",
    createdAt: formatDate(user.createdAt),
  }
}

// --- Horses ---

export interface FlatHorse {
  name: string
  breed: string
  birthYear: number | string
  color: string
  gender: string
  specialNeeds: string
  createdAt: string
}

export function flattenHorses(
  horses: Array<{
    id: string
    name: string
    breed?: string | null
    birthYear?: number | null
    color?: string | null
    gender?: string | null
    specialNeeds?: string | null
    createdAt: Date | string
  }>
): FlatHorse[] {
  return horses.map((h) => ({
    name: h.name,
    breed: h.breed || "",
    birthYear: h.birthYear ?? "",
    color: h.color || "",
    gender: h.gender || "",
    specialNeeds: h.specialNeeds || "",
    createdAt: formatDate(h.createdAt),
  }))
}

// --- Reviews ---

export interface FlatReview {
  rating: number
  comment: string
  reply: string
  repliedAt: string
  providerName: string
  bookingDate: string
  serviceName: string
  createdAt: string
}

export function flattenReviews(
  reviews: Array<{
    id: string
    rating: number
    comment?: string | null
    reply?: string | null
    repliedAt?: Date | string | null
    createdAt: Date | string
    provider?: { businessName: string } | null
    booking?: {
      bookingDate: Date | string
      service?: { name: string } | null
    } | null
  }>
): FlatReview[] {
  return reviews.map((r) => ({
    rating: r.rating,
    comment: r.comment || "",
    reply: r.reply || "",
    repliedAt: r.repliedAt ? formatDate(r.repliedAt) : "",
    providerName: r.provider?.businessName || "",
    bookingDate: r.booking ? formatDate(r.booking.bookingDate) : "",
    serviceName: r.booking?.service?.name || "",
    createdAt: formatDate(r.createdAt),
  }))
}

// --- Provider ---

export interface FlatProvider {
  businessName: string
  description: string
  address: string
  city: string
  postalCode: string
  serviceAreaKm: number | string
  isVerified: boolean
  createdAt: string
}

export function flattenProvider(provider: {
  id: string
  businessName: string
  description?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  serviceAreaKm?: number | null
  isVerified: boolean
  createdAt: Date | string
}): FlatProvider {
  return {
    businessName: provider.businessName,
    description: provider.description || "",
    address: provider.address || "",
    city: provider.city || "",
    postalCode: provider.postalCode || "",
    serviceAreaKm: provider.serviceAreaKm ?? "",
    isVerified: provider.isVerified,
    createdAt: formatDate(provider.createdAt),
  }
}

// --- Provider services ---

export interface FlatProviderService {
  name: string
  description: string
  price: number
  durationMinutes: number
  isActive: boolean
}

export function flattenProviderServices(
  services: Array<{
    id: string
    name: string
    description?: string | null
    price: number
    durationMinutes: number
    isActive: boolean
  }>
): FlatProviderService[] {
  return services.map((s) => ({
    name: s.name,
    description: s.description || "",
    price: s.price,
    durationMinutes: s.durationMinutes,
    isActive: s.isActive,
  }))
}
