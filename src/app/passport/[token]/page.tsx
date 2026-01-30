"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// --- Types ---

interface HorseInfo {
  name: string
  breed: string | null
  birthYear: number | null
  age: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
}

interface TimelineItem {
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

interface PassportData {
  horse: HorseInfo
  timeline: TimelineItem[]
  expiresAt: string
}

// --- Constants ---

const GENDER_LABELS: Record<string, string> = {
  mare: "Sto",
  gelding: "Valack",
  stallion: "Hingst",
}

const CATEGORY_OPTIONS: Record<string, { label: string; color: string }> = {
  veterinary: { label: "Veterinar", color: "bg-blue-100 text-blue-800" },
  farrier: { label: "Hovslagare", color: "bg-orange-100 text-orange-800" },
  medication: { label: "Medicin", color: "bg-purple-100 text-purple-800" },
}

// --- Page ---

export default function PassportPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PassportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPassport() {
      try {
        const response = await fetch(`/api/passport/${token}`)
        if (!response.ok) {
          const body = await response.json()
          setError(body.error || "Hastpasset hittades inte")
          return
        }
        const passportData = await response.json()
        setData(passportData)
      } catch {
        setError("Kunde inte ladda hastpasset")
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchPassport()
    }
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-gray-600">Laddar hastpass...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-2">
              Hastpass inte tillgangligt
            </p>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const { horse, timeline, expiresAt } = data
  const expiresDate = new Date(expiresAt).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8 print:mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Hastpass</h1>
          <p className="text-gray-500 text-sm mt-1">
            Delad fran Equinet &middot; Giltig till {expiresDate}
          </p>
        </div>

        {/* Horse info card */}
        <Card className="mb-8 print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="text-2xl">{horse.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {horse.breed && (
                <div>
                  <span className="text-gray-500">Ras:</span>{" "}
                  <span className="font-medium">{horse.breed}</span>
                </div>
              )}
              {horse.color && (
                <div>
                  <span className="text-gray-500">Farg:</span>{" "}
                  <span className="font-medium">{horse.color}</span>
                </div>
              )}
              {horse.gender && (
                <div>
                  <span className="text-gray-500">Kon:</span>{" "}
                  <span className="font-medium">
                    {GENDER_LABELS[horse.gender] || horse.gender}
                  </span>
                </div>
              )}
              {horse.birthYear && (
                <div>
                  <span className="text-gray-500">Fodelseår:</span>{" "}
                  <span className="font-medium">
                    {horse.birthYear}
                    {horse.age !== null && ` (${horse.age} år)`}
                  </span>
                </div>
              )}
              {horse.specialNeeds && (
                <div className="col-span-2 bg-amber-50 p-3 rounded">
                  <span className="text-amber-800 font-medium">
                    Specialbehov:
                  </span>{" "}
                  <span className="text-amber-700">{horse.specialNeeds}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <h2 className="text-xl font-semibold mb-4">Vardhistorik</h2>

        {timeline.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-600">Ingen historik att visa.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {timeline.map((item) => (
              <PassportTimelineCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400 print:mt-6">
          <p>
            Detta hastpass genererades av Equinet. Informationen ar delad av
            hastens agare.
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Timeline card for passport ---

function PassportTimelineCard({ item }: { item: TimelineItem }) {
  const date = new Date(item.date)
  const dateStr = date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  if (item.type === "booking") {
    return (
      <Card className="print:shadow-none print:border">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-600">{item.providerName}</p>
              {item.notes && (
                <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-sm text-gray-500">{dateStr}</p>
              <Badge
                variant="outline"
                className="mt-1 bg-green-50 text-green-700 border-green-200"
              >
                Bokning
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Note
  const cat = item.category ? CATEGORY_OPTIONS[item.category] : null

  return (
    <Card className="print:shadow-none print:border">
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{item.title}</p>
            {item.content && (
              <p className="text-sm text-gray-600 mt-1">{item.content}</p>
            )}
            {item.authorName && (
              <p className="text-xs text-gray-400 mt-1">
                Av {item.authorName}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-sm text-gray-500">{dateStr}</p>
            {cat && (
              <Badge variant="outline" className={`mt-1 ${cat.color}`}>
                {cat.label}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
