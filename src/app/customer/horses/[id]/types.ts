export interface Horse {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
  registrationNumber: string | null
  microchipNumber: string | null
  photoUrl: string | null
}

export interface TimelineItem {
  type: "booking" | "note"
  id: string
  date: string
  title: string
  providerName?: string
  status?: string
  notes?: string | null
  category?: string
  content?: string | null
  authorName?: string
}

export interface ServiceInterval {
  id: string
  serviceId: string
  intervalWeeks: number
  service: {
    id: string
    name: string
    recommendedIntervalWeeks: number | null
  }
}

export interface AvailableService {
  id: string
  name: string
  recommendedIntervalWeeks: number | null
}

export const GENDER_LABELS: Record<string, string> = {
  mare: "Sto",
  gelding: "Valack",
  stallion: "Hingst",
}

export const CATEGORY_OPTIONS = [
  { value: "veterinary", label: "Veterinär", color: "bg-blue-100 text-blue-800" },
  { value: "farrier", label: "Hovslagare", color: "bg-orange-100 text-orange-800" },
  { value: "general", label: "Allmänt", color: "bg-gray-100 text-gray-800" },
  { value: "injury", label: "Skada", color: "bg-red-100 text-red-800" },
  { value: "medication", label: "Medicin", color: "bg-purple-100 text-purple-800" },
] as const

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c])
)

export const emptyNoteForm = {
  category: "",
  title: "",
  content: "",
  noteDate: new Date().toISOString().split("T")[0],
}

export const emptyHorseForm = {
  name: "",
  breed: "",
  birthYear: "",
  color: "",
  gender: "",
  specialNeeds: "",
  registrationNumber: "",
  microchipNumber: "",
}
